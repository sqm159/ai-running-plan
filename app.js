const EVENT_MODELS = {
  800: {
    name: "800 米",
    goalRef: 105,
    weights: { speed: 0.30, speedEndurance: 0.30, lactate: 0.25, vo2max: 0.10, aerobic: 0.05 },
    focus: ["速度耐力", "乳酸能力", "绝对速度"],
    longRunCap: 10,
  },
  1500: {
    name: "1500 米",
    goalRef: 210,
    weights: { vo2max: 0.30, threshold: 0.25, speedEndurance: 0.20, speed: 0.15, aerobic: 0.10 },
    focus: ["VO₂max", "乳酸阈", "速度耐力"],
    longRunCap: 13,
  },
  3000: {
    name: "3000 米",
    goalRef: 455,
    weights: { vo2max: 0.32, threshold: 0.28, aerobic: 0.25, speedEndurance: 0.10, speed: 0.05 },
    focus: ["VO₂max", "乳酸阈", "有氧能力"],
    longRunCap: 16,
  },
  5000: {
    name: "5000 米",
    goalRef: 780,
    weights: { aerobic: 0.40, threshold: 0.30, vo2max: 0.20, speedReserve: 0.10 },
    focus: ["有氧能力", "乳酸阈", "VO₂max"],
    longRunCap: 20,
  },
};

const LABELS = {
  speed: "绝对速度",
  speedEndurance: "速度耐力",
  lactate: "乳酸能力",
  vo2max: "VO₂max",
  aerobic: "有氧能力",
  threshold: "乳酸阈",
  speedReserve: "速度储备",
  strength: "力量能力",
};

const REFERENCE = {
  speed400: 47,
  lactate600: 74,
  speedEnduranceRatio800: 0.94,
  t800: 105,
  t1500: 210,
  t3000: 455,
  t5000: 780,
  t10000: 1620,
  vo2: 85,
};

