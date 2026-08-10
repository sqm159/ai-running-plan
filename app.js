const EVENT_MODELS = {
  800: {
    name: "800 米",
    goalRef: 105,
    weights: { speed: 0.22, speedEndurance: 0.25, lactate: 0.23, vo2max: 0.15, aerobic: 0.10, threshold: 0.05 },
    focus: ["速度耐力", "乳酸能力", "绝对速度"],
    longRunCap: 10,
  },
  1500: {
    name: "1500 米",
    goalRef: 210,
    weights: { vo2max: 0.25, threshold: 0.22, speedEndurance: 0.18, lactate: 0.13, speed: 0.12, aerobic: 0.10 },
    focus: ["VO₂max", "乳酸阈", "速度耐力"],
    longRunCap: 13,
  },
  3000: {
    name: "3000 米",
    goalRef: 455,
    weights: { vo2max: 0.28, threshold: 0.25, aerobic: 0.22, speedEndurance: 0.12, lactate: 0.08, speed: 0.05 },
    focus: ["VO₂max", "乳酸阈", "有氧能力"],
    longRunCap: 16,
  },
  5000: {
    name: "5000 米",
    goalRef: 780,
    weights: { aerobic: 0.32, threshold: 0.25, vo2max: 0.20, speedEndurance: 0.10, lactate: 0.08, speed: 0.05 },
    focus: ["有氧能力", "乳酸阈", "VO₂max"],
    longRunCap: 20,
  },
};

