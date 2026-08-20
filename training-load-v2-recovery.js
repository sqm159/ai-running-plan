/**
 * Recovery State Model V1
 *
 * Replaces old rest coupling in the prototype scorer only:
 *   - rest_s × cvRestIntensity  (removed)
 *   - leftoverAcid × metIncompleteK on current/next glyco term (replaced)
 *   - restQuality(rest_after) multiplier on current-bout NM (replaced)
 *
 * Does not change vmax, CV intensity curve, NM velocity curve, MECH,
 * incomplete-data representation, or the official app.
 *
 * Timing (required):
 *   enter bout i with (M, Q, C) from previous rest
 *   → score bout i
 *   → apply work disturbance
 *   → recover using rest AFTER this bout
 *   → that state is the start of bout i+1
 * Rest after bout i must not rewrite bout i's already-scored load.
 *
 * All RECOVERY_V1_PARAMS values are heuristic / needs calibration.
 */

(function (global) {
"use strict";

const RECOVERY_V1_PARAMS = {
  /* time constants (s) — heuristic / needs calibration */
  tauM: 150,
  tauC: 70,
  tauQ: 120,
  tauQWork: 30, /* 25–35s band; 30s first pass. heuristic / needs calibration */

  /* coupling — heuristic / needs calibration */
  kappaM: 0.5,
  kappaC: 0.2,
  qMin: 0.55,
  deltaQ: 0.15,
  qRelStart: 0.85,

  /*
   * Residual impulse reads BOTH glycolytic work and severe-domain work
   * from the existing MET terms. Does not modify those curves.
   * heuristic / needs calibration
   */
  piMGlycoRef: 0.2,
  piMSevereRef: 0.15,
  piCRef: 28,
};

function clip01(x) {
  return Math.max(0, Math.min(1, x));
}

function initialRecoveryState() {
  return { M: 0, Q: 1, C: 0 };
}

function restPriorFromWorkDuration(workDurationS) {
  const W = Number(workDurationS) || 0;
  if (W > 0 && W < 15) {
    return { lo: 120, mid: 180, hi: 240, band: "<15s" };
  }
  if (W >= 60 && W <= 80) {
    return { lo: 45, mid: 75, hi: 120, band: "60-80s" };
  }
  if (W > 80 && W <= 100) {
    return { lo: 90, mid: 150, hi: 240, band: "80-100s" };
  }
  if (W >= 130 && W <= 180) {
    return { lo: 90, mid: 150, hi: 210, band: "~150s" };
  }
  const mid = Math.max(60, Math.min(240, Math.round(2.5 * Math.max(W, 1))));
  return {
    lo: Math.max(45, Math.round(mid * 0.6)),
    mid,
    hi: Math.min(360, Math.round(mid * 1.6)),
    band: "fallback",
  };
}

function pickBound(lo, mid, hi, restBound) {
  if (restBound === "lo") return lo;
  if (restBound === "hi") return hi;
  return mid;
}

function hasSessionLevelRest(session) {
  if (!session) return false;
  if (session.recoveryType === "none") return true;
  if (session.recovery_duration_sec != null && session.recovery_duration_sec !== "") return true;
  if (Array.isArray(session.recovery_after_rep_sec) && session.recovery_after_rep_sec.length) return true;
  if (session.recovery_range_sec && session.recovery_range_sec.min != null && session.recovery_range_sec.max != null) {
    return true;
  }
  return false;
}

function isExactSplit(part, session) {
  if (!part) return false;
  if (part.valueKind === "range" || part.valueKind === "summary" || part.valueKind === "approx") return false;
  if (part.derived || part.durationApproximate || part.paceApproximate) return false;
  if (part.valueKind === "exact" || part.provenance === "exact") return true;
  if (session && session.valueKind === "exact" && part.valueKind !== "range" && part.valueKind !== "summary") {
    return Number(part.distance_m) > 0 && Number(part.duration_s) > 0;
  }
  return (
    Number(part.distance_m) > 0 &&
    Number(part.duration_s) > 0 &&
    part.durationApproximate === false
  );
}

function qualityPhi(Q, exactSplit, recP = RECOVERY_V1_PARAMS) {
  if (exactSplit) return 1;
  const q = clip01(Q);
  const phi = recP.qMin + (1 - recP.qMin) * q;
  return Math.min(1, Math.max(0, phi));
}

function metabolicImpulse(glycoProd, severeProd, recP = RECOVERY_V1_PARAMS) {
  const g = Math.max(0, Number(glycoProd) || 0);
  const s = Math.max(0, Number(severeProd) || 0);
  const gRef = recP.piMGlycoRef > 0 ? recP.piMGlycoRef : 0.2;
  const sRef = recP.piMSevereRef > 0 ? recP.piMSevereRef : 0.15;
  return clip01(1 - Math.exp(-g / gRef - s / sRef));
}

function cardiovascularImpulse(trimpUnit, recP = RECOVERY_V1_PARAMS) {
  const x = Math.max(0, Number(trimpUnit) || 0);
  const ref = recP.piCRef > 0 ? recP.piCRef : 28;
  return clip01(1 - Math.exp(-x / ref));
}

function applyWorkDisturbance(state, spec, recP = RECOVERY_V1_PARAMS) {
  const M = clip01(state.M);
  const Q = clip01(state.Q);
  const C = clip01(state.C);
  const W = Math.max(0, Number(spec.workDurationS) || 0);
  const rel = Number(spec.relVmax) || 0;
  const piM = metabolicImpulse(spec.glycoProd, spec.severeProd, recP);
  const piC = cardiovascularImpulse(spec.trimpUnit, recP);
  const drain = Math.exp(-W / recP.tauQWork);
  const extra = 1 - recP.deltaQ * Math.max(0, rel - recP.qRelStart);
  return {
    M: clip01(M + (1 - M) * piM),
    Q: clip01(Q * drain * extra),
    C: clip01(C + (1 - C) * piC),
    piM,
    piC,
  };
}

function applyRestEvolution(statePlus, restS, recP = RECOVERY_V1_PARAMS) {
  const R = Math.max(0, Number(restS) || 0);
  const Mp = clip01(statePlus.M);
  const Qp = clip01(statePlus.Q);
  const Cp = clip01(statePlus.C);
  return {
    M: clip01(Mp * Math.exp(-R / recP.tauM)),
    Q: clip01(1 - (1 - Qp) * Math.exp(-R / recP.tauQ)),
    C: clip01(Cp * Math.exp(-R / recP.tauC)),
  };
}

function coerceRest(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveBoutRest(spec) {
  const { part, session, workIndex, workCount, workDurationS, restBound } = spec;
  const isLast = workIndex >= workCount - 1;

  if (session && session.recoveryType === "none") {
    return {
      restS: 0,
      kind: "none",
      provenance: "none",
      source: "recoveryType=none",
      midpointNotExact: false,
    };
  }

  const range = session && session.recovery_range_sec;
  const hasRange =
    range && range.min != null && range.max != null && Number(range.max) >= Number(range.min);

  const fromPart = coerceRest(part && part.rest_s);
  if (fromPart != null) {
    if (hasRange && fromPart > 0 && !isLast) {
      const lo = Number(range.min);
      const hi = Number(range.max);
      const mid = fromPart;
      return {
        restS: pickBound(lo, mid, hi, restBound),
        kind: "range",
        provenance: (part && part.restProvenance) || session.recoveryProvenance || "user_recalled_range",
        source: "recovery_range_sec",
        lo,
        mid,
        hi,
        midpointNotExact: true,
      };
    }
    return {
      restS: fromPart,
      kind: fromPart === 0 && isLast ? "last_none" : "specified",
      provenance: (part && part.restProvenance) || (session && session.recoveryProvenance) || "specified",
      source: "part.rest_s",
      midpointNotExact: Boolean(session && session.recoveryApproximate),
    };
  }

  const after = session && Array.isArray(session.recovery_after_rep_sec) ? session.recovery_after_rep_sec : null;
  if (after && after[workIndex] != null && after[workIndex] !== "") {
    return {
      restS: Number(after[workIndex]),
      kind: "specified",
      provenance: session.recoveryProvenance || "user_recalled_approx",
      source: "recovery_after_rep_sec",
      midpointNotExact: true,
    };
  }

  if (session && session.recovery_duration_sec != null && session.recovery_duration_sec !== "") {
    const mid = Number(session.recovery_duration_sec);
    if (isLast) {
      return {
        restS: 0,
        kind: "last_none",
        provenance: session.recoveryProvenance || "user_recalled_approx",
        source: "no_rest_after_last",
        midpointNotExact: true,
      };
    }
    if (hasRange && mid > 0) {
      const lo = Number(range.min);
      const hi = Number(range.max);
      return {
        restS: pickBound(lo, mid, hi, restBound),
        kind: "range",
        provenance: session.recoveryProvenance || "user_recalled_range",
        source: "recovery_duration_sec+range",
        lo,
        mid,
        hi,
        midpointNotExact: true,
      };
    }
    return {
      restS: mid,
      kind: "specified",
      provenance: session.recoveryProvenance || "user_recalled_approx",
      source: "recovery_duration_sec",
      midpointNotExact: true,
    };
  }

  if (isLast) {
    return {
      restS: 0,
      kind: "last_none",
      provenance: "no_rest_after_last",
      source: "last_bout",
      midpointNotExact: false,
    };
  }

  const prior = restPriorFromWorkDuration(workDurationS);
  return {
    restS: pickBound(prior.lo, prior.mid, prior.hi, restBound),
    kind: "unknown_prior",
    provenance: "recovery_prior",
    source: prior.band,
    lo: prior.lo,
    mid: prior.mid,
    hi: prior.hi,
    midpointNotExact: true,
  };
}

function sessionUsesRecoveryRange(session, intervals) {
  if (session && session.recoveryType === "none") return false;
  if (session && session.recovery_range_sec && session.recovery_range_sec.min != null) return true;
  const work = (intervals || []).filter((p) => p.activity !== "plyo" && p.activity !== "strength");
  if (work.length <= 1) return false;
  if (hasSessionLevelRest(session)) return false;
  for (let i = 0; i < work.length - 1; i += 1) {
    if (coerceRest(work[i].rest_s) == null) return true;
  }
  return false;
}

const REST_INVARIANT_DIMS = ["CV", "MET", "NM"];

/**
 * Same scorer, same session input: midpoint rest must land inside the
 * sampled {R_low, R_high} score interval. Does not assume monotonicity.
 */
function midpointInSampledRange(loScores, midScores, hiScores, dims = REST_INVARIANT_DIMS, eps = 0.11) {
  const failures = [];
  if (!loScores || !midScores || !hiScores) {
    return { ok: false, failures: [{ dim: "*", reason: "missing bound scores" }] };
  }
  for (const d of dims) {
    const lo = loScores[d];
    const mid = midScores[d];
    const hi = hiScores[d];
    const sampledMin = Math.min(lo, hi);
    const sampledMax = Math.max(lo, hi);
    if (mid + eps < sampledMin || mid - eps > sampledMax) {
      failures.push({ dim: d, lo, mid, hi, sampledMin, sampledMax });
    }
  }
  return { ok: failures.length === 0, failures };
}

const TrainingLoadV2Recovery = {
  RECOVERY_V1_PARAMS,
  initialRecoveryState,
  restPriorFromWorkDuration,
  hasSessionLevelRest,
  isExactSplit,
  qualityPhi,
  metabolicImpulse,
  cardiovascularImpulse,
  applyWorkDisturbance,
  applyRestEvolution,
  coerceRest,
  resolveBoutRest,
  sessionUsesRecoveryRange,
  REST_INVARIANT_DIMS,
  midpointInSampledRange,
};

if (typeof module === "object" && module.exports) {
  module.exports = TrainingLoadV2Recovery;
}
global.TrainingLoadV2Recovery = TrainingLoadV2Recovery;
})(typeof globalThis !== "undefined" ? globalThis : this);