const TRAINING_LIBRARY = {
  base: {
    speed: [
      "6-8×100m 加速跑，充分走回恢复，保持动作放松",
      "5×150m 放松快跑，强度 85%-90%，组间走回恢复",
      "4×60m 起跑加速 + 4×120m 顺风跑，重点是步频和放松",
    ],
    speedEndurance: [
      "6×200m @ 1500m-800m 配速，组间慢走 2-3 分钟",
      "4×300m @ 1500m 节奏，组间 3 分钟，最后 100m 保持动作",
      "3 组 300m+200m，组内休 90 秒，组间休 5 分钟，控制乳酸堆积",
      "5×300m 渐进跑，第 1-3 组可控，第 4-5 组接近专项节奏",
    ],
    lactate: [
      "4×300m @ 800m 配速控制版，组间 4 分钟，避免跑崩",
      "3 组 300m+150m，组内休 60-90 秒，组间休 6 分钟",
      "2×500m @ 1500m-800m 强度，组间 7 分钟，重点是后程动作稳定",
    ],
    vo2max: [
      "5×600m @ 3km-5km 配速，组间慢跑 2 分钟",
      "6×500m @ 3km 配速，组间慢跑 90 秒",
      "4×800m @ 5km 配速，组间慢跑 2 分钟",
      "3×1200m @ 5km 配速，组间慢跑 2-3 分钟，用于建立长间歇耐受",
    ],
    threshold: [
      "节奏跑 15-20 分钟，强度为可控但不能轻松聊天",
      "3×8 分钟阈值跑，组间慢跑 2 分钟",
      "20 分钟渐进节奏跑，后 5 分钟接近阈值强度",
      "2×1600m @ 阈值配速，组间慢跑 3 分钟，重点是稳定节奏",
    ],
    aerobic: [
      "轻松跑 40-55 分钟，最后加入 4 次短加速",
      "轻松跑 35-50 分钟 + 6×80m 技术加速跑",
      "有氧跑 45 分钟，保持稳定呼吸和轻松步频",
    ],
    strength: [
      "核心、臀腿和小腿力量 30 分钟，动作质量优先",
      "徒手力量 30 分钟：弓步、臀桥、提踵、平板支撑",
      "跑姿稳定训练 25 分钟：单腿硬拉、侧桥、弹力带侧走",
    ],
  },
  build: {
    speed: [
      "8×150m 快跑，接近 400m 节奏，组间充分恢复",
      "6×200m @ 400m-800m 之间的速度，组间 3-4 分钟",
      "4×120m + 4×80m，前者建立速度，后者保持神经兴奋",
    ],
    speedEndurance: [
      "5×400m @ 目标项目节奏，组间 2.5-4 分钟",
      "3 组 400m+300m，组内休 90 秒，组间休 6 分钟，400m 稳、300m 顶住后程",
      "3 组 500m+300m，组内休 2 分钟，组间休 7 分钟，用于强化 800m-1500m 后程能力",
      "4×500m @ 1500m 节奏，组间 4-5 分钟，要求每组后 100m 不掉速",
      "2 组 600m+200m，组内休 2 分钟，组间休 8 分钟，600m 控制、200m 快速收尾",
      "6×300m @ 略快于目标项目节奏，组间 2.5-3 分钟，训练速度保持率",
    ],
    lactate: [
      "3×500m @ 800m-1500m 强度，组间 6 分钟",
      "2 组 500m+300m+200m，组内休 90 秒，组间休 8 分钟，模拟比赛后半段压力",
      "3 组 400m+200m，组内休 60-90 秒，组间休 6 分钟，提升耐酸和冲刺保持",
      "2×600m @ 800m-1500m 强度，组间 8 分钟，第二组重点保持节奏",
    ],
    vo2max: [
      "5×800m @ 3km-5km 配速，组间慢跑 2-3 分钟",
      "4×1000m @ 5km 配速，组间慢跑 2 分钟",
      "6×600m @ 3km 配速，组间 2 分钟，强调稳定输出",
      "4×1200m @ 5km 配速，组间慢跑 2-3 分钟，提升 VO₂max 持续输出",
      "3×1600m @ 5km-10km 之间强度，组间慢跑 3 分钟，适合 3000m/5000m 强化期",
    ],
    threshold: [
      "2×12 分钟阈值跑，组间慢跑 3 分钟",
      "3×10 分钟阈值跑，组间慢跑 2 分钟",
      "25 分钟连续节奏跑，前 15 分钟稳住，后 10 分钟略提速",
      "3×1600m @ 阈值配速，组间慢跑 2-3 分钟，保持每组配速一致",
      "2×2000m @ 阈值配速，组间慢跑 3 分钟，适合有氧基础较好的跑者",
    ],
    aerobic: [
      "轻松跑 45-65 分钟，控制心率和步频",
      "中等有氧跑 50 分钟，结束后 6×100m 放松加速",
      "轻松跑 40 分钟 + 跑姿技术练习 12 分钟",
    ],
    strength: [
      "力量训练 35 分钟：深蹲、弓步、提踵、核心",
      "下肢力量 35 分钟：分腿蹲、台阶上步、提踵、臀桥",
      "核心稳定 30 分钟：死虫、侧桥、平板支撑、髋部稳定",
    ],
  },
  specific: {
    speed: [
      "4×120m 快速放松跑，保持高质量神经激活",
      "5×150m @ 接近 400m 节奏，组间充分恢复，不追求跑崩",
      "3×200m @ 略快于比赛节奏，组间 5 分钟，找速度感觉",
    ],
    speedEndurance: [
      "3-4×500m @ 比赛节奏，组间 5-6 分钟",
      "2 组 400m+300m，组内休 90 秒，组间休 8 分钟，按目标比赛节奏执行",
      "2 组 500m+300m，组内休 2 分钟，组间休 8-10 分钟，模拟中后程速度保持",
      "2 组 600m+200m，组内休 2 分钟，组间休 10 分钟，600m 稳住专项节奏，200m 快速结束",
      "3×400m @ 比赛节奏 + 2×300m @ 略快，组间充分恢复，保持高质量",
    ],
    lactate: [
      "2×600m @ 目标 800m 节奏，组间 8 分钟",
      "500m+300m+200m 组合，组内休 2 分钟，完整模拟比赛后程压力",
      "2 组 300m+300m，组内休 60 秒，组间休 8 分钟，训练耐酸与动作稳定",
    ],
    vo2max: [
      "4×1000m @ 3km-5km 强度，组间 2.5 分钟",
      "5×800m @ 3km-5km 强度，组间 2 分钟",
      "3×1200m @ 5km 强度，组间 3 分钟，保持节奏稳定",
      "4×1200m @ 3km-5km 强度，组间 2.5-3 分钟，强化高强度持续能力",
      "3×1600m @ 5km 强度，组间 3-4 分钟，适合 3000m/5000m 专项期",
      "2×2000m @ 5km 强度控制版，组间 4 分钟，要求后半程不掉速",
    ],
    threshold: [
      "20-25 分钟连续阈值跑，后半程稳定",
      "2×15 分钟阈值跑，组间慢跑 3 分钟",
      "10 分钟节奏跑 + 4×400m 稳定间歇，连接阈值和专项节奏",
      "3×1600m @ 阈值配速，组间慢跑 2-3 分钟，连接阈值和比赛耐力",
      "2-3×2000m @ 阈值配速，组间慢跑 3 分钟，用于 5000m 专项耐力",
    ],
    aerobic: [
      "轻松跑 35-55 分钟，保留体能给专项课",
      "轻松跑 40 分钟 + 4×100m 放松加速",
      "恢复性有氧跑 35-45 分钟，重点消除疲劳",
    ],
    strength: [
      "弹力带、核心和低量爆发力 25 分钟",
      "低量力量激活 20 分钟：臀桥、提踵、核心、髋部稳定",
      "赛前稳定训练 20 分钟，不做大重量，不制造酸痛",
    ],
  },
  taper: {
    speed: [
      "4×80m 放松加速，保持速度感觉",
      "3×120m 快速但放松，组间充分恢复",
      "4×60m 起跑加速，保持神经兴奋，不制造疲劳",
    ],
    speedEndurance: [
      "3×300m @ 比赛节奏，组间充分恢复",
      "2 组 300m+200m，组内休 90 秒，组间充分恢复，量小质高",
      "2×400m @ 比赛节奏，组间 6-8 分钟，跑完仍有余力",
    ],
    lactate: [
      "2×300m @ 略快于比赛节奏，量小质高",
      "300m+200m 组合，组内休 90 秒，保持速度感觉即可",
      "2×200m @ 比赛收尾节奏，组间充分恢复",
    ],
    vo2max: [
      "3×600m @ 目标项目节奏，组间 3 分钟",
      "3×500m @ 目标节奏，组间 3-4 分钟，保持轻快",
      "2×800m @ 5km 节奏，组间慢跑 3 分钟，控制疲劳",
      "2×1200m @ 5km 节奏，组间慢跑 3 分钟，只保留节奏感不堆疲劳",
    ],
    threshold: [
      "节奏跑 10-15 分钟，结束时仍感觉有余力",
      "2×8 分钟轻阈值跑，组间慢跑 3 分钟",
      "15 分钟渐进跑，最后 3 分钟接近阈值但不硬顶",
      "2×1600m @ 轻阈值配速，组间慢跑 3 分钟，赛前保持有氧张力",
    ],
    aerobic: [
      "轻松跑 25-40 分钟，保持节奏感",
      "恢复跑 25-35 分钟 + 4×80m 放松加速",
      "轻松跑 30 分钟，结束后充分拉伸",
    ],
    strength: [
      "轻量激活 15-20 分钟，不制造酸痛",
      "核心激活 15 分钟 + 髋部灵活性",
      "弹力带激活 12-15 分钟，保持身体唤醒",
    ],
  },
};