const LABELS = {
  speed: "绝对速度",
  speedEndurance: "中段速度耐力",
  lactate: "末段乳酸能力",
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

// V2.2 第四章：目标成绩能力模型（Target Performance Model）
// 取消固定项目需求，改为根据用户输入的目标成绩动态计算六维能力需求
// 每个目标成绩档位定义了达到该成绩所需的"95分标准"能力画像
const TARGET_PERFORMANCE_MODEL = {
  800: [
    { time: 100, label: "1:40",  speed: 98, speedEndurance: 98, lactate: 98, vo2max: 80, threshold: 65, aerobic: 50 },
    { time: 110, label: "1:50",  speed: 93, speedEndurance: 93, lactate: 93, vo2max: 77, threshold: 65, aerobic: 55 },
    { time: 120, label: "2:00",  speed: 90, speedEndurance: 90, lactate: 90, vo2max: 75, threshold: 65, aerobic: 60 },
    { time: 130, label: "2:10",  speed: 82, speedEndurance: 82, lactate: 82, vo2max: 72, threshold: 65, aerobic: 62 },
    { time: 140, label: "2:20",  speed: 75, speedEndurance: 75, lactate: 75, vo2max: 68, threshold: 63, aerobic: 65 },
  ],
  1500: [
    { time: 210, label: "3:30",  speed: 88, speedEndurance: 90, lactate: 88, vo2max: 95, threshold: 90, aerobic: 82 },
    { time: 225, label: "3:45",  speed: 82, speedEndurance: 85, lactate: 82, vo2max: 90, threshold: 87, aerobic: 80 },
    { time: 240, label: "4:00",  speed: 75, speedEndurance: 80, lactate: 75, vo2max: 85, threshold: 82, aerobic: 78 },
    { time: 260, label: "4:20",  speed: 68, speedEndurance: 73, lactate: 68, vo2max: 78, threshold: 75, aerobic: 75 },
    { time: 280, label: "4:40",  speed: 60, speedEndurance: 65, lactate: 60, vo2max: 72, threshold: 70, aerobic: 72 },
  ],
  3000: [
    { time: 450, label: "7:30",  speed: 72, speedEndurance: 78, lactate: 75, vo2max: 95, threshold: 92, aerobic: 88 },
    { time: 480, label: "8:00",  speed: 65, speedEndurance: 72, lactate: 68, vo2max: 90, threshold: 88, aerobic: 85 },
    { time: 510, label: "8:30",  speed: 58, speedEndurance: 65, lactate: 62, vo2max: 85, threshold: 82, aerobic: 80 },
    { time: 540, label: "9:00",  speed: 52, speedEndurance: 58, lactate: 55, vo2max: 78, threshold: 75, aerobic: 75 },
    { time: 600, label: "10:00", speed: 45, speedEndurance: 50, lactate: 48, vo2max: 70, threshold: 68, aerobic: 70 },
  ],
  5000: [
    { time: 770, label: "12:50", speed: 55, speedEndurance: 62, lactate: 58, vo2max: 95, threshold: 95, aerobic: 92 },
    { time: 810, label: "13:30", speed: 50, speedEndurance: 55, lactate: 52, vo2max: 90, threshold: 90, aerobic: 88 },
    { time: 870, label: "14:30", speed: 45, speedEndurance: 50, lactate: 48, vo2max: 85, threshold: 85, aerobic: 82 },
    { time: 960, label: "16:00", speed: 40, speedEndurance: 45, lactate: 42, vo2max: 78, threshold: 78, aerobic: 75 },
    { time: 1080,label: "18:00", speed: 35, speedEndurance: 40, lactate: 38, vo2max: 70, threshold: 70, aerobic: 68 },
  ],
};

const SIX_DIMENSIONS = ["speed", "speedEndurance", "lactate", "vo2max", "threshold", "aerobic"];

const AGE_CORRECTION = [
  { max: 14, coef: 1.12 },
  { max: 17, coef: 1.06 },
  { max: 22, coef: 1.0 },
  { max: 27, coef: 0.98 },
  { max: 32, coef: 0.95 },
  { max: 38, coef: 0.91 },
  { max: 44, coef: 0.86 },
  { max: 50, coef: 0.81 },
  { max: 99, coef: 0.75 },
];

const DEFAULT_WEIGHTS = {
  800: { speed: 20, speedEndurance: 28, lactate: 22, vo2max: 15, threshold: 5, aerobic: 10 },
  1500: { speed: 12, speedEndurance: 18, lactate: 13, vo2max: 25, threshold: 22, aerobic: 10 },
  3000: { speed: 5, speedEndurance: 12, lactate: 8, vo2max: 28, threshold: 25, aerobic: 22 },
  5000: { speed: 5, speedEndurance: 10, lactate: 8, vo2max: 20, threshold: 25, aerobic: 32 },
};

const ATHLETE_TYPE_RULES = [
  {
    id: "speed",
    label: "速度型",
    badgeClass: "badge-speed",
    // V2.2：绝对速度≥需求-5 且 中段速度耐力≤需求-10
    test: (s, d) => s.speed >= d.speed - 5 && s.speedEndurance <= d.speedEndurance - 10,
    desc: (event) => `速度储备优秀，${event}米训练应优先补强高速保持能力，同时维持速度优势。`,
  },
  {
    id: "endurance",
    label: "耐力型",
    badgeClass: "badge-endurance",
    // V2.2：有氧能力≥需求 且 绝对速度≤需求-10
    test: (s, d) => s.aerobic >= d.aerobic && s.speed <= d.speed - 10,
    desc: (event) => `耐力基础优秀，${event}米训练应重点提升速度储备和爆发力，把耐力优势转化为专项速度。`,
  },
  {
    id: "balanced",
    label: "能力型",
    badgeClass: "badge-balanced",
    test: () => true,
    desc: (event) => `各维度较为均衡，${event}米训练按目标需求分配重点，均衡提升同时补强最弱维度。`,
  },
];

const WEAKNESS_RULES = [
  {
    id: "speed_deficit",
    gapKey: "speed",
    test: (s, d) => s.speed <= d.speed - 10,
    type: (event) => `${event}米速度短板`,
    factor: "绝对速度不足",
    adjustment: "速度训练 +10%，增加 30-80m 冲刺和短距离高速跑",
    weightShift: { from: null, to: "speed", amount: 8 },
  },
  {
    id: "speedEndurance_deficit",
    gapKey: "speedEndurance",
    test: (s, d) => s.speedEndurance <= d.speedEndurance - 10,
    type: (event) => `${event}米速度耐力短板`,
    factor: "中段速度保持能力不足",
    adjustment: "速度耐力训练 +15%，增加 300-600m 专项训练",
    weightShift: { from: null, to: "speedEndurance", amount: 8 },
  },
  {
    id: "lactate_deficit",
    gapKey: "lactate",
    test: (s, d) => s.lactate <= d.lactate - 10,
    type: (event) => `${event}米乳酸耐受短板`,
    factor: "末段乳酸能力不足",
    adjustment: "乳酸耐受训练 +15%，增加 500-600m 高强度段落",
    weightShift: { from: null, to: "speedEndurance", amount: 8 },
  },
  {
    id: "vo2max_deficit",
    gapKey: "vo2max",
    test: (s, d) => s.vo2max <= d.vo2max - 10,
    type: (event) => `${event}米 VO₂max 短板`,
    factor: "最大摄氧能力不足",
    adjustment: "VO₂max 间歇 +15%，增加 800-1600m 长间歇",
    weightShift: { from: null, to: "vo2max", amount: 8 },
  },
  {
    id: "threshold_deficit",
    gapKey: "threshold",
    test: (s, d) => s.threshold <= d.threshold - 10,
    type: (event) => `${event}米乳酸阈短板`,
    factor: "乳酸阈能力不足",
    adjustment: "阈值训练 +15%，增加节奏跑和阈值间歇",
    weightShift: { from: null, to: "threshold", amount: 8 },
  },
  {
    id: "aerobic_deficit",
    gapKey: "aerobic",
    test: (s, d) => s.aerobic <= d.aerobic - 10,
    type: (event) => `${event}米有氧短板`,
    factor: "有氧基础不足",
    adjustment: "有氧跑量 +15%，延长长跑距离和轻松跑时间",
    weightShift: { from: null, to: "aerobic", amount: 8 },
  },
];

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

const EVENT_SPECIAL_WORKOUTS = {
  800: {
    build: [
      "1000m+800m+600m 递减组合，组间 6-8 分钟：1000m 控制在 1500m 节奏，800m 接近专项节奏，600m 强化后程刺激",
      "600m+400m+300m+200m 递减组合，组间 4-6 分钟：从专项耐受过渡到速度保持",
      "2 组 500m+300m，组内休 2 分钟，组间休 8 分钟：模拟 800m 中后段酸感下的节奏保持",
      "700m+500m+300m，组间 6-8 分钟：700m 稳住比赛节奏，后两段提升速度耐力",
    ],
    specific: [
      "1000m+800m+600m 专项刺激，组间充分恢复：总量不追求大，重点是每段后 200m 动作不散",
      "600m+200m 组合 ×2，组内休 2 分钟，组间休 10 分钟：600m 接近比赛节奏，200m 快速收尾",
      "500m+300m+200m，组内休 2 分钟：完整模拟 800m 后程压力和冲刺转换",
      "3×300m @ 略快于比赛节奏 + 2×200m 快速放松，组间充分恢复，保持神经速度",
    ],
  },
  1500: {
    build: [
      "4000m+2000m+1000m 递减节奏组合，组间慢跑 3-4 分钟：4000m 有氧阈值，2000m 接近 5km，1000m 接近 1500m 控制节奏",
      "3000m+2000m+1000m+400m 金字塔下降，组间 3-5 分钟：距离越短速度越快，最后 400m 保持放松",
      "2000m+1600m+1200m+800m+400m 递减组合，组间 2.5-4 分钟：从阈值过渡到专项速度",
      "1000m+800m+600m+400m+300m，组间 3-5 分钟：每段逐步提速，训练 1500m 后程变化能力",
    ],
    specific: [
      "3000m+2000m+1000m+400m 专项金字塔，组间 3-5 分钟：前两段稳住有氧，后两段进入 1500m 节奏",
      "2000m+1000m+800m+400m，组间 4 分钟：1000m 后开始接近比赛感觉，400m 快速但不僵",
      "1600m+1200m+800m+400m，组间 3-4 分钟：每段递进提速，建立从巡航到冲刺的转换",
      "1200m+800m+600m+400m，组间充分恢复：专项期高质量节奏课，保持动作完整优先",
    ],
  },
  3000: {
    build: [
      "3000m+2000m+1000m，组间慢跑 3 分钟：3000m 稳定巡航，2000m 接近阈值，1000m 提到 3km 节奏",
      "4×1200m @ 3km-5km 强度，组间 2.5-3 分钟：保持每组配速一致",
      "2000m+1600m+1200m+800m，组间 3 分钟：由有氧耐力过渡到专项节奏",
      "5×1000m @ 3km 节奏控制版，组间 2-3 分钟：最后两组保持技术动作",
    ],
    specific: [
      "2000m+1000m+800m+400m，组间 3-4 分钟：专项节奏和最后 400m 变速能力结合",
      "3×1600m @ 5km-3km 之间强度，组间 3 分钟：提高长间歇持续输出",
      "1200m+1000m+800m+600m+400m，组间 2.5-4 分钟：逐段提速，强化后程能力",
      "2×2000m @ 3km 控制强度 + 4×400m，长段稳住，短段找节奏变化",
    ],
  },
  5000: {
    build: [
      "4×1600m @ 5km-10km 之间强度，组间慢跑 2-3 分钟：重点是稳定巡航能力",
      "3×2000m @ 阈值配速，组间慢跑 3 分钟：训练 5000m 所需的高有氧输出",
      "3000m+2000m+1000m，组间慢跑 3 分钟：长段控阈值，短段接近 5km 节奏",
      "5×1200m @ 5km 配速，组间慢跑 2 分钟：提高专项节奏重复能力",
    ],
    specific: [
      "2000m+1600m+1200m+800m+400m 递减组合，组间 2.5-4 分钟：从 5km 节奏逐步过渡到最后冲刺",
      "2×3000m @ 10km-5km 之间强度，组间慢跑 4 分钟：大段落专项耐力",
      "3×2000m @ 5km 控制版，组间 3-4 分钟：要求后 1000m 不掉速",
      "1600m+1200m+1000m+800m+600m，组间 2.5-3 分钟：递减提速，强化 5000m 后程",
    ],
  },
};

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
    age: Number(document.getElementById("age").value) || 20,
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

  // V2.0 第二章：六维能力评分
  const speed = scoreFromTime(REFERENCE.speed400, estimated[400], 2.1);
  const speedEndurance = scoreSpeedEndurance(estimated[400], estimated[600]);
  const lactate = scoreLactate(estimated[600], estimated[800]);
  const vo2max = scoreVo2(estimated);
  const aerobic = scoreAerobic(estimated);
  const threshold = scoreThreshold(estimated);
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

  const ageCoef = calculateAgeCorrection(input.age);
  const correctedScores = {};
  Object.keys(rawScores).forEach((key) => {
    // V2.1 3.3：所有能力评分封顶100分
    correctedScores[key] = Math.round(clamp(rawScores[key] * ageCoef, 0, 100));
  });

  const goalDemands = calculateGoalDemandScores(input.event, input.goalTime, estimated);

  const athleteType = classifyAthleteType(correctedScores, goalDemands, input.event);

  const weaknessAnalysis = analyzeWeaknesses(correctedScores, goalDemands, input.event, athleteType);

  const weightResult = adjustTrainingWeights(input.event, correctedScores, goalDemands, weaknessAnalysis);

  const weightedScore = Math.round(
    Object.entries(input.model.weights).reduce((sum, [key, weight]) => sum + correctedScores[key] * weight, 0)
  );
  const weakKeys = Object.keys(input.model.weights)
    .sort((a, b) => (correctedScores[a] - goalDemands[a]) - (correctedScores[b] - goalDemands[b]))
    .slice(0, 3);
  const goalDifficulty = rateGoalDifficulty(input.event, input.goalTime, estimated[input.event]);

  // V2.0 第六章：异常数据检测
  const anomalies = detectAnomalies(input.times);

  // V2.1 3.5：计算能力差距等级（取消适配评分）
  const gapAnalysis = {};
  SIX_DIMENSIONS.forEach((dim) => {
    const ability = correctedScores[dim];
    const demand = goalDemands[dim];
    if (ability != null && demand != null) {
      gapAnalysis[dim] = getGapLevel(ability - demand);
    }
  });

  return {
    scores: correctedScores,
    rawScores,
    ageCoef,
    goalDemands,
    gapAnalysis,
    athleteType,
    weaknessAnalysis,
    weightResult,
    weakKeys,
    weightedScore,
    estimated,
    goalDifficulty,
    anomalies,
  };
}

