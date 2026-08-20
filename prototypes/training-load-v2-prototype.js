/**
 * NextLap Training Load Model V2 — prototype / test harness
 *
 * Verified reference implementation. App Beta loads this same file.
 * Do not rewrite CV/MET/NM/MECH formulas or LOAD_V2_PARAMS.
 *
 * Pipeline:
 *   session input → normalize athlete → expand work intervals
 *   → CV / MET / NM / MECH → confidence + ordinal levels
 *
 * NM internals: velocityExposure + accelerationForceExposure
 * MECH internals: runningVolumeExposure + highForceExposure + externalLoadExposure
 *
 * MECH is a mechanical exposure index. It is not injury risk and not
 * measured tendon/bone load.
 *
 * Confidence is data-quality only. It does not change CV/MET/NM/MECH scores.
 * LOAD_V2_PARAMS are frozen for scoring.
 *
 * Rest coupling is Recovery State Model V1 (RECOVERY_V1_PARAMS), not
 * rest×cvRestIntensity / leftoverAcid / restQuality(rest_after).
 */

(function (global) {
"use strict";

const LOAD_V2_PARAMS = {
  /* ----- athlete / pace mapping ----- */
  vmaxFrom400Ratio: 0.9,
  easyPaceVs5k: 1.42,
  recoveryPaceVs5k: 1.58,
  thresholdPaceVs5k: 1.13,
  vo2VelocityBlend: 0.55,

  /* ----- cardiovascular (TRIMP-like, saturates above vVO2) ----- */
  cvZeroVelocity: 2.05,
  cvBanisterB: 2.95,
  cvRestIntensity: 0.12, /* unused by Recovery State Model V1 */
  cvSatRaw: 185,
  cvIntensityCap: 1.0,

  /* ----- metabolic ----- */
  metCurveK: 9,
  metCurveCenterRelT: 1.32,
  metGlycoPower: 1.0,
  metBoutTauSec: 40,
  metGlycoPeakSec: 48,
  metGlycoWidthSec: 26,
  metSevereK: 0.11,
  metSevereStart: 0.86,
  metIncompleteK: 0.14, /* unused by Recovery State Model V1 */
  metRecoveryTauSec: 140, /* unused by Recovery State Model V1 */
  metSatRaw: 1.85,

  /* ----- neuromuscular: velocity exposure ----- */
  nmVelFloorRel: 0.62,
  nmVelCenterRelVmax: 0.76,
  nmVelSteepness: 16,
  nmVelPower: 1.4,
  nmVelDistSatM: 32,
  nmRepDecay: 0.22,
  nmRestQualityTau: 160, /* unused by Recovery State Model V1 */
  nmRestQualityFloor: 0.48, /* unused by Recovery State Model V1 */
  nmPeakStartRel: 0.905,
  nmPeakWeight: 1.15,

  /* ----- neuromuscular: acceleration / high-force output ----- */
  nmAccelDistSatM: 36,
  nmAccelHillGain: 0.038,
    nmPlyoContactRef: 18,
    nmStrengthSetRef: 8,
  nmAccelRoleGain: {
    accel: 0.68,
    hill: 0.7,
    fly: 0.2,
    accel_and_velocity: 0.48,
    velocity: 0.08,
    run: 0.06,
    plyo: 1.05,
    strength: 0.72,
  },

  /* ----- NM mix ----- */
  nmVelWeight: 1.5,
  nmAccelWeight: 0.52,
  nmSatRaw: 3.05,

  /* ----- mechanical exposure ----- */
  mechVolWeight: 0.9,
  mechHighForceWeight: 1.2,
  mechExternalWeight: 1.55,
  mechForceVelExp: 2.2,
  mechForceDistSatM: 85,
  mechGradeK: 0.45,
  mechPlyoContactRef: 4.2,
  mechStrengthSetRef: 4.2,
  mechSatRaw: 13.2,

  /* ----- ordinal levels ----- */
  levelCuts: {
    medium: 28,
    high: 52,
    veryHigh: 74,
  },
  orderEpsilon: 1.2,
  approxBand: 8,
};

const __v2Recovery =
  typeof require === "function"
    ? require("./training-load-v2-recovery")
    : globalThis.TrainingLoadV2Recovery;
const {
  RECOVERY_V1_PARAMS,
  initialRecoveryState,
  hasSessionLevelRest,
  isExactSplit,
  qualityPhi,
  applyWorkDisturbance,
  applyRestEvolution,
  coerceRest,
  resolveBoutRest,
  sessionUsesRecoveryRange,
  midpointInSampledRange,
} = __v2Recovery;

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function satExp(raw, ref) {
  if (ref <= 0) return 0;
  return 100 * (1 - Math.exp(-Math.max(0, raw) / ref));
}

function diminishingRepGain(indexZeroBased, decay) {
  return 1 / (1 + decay * indexZeroBased);
}

function distSaturate(distanceM, satM) {
  if (!distanceM || distanceM <= 0) return 0;
  return 1 - Math.exp(-distanceM / satM);
}

function toLevel(score, cuts) {
  if (score >= cuts.veryHigh) return "veryHigh";
  if (score >= cuts.high) return "high";
  if (score >= cuts.medium) return "medium";
  return "low";
}

function normalizeAthlete(athlete, P = LOAD_V2_PARAMS) {
  const t = athlete.times || {};
  const t400 = Number(t[400]);
  const t800 = Number(t[800]);
  const t1500 = Number(t[1500]);
  const t3000 = Number(t[3000]);
  const t5000 = Number(t[5000]);

  const v = (dist, sec) => (sec > 0 ? dist / sec : null);
  const v400 = v(400, t400);
  const v800 = v(800, t800);
  const v1500 = v(1500, t1500);
  const v3000 = v(3000, t3000);
  const v5000 = v(5000, t5000);
  const vmax = athlete.vmax_mps || (v400 ? v400 / P.vmaxFrom400Ratio : 8.5);

  const vEasy = v5000 ? v5000 / P.easyPaceVs5k : vmax * 0.45;
  const vRec = v5000 ? v5000 / P.recoveryPaceVs5k : vmax * 0.4;
  const vThresh = v5000 ? v5000 / P.thresholdPaceVs5k : vmax * 0.57;
  const vVO2 =
    v3000 && v5000
      ? P.vo2VelocityBlend * v3000 + (1 - P.vo2VelocityBlend) * v5000
      : v3000 || v5000 || vmax * 0.68;

  return {
    vmax,
    vRec,
    vEasy,
    vThresh,
    vVO2,
    v800,
    v1500,
    v3000,
    v5000,
    v400,
    times: { 400: t400, 800: t800, 1500: t1500, 3000: t3000, 5000: t5000 },
  };
}

function resolveVelocity(part, ability) {
  if (Number(part.velocity_mps) > 0) return Number(part.velocity_mps);
  if (Number(part.velocityRelVmax) > 0) return Number(part.velocityRelVmax) * ability.vmax;
  if (part.paceRef && ability[part.paceRef]) return ability[part.paceRef];
  if (Number(part.distance_m) > 0 && Number(part.duration_s) > 0) {
    return Number(part.distance_m) / Number(part.duration_s);
  }
  return null;
}

function expandIntervals(session) {
  const parts = session.parts || [];
  const out = [];
  for (const part of parts) {
    const reps = Math.max(1, Number(part.reps) || 1);
    const cycle = part.cycle;
    if (Array.isArray(cycle) && cycle.length) {
      for (let i = 0; i < reps; i += 1) {
        cycle.forEach((step, stepIdx) => {
          out.push({
            ...step,
            repIndex: i,
            rest_s: coerceRest(step.rest_s),
            cycleStep: stepIdx,
          });
        });
      }
      continue;
    }
    for (let i = 0; i < reps; i += 1) {
      out.push({
        ...part,
        repIndex: i,
        rest_s: coerceRest(part.rest_s),
      });
    }
  }
  return out;
}

function cvIntensity(velocity, ability, P) {
  if (!velocity) return 0;
  const zero = P.cvZeroVelocity;
  const span = Math.max(0.8, ability.vVO2 - zero);
  let i = (velocity - zero) / span;
  i = clamp(i, 0, P.cvIntensityCap);
  return i;
}

function metGlycoIntensity(velocity, ability, P) {
  if (!velocity) return 0;
  const relT = velocity / Math.max(ability.vThresh, 0.1);
  return Math.pow(sigmoid(P.metCurveK * (relT - P.metCurveCenterRelT)), 1);
}

function metSevereFrac(velocity, ability, P) {
  if (!velocity) return 0;
  const start = ability.vThresh * P.metSevereStart;
  const span = Math.max(0.15, ability.vVO2 - start);
  return clamp((velocity - start) / span, 0, 1.15);
}

function glycoDurationWindow(durationS, P) {
  const x = (durationS - P.metGlycoPeakSec) / P.metGlycoWidthSec;
  return Math.exp(-x * x);
}

function velCurve(relVmax, P) {
  if (relVmax < P.nmVelFloorRel) return 0;
  const s = sigmoid(P.nmVelSteepness * (relVmax - P.nmVelCenterRelVmax));
  return Math.pow(s, P.nmVelPower);
}

function accelRoleGain(part, P) {
  const role = part.role || part.activity || "run";
  const table = P.nmAccelRoleGain;
  return table[role] != null ? table[role] : table.run;
}

function isGymActivity(activity) {
  return activity === "plyo" || activity === "strength";
}

function unionScoreRange(scoreList) {
  const dims = ["CV", "MET", "NM", "MECH"];
  const range = {};
  for (const d of dims) {
    const xs = scoreList.map((s) => s[d]);
    range[d] = { low: Math.min(...xs), high: Math.max(...xs) };
  }
  return range;
}

function scoreSessionRecoveryPass(session, intervals, athlete, P, recP, restBound) {
  const ability = normalizeAthlete(athlete, P);
  const missing = [];
  const runSlots = intervals.filter((p) => !isGymActivity(p.activity || "run"));
  const workCount = runSlots.length;

  let cvRaw = 0;
  let metRaw = 0;
  let velRaw = 0;
  let accelRaw = 0;
  let runKm = 0;
  let highForceRaw = 0;
  let externalRaw = 0;
  let specifiedVelocity = 0;
  let workBouts = 0;
  let workIndex = 0;
  let state = initialRecoveryState();
  const bouts = [];

  for (const part of intervals) {
    const activity = part.activity || "run";
    const durationS = Number(part.duration_s) || 0;
    const distanceM = Number(part.distance_m) || 0;
    const grade = Number(part.grade_pct) || 0;
    const gain = diminishingRepGain(part.repIndex || 0, P.nmRepDecay);

    if (activity === "plyo") {
      const contacts = Number(part.contacts) || 0;
      const intensity = Number(part.intensity) != null ? Number(part.intensity) : 0.8;
      accelRaw += (contacts / P.nmPlyoContactRef) * intensity * accelRoleGain(part, P);
      highForceRaw += (contacts / P.mechPlyoContactRef) * intensity * (1.15 + 0.04 * grade);
      cvRaw += (durationS / 60) * 0.12 * (Math.exp(P.cvBanisterB * 0.22) - 1);
      continue;
    }

    if (activity === "strength") {
      const sets = Number(part.sets) || 0;
      const relLoad = Number(part.relativeLoad) != null ? Number(part.relativeLoad) : 0.75;
      accelRaw += (sets / P.nmStrengthSetRef) * relLoad * accelRoleGain(part, P);
      externalRaw += (sets / P.mechStrengthSetRef) * relLoad;
      highForceRaw += 0.35 * (sets / P.mechStrengthSetRef) * relLoad;
      cvRaw += (durationS / 60) * 0.1 * (Math.exp(P.cvBanisterB * 0.18) - 1);
      continue;
    }

    const velocity = resolveVelocity(part, ability);
    workBouts += 1;
    if (velocity == null) missing.push("velocity");
    else specifiedVelocity += 1;

    const workDurationS =
      durationS > 0 ? durationS : velocity && distanceM ? distanceM / velocity : 0;
    if (!workDurationS) missing.push("duration");

    const durationMin = workDurationS / 60;
    runKm += distanceM > 0 ? distanceM / 1000 : velocity ? (velocity * workDurationS) / 1000 : 0;

    const restInfo = resolveBoutRest({
      part,
      session,
      workIndex,
      workCount,
      workDurationS,
      restBound,
    });

    const M_in = state.M;
    const Q_in = state.Q;
    const C_in = state.C;
    const exactSplit = isExactSplit(part, session);
    const phi = qualityPhi(Q_in, exactSplit, recP);

    const iCv = cvIntensity(velocity, ability, P);
    const trimpUnit = durationMin * iCv * Math.exp(P.cvBanisterB * iCv);
    cvRaw += trimpUnit * (1 + recP.kappaC * C_in);

    const iGlyco = metGlycoIntensity(velocity || 0, ability, P);
    const glyco =
      Math.pow(iGlyco, P.metGlycoPower) * glycoDurationWindow(workDurationS, P);
    const boutCap = 1 - Math.exp(-workDurationS / P.metBoutTauSec);
    const glycoProd = glyco * boutCap;
    const severeProd = durationMin * P.metSevereK * metSevereFrac(velocity || 0, ability, P);
    const Wmet = glycoProd + severeProd;
    metRaw += Wmet * (1 + recP.kappaM * M_in);

    const rel = velocity != null && ability.vmax > 0 ? velocity / ability.vmax : 0;
    if (velocity != null && ability.vmax > 0) {
      const peak =
        Math.max(0, (rel - P.nmPeakStartRel) / Math.max(0.04, 1 - P.nmPeakStartRel)) *
        P.nmPeakWeight *
        phi *
        gain;
      const velBout =
        velCurve(rel, P) *
          distSaturate(distanceM || velocity * workDurationS, P.nmVelDistSatM) *
          gain *
          phi +
        peak;
      velRaw += velBout;

      const role = part.role || activity;
      const specialForce = role === "accel" || role === "hill" || role === "plyo" || role === "strength";
      const effortScale = specialForce ? 1 : 0.2 + 0.8 * velCurve(rel, P);
      const hill = 1 + P.nmAccelHillGain * Math.max(0, grade);
      const accelBout =
        accelRoleGain(part, P) *
        hill *
        effortScale *
        distSaturate(Math.min(distanceM || 30, 45), P.nmAccelDistSatM) *
        gain;
      accelRaw += accelBout;

      const forceVel = Math.pow(clamp(rel, 0, 1.05), P.mechForceVelExp);
      highForceRaw +=
        (forceVel + P.mechGradeK * Math.max(0, grade)) *
        distSaturate(distanceM || velocity * workDurationS, P.mechForceDistSatM) *
        gain;
    }

    const plus = applyWorkDisturbance(
      { M: M_in, Q: Q_in, C: C_in },
      {
        workDurationS,
        relVmax: rel,
        glycoProd,
        severeProd,
        trimpUnit,
      },
      recP
    );
    const next = applyRestEvolution(plus, restInfo.restS, recP);
    bouts.push({
      i: workIndex + 1,
      restS: restInfo.restS,
      restKind: restInfo.kind,
      restProvenance: restInfo.provenance,
      restSource: restInfo.source,
      midpointNotExact: Boolean(restInfo.midpointNotExact),
      restLo: restInfo.lo != null ? restInfo.lo : null,
      restMid: restInfo.mid != null ? restInfo.mid : null,
      restHi: restInfo.hi != null ? restInfo.hi : null,
      exactSplit,
      phi: round2(phi),
      M_in: round2(M_in),
      Q_in: round2(Q_in),
      C_in: round2(C_in),
      M_plus: round2(plus.M),
      Q_plus: round2(plus.Q),
      C_plus: round2(plus.C),
      piM: round2(plus.piM),
      piC: round2(plus.piC),
      M_out: round2(next.M),
      Q_out: round2(next.Q),
      C_out: round2(next.C),
    });
    state = next;
    workIndex += 1;
  }

  const cv = satExp(cvRaw, P.cvSatRaw);
  const met = satExp(metRaw, P.metSatRaw);
  const nm = satExp(P.nmVelWeight * velRaw + P.nmAccelWeight * accelRaw, P.nmSatRaw);
  const volRaw = runKm;
  const mechRaw =
    P.mechVolWeight * volRaw +
    P.mechHighForceWeight * highForceRaw +
    P.mechExternalWeight * externalRaw;
  const mech = satExp(mechRaw, P.mechSatRaw);
  const scores = {
    CV: round1(cv),
    MET: round1(met),
    NM: round1(nm),
    MECH: round1(mech),
  };
  const cuts = P.levelCuts;
  const levels = {
    CV: toLevel(scores.CV, cuts),
    MET: toLevel(scores.MET, cuts),
    NM: toLevel(scores.NM, cuts),
    MECH: toLevel(scores.MECH, cuts),
  };

  return {
    scores,
    levels,
    order: orderString(scores, P.orderEpsilon),
    components: {
      NM: {
        velocityExposure: round2(velRaw),
        accelerationForceExposure: round2(accelRaw),
      },
      MECH: {
        runningVolumeExposure: round2(volRaw),
        highForceExposure: round2(highForceRaw),
        externalLoadExposure: round2(externalRaw),
      },
      debug: {
        cvRaw: round2(cvRaw),
        metRaw: round2(metRaw),
        runKm: round2(runKm),
      },
    },
    ability,
    missing,
    specifiedVelocity,
    workBouts,
    recoveryBouts: bouts,
  };
}

function analyzeSession(session, athlete, P = LOAD_V2_PARAMS) {
  const recP = RECOVERY_V1_PARAMS;
  const intervals = expandIntervals(session);
  const needsRange = sessionUsesRecoveryRange(session, intervals);
  const midPass = scoreSessionRecoveryPass(session, intervals, athlete, P, recP, "mid");
  let scoreRange = null;
  let boundScores = null;
  if (needsRange) {
    const loPass = scoreSessionRecoveryPass(session, intervals, athlete, P, recP, "lo");
    const hiPass = scoreSessionRecoveryPass(session, intervals, athlete, P, recP, "hi");
    boundScores = {
      lo: loPass.scores,
      mid: midPass.scores,
      hi: hiPass.scores,
    };
    scoreRange = unionScoreRange([loPass.scores, midPass.scores, hiPass.scores]);
  }

  const restInvariant = boundScores
    ? midpointInSampledRange(boundScores.lo, boundScores.mid, boundScores.hi)
    : null;

  const quality = assessDataQuality(session, intervals);
  const kinds = (midPass.recoveryBouts || []).map((b) => b.restKind);
  const provenances = [...new Set((midPass.recoveryBouts || []).map((b) => b.restProvenance).filter(Boolean))];
  const usedPrior = kinds.includes("unknown_prior");
  const usedRange = kinds.includes("range");
  const usedNone = kinds.includes("none") && !usedPrior;

  return {
    scores: midPass.scores,
    levels: midPass.levels,
    order: midPass.order,
    confidence: quality.overall,
    confidenceBreakdown: quality.breakdown,
    confidenceByDimension: quality.byDimension,
    dataQualityFlags: quality.flags,
    components: midPass.components,
    ability: midPass.ability,
    recovery: {
      model: "RecoveryStateModelV1",
      params: "RECOVERY_V1_PARAMS",
      restBound: "mid",
      midpointNotExact: usedPrior || usedRange || (midPass.recoveryBouts || []).some((b) => b.midpointNotExact),
      provenance: provenances[0] || (usedNone ? "none" : "specified"),
      restKinds: kinds,
      usedUnknownPrior: usedPrior,
      usedRestRange: usedRange,
      scoreRange,
      boundScores,
      invariant: restInvariant,
      bouts: midPass.recoveryBouts,
    },
  };
}

function isGymPart(part) {
  return part.activity === "plyo" || part.activity === "strength";
}

function isAuxBlock(part) {
  return part.block === "warmup" || part.block === "cooldown";
}

function claimedIntervalText(session) {
  const text = `${session.prescription || ""} ${session.name || ""} ${session.planned_detail || ""}`;
  return /(\d+)\s*[x×]\s*(\d+)/i.test(text);
}

function velocitySource(part) {
  if (Number(part.duration_s) > 0 && Number(part.distance_m) > 0) return "split";
  if (Number(part.velocity_mps) > 0) return "measured";
  if (Number(part.velocityRelVmax) > 0) return "rel_vmax";
  if (part.paceRef) return "pace_ref";
  return "missing";
}

function geoMean(values) {
  const xs = values.filter((v) => v > 0);
  if (!xs.length) return 0.2;
  const log = xs.reduce((s, v) => s + Math.log(v), 0) / xs.length;
  return Math.exp(log);
}

/**
 * Data-quality confidence. Does not change load scores.
 *
 * Average session pace is not treated as complete velocity data.
 * Collapsed intervals (lost work/rest/reps) drop MET/NM confidence hard;
 * CV can remain medium if a duration+average pace exists; MECH can remain
 * medium if total distance exists.
 */
function assessDataQuality(session, intervals) {
  const parts = session.parts || [];
  const all = intervals && intervals.length ? intervals : expandIntervals(session);
  const runAll = all.filter((p) => !isGymPart(p));
  const runWork = runAll.filter((p) => !isAuxBlock(p));
  const gym = all.filter(isGymPart);
  const hasPlyo = gym.some((p) => p.activity === "plyo");
  const hasStrength = gym.some((p) => p.activity === "strength");

  const multiRepDeclared = parts.some(
    (p) => (Number(p.reps) || 1) > 1 || (Array.isArray(p.cycle) && p.cycle.length)
  );
  const intervalClaim = Boolean(session.lostStructure) || claimedIntervalText(session) || multiRepDeclared;
  const singleRunBlock = runWork.length <= 1 && !multiRepDeclared;
  const collapsedAverage =
    Boolean(session.lostStructure) ||
    session.structureFidelity === "session_average" ||
    session.inputVersion === "partial" ||
    (intervalClaim && runWork.length <= 1 && (Number(runWork[0] && runWork[0].reps) || 1) === 1);

  const sources = runWork.map(velocitySource);
  const splitShare = sources.length ? sources.filter((s) => s === "split" || s === "measured" || s === "rel_vmax").length / sources.length : 0;
  const paceRefShare = sources.length ? sources.filter((s) => s === "pace_ref").length / sources.length : 0;
  const missingVelShare = sources.length ? sources.filter((s) => s === "missing").length / sources.length : runWork.length ? 1 : 0;

  const restApplicable = intervalClaim || runWork.length > 1 || multiRepDeclared;
  const restSpecified = runWork.filter((p) => p.rest_s != null).length;
  const sessionRest = hasSessionLevelRest(session);
  const restUnknown =
    restApplicable &&
    session.recoveryType !== "none" &&
    !sessionRest &&
    runWork.slice(0, Math.max(0, runWork.length - 1)).some((p) => p.rest_s == null);
  const restKnown = !restApplicable || session.recoveryType === "none" || sessionRest || (runWork.length > 0 && restSpecified === runWork.length);

  const hasDistance = runWork.some((p) => Number(p.distance_m) > 0) || Number(session.distance_km) > 0;
  const hasDuration = runWork.some((p) => Number(p.duration_s) > 0);
  const plyoOk = gym.some((p) => p.activity === "plyo" && Number(p.contacts) > 0);
  const strengthOk = gym.some((p) => p.activity === "strength" && Number(p.sets) > 0);
  const gradeKnown = all.some((p) => p.grade_pct != null && p.grade_pct !== "");

  const hrWork = session.hrWorkAvg != null || session.avg_hr_work != null;
  const hrSession = session.hrSessionAvg != null || session.avg_hr != null || session.hrMax != null;

  let structureConfidence = 0.88;
  if (!parts.length) structureConfidence = 0.2;
  else if (collapsedAverage) structureConfidence = 0.32;
  else if (session.inputVersion === "minimal" || session.structureFidelity === "inferred") structureConfidence = 0.36;
  else if (hasPlyo || hasStrength) structureConfidence = plyoOk || strengthOk ? 0.82 : 0.45;
  else if (multiRepDeclared && restKnown) structureConfidence = 0.95;
  else if (multiRepDeclared && !restKnown) structureConfidence = 0.62;
  else if (singleRunBlock) structureConfidence = 0.86;

  let velocityConfidence = 0.5;
  if (hasPlyo || hasStrength) {
    velocityConfidence = 0.55;
  } else if (collapsedAverage) {
    velocityConfidence = sources.some((s) => s !== "missing") || (hasDistance && hasDuration) ? 0.58 : 0.28;
  } else if (missingVelShare >= 1) {
    velocityConfidence = 0.28;
  } else {
    velocityConfidence = 0.38 + 0.5 * splitShare + 0.32 * paceRefShare;
    velocityConfidence *= 1 - 0.55 * missingVelShare;
  }

  let hrConfidence = 0.5;
  if (hrWork) hrConfidence = 0.9;
  else if (hrSession) hrConfidence = 0.72;
  if (hasPlyo || hasStrength) hrConfidence = Math.max(hrConfidence, 0.55);

  let recoveryConfidence = 0.88;
  if (collapsedAverage) recoveryConfidence = 0.32;
  else if (!restApplicable) recoveryConfidence = 0.9;
  else if (session.recoveryType === "none") recoveryConfidence = 0.9;
  else if (restUnknown) recoveryConfidence = 0.3;
  else if (session.recoveryProvenance === "user_recalled_range" || (session.recovery_range_sec && session.recovery_range_sec.min != null)) {
    recoveryConfidence = 0.5;
  } else if (session.recoveryApproximate || session.recoveryProvenance === "user_recalled_approx") {
    recoveryConfidence = 0.55;
  } else if (restKnown && session.recoveryType) recoveryConfidence = 0.95;
  else if (restKnown) recoveryConfidence = 0.88;
  else if (restSpecified > 0) recoveryConfidence = 0.55;
  else recoveryConfidence = 0.3;

  let mechanicalConfidence = 0.5;
  if (hasPlyo) mechanicalConfidence = plyoOk ? 0.88 : 0.42;
  else if (hasStrength) mechanicalConfidence = strengthOk ? 0.86 : 0.42;
  else if (hasDistance && gradeKnown) mechanicalConfidence = 0.9;
  else if (hasDistance) mechanicalConfidence = collapsedAverage ? 0.7 : 0.86;
  else if (hasDuration) mechanicalConfidence = 0.58;
  else mechanicalConfidence = 0.34;

  structureConfidence = clamp(structureConfidence, 0.2, 0.99);
  velocityConfidence = clamp(velocityConfidence, 0.2, 0.99);
  hrConfidence = clamp(hrConfidence, 0.2, 0.99);
  recoveryConfidence = clamp(recoveryConfidence, 0.2, 0.99);
  mechanicalConfidence = clamp(mechanicalConfidence, 0.2, 0.99);

  let cv = clamp(
    0.5 * velocityConfidence + 0.22 * hrConfidence + 0.16 * structureConfidence + 0.12 * recoveryConfidence,
    0.2,
    0.99
  );
  let met = clamp(
    0.4 * structureConfidence + 0.22 * velocityConfidence + 0.38 * recoveryConfidence,
    0.2,
    0.99
  );
  let nm = clamp(
    0.52 * structureConfidence + 0.14 * velocityConfidence + 0.34 * recoveryConfidence,
    0.2,
    0.99
  );
  let mech = clamp(
    0.72 * mechanicalConfidence + 0.16 * velocityConfidence + 0.12 * structureConfidence,
    0.2,
    0.99
  );

  let overall = clamp(geoMean([cv, met, nm, mech]), 0.2, 0.99);

  const kind = session.valueKind;
  const prov = session.provenance;
  const scale = provenanceConfidenceScale(kind, prov);
  if (scale) {
    structureConfidence = clamp(structureConfidence * scale.struct, 0.2, 0.99);
    velocityConfidence = clamp(velocityConfidence * scale.vel, 0.2, 0.99);
    cv = clamp(cv * scale.cv, 0.2, 0.99);
    met = clamp(met * scale.met, 0.2, 0.99);
    nm = clamp(nm * scale.nm, 0.2, 0.99);
    mech = clamp(mech * scale.mech, 0.2, 0.99);
    overall = clamp(geoMean([cv, met, nm, mech]), 0.2, 0.99);
  }

  return {
    overall: round2(overall),
    breakdown: {
      structureConfidence: round2(structureConfidence),
      velocityConfidence: round2(velocityConfidence),
      hrConfidence: round2(hrConfidence),
      recoveryConfidence: round2(recoveryConfidence),
      mechanicalConfidence: round2(mechanicalConfidence),
    },
    byDimension: {
      CV: round2(cv),
      MET: round2(met),
      NM: round2(nm),
      MECH: round2(mech),
    },
    flags: {
      collapsedAverage,
      intervalClaim,
      missingHr: !hrWork && !hrSession,
      missingRest: restApplicable && (restUnknown || !restKnown),
      recoveryUnknown: restUnknown,
      recoveryPriorUsed: restUnknown,
      missingDistance: !hasDistance && !plyoOk && !strengthOk,
      inferredStructure: session.inputVersion === "minimal" || session.structureFidelity === "inferred",
      valueKind: kind || null,
      provenance: prov || null,
    },
  };
}

function provenanceConfidenceScale(kind, prov) {
  if (kind === "range" || prov === "rangeOnly") {
    return { struct: 0.9, vel: 0.68, cv: 0.86, met: 0.78, nm: 0.7, mech: 0.92 };
  }
  if (prov === "derivedFromApprox") {
    return { struct: 0.88, vel: 0.58, cv: 0.8, met: 0.72, nm: 0.66, mech: 0.78 };
  }
  if (kind === "approx" || prov === "userApprox") {
    return { struct: 0.9, vel: 0.62, cv: 0.82, met: 0.75, nm: 0.7, mech: 0.88 };
  }
  if (kind === "summary" || prov === "summaryOnly") {
    return { struct: 0.72, vel: 0.5, cv: 0.72, met: 0.64, nm: 0.48, mech: 0.88 };
  }
  return null;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function orderString(scores, eps) {
  const dims = ["CV", "MET", "NM", "MECH"];
  const sorted = dims.slice().sort((a, b) => scores[b] - scores[a]);
  let out = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = scores[sorted[i - 1]];
    const cur = scores[sorted[i]];
    if (Math.abs(prev - cur) <= eps) out += " ≥ " + sorted[i];
    else out += " > " + sorted[i];
  }
  return out;
}

function comparePair(op, left, right, P) {
  if (op === ">") return left > right + P.orderEpsilon * 0.25;
  if (op === ">=" || op === "≥") return left + P.orderEpsilon >= right;
  if (op === "≈") return Math.abs(left - right) <= P.approxBand;
  if (op === "<") return right > left + P.orderEpsilon * 0.25;
  return false;
}

function parseExpectedOrder(expr) {
  const tokens = String(expr)
    .replace(/≥/g, ">=")
    .split(/(\s+>=\s+|\s+>\s+|\s+≈\s+)/)
    .map((t) => t.trim())
    .filter(Boolean);
  const dims = [];
  const ops = [];
  for (const tok of tokens) {
    if (tok === ">" || tok === ">=" || tok === "≈") ops.push(tok);
    else dims.push(tok);
  }
  return { dims, ops };
}

function checkExpectedOrder(scores, expr, P) {
  const { dims, ops } = parseExpectedOrder(expr);
  const failures = [];
  for (let i = 0; i < ops.length; i += 1) {
    const a = scores[dims[i]];
    const b = scores[dims[i + 1]];
    let op = ops[i];
    if (op === ">" && a < 12 && b < 12) {
      op = "≈";
    }
    if (!comparePair(op, a, b, P)) {
      failures.push(`${dims[i]} ${ops[i]} ${dims[i + 1]} (got ${a} vs ${b})`);
    }
  }
  return { pass: failures.length === 0, failures };
}

function highestDim(scores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function lowestDim(scores) {
  return Object.entries(scores).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0];
}

function lowestOk(scores, expected, allowed, band = 1.6) {
  const allowedSet = allowed || [expected];
  const minVal = Math.min(...Object.values(scores));
  return allowedSet.some((dim) => scores[dim] <= minVal + band);
}

const REFERENCE_ATHLETE = {
  times: { 400: 52, 800: 116, 1500: 238, 3000: 520, 5000: 910 },
};

const TrainingLoadV2 = {
  LOAD_V2_PARAMS,
  RECOVERY_V1_PARAMS,
  REFERENCE_ATHLETE,
  normalizeAthlete,
  analyzeSession,
  assessDataQuality,
  checkExpectedOrder,
  highestDim,
  lowestDim,
  lowestOk,
  toLevel,
  orderString,
  round1,
};

if (typeof module === "object" && module.exports) {
  module.exports = TrainingLoadV2;
}
global.TrainingLoadV2 = TrainingLoadV2;
})(typeof globalThis !== "undefined" ? globalThis : this);