const PHASES = [
  { id: "base", name: "基础期", goal: "建立有氧、力量和动作基础", ratio: 0.34 },
  { id: "build", name: "强化期", goal: "提升专项关键能力", ratio: 0.28 },
  { id: "specific", name: "专项期", goal: "接近比赛配速与项目需求", ratio: 0.25 },
  { id: "taper", name: "调整期", goal: "降低疲劳并形成比赛状态", ratio: 0.13 },
];

const NEED_KEYWORDS = {
  reduce: ["疲劳", "太累", "累", "恢复差", "睡眠差", "压力大", "状态差", "降低", "轻一点", "轻松", "保守"],
  injury: ["受伤", "伤", "疼", "痛", "不适", "膝", "跟腱", "小腿", "胫骨", "足底", "髂胫束", "拉伤"],
  increase: ["加强", "提高强度", "加量", "冲一冲", "激进", "挑战", "突破", "更难"],
  timeLimited: ["时间少", "时间紧", "忙", "课业", "工作忙", "没时间", "压缩", "短一点"],
  avoidStrength: ["不想力量", "少做力量", "不做力量", "没有器械", "无器械"],
  focus: [
    { keys: ["速度", "冲刺", "爆发", "步频", "400"], value: "speed" },
    { keys: ["速度耐力", "后程", "最后300", "最后 300", "保持率"], value: "speedEndurance" },
    { keys: ["乳酸", "耐酸", "酸痛耐受"], value: "lactate" },
    { keys: ["vo2", "VO2", "摄氧", "间歇", "1200", "长间歇"], value: "vo2max" },
    { keys: ["阈值", "节奏", "tempo", "1600", "2000", "长距离间歇"], value: "threshold" },
    { keys: ["有氧", "耐力", "长跑", "跑量"], value: "aerobic" },
    { keys: ["力量", "核心", "稳定", "弹跳"], value: "strength" },
  ],
};