// V2.2 第四章4.4：能力差距等级模型（3级制）
// 取消"适配评分"，改为能力差距等级判断
function getGapLevel(gap) {
  if (gap >= 10) return { level: "advantage", label: "优势", cls: "gap-advantage" };
  if (gap >= -10) return { level: "matched", label: "满足", cls: "gap-matched" };
  return { level: "deficit", label: "限制因素", cls: "gap-deficit" };
}

// V2.2 第四章3.7：定性标签输出
// 系统不向用户展示复杂分数，改用定性标签
function getQualitativeLabel(gap) {
  if (gap >= 10) return { label: "优势", cls: "qual-excellent" };
  if (gap >= -10) return { label: "满足", cls: "qual-good" };
  return { label: "需要提升", cls: "qual-deficit" };
}

// V2.0 第六章：异常数据检测
function detectAnomalies(times) {
  const anomalies = [];
  const checks = [
    { a: 400, b: 800, min: 1.9, max: 2.5 },
    { a: 400, b: 1500, min: 3.8, max: 5.2 },
    { a: 800, b: 1500, min: 1.8, max: 2.4 },
    { a: 1500, b: 3000, min: 1.85, max: 2.3 },
    { a: 3000, b: 5000, min: 1.55, max: 1.85 },
    { a: 5000, b: 10000, min: 1.9, max: 2.2 },
  ];
  checks.forEach(({ a, b, min, max }) => {
    if (times[a] && times[b]) {
      const ratio = times[b] / times[a];
      if (ratio < min || ratio > max) {
        anomalies.push(`${a}米与${b}米成绩组合不符合常规（比值${ratio.toFixed(2)}），请检查输入。`);
      }
    }
  });
  return anomalies;
}

