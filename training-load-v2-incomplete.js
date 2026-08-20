/**
 * Incomplete Data Representation V1
 *
 * Incomplete Data Representation V1. App Beta loads this same file.
 * Does not change CV/MET/NM/MECH formulas or LOAD_V2_PARAMS.
 * Converts user-stated ranges / approx / summaries into velocity bounds
 * the frozen scorer can consume.
 *
 * Does not invent per-rep times. Does not invent rest/HR/RPE.
 * Recalled rest on the original session is copied onto generated
 * velocity-bound parts so range/summary sessions can be scored with rest.
 */

(function (global) {
"use strict";

const __v2Proto =
  typeof require === "function" ? require("./training-load-v2-prototype") : globalThis.TrainingLoadV2;
const __v2RecoveryInc =
  typeof require === "function"
    ? require("./training-load-v2-recovery")
    : globalThis.TrainingLoadV2Recovery;
const {
  LOAD_V2_PARAMS,
  analyzeSession,
  toLevel,
  orderString,
  round1,
} = __v2Proto;
const { midpointInSampledRange } = __v2RecoveryInc;

const DIMS = ["CV", "MET", "NM", "MECH"];

function parsePaceKm(text) {
  if (text == null || text === "") return null;
  const raw = String(text);
  const approximate = /约|approx|~/i.test(raw);
  const m = raw.replace(/／/g, "/").match(/(\d+)\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*km/i);
  if (!m) return null;
  const secPerKm = Number(m[1]) * 60 + Number(m[2]);
  if (!(secPerKm > 0)) return null;
  return { secPerKm, mps: 1000 / secPerKm, approximate, text: raw };
}

function workShell(spec) {
  return {
    activity: "run",
    role: null,
    rest_s: null,
    reps: 1,
    block: "work",
    ...spec,
  };
}

function repeatWork(count, spec) {
  return Array.from({ length: count }, () => workShell(spec));
}

function attachRecalledRecovery(parts, session) {
  const origWork = (session.parts || []).filter((p) => p.block === "work" || !p.block);
  const n = parts.length;
  const per = session.recovery_after_rep_sec;
  return parts.map((p, i) => {
    const next = { ...p };
    const fromOrig = origWork[i];
    if (fromOrig && fromOrig.rest_s != null) {
      next.rest_s = fromOrig.rest_s;
      if (fromOrig.restApproximate != null) next.restApproximate = fromOrig.restApproximate;
      if (fromOrig.restProvenance) next.restProvenance = fromOrig.restProvenance;
    } else if (Array.isArray(per)) {
      next.rest_s = per[i] == null ? 0 : per[i];
      next.restApproximate = true;
      next.restProvenance = session.recoveryProvenance || "user_recalled_approx";
    } else if (session.recovery_duration_sec != null && Number(session.recovery_duration_sec) >= 0) {
      next.rest_s = i < n - 1 ? session.recovery_duration_sec : 0;
      next.restApproximate = true;
      next.restProvenance = session.recoveryProvenance || "user_recalled_approx";
    }
    return next;
  });
}

function allWorkHaveExactSplits(session) {
  const parts = (session.parts || []).filter((p) => p.block === "work" || !p.block);
  if (!parts.length) return false;
  return parts.every(
    (p) =>
      Number(p.distance_m) > 0 &&
      Number(p.duration_s) > 0 &&
      !p.durationApproximate &&
      !p.paceApproximate &&
      !p.derived
  );
}

function classifyValueKind(session) {
  if (session.rep_time_range_sec && session.rep_distance_m && session.reps) return "range";
  if (
    Array.isArray(session.known_rep_times) &&
    session.known_rep_times.length &&
    (session.unknown_rep_time_count > 0 || session.known_rep_times.some((t) => t.repIndex == null))
  ) {
    return "summary";
  }
  if (session.paceApproximate || (session.pace_text && /约/.test(session.pace_text) && session.rep_distance_m == null)) {
    return "approx";
  }
  const work = (session.parts || []).filter((p) => p.block === "work" || !p.block);
  const userApproxDuration =
    work.some((p) => p.durationApproximate) &&
    (!session.pace_text || /约/.test(session.pace_text) || session.paceApproximate);
  if (work.some((p) => p.paceApproximate || p.derived) || userApproxDuration) return "approx";
  if (allWorkHaveExactSplits(session)) return "exact";
  if (work.some((p) => Number(p.duration_s) > 0 || Number(p.distance_m) > 0)) return "exact";
  return "unknown";
}

function provenanceForKind(kind, extra) {
  if (extra) return extra;
  if (kind === "exact") return "exact";
  if (kind === "range") return "rangeOnly";
  if (kind === "approx") return extra || "userApprox";
  if (kind === "summary") return "summaryOnly";
  return "unknown";
}

function rangeVariants(session) {
  const n = Number(session.reps);
  const dist = Number(session.rep_distance_m);
  const loT = Number(session.rep_time_range_sec.min);
  const hiT = Number(session.rep_time_range_sec.max);
  const slowT = Math.max(loT, hiT);
  const fastT = Math.min(loT, hiT);
  const midT = (slowT + fastT) / 2;
  const note =
    `${n}×${dist}m at velocity bounds ${round4(dist / slowT)}–${round4(dist / fastT)} m/s ` +
    `(${dist}m / ${slowT}–${fastT}s). Same bound applied to every rep; no per-rep times synthesized.`;
  function variant(bound, t) {
    const v = dist / t;
    return {
      bound,
      parts: repeatWork(n, {
        distance_m: dist,
        velocity_mps: v,
        valueKind: "range",
        provenance: "rangeOnly",
        derived: true,
        derivedDuration: true,
      }),
      derived: [{ field: "velocity_mps", from: `distance ${dist}m / bound time ${t}s`, bound }],
    };
  }
  return {
    valueKind: "range",
    provenance: "rangeOnly",
    note,
    variants: [variant("low", slowT), variant("mid", midT), variant("high", fastT)],
  };
}

function summaryVariants(session) {
  const n = Number(session.reps) || (session.parts || []).length;
  const dist = Number(session.rep_distance_m);
  const times = session.known_rep_times || [];
  const secs = times.map((t) => Number(t.duration_s)).filter((x) => x > 0);
  const slowT = Math.max(...secs);
  const fastT = Math.min(...secs);
  const note =
    `${n}×${dist}m velocity-exposure envelope from known times ${fastT}–${slowT}s. ` +
    `Unknown reps are not filled in; the same bound is applied to all ${n} reps for a range only.`;
  function variant(bound, t) {
    return {
      bound,
      parts: repeatWork(n, {
        distance_m: dist,
        velocity_mps: dist / t,
        valueKind: "summary",
        provenance: "summaryOnly",
        derived: true,
        derivedDuration: true,
      }),
      derived: [{ field: "velocity_mps", from: `summary bound ${t}s`, bound }],
    };
  }
  return {
    valueKind: "summary",
    provenance: "summaryOnly",
    note,
    variants: [variant("low", slowT), variant("high", fastT)],
  };
}

function approxVariants(session) {
  const pace = parsePaceKm(session.pace_text);
  const work = (session.parts || []).filter((p) => p.block === "work" || !p.block);
  const derived = [];
  const parts = work.map((p) => {
    const next = { ...p, valueKind: "approx", provenance: "userApprox" };
    if (pace && Number(p.duration_s) > 0 && !(Number(p.distance_m) > 0)) {
      next.velocity_mps = pace.mps;
      next.distance_m = round1(pace.mps * Number(p.duration_s) * 10) / 10;
      next.derived = true;
      next.provenance = "derivedFromApprox";
      derived.push({
        field: "distance_m",
        value: next.distance_m,
        from: `duration ${p.duration_s}s × ${session.pace_text}`,
      });
    } else if (pace && Number(p.distance_m) > 0 && !(Number(p.duration_s) > 0)) {
      next.velocity_mps = pace.mps;
      next.duration_s = Number(p.distance_m) / pace.mps;
      next.derived = true;
      next.provenance = "derivedFromApprox";
      derived.push({
        field: "duration_s",
        value: next.duration_s,
        from: `distance ${p.distance_m}m / ${session.pace_text}`,
      });
    } else if (p.durationApproximate && Number(p.duration_s) > 0 && Number(p.distance_m) > 0) {
      next.provenance = "userApprox";
    }
    return next;
  });
  const provenance = parts.some((p) => p.provenance === "derivedFromApprox") ? "derivedFromApprox" : "userApprox";
  return {
    valueKind: "approx",
    provenance,
    note: pace
      ? `Approx pace ${session.pace_text} used as velocity. Derived fields marked derived=true.`
      : "Approximate durations used as provided; not expanded into fake precision.",
    variants: [{ bound: "mid", parts, derived }],
  };
}

function exactPassthrough(session) {
  const parts = (session.parts || []).map((p) => ({
    ...p,
    valueKind: "exact",
    provenance: "exact",
    derived: false,
  }));
  return {
    valueKind: "exact",
    provenance: "exact",
    note: "Per-rep exact splits as recorded.",
    variants: [{ bound: "mid", parts, derived: [] }],
  };
}

function representIncompleteSession(session) {
  const kind = classifyValueKind(session);
  let rep;
  if (kind === "range") rep = rangeVariants(session);
  else if (kind === "summary") rep = summaryVariants(session);
  else if (kind === "approx") rep = approxVariants(session);
  else if (kind === "exact") rep = exactPassthrough(session);
  else {
    rep = {
      valueKind: "unknown",
      provenance: "unknown",
      note: "No usable velocity representation; scorer will see missing pace/distance.",
      variants: [{ bound: "mid", parts: session.parts || [], derived: [] }],
    };
  }
  if (rep && Array.isArray(rep.variants)) {
    rep.variants = rep.variants.map((v) => ({
      ...v,
      parts: attachRecalledRecovery(v.parts || [], session),
    }));
  }
  return rep;
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

function averageScores(scoreList) {
  const out = {};
  for (const d of DIMS) {
    const xs = scoreList.map((s) => s[d]);
    out[d] = round1(xs.reduce((a, b) => a + b, 0) / xs.length);
  }
  return out;
}

function scoreRangeFrom(results) {
  const range = {};
  for (const d of DIMS) {
    const xs = results.map((r) => r.scores[d]);
    range[d] = { low: Math.min(...xs), high: Math.max(...xs) };
  }
  return range;
}

function aggregateRecoveryBoundScores(variantResults) {
  const bounds = variantResults.map((v) => v.result.recovery && v.result.recovery.boundScores);
  if (!bounds.length || bounds.some((b) => !b)) return null;
  const lo = averageScores(bounds.map((b) => b.lo));
  const mid = averageScores(bounds.map((b) => b.mid));
  const hi = averageScores(bounds.map((b) => b.hi));
  return {
    boundScores: { lo, mid, hi },
    scoreRange: scoreRangeFrom([{ scores: lo }, { scores: mid }, { scores: hi }]),
    invariant: midpointInSampledRange(lo, mid, hi),
  };
}

function analyzeIncomplete(session, athlete, P = LOAD_V2_PARAMS) {
  const representation = representIncompleteSession(session);
  const variantResults = representation.variants.map((v) => {
    const tagged = {
      ...session,
      parts: v.parts,
      valueKind: representation.valueKind,
      provenance: representation.provenance,
      incompleteBound: v.bound,
    };
    const result = analyzeSession(tagged, athlete, P);
    return { bound: v.bound, derived: v.derived, result };
  });

  const scoreList = variantResults.map((v) => v.result.scores);
  const scores = averageScores(scoreList);
  const range = scoreRangeFrom(variantResults.map((v) => v.result));
  const mid =
    variantResults.find((v) => v.bound === "mid") ||
    variantResults[0];
  const confSource = mid.result;
  const cuts = P.levelCuts;
  const levels = {
    CV: toLevel(scores.CV, cuts),
    MET: toLevel(scores.MET, cuts),
    NM: toLevel(scores.NM, cuts),
    MECH: toLevel(scores.MECH, cuts),
  };
  const hasSpan = DIMS.some((d) => range[d].high - range[d].low > 0.15);

  const recAgg = aggregateRecoveryBoundScores(variantResults);
  const recovery = confSource.recovery
    ? {
        ...confSource.recovery,
        velocityBoundForStates: mid.bound,
        ...(recAgg
          ? {
              boundScores: recAgg.boundScores,
              scoreRange: recAgg.scoreRange,
              invariant: recAgg.invariant,
            }
          : {}),
      }
    : null;

  return {
    scores,
    scoreRange: hasSpan ? range : null,
    levels,
    order: orderString(scores, P.orderEpsilon),
    confidence: confSource.confidence,
    confidenceBreakdown: confSource.confidenceBreakdown,
    confidenceByDimension: confSource.confidenceByDimension,
    dataQualityFlags: confSource.dataQualityFlags,
    components: confSource.components,
    valueKind: representation.valueKind,
    provenance: representation.provenance,
    representationNote: representation.note,
    derivedFields: representation.variants.flatMap((v) => v.derived || []),
    variantScores: variantResults.map((v) => ({ bound: v.bound, scores: v.result.scores })),
    displayPrecision: representation.valueKind === "exact" ? "point" : hasSpan ? "range" : "midpoint",
    recovery,
  };
}

function fabricatedPerRepTimes(session) {
  const rep = representIncompleteSession(session);
  if (rep.valueKind !== "range" && rep.valueKind !== "summary") return false;
  const durations = new Set();
  for (const v of rep.variants) {
    for (const p of v.parts) {
      if (p.duration_s != null) durations.add(Number(p.duration_s));
    }
  }
  return durations.size >= Number(session.reps);
}

const TrainingLoadV2Incomplete = {
  parsePaceKm,
  classifyValueKind,
  representIncompleteSession,
  analyzeIncomplete,
  fabricatedPerRepTimes,
};

if (typeof module === "object" && module.exports) {
  module.exports = TrainingLoadV2Incomplete;
}
global.TrainingLoadV2Incomplete = TrainingLoadV2Incomplete;
})(typeof globalThis !== "undefined" ? globalThis : this);