document.getElementById("planForm").addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    const input = readInput();
    const analysis = analyzeAthlete(input);
    const phases = splitPhases(input.weeks);
    const weeks = buildPlan(input, analysis, phases);
    renderSummary(input, analysis);
    renderTimeline(phases);
    renderPlan(weeks);
    document.getElementById("resultsPanel").hidden = false;
    document.getElementById("resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    alert(error.message);
  }
});

function readInput() {
  const event = document.getElementById("event").value;
  const getTime = (id) => parseTime(document.getElementById(id).value);
  const input = {
    event,
    model: EVENT_MODELS[event],
    weeks: Number(document.getElementById("weeks").value),
    goalTime: getTime("goalTime"),
    daysPerWeek: Number(document.getElementById("daysPerWeek").value),
    times: {
      400: getTime("time400"),
      600: getTime("time600"),
      800: getTime("time800"),
      1500: getTime("time1500"),
      3000: getTime("time3000"),
      5000: getTime("time5000"),
      10000: getTime("time10000"),
    },
    strength: Number(document.getElementById("strength").value),
    longRun: Number(document.getElementById("longRun").value),
    recovery: document.getElementById("recovery").value,
    injuryRisk: document.getElementById("injuryRisk").value,
    additionalNeeds: document.getElementById("additionalNeeds").value.trim(),
  };
  input.adjustment = analyzeAdditionalNeeds(input.additionalNeeds);

  if (!input.goalTime) throw new Error("请填写目标成绩。");
  if (input.weeks < 4 || input.weeks > 24) throw new Error("训练周期建议设置在 4 到 24 周之间。");
  return input;
}

function analyzeAdditionalNeeds(text) {
  const source = String(text || "");
  const normalized = source.toLowerCase();
  const hasAny = (words) => words.some((word) => normalized.includes(word.toLowerCase()));
  const focusKeys = [];
  const notes = [];
  const avoidKeys = [];
  let loadMultiplier = 1;
  let intensity = "标准";
  let sessionModifier = "";

  NEED_KEYWORDS.focus.forEach((item) => {
    if (item.keys.some((word) => normalized.includes(word.toLowerCase()))) focusKeys.push(item.value);
  });

  if (hasAny(NEED_KEYWORDS.injury)) {
    loadMultiplier *= 0.78;
    intensity = "保护性降低";
    notes.push("检测到伤病或疼痛相关反馈，关键课总量降低，并增加恢复/替代训练提示。");
  } else if (hasAny(NEED_KEYWORDS.reduce)) {
    loadMultiplier *= 0.88;
    intensity = "适度降低";
    notes.push("检测到疲劳或希望保守训练，整体训练负荷下调。");
  }

  if (hasAny(NEED_KEYWORDS.increase) && !hasAny(NEED_KEYWORDS.injury)) {
    loadMultiplier *= 1.06;
    intensity = intensity === "标准" ? "适度提高" : intensity;
    notes.push("检测到希望加强训练，非调整周会小幅提高关键课刺激。");
  }

  if (hasAny(NEED_KEYWORDS.timeLimited)) {
    loadMultiplier *= 0.93;
    sessionModifier = "本周训练按时间紧张处理：热身和放松保留，主训练组数减少 1-2 组。";
    notes.push("检测到时间紧张，训练内容会压缩组数，优先保留关键训练。");
  }

  if (hasAny(NEED_KEYWORDS.avoidStrength)) {
    avoidKeys.push("strength");
    notes.push("检测到不便做力量训练，力量课会替换为短核心、灵活性或徒手稳定训练。");
  }

  if (focusKeys.length) {
    const focusText = [...new Set(focusKeys)].map((key) => LABELS[key]).join("、");
    notes.push(`检测到希望强化 ${focusText}，系统会优先提高相关训练出现频率。`);
  }

  if (!notes.length && source) {
    notes.push("已记录进一步需求，但没有命中特定风险或强化关键词，计划保持标准负荷。");
  }

  return {
    text: source,
    focusKeys: [...new Set(focusKeys)],
    avoidKeys,
    loadMultiplier: clamp(loadMultiplier, 0.65, 1.1),
    intensity,
    sessionModifier,
    notes,
  };
}