function calculateAgeCorrection(age) {
  const entry = AGE_CORRECTION.find((item) => age <= item.max);
  return entry ? entry.coef : 0.75;
}

function deriveGoalTimes(event, goalTime) {
  const factors = {
    400: { 800: 0.46, 1500: 0.225, 3000: 0.105, 5000: 0.06, 10000: 0.028 },
    600: { 800: 0.70, 1500: 0.34, 3000: 0.16, 5000: 0.092, 10000: 0.043 },
    800: { 400: 2.17, 1500: 0.49, 3000: 0.23, 5000: 0.13, 10000: 0.061 },
    1500: { 400: 4.45, 600: 2.95, 800: 2.04, 3000: 0.47, 5000: 0.27, 10000: 0.126 },
    3000: { 400: 9.5, 600: 6.25, 800: 4.35, 1500: 2.13, 5000: 0.57, 10000: 0.27 },
    5000: { 400: 16.5, 600: 10.9, 800: 7.7, 1500: 3.7, 3000: 1.75, 10000: 0.48 },
    10000: { 400: 35, 600: 23, 800: 16.3, 1500: 7.9, 3000: 3.7, 5000: 2.08 },
  };

  const goalTimes = {};
  goalTimes[event] = goalTime;

  for (const target of [400, 600, 800, 1500, 3000, 5000, 10000]) {
    if (String(target) === String(event)) continue;
    const factor = factors[target]?.[event];
    if (factor) {
      goalTimes[target] = goalTime * factor;
    }
  }

  for (const target of [400, 600, 800, 1500, 3000, 5000, 10000]) {
    if (goalTimes[target]) continue;
    const estimates = [];
    for (const [source, srcTime] of Object.entries(goalTimes)) {
      const f = factors[target]?.[source];
      if (srcTime && f) estimates.push(srcTime * f);
    }
    if (estimates.length) goalTimes[target] = average(estimates);
  }

  return goalTimes;
}

function calculateGoalDemandScores(event, goalTime, estimated) {
  // V2.2 第四章：目标成绩能力模型
  // 不再使用固定项目需求，改为根据用户输入的目标成绩动态计算六维能力需求
  // 通过在档位之间线性插值，得到该目标成绩所需的能力画像
  return calculateTargetProfile(event, goalTime);
}

// V2.2 第四章：根据目标成绩计算六维能力需求（线性插值）
function calculateTargetProfile(event, targetTime) {
  const tiers = TARGET_PERFORMANCE_MODEL[event];
  if (!tiers || !tiers.length) {
    return { speed: 70, speedEndurance: 70, lactate: 70, vo2max: 70, threshold: 70, aerobic: 70 };
  }

  // 如果目标成绩比最快档位还快，使用最快档位
  if (targetTime <= tiers[0].time) {
    return extractProfile(tiers[0]);
  }
  // 如果目标成绩比最慢档位还慢，使用最慢档位
  const last = tiers[tiers.length - 1];
  if (targetTime >= last.time) {
    return extractProfile(last);
  }

  // 找到目标成绩所在的区间，进行线性插值
  for (let i = 0; i < tiers.length - 1; i++) {
    const lower = tiers[i];
    const upper = tiers[i + 1];
    if (targetTime >= lower.time && targetTime <= upper.time) {
      const ratio = (targetTime - lower.time) / (upper.time - lower.time);
      const result = {};
      SIX_DIMENSIONS.forEach((dim) => {
        // 时间越慢（ratio越大），能力需求越低
        result[dim] = Math.round(lower[dim] + (upper[dim] - lower[dim]) * ratio);
      });
      return result;
    }
  }

  return extractProfile(tiers[0]);
}

function extractProfile(tier) {
  const result = {};
  SIX_DIMENSIONS.forEach((dim) => {
    result[dim] = tier[dim];
  });
  return result;
}

function classifyAthleteType(scores, goalDemands, event) {
  const eventName = EVENT_MODELS[event].name.replace(" 米", "");
  const rule = ATHLETE_TYPE_RULES.find((r) => r.test(scores, goalDemands));
  return {
    id: rule.id,
    label: rule.label,
    badgeClass: rule.badgeClass,
    description: rule.desc(eventName),
  };
}

function analyzeWeaknesses(scores, goalDemands, event, athleteType) {
  const eventName = EVENT_MODELS[event].name.replace(" 米", "");

  // V2.0 第五章：短板识别
  // 找出所有满足条件的短板规则
  const matched = WEAKNESS_RULES.filter((rule) => rule.test(scores, goalDemands));

  // 按差距大小排序，差距最大的排在前面
  const results = matched.map((rule) => {
    const dim = rule.gapKey || rule.id.replace("_deficit", "");
    const gap = scores[dim] != null && goalDemands[dim] != null
      ? goalDemands[dim] - scores[dim]
      : 10;
    return {
      type: rule.type(eventName),
      factor: rule.factor,
      adjustment: rule.adjustment,
      weightShift: rule.weightShift,
      gap,
    };
  }).sort((a, b) => b.gap - a.gap);

  if (!results.length) {
    // V2.0 第五章：找差距最大的能力作为主要限制因素
    const dims = SIX_DIMENSIONS.filter((d) => scores[d] != null && goalDemands[d] != null);
    if (dims.length) {
      const weakest = dims
        .sort((a, b) => (scores[a] - goalDemands[a]) - (scores[b] - goalDemands[b]))[0];
      const gap = goalDemands[weakest] - scores[weakest];
      return [{
        type: `${eventName}米${athleteType.label}运动员`,
        factor: `${LABELS[weakest]}是主要限制因素`,
        adjustment: `重点补强${LABELS[weakest]}，当前差距${gap}分`,
        weightShift: { from: null, to: weakest, amount: 8 },
        gap,
      }];
    }
    return [{
      type: `${eventName}米均衡型`,
      factor: "各维度基本达标",
      adjustment: "维持标准训练分配，按周期计划推进",
      weightShift: null,
      gap: 0,
    }];
  }

  return results;
}