function parseTime(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!text.includes(":")) {
    const seconds = Number(text);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }
  const parts = text.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatTime(seconds) {
  if (!seconds) return "未填写";
  const rounded = Math.round(seconds);
  const min = Math.floor(rounded / 60);
  const sec = rounded % 60;
  return min > 0 ? `${min}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

function scoreFromTime(reference, actual, k = 2) {
  if (!actual) return null;
  return clamp(100 * Math.pow(reference / actual, k), 25, 100);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function analyzeAthlete(input) {
  const t = input.times;
  const estimated = estimateMissingTimes(t, input.event, input.goalTime);
  const speed = scoreFromTime(REFERENCE.speed400, estimated[400], 2.1);
  const lactate = scoreFromTime(REFERENCE.lactate600, estimated[600], 2.4);
  const speedEndurance = scoreSpeedEndurance(estimated[400], estimated[800]);
  const vo2max = scoreVo2(estimated);
  const aerobic = scoreFromTime(REFERENCE.t10000, estimated[10000], 2);
  const threshold = scoreThreshold(input.event, estimated);
  const speedReserve = scoreFromTime(REFERENCE.t1500, estimated[1500], 1.7);
  const rawScores = {
    speed,
    speedEndurance,
    lactate,
    vo2max,
    aerobic,
    threshold,
    speedReserve,
    strength: input.strength,
  };

  Object.keys(rawScores).forEach((key) => {
    rawScores[key] = Math.round(rawScores[key] ?? inferFallbackScore(key, rawScores));
  });

  const weightedScore = Math.round(
    Object.entries(input.model.weights).reduce((sum, [key, weight]) => sum + rawScores[key] * weight, 0)
  );
  const weakKeys = Object.keys(input.model.weights)
    .sort((a, b) => rawScores[a] - rawScores[b])
    .slice(0, 3);
  const goalDifficulty = rateGoalDifficulty(input.event, input.goalTime, estimated[input.event]);

  return { scores: rawScores, weakKeys, weightedScore, estimated, goalDifficulty };
}

function estimateMissingTimes(times, event, goalTime) {
  const known = { ...times };
  if (!known[event]) known[event] = goalTime * 1.08;

  const factors = {
    400: { 800: 0.46, 1500: 0.225, 3000: 0.105, 5000: 0.06, 10000: 0.028 },
    600: { 800: 0.70, 1500: 0.34, 3000: 0.16, 5000: 0.092, 10000: 0.043 },
    800: { 400: 2.17, 1500: 0.49, 3000: 0.23, 5000: 0.13, 10000: 0.061 },
    1500: { 400: 4.45, 600: 2.95, 800: 2.04, 3000: 0.47, 5000: 0.27, 10000: 0.126 },
    3000: { 400: 9.5, 600: 6.25, 800: 4.35, 1500: 2.13, 5000: 0.57, 10000: 0.27 },
    5000: { 400: 16.5, 600: 10.9, 800: 7.7, 1500: 3.7, 3000: 1.75, 10000: 0.48 },
    10000: { 400: 35, 600: 23, 800: 16.3, 1500: 7.9, 3000: 3.7, 5000: 2.08 },
  };

  for (const target of [400, 600, 800, 1500, 3000, 5000, 10000]) {
    if (known[target]) continue;
    const estimates = [];
    for (const [source, sourceTime] of Object.entries(known)) {
      if (sourceTime && factors[target]?.[source]) estimates.push(sourceTime * factors[target][source]);
    }
    known[target] = estimates.length ? average(estimates) : null;
  }

  return known;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreSpeedEndurance(t400, t800) {
  if (!t400 || !t800) return null;
  const ratio = (2 * t400) / t800;
  return clamp(100 * Math.pow(ratio / REFERENCE.speedEnduranceRatio800, 2.5), 25, 100);
}

function scoreVo2(times) {
  const candidates = [
    scoreFromTime(REFERENCE.t1500, times[1500], 1.9),
    scoreFromTime(REFERENCE.t3000, times[3000], 2.0),
    scoreFromTime(REFERENCE.t5000, times[5000], 2.0),
  ].filter(Boolean);
  return candidates.length ? average(candidates) : null;
}

function scoreThreshold(event, times) {
  const eventTime = times[event] || times[5000] || times[3000];
  const t10k = times[10000];
  if (!eventTime || !t10k) return null;
  const eventSpeed = Number(event) / eventTime;
  const thresholdSpeed = 10000 / t10k;
  const targetRatio = event === "5000" ? 0.925 : event === "3000" ? 0.89 : 0.86;
  return clamp(100 * Math.pow(thresholdSpeed / eventSpeed / targetRatio, 2), 25, 100);
}

function inferFallbackScore(key, scores) {
  const pools = {
    speed: [scores.speedEndurance, scores.lactate],
    speedEndurance: [scores.speed, scores.lactate],
    lactate: [scores.speedEndurance, scores.vo2max],
    vo2max: [scores.threshold, scores.aerobic],
    aerobic: [scores.threshold, scores.vo2max],
    threshold: [scores.vo2max, scores.aerobic],
    speedReserve: [scores.speed, scores.speedEndurance],
  };
  const values = (pools[key] || []).filter(Boolean);
  return values.length ? average(values) : 62;
}

function rateGoalDifficulty(event, goalTime, currentTime) {
  if (!currentTime) return "目标可评估性较低，建议补充当前专项成绩。";
  const improvement = (currentTime - goalTime) / currentTime;
  if (improvement <= 0.02) return "目标较稳健，当前周期重点是稳定状态和降低比赛失误。";
  if (improvement <= 0.08) return "目标有挑战但合理，需要围绕短板安排关键课。";
  if (improvement <= 0.14) return "目标进取，建议延长周期或提高恢复管理质量。";
  return "目标跨度较大，当前周期宜先建立阶段目标，避免过快增加强度。";
}

function splitPhases(totalWeeks) {
  let remaining = totalWeeks;
  const phases = PHASES.map((phase, index) => {
    const weeks = index === PHASES.length - 1 ? remaining : Math.max(1, Math.round(totalWeeks * phase.ratio));
    remaining -= weeks;
    return { ...phase, weeks };
  });

  while (remaining < 0) {
    const phase = phases.find((item) => item.weeks > 1 && item.id !== "taper");
    if (!phase) break;
    phase.weeks -= 1;
    remaining += 1;
  }
  return phases;
}

function buildPlan(input, analysis, phases) {
  const weeks = [];
  let weekNo = 1;
  phases.forEach((phase) => {
    for (let i = 0; i < phase.weeks; i += 1) {
      const load = calculateLoad(input, phase, i);
      weeks.push({
        weekNo,
        phase,
        load,
        emphasis: pickEmphasis(input, analysis, phase),
        days: buildWeekDays(input, analysis, phase, load, weekNo),
      });
      weekNo += 1;
    }
  });
  return weeks;
}

function calculateLoad(input, phase, indexInPhase) {
  const recoveryAdjust = input.recovery === "high" ? 1.05 : input.recovery === "low" ? 0.9 : 1;
  const injuryAdjust = input.injuryRisk === "high" ? 0.82 : input.injuryRisk === "medium" ? 0.92 : 1;
  const needAdjust = input.adjustment?.loadMultiplier || 1;
  const phaseBase = { base: 0.78, build: 0.92, specific: 1, taper: 0.62 }[phase.id];
  const wave = indexInPhase % 4 === 3 ? 0.78 : 1 + Math.min(indexInPhase, 2) * 0.05;
  return clamp(phaseBase * wave * recoveryAdjust * injuryAdjust * needAdjust, 0.48, 1.15);
}

function pickEmphasis(input, analysis, phase) {
  const requestedFocus = input.adjustment?.focusKeys || [];
  const avoidKeys = input.adjustment?.avoidKeys || [];
  const removeAvoided = (keys) => keys.filter((key) => !avoidKeys.includes(key));
  if (phase.id === "base") return removeAvoided([...new Set([...requestedFocus, "aerobic", "strength", analysis.weakKeys[0]])]).slice(0, 3);
  if (phase.id === "taper") return removeAvoided([...new Set([...requestedFocus, "speed", analysis.weakKeys[0], "aerobic"])]).slice(0, 3);
  return removeAvoided([...new Set([...requestedFocus, analysis.weakKeys[0], analysis.weakKeys[1], ...Object.keys(input.model.weights)])]).slice(0, 3);
}

function buildWeekDays(input, analysis, phase, load, weekNo) {
  const emphasis = pickEmphasis(input, analysis, phase);
  const primary = emphasis[0];
  const secondary = emphasis[1] || "aerobic";
  const tertiary = emphasis[2] || "strength";
  const hasProtectionNeed = input.adjustment?.intensity?.includes("降低") || input.adjustment?.intensity?.includes("保护");
  const longRunDistance = Math.min(input.model.longRunCap, Math.max(hasProtectionNeed ? 4 : 5, input.longRun * load)).toFixed(1);
  const easyMinutes = Math.round((30 + input.daysPerWeek * 4) * load);
  const paceHint = buildPaceHint(input.goalTime, input.event);
  const modifier = input.adjustment?.sessionModifier ? ` ${input.adjustment.sessionModifier}` : "";

  const fullWeek = [
    day("周一", "恢复与灵活性", applyNeedAdjustment(input, `轻松跑 ${Math.max(20, easyMinutes - 12)} 分钟 + 拉伸放松，RPE 3-4。`, "recovery")),
    day("周二", LABELS[primary], applyNeedAdjustment(input, `${getWorkout(phase.id, primary, weekNo, 0)}。${paceHint}${modifier}`, primary)),
    day("周三", "力量与轻松跑", applyNeedAdjustment(input, `${getWorkout(phase.id, "strength", weekNo, 1)} + 轻松跑 ${Math.max(18, easyMinutes - 15)} 分钟。`, "strength")),
    day("周四", LABELS[secondary], applyNeedAdjustment(input, `${getWorkout(phase.id, secondary, weekNo, 2)}。${modifier}`, secondary)),
    day("周五", "休息或交叉训练", "完全休息，或骑行/游泳 30 分钟，保持低强度。"),
    day("周六", LABELS[tertiary], applyNeedAdjustment(input, `${getWorkout(phase.id, tertiary, weekNo, 3)}。${modifier}`, tertiary)),
    day("周日", "有氧长跑", applyNeedAdjustment(input, `轻松长跑 ${longRunDistance} km，最后 5 分钟放松慢跑。`, "aerobic")),
  ];

  if (input.daysPerWeek === 4) return [fullWeek[0], fullWeek[1], fullWeek[3], fullWeek[6]];
  if (input.daysPerWeek === 5) return [fullWeek[0], fullWeek[1], fullWeek[2], fullWeek[3], fullWeek[6]];
  return fullWeek.filter((item) => !(weekNo % 4 === 0 && item.title.includes("速度储备")));
}

function day(name, title, detail) {
  return { name, title, detail };
}

function getWorkout(phaseId, type, weekNo, offset = 0) {
  const phaseLibrary = TRAINING_LIBRARY[phaseId] || TRAINING_LIBRARY.base;
  const candidates = phaseLibrary[type] || phaseLibrary.vo2max || phaseLibrary.aerobic;
  if (Array.isArray(candidates)) {
    return candidates[(weekNo + offset - 1) % candidates.length];
  }
  return candidates;
}

function applyNeedAdjustment(input, detail, type) {
  const adjustment = input.adjustment;
  if (!adjustment) return detail;
  let result = detail;

  if (adjustment.avoidKeys.includes("strength") && type === "strength") {
    result = "替换为徒手核心与灵活性 20 分钟：平板支撑、臀桥、死虫、小腿放松，不做大重量力量。";
  }

  if (adjustment.intensity === "保护性降低") {
    result += " 若疼痛超过 3/10，立即改为休息或无冲击交叉训练。";
  } else if (adjustment.intensity === "适度降低") {
    result += " 当天主观疲劳高时，减少 1-2 组或把强度降到 RPE 6。";
  } else if (adjustment.intensity === "适度提高" && ["speed", "speedEndurance", "lactate", "vo2max", "threshold"].includes(type)) {
    result += " 状态良好时最后 1 组可略快，但不冲到力竭。";
  }

  return result;
}

function buildPaceHint(goalTime, event) {
  const pacePerUnit = goalTime / (Number(event) / 100);
  return `参考目标节奏：每 100m 约 ${pacePerUnit.toFixed(1)} 秒，训练中按阶段上下浮动。`;
}

function renderSummary(input, analysis) {
  const scoreRows = Object.keys(input.model.weights)
    .map((key) => scoreRow(key, analysis.scores[key]))
    .join("");
  const weakText = analysis.weakKeys.map((key) => LABELS[key]).join("、");
  const focusText = input.model.focus.join("、");
  const adjustmentNotes = input.adjustment?.notes?.length
    ? `<div class="adjustment-box"><strong>动态调整</strong>${input.adjustment.notes.map((note) => `<p>${note}</p>`).join("")}</div>`
    : "";

  document.getElementById("summary").innerHTML = `
    <p class="eyebrow">Analysis</p>
    <h2>${input.model.name} 训练分析</h2>
    <div class="metric">
      <span>专项综合评分</span>
      <strong>${analysis.weightedScore}/100</strong>
    </div>
    <div class="score-list">${scoreRows}</div>
    <div class="pill-list">
      <span class="pill">重点：${focusText}</span>
      <span class="pill">短板：${weakText}</span>
      <span class="pill">周期：${input.weeks} 周</span>
      <span class="pill">强度：${input.adjustment?.intensity || "标准"}</span>
    </div>
    ${adjustmentNotes}
    <p class="advice">${analysis.goalDifficulty}<br>训练建议：优先补强 ${weakText}，同时保留 ${input.model.name} 的专项核心能力。</p>
  `;
}

function scoreRow(key, score) {
  const colorClass = score < 60 ? "low" : score < 78 ? "mid" : "high";
  return `
    <div class="score-row ${colorClass}">
      <span>${LABELS[key]}</span>
      <div class="bar"><span style="width:${score}%"></span></div>
      <strong>${score}</strong>
    </div>
  `;
}

function renderTimeline(phases) {
  document.getElementById("phaseTimeline").innerHTML = phases
    .map(
      (phase) => `
      <article class="timeline-item">
        <strong>${phase.name}</strong>
        <span>${phase.weeks} 周 · ${phase.goal}</span>
      </article>
    `
    )
    .join("");
}

function renderPlan(weeks) {
  document.getElementById("weeklyPlan").innerHTML = weeks.map(renderWeekCard).join("");
}

function renderWeekCard(week) {
  const dayItems = week.days
    .map(
      (item) => `
      <li>
        <strong>${item.name} · ${item.title}</strong>
        <span>${item.detail}</span>
      </li>
    `
    )
    .join("");

  return `
    <article class="week-card">
      <div class="week-head">
        <div>
          <h3>第 ${week.weekNo} 周</h3>
          <small>${week.phase.name} · 负荷系数 ${week.load.toFixed(2)}</small>
        </div>
        <span class="pill">${week.emphasis.map((key) => LABELS[key]).join(" / ")}</span>
      </div>
      <ul class="day-list">${dayItems}</ul>
    </article>
  `;
}