function adjustTrainingWeights(event, scores, goalDemands, weaknessAnalysis) {
  const defaults = { ...DEFAULT_WEIGHTS[event] };
  const adjusted = { ...defaults };

  weaknessAnalysis.forEach((w) => {
    if (!w.weightShift) return;
    const { from, to, amount } = w.weightShift;
    if (from && adjusted[from] != null) {
      adjusted[from] = Math.max(5, adjusted[from] - amount);
    }
    if (to && adjusted[to] != null) {
      adjusted[to] = adjusted[to] + amount;
    } else if (to && adjusted[to] == null) {
      adjusted[to] = amount;
    }
  });

  return { default: defaults, adjusted, changed: JSON.stringify(defaults) !== JSON.stringify(adjusted) };
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

function avgVal(values) {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  return valid.length ? average(valid) : 0;
}

function scoreSpeedEndurance(t400, t600) {
  // V2.0 第二章2.2：中段速度耐力
  // 比较400m速度延伸后的理论600m能力与实际600m成绩
  // 中段速度保持率 = 理论600m时间 / 实际600m时间
  if (!t400 || !t600) return null;
  const theoretical600 = t400 * (REFERENCE.lactate600 / REFERENCE.speed400);
  const ratio = theoretical600 / t600;
  return clamp(100 * Math.pow(ratio, 2.5), 25, 100);
}

function scoreLactate(t600, t800) {
  // V2.0 第二章2.3：末段乳酸能力
  // 计算600m结束后的最后200m速度下降程度
  // 末段速度下降 = 最后200m时间 - 前200m平均时间
  // 下降越小，乳酸能力越强
  if (!t600 || !t800) return null;
  const last200 = t800 - t600;
  const avg200 = t600 / 3;
  const dropRatio = last200 / avg200;
  return clamp(100 * Math.pow(1 / dropRatio, 3), 25, 100);
}

function scoreVo2(times) {
  // V2.0 第二章2.4：VO₂max能力
  // 数据来源：1500m, 3000m
  const candidates = [
    scoreFromTime(REFERENCE.t1500, times[1500], 1.9),
    scoreFromTime(REFERENCE.t3000, times[3000], 2.0),
  ].filter(Boolean);
  return candidates.length ? average(candidates) : null;
}

function scoreAerobic(times) {
  // V2.0 第二章2.5：有氧能力
  // 数据来源：3000m, 5000m, 10km
  const candidates = [
    scoreFromTime(REFERENCE.t3000, times[3000], 2.0),
    scoreFromTime(REFERENCE.t5000, times[5000], 2.0),
    scoreFromTime(REFERENCE.t10000, times[10000], 2.0),
  ].filter(Boolean);
  return candidates.length ? average(candidates) : null;
}

function scoreThreshold(times) {
  // V2.0 第二章2.6：乳酸阈能力
  // 数据来源：5000m, 10km
  // 注意：1500米成绩不能直接代表乳酸阈能力
  const candidates = [
    times[5000] ? scoreFromTime(REFERENCE.t5000, times[5000], 1.8) : null,
    times[10000] ? scoreFromTime(REFERENCE.t10000, times[10000], 1.8) : null,
  ].filter(Boolean);
  if (!candidates.length) return null;
  return average(candidates);
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

  const adjustedWeights = analysis.weightResult?.adjusted || input.model.weights;
  const sortedByWeight = Object.keys(adjustedWeights)
    .filter((k) => k !== "strength")
    .sort((a, b) => (adjustedWeights[b] || 0) - (adjustedWeights[a] || 0));

  if (phase.id === "base") return removeAvoided([...new Set([...requestedFocus, "aerobic", "strength", analysis.weakKeys[0]])]).slice(0, 3);
  if (phase.id === "taper") return removeAvoided([...new Set([...requestedFocus, "speed", analysis.weakKeys[0], "aerobic"])]).slice(0, 3);
  return removeAvoided([...new Set([...requestedFocus, ...sortedByWeight.slice(0, 2), analysis.weakKeys[0]])]).slice(0, 3);
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
  const specialWorkout = getEventSpecialWorkout(input.event, phase.id, weekNo);
  const qualityDayTitle = specialWorkout ? `${input.model.name} 专项刺激` : LABELS[secondary];
  const qualityDayDetail = specialWorkout || `${getWorkout(phase.id, secondary, weekNo, 2)}。${modifier}`;

  const fullWeek = [
    day("周一", "恢复与灵活性", applyNeedAdjustment(input, `轻松跑 ${Math.max(20, easyMinutes - 12)} 分钟 + 拉伸放松，RPE 3-4。`, "recovery")),
    day("周二", LABELS[primary], applyNeedAdjustment(input, `${getWorkout(phase.id, primary, weekNo, 0)}。${paceHint}${modifier}`, primary)),
    day("周三", "力量与轻松跑", applyNeedAdjustment(input, `${getWorkout(phase.id, "strength", weekNo, 1)} + 轻松跑 ${Math.max(18, easyMinutes - 15)} 分钟。`, "strength")),
    day("周四", qualityDayTitle, applyNeedAdjustment(input, qualityDayDetail, specialWorkout ? "eventSpecific" : secondary)),
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

function getEventSpecialWorkout(event, phaseId, weekNo) {
  if (!["build", "specific"].includes(phaseId)) return null;
  const eventLibrary = EVENT_SPECIAL_WORKOUTS[event]?.[phaseId];
  if (!eventLibrary?.length) return null;
  const workout = eventLibrary[(weekNo - 1) % eventLibrary.length];
  return `${workout}。这节课属于专项刺激课，热身至少 15-20 分钟，结束后慢跑放松 10 分钟`;
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
  // V2.0 第七章 + V2.1 3.7：教练化语言输出
  const weakText = analysis.weakKeys.map((key) => LABELS[key]).join("、");
  const focusText = input.model.focus.join("、");
  const typeBadge = analysis.athleteType;

  // V2.0 第六章：异常数据警告
  const anomalyWarning = analysis.anomalies?.length
    ? `<div class="adjustment-box" style="border-color:var(--red);background:linear-gradient(180deg,#fff5f4,#fef0ee)"><strong style="color:var(--red)">⚠ 数据异常提醒</strong>${analysis.anomalies.map((a) => `<p style="color:#a04030">${a}</p>`).join("")}</div>`
    : "";

  // V2.1 3.5：能力评估详情（用差距等级替代适配评分）
  const scoreRows = SIX_DIMENSIONS
    .map((dim) => {
      const absScore = analysis.scores[dim] ?? "—";
      const demand = analysis.goalDemands[dim] ?? "—";
      const gapInfo = analysis.gapAnalysis?.[dim];
      const gapLabel = gapInfo ? gapInfo.label : "—";
      const gapCls = gapInfo ? gapInfo.cls : "";
      const diff = typeof absScore === "number" && typeof demand === "number" ? absScore - demand : 0;
      const cls = diff > 10 ? "surplus" : diff < -10 ? "deficit" : "balanced";
      const sign = diff > 0 ? "+" : "";
      return `<tr><td>${LABELS[dim]}</td><td>${absScore}</td><td>${demand}</td><td class="${cls}">${sign}${diff}</td><td class="${gapCls}">${gapLabel}</td></tr>`;
    })
    .join("");

  // V2.1 3.7：能力画像（定性标签替代复杂分数）
  const abilityProfile = SIX_DIMENSIONS
    .map((dim) => {
      const score = analysis.scores[dim];
      const demand = analysis.goalDemands[dim];
      if (score == null || demand == null) return null;
      const gap = score - demand;
      const qual = getQualitativeLabel(gap);
      return `<div class="profile-item ${qual.cls}"><span class="profile-label">${LABELS[dim]}</span><span class="profile-value">${qual.label}</span></div>`;
    })
    .filter(Boolean)
    .join("");

  // V2.1 3.7：教练建议
  const coachAdvice = generateCoachAdvice(analysis, input);

  const weaknessItems = analysis.weaknessAnalysis
    .map((w) => `
      <div class="weakness-item">
        <span class="wk-label">类型</span><span class="wk-value">${w.type}</span>
        <span class="wk-label">限制因素</span><span class="wk-value">${w.factor}</span>
        <span class="wk-label">训练调整</span><span class="wk-value">${w.adjustment}</span>
      </div>
    `)
    .join("");

  const adjustmentNotes = input.adjustment?.notes?.length
    ? `<div class="adjustment-box"><strong>动态调整</strong>${input.adjustment.notes.map((note) => `<p>${note}</p>`).join("")}</div>`
    : "";

  // V2.0 第七章：教练语言描述优势
  const advantageDims = SIX_DIMENSIONS
    .filter((d) => analysis.scores[d] != null && analysis.goalDemands[d] != null)
    .filter((d) => analysis.scores[d] >= analysis.goalDemands[d] - 10)
    .sort((a, b) => (analysis.scores[b] - analysis.goalDemands[b]) - (analysis.scores[a] - analysis.goalDemands[a]));
  const advantageText = advantageDims.length
    ? advantageDims.slice(0, 2).map((d) => LABELS[d]).join("、")
    : "各维度均有提升空间";

  document.getElementById("summary").innerHTML = `
    <p class="eyebrow">Analysis</p>
    <h2>${input.model.name} 训练分析</h2>
    ${anomalyWarning}
    <div class="athlete-type-box">
      <span class="athlete-type-badge ${typeBadge.badgeClass}">${typeBadge.label}</span>
      <span class="athlete-type-desc">${typeBadge.description}</span>
    </div>
    <div class="metric">
      <span>运动员类型：${typeBadge.label}${input.model.name}运动员（年龄修正系数 ${analysis.ageCoef}）</span>
      <strong>专项综合评分 ${analysis.weightedScore}/100</strong>
    </div>
    <div class="metric" style="margin-top:8px">
      <span>优势：${advantageText}</span>
      <strong>限制因素：${weakText || "—"}</strong>
    </div>
    <div class="radar-section">
      <canvas class="radar-canvas" id="radarChart" width="360" height="360"></canvas>
      <div class="radar-legend">
        <span><span class="dot dot-current"></span>当前能力</span>
        <span><span class="dot dot-target"></span>目标需求</span>
      </div>
    </div>
    <h4 style="margin:16px 0 6px;font-size:15px;color:var(--green-dark)">能力画像</h4>
    <div class="ability-profile">${abilityProfile}</div>
    <h4 style="margin:16px 0 6px;font-size:15px;color:var(--green-dark)">能力评估详情</h4>
    <table class="demand-table">
      <thead><tr><th>维度</th><th>能力评分</th><th>目标需求</th><th>差值</th><th>差距等级</th></tr></thead>
      <tbody>${scoreRows}</tbody>
    </table>
    <div class="coach-advice-box">
      <h4>教练建议</h4>
      <p><strong>你的主要限制因素：</strong>${coachAdvice.limitingFactor}</p>
      <p><strong>未来训练重点：</strong>${coachAdvice.trainingFocus}</p>
    </div>
    <div class="weakness-box">
      <h4>短板识别与训练调整</h4>
      ${weaknessItems}
    </div>
    ${analysis.weightResult.changed ? `
    <div class="weight-box">
      <h4>训练权重调整</h4>
      <div class="weight-comparison">
        <div class="weight-col">
          <h5>默认分配</h5>
          ${Object.keys(analysis.weightResult.default).map((key) => {
            const v = analysis.weightResult.default[key];
            return `<div class="weight-bar-item wb-default"><span class="wb-label">${LABELS[key] || key}</span><div class="wb-bar"><span style="width:${(v / 40) * 100}%"></span></div><span class="wb-value">${v}</span></div>`;
          }).join("")}
        </div>
        <div class="weight-col">
          <h5>调整后分配</h5>
          ${Object.keys(analysis.weightResult.adjusted).map((key) => {
            const v = analysis.weightResult.adjusted[key];
            return `<div class="weight-bar-item wb-adjusted"><span class="wb-label">${LABELS[key] || key}</span><div class="wb-bar"><span style="width:${(v / 40) * 100}%"></span></div><span class="wb-value">${v}</span></div>`;
          }).join("")}
        </div>
      </div>
    </div>
    ` : ""}
    <div class="pill-list">
      <span class="pill">类型：${typeBadge.label}</span>
      <span class="pill">优势：${advantageText}</span>
      <span class="pill">短板：${weakText}</span>
      <span class="pill">周期：${input.weeks} 周</span>
      <span class="pill">强度：${input.adjustment?.intensity || "标准"}</span>
    </div>
    ${adjustmentNotes}
    <p class="advice">${analysis.goalDifficulty}<br>训练重点：未来训练周期优先补强 ${weakText}，将训练优势转化为 ${input.model.name} 专项成绩。</p>
  `;

  drawRadarChart("radarChart", analysis.scores, analysis.goalDemands);
}

// V2.1 3.7：教练建议生成函数
function generateCoachAdvice(analysis, input) {
  const eventName = input.model.name.replace(" 米", "");

  // V2.1 3.6：训练决策基于最大差距而非最低分
  const gaps = SIX_DIMENSIONS
    .filter((d) => analysis.scores[d] != null && analysis.goalDemands[d] != null)
    .map((d) => ({
      dim: d,
      gap: analysis.scores[d] - analysis.goalDemands[d],
      score: analysis.scores[d],
      demand: analysis.goalDemands[d],
    }))
    .sort((a, b) => a.gap - b.gap); // 差距最大的排最前

  const maxGap = gaps[0];
  const limitingFactor = maxGap && maxGap.gap < -10
    ? `${LABELS[maxGap.dim]}（当前${maxGap.score}分，目标需求${maxGap.demand}分，差距${maxGap.gap}分）`
    : "各维度基本达标，无明显限制因素";

  // 根据最大差距维度生成训练重点
  const focusMap = {
    speed: "提高短距离冲刺和速度力量，增加 30-80m 高速跑训练",
    speedEndurance: "提升中段速度保持能力，增加 300-600m 专项训练",
    lactate: "强化末段乳酸耐受能力，增加 500-600m 高强度段落",
    vo2max: "提升最大摄氧能力，增加 800-1600m 长间歇训练",
    threshold: "加强乳酸阈能力，增加节奏跑和阈值间歇训练",
    aerobic: "夯实有氧基础，延长长跑距离和轻松跑时间",
  };

  const trainingFocus = maxGap && maxGap.gap < -10
    ? `${focusMap[maxGap.dim]}，同时保持现有优势维度`
    : `按${eventName}米目标需求均衡分配训练重点，持续提升专项综合能力`;

  return { limitingFactor, trainingFocus };
}

function scoreRowWithDemand(key, score) {
  const colorClass = score < 60 ? "low" : score < 78 ? "mid" : "high";
  return `
    <div class="score-row ${colorClass}">
      <span>${LABELS[key]}</span>
      <div class="bar"><span style="width:${Math.min(score, 100)}%"></span></div>
      <strong>${score}</strong>
    </div>
  `;
}

function drawRadarChart(canvasId, currentScores, targetScores) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 50;
  const dims = SIX_DIMENSIONS;
  const n = dims.length;
  const angleStep = (Math.PI * 2) / n;
  // V2.1 3.3：雷达图最大值改为100（所有能力评分封顶100分）
  const minVal = 20;
  const maxVal = 100;
  const range = maxVal - minVal;

  const valToRadius = (val) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val ?? 0));
    return ((clamped - minVal) / range) * radius;
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // V2.1：网格标签更新为0-100范围
  const gridLabels = ["40", "55", "70", "85", "100"];
  for (let level = 1; level <= 5; level++) {
    const r = (radius * level) / 5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = level === 5 ? "rgba(100,112,103,0.3)" : "rgba(100,112,103,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(100,112,103,0.5)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  for (let level = 1; level <= 5; level++) {
    const r = (radius * level) / 5;
    ctx.fillText(gridLabels[level - 1], cx + 3, cy - r + 3);
  }

  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + Math.cos(angle) * (radius + 28);
    const y = cy + Math.sin(angle) * (radius + 28);
    ctx.fillStyle = "#3a4a3f";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(LABELS[dims[i]], x, y);
  }

  const drawPolygon = (scores, fill, stroke, lineWidth) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const r = valToRadius(scores[dims[idx]]);
      const angle = -Math.PI / 2 + idx * angleStep;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  drawPolygon(targetScores, "rgba(214,122,44,0.1)", "rgba(214,122,44,0.8)", 2);

  for (let i = 0; i < n; i++) {
    const r = valToRadius(targetScores[dims[i]]);
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#d67a2c";
    ctx.fill();
  }

  drawPolygon(currentScores, "rgba(31,122,76,0.2)", "rgba(31,122,76,1)", 2.5);

  for (let i = 0; i < n; i++) {
    const r = valToRadius(currentScores[dims[i]]);
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#1f7a4c";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
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
