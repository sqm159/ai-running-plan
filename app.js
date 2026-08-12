/* =========================================================================
 * AI 中长跑训练系统 V1.0
 * -------------------------------------------------------------------------
 * 多页面改造 + 用户账户 + 用户数据保存 + 成绩数据库
 *
 *   - 分析/计划生成逻辑保持原 Work 模式实现不变（六维能力、目标成绩模型、
 *     运动员类型识别、短板识别、训练权重调整、周期计划、配速体系）。
 *   - 新增：Supabase 客户端、用户认证、数据持久化、Hash 路由、多页面渲染。
 *
 * 文件结构：
 *   1) 核心常量与数据模型
 *   2) 通用工具（时间解析、Toast、字段读写、HTML 转义）
 *   3) 输入解析与进一步需求分析
 *   4) 能力分析核心（analyzeAthlete 及其依赖）
 *   5) 训练计划生成
 *   6) 配速体系
 *   7) 渲染函数（雷达图 / 分析摘要 / 周期 / 周计划）
 *   8) Supabase 客户端 + 认证模块 + 数据库模块
 *   9) Hash 路由 + 页面渲染器
 *  10) 启动引导
 * ========================================================================= */

/* ===================== 1. 核心常量与数据模型 ===================== */

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
    test: (s, d) => (s.speed - s.aerobic >= 10) && s.speed >= d.speed - 15,
    desc: (event) => `速度储备优秀，${event}米训练应优先补强高速保持能力，同时维持速度优势。`,
  },
  {
    id: "endurance",
    label: "耐力型",
    badgeClass: "badge-endurance",
    test: (s, d) => s.speed - s.aerobic <= -10,
    desc: (event) => `耐力基础优秀，${event}米训练应重点提升速度储备和爆发力，把耐力优势转化为专项速度。`,
  },
  {
    id: "balanced",
    label: "均衡型",
    badgeClass: "badge-balanced",
    test: () => true,
    desc: (event) => `各项能力较均衡，${event}米训练按目标需求分配重点，均衡提升同时补强最弱维度。`,
  },
];

const WEAKNESS_RULES = [
  { id: "speed_deficit", gapKey: "speed", test: (s, d) => s.speed <= d.speed - 10, type: (event) => `${event}米速度短板`, factor: "绝对速度不足", adjustment: "速度训练 +10%，增加 30-80m 冲刺和短距离高速跑", weightShift: { from: null, to: "speed", amount: 8 } },
  { id: "speedEndurance_deficit", gapKey: "speedEndurance", test: (s, d) => s.speedEndurance <= d.speedEndurance - 10, type: (event) => `${event}米速度耐力短板`, factor: "中段速度保持能力不足", adjustment: "速度耐力训练 +15%，增加 300-600m 专项训练", weightShift: { from: null, to: "speedEndurance", amount: 8 } },
  { id: "lactate_deficit", gapKey: "lactate", test: (s, d) => s.lactate <= d.lactate - 10, type: (event) => `${event}米乳酸耐受短板`, factor: "末段乳酸能力不足", adjustment: "乳酸耐受训练 +15%，增加 500-600m 高强度段落", weightShift: { from: null, to: "lactate", amount: 8 } },
  { id: "vo2max_deficit", gapKey: "vo2max", test: (s, d) => s.vo2max <= d.vo2max - 10, type: (event) => `${event}米 VO₂max 短板`, factor: "最大摄氧能力不足", adjustment: "VO₂max 间歇 +15%，增加 800-1600m 长间歇", weightShift: { from: null, to: "vo2max", amount: 8 } },
  { id: "threshold_deficit", gapKey: "threshold", test: (s, d) => s.threshold <= d.threshold - 10, type: (event) => `${event}米乳酸阈短板`, factor: "乳酸阈能力不足", adjustment: "阈值训练 +15%，增加节奏跑和阈值间歇", weightShift: { from: null, to: "threshold", amount: 8 } },
  { id: "aerobic_deficit", gapKey: "aerobic", test: (s, d) => s.aerobic <= d.aerobic - 10, type: (event) => `${event}米有氧短板`, factor: "有氧基础不足", adjustment: "有氧跑量 +15%，延长长跑距离和轻松跑时间", weightShift: { from: null, to: "aerobic", amount: 8 } },
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

/* ===================== 2. 通用工具 ===================== */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getFieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

let _toastTimer = null;
function showToast(message, type) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast" + (type ? ` toast-${type}` : "");
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.remove(), 2600);
}

/* ===================== 3. 输入解析与进一步需求 ===================== */

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

function scoreFromTime(reference, actual, k = 2) {
  if (!actual) return null;
  return clamp(100 * Math.pow(reference / actual, k), 25, 100);
}

/* ===================== 4. 能力分析核心 ===================== */

function analyzeAthlete(input) {
  const t = input.times;
  const estimated = estimateMissingTimes(t, input.event, input.goalTime);

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

  const anomalies = detectAnomalies(input.times);

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

function getGapLevel(gap) {
  if (gap >= 10) return { level: "advantage", label: "优势", cls: "gap-advantage" };
  if (gap >= -10) return { level: "matched", label: "满足", cls: "gap-matched" };
  return { level: "deficit", label: "限制因素", cls: "gap-deficit" };
}

function getQualitativeLabel(gap) {
  if (gap >= 10) return { label: "优势", cls: "qual-excellent" };
  if (gap >= -10) return { label: "满足", cls: "qual-good" };
  return { label: "需要提升", cls: "qual-deficit" };
}

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
  return calculateTargetProfile(event, goalTime);
}

function calculateTargetProfile(event, targetTime) {
  const tiers = TARGET_PERFORMANCE_MODEL[event];
  if (!tiers || !tiers.length) {
    return { speed: 70, speedEndurance: 70, lactate: 70, vo2max: 70, threshold: 70, aerobic: 70 };
  }

  if (targetTime <= tiers[0].time) {
    return extractProfile(tiers[0]);
  }
  const last = tiers[tiers.length - 1];
  if (targetTime >= last.time) {
    return extractProfile(last);
  }

  for (let i = 0; i < tiers.length - 1; i++) {
    const lower = tiers[i];
    const upper = tiers[i + 1];
    if (targetTime >= lower.time && targetTime <= upper.time) {
      const ratio = (targetTime - lower.time) / (upper.time - lower.time);
      const result = {};
      SIX_DIMENSIONS.forEach((dim) => {
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
  const sbi = scores.speed != null && scores.aerobic != null
    ? scores.speed - scores.aerobic : 0;

  const rule = ATHLETE_TYPE_RULES.find((r) => r.test(scores, goalDemands));
  let description = rule.desc(eventName);
  let limitingFactor = null;

  if (event === 800) {
    if (rule.id === "speed" && scores.lactate != null && goalDemands.lactate != null) {
      if (scores.lactate < goalDemands.lactate - 15) {
        const lactateGap = goalDemands.lactate - scores.lactate;
        limitingFactor = "末段乳酸能力";
        description = `速度偏向指数 ${sbi}，速度储备较好，但末段乳酸能力明显不足（差距 ${lactateGap} 分），速度优势尚未转化为 ${eventName}米成绩。训练重点：增加 300-600m 专项乳酸耐受训练。`;
      }
    } else if (rule.id === "endurance" && scores.speed != null && goalDemands.speed != null) {
      if (scores.speed < goalDemands.speed - 15) {
        const speedGap = goalDemands.speed - scores.speed;
        limitingFactor = "绝对速度";
        description = `速度偏向指数 ${sbi}，有氧基础强，但绝对速度明显不足（差距 ${speedGap} 分），需要提升速度储备。训练重点：增加 100-200m 速度训练、爆发力训练。`;
      }
    }
  }

  return {
    id: rule.id,
    label: rule.label,
    badgeClass: rule.badgeClass,
    description,
    limitingFactor,
    sbi,
  };
}

function analyzeWeaknesses(scores, goalDemands, event, athleteType) {
  const eventName = EVENT_MODELS[event].name.replace(" 米", "");

  const matched = WEAKNESS_RULES.filter((rule) => rule.test(scores, goalDemands));

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
    const dims = SIX_DIMENSIONS.filter((d) => scores[d] != null && goalDemands[d] != null);
    if (dims.length) {
      const weakest = dims
        .sort((a, b) => (scores[a] - goalDemands[a]) - (scores[b] - goalDemands[b]))[0];
      const gap = goalDemands[weakest] - scores[weakest];
      return [{
        type: `${athleteType.label}${eventName}米运动员`,
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
  if (!t400 || !t600) return null;
  const theoretical600 = t400 * (REFERENCE.lactate600 / REFERENCE.speed400);
  const ratio = theoretical600 / t600;
  return clamp(100 * Math.pow(ratio, 2.5), 25, 100);
}

function scoreLactate(t600, t800) {
  if (!t600 || !t800) return null;
  const last200 = t800 - t600;
  const avg200 = t600 / 3;
  const dropRatio = last200 / avg200;
  return clamp(100 * Math.pow(1 / dropRatio, 3), 25, 100);
}

function scoreVo2(times) {
  const candidates = [
    scoreFromTime(REFERENCE.t1500, times[1500], 1.9),
    scoreFromTime(REFERENCE.t3000, times[3000], 2.0),
  ].filter(Boolean);
  return candidates.length ? average(candidates) : null;
}

function scoreAerobic(times) {
  const candidates = [
    scoreFromTime(REFERENCE.t3000, times[3000], 2.0),
    scoreFromTime(REFERENCE.t5000, times[5000], 2.0),
    scoreFromTime(REFERENCE.t10000, times[10000], 2.0),
  ].filter(Boolean);
  return candidates.length ? average(candidates) : null;
}

function scoreThreshold(times) {
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

/* ===================== 5. 训练计划生成 ===================== */

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

  const gaps = {};
  SIX_DIMENSIONS.forEach((k) => {
    gaps[k] = analysis.scores[k] != null && analysis.goalDemands[k] != null
      ? analysis.scores[k] - analysis.goalDemands[k] : -999;
  });

  const sortedByGap = SIX_DIMENSIONS
    .filter((k) => gaps[k] < 10)
    .sort((a, b) => gaps[a] - gaps[b]);

  const validFocus = requestedFocus.filter((k) => gaps[k] < 0);

  if (phase.id === "base") return removeAvoided([...new Set([...sortedByGap.slice(0, 2), ...validFocus, "aerobic", "strength"])]).slice(0, 3);
  if (phase.id === "taper") return removeAvoided([...new Set([...sortedByGap.slice(0, 1), ...validFocus, "speed", "aerobic"])]).slice(0, 3);
  return removeAvoided([...new Set([...sortedByGap.slice(0, 3), ...validFocus])]).slice(0, 3);
}

function buildWeekDays(input, analysis, phase, load, weekNo) {
  const emphasis = pickEmphasis(input, analysis, phase);
  const primary = emphasis[0];
  const secondary = emphasis[1] || "aerobic";
  const tertiary = emphasis[2] || "strength";
  const hasProtectionNeed = input.adjustment?.intensity?.includes("降低") || input.adjustment?.intensity?.includes("保护");
  const longRunDistance = Math.min(input.model.longRunCap, Math.max(hasProtectionNeed ? 4 : 5, input.longRun * load)).toFixed(1);
  const easyMinutes = Math.round((30 + input.daysPerWeek * 4) * load);
  const modifier = input.adjustment?.sessionModifier ? ` ${input.adjustment.sessionModifier}` : "";
  const specialWorkout = getEventSpecialWorkout(input.event, phase.id, weekNo);
  const qualityDayTitle = specialWorkout ? `${input.model.name} 专项刺激` : LABELS[secondary];

  const paceFor = (type) => buildPaceHintForType(input, analysis, type);
  const paceHintPrimary = paceFor(primary);
  const paceHintSecondary = paceFor(specialWorkout ? "eventSpecific" : secondary);
  const paceHintTertiary = paceFor(tertiary);
  const paceHintRecovery = paceFor("recovery");
  const paceHintAerobic = paceFor("aerobic");

  const qualityDayDetail = specialWorkout
    ? `${specialWorkout} ${paceHintSecondary}`
    : `${getWorkout(phase.id, secondary, weekNo, 2)}。${paceHintSecondary}${modifier}`;

  const fullWeek = [
    day("周一", "恢复与灵活性", applyNeedAdjustment(input, `轻松跑 ${Math.max(20, easyMinutes - 12)} 分钟 + 拉伸放松，RPE 3-4。${paceHintRecovery}`, "recovery")),
    day("周二", LABELS[primary], applyNeedAdjustment(input, `${getWorkout(phase.id, primary, weekNo, 0)}。${paceHintPrimary}${modifier}`, primary)),
    day("周三", "力量与轻松跑", applyNeedAdjustment(input, `${getWorkout(phase.id, "strength", weekNo, 1)} + 轻松跑 ${Math.max(18, easyMinutes - 15)} 分钟。${paceHintRecovery}`, "strength")),
    day("周四", qualityDayTitle, applyNeedAdjustment(input, qualityDayDetail, specialWorkout ? "eventSpecific" : secondary)),
    day("周五", "休息或交叉训练", "完全休息，或骑行/游泳 30 分钟，保持低强度。"),
    day("周六", LABELS[tertiary], applyNeedAdjustment(input, `${getWorkout(phase.id, tertiary, weekNo, 3)}。${paceHintTertiary}${modifier}`, tertiary)),
    day("周日", "有氧长跑", applyNeedAdjustment(input, `轻松长跑 ${longRunDistance} km，最后 5 分钟放松慢跑。${paceHintAerobic}`, "aerobic")),
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
  return `参考配速：${event}m 比赛节奏约 ${pacePerUnit.toFixed(1)} 秒/100m，其他训练类型配速见上方「训练配速参考表」。`;
}

/* ===================== 6. 配速体系 ===================== */

function buildPaceHintForType(input, analysis, trainingType) {
  const est = analysis.estimated;
  const event = Number(input.event);
  const goalTime = input.goalTime;

  const t400 = est[400];
  const t800 = est[800] || (event === 800 ? goalTime : null);
  const t1500 = est[1500];
  const t3000 = est[3000];
  const t5000 = est[5000];
  const t10000 = est[10000];

  const per100 = (time, dist) => (time && dist ? time / (dist / 100) : null);
  const perKm = (time, dist) => (time && dist ? time / (dist / 1000) : null);

  const thresholdPerKm = t5000 ? perKm(t5000, 5000) * 1.07 : (t3000 ? perKm(t3000, 3000) * 1.10 : null);
  const easyPerKm = thresholdPerKm ? thresholdPerKm + 65 : null;
  const sprintPer100 = t400 ? per100(t400, 400) * 0.92 : null;
  const racePer100 = goalTime ? per100(goalTime, event) : null;

  const fmt = formatPaceTime;

  switch (trainingType) {
    case "speed":
      return sprintPer100 ? `配速：约 ${fmt(sprintPer100)}/100m（冲刺速度，组间充分恢复）。` : "";
    case "speedEndurance":
      if (t800 && t1500) return `配速：${fmt(per100(t800, 800))}/100m（800m 节奏）~ ${fmt(per100(t1500, 1500))}/100m（1500m 节奏）。`;
      if (t800) return `配速：${fmt(per100(t800, 800))}/100m（800m 节奏）。`;
      return "";
    case "lactate":
      return t800 ? `配速：${fmt(per100(t800, 800))}/100m 或略快（800m 比赛节奏，耐酸训练）。` : "";
    case "vo2max":
      if (t3000 && t5000) return `配速：${fmt(per100(t3000, 3000))}/100m（3km 配速）~ ${fmt(perKm(t5000, 5000))}/km（5km 配速）。`;
      if (t3000) return `配速：${fmt(per100(t3000, 3000))}/100m（3km 配速）。`;
      if (t5000) return `配速：${fmt(perKm(t5000, 5000))}/km（5km 配速）。`;
      return "";
    case "threshold":
      return thresholdPerKm ? `配速：${fmt(thresholdPerKm)}/km（阈值配速，RPE 7-8）。` : "";
    case "aerobic":
      return easyPerKm ? `配速：${fmt(easyPerKm)}/km（轻松跑，RPE 4-5）。` : "";
    case "recovery":
      return easyPerKm ? `配速：${fmt(easyPerKm + 15)}/km（恢复跑，RPE 3）。` : "";
    case "eventSpecific": {
      let longPace = null, longLabel = "";
      let midPace = null, midLabel = "";
      let shortPace = null, shortLabel = "";

      if (event === 800) {
        if (t1500) { longPace = per100(t1500, 1500); longLabel = "1500m 节奏"; }
        if (t400) { shortPace = per100(t400, 400); shortLabel = "400m 速度"; }
      } else if (event === 1500) {
        if (t3000) { longPace = per100(t3000, 3000); longLabel = "3000m 节奏"; }
        if (t800) { shortPace = per100(t800, 800); shortLabel = "800m 速度"; }
      } else if (event === 3000) {
        if (t5000) { longPace = per100(t5000, 5000); longLabel = "5000m 节奏"; }
        if (t1500) { shortPace = per100(t1500, 1500); shortLabel = "1500m 速度"; }
      } else if (event === 5000) {
        if (t10000) { longPace = per100(t10000, 10000); longLabel = "10km 节奏"; }
        else if (t5000) { longPace = perKm(t5000, 5000) * 1.06 / 10; longLabel = "阈值节奏"; }
        if (t3000) { shortPace = per100(t3000, 3000); shortLabel = "3000m 速度"; }
      }

      const parts = [];
      if (longPace) parts.push(`长段落（≥1000m）${fmt(longPace)}/100m（${longLabel}，控速积累）`);
      if (midPace) parts.push(`中段落（600-800m）${fmt(midPace)}/100m（${midLabel}）`);
      if (racePer100) parts.push(`专项段落 ${fmt(racePer100)}/100m（${event}m 比赛节奏）`);
      if (shortPace) parts.push(`短段落（≤400m）${fmt(shortPace)}/100m（${shortLabel}，提速刺激）`);
      return parts.length ? `配速参考：${parts.join("；")}。长段落控速积累，短段落提速刺激，不要全部按比赛节奏跑。` : "";
    }
    case "strength":
      return "";
    default:
      return "";
  }
}

function formatPaceTime(seconds) {
  if (seconds == null || !isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m > 0) return `${m}:${String(s).padStart(2, "0")}`;
  return `${s}秒`;
}

function buildPaceTable(input, analysis) {
  const est = analysis.estimated;
  const event = Number(input.event);
  const goalTime = input.goalTime;

  const t400 = est[400];
  const t800 = est[800] || (event === 800 ? goalTime : null);
  const t1500 = est[1500];
  const t3000 = est[3000];
  const t5000 = est[5000];
  const t10000 = est[10000];

  const per100 = (time, dist) => (time && dist ? time / (dist / 100) : null);
  const per400 = (time, dist) => (time && dist ? time / (dist / 400) : null);
  const perKm = (time, dist) => (time && dist ? time / (dist / 1000) : null);

  const thresholdPerKm = t5000 ? perKm(t5000, 5000) * 1.07 : (t3000 ? perKm(t3000, 3000) * 1.10 : null);
  const easyPerKm = thresholdPerKm ? thresholdPerKm + 65 : null;
  const sprintPer100 = t400 ? per100(t400, 400) * 0.92 : null;
  const racePer100 = goalTime ? per100(goalTime, event) : null;

  const rows = [
    {
      label: "冲刺/速度训练",
      desc: "30-80m 加速跑、短距离高速跑",
      pace: sprintPer100 ? `${formatPaceTime(sprintPer100)}/100m` : "—",
      detail: t400 ? `参考 400m 成绩 ${formatPaceTime(t400)}` : "需 400m 成绩",
    },
    {
      label: `${event}m 比赛配速`,
      desc: "专项刺激、比赛模拟",
      pace: racePer100 ? `${formatPaceTime(racePer100)}/100m` : "—",
      detail: goalTime ? `目标 ${formatPaceTime(goalTime)}` : "—",
    },
  ];

  if (event !== 800 && t800) {
    rows.push({
      label: "800m 配速",
      desc: "800m 节奏间歇、速度耐力",
      pace: `${formatPaceTime(per100(t800, 800))}/100m`,
      detail: `400m 用时 ${formatPaceTime(per400(t800, 800))}`,
    });
  }

  if (t1500) {
    rows.push({
      label: "1500m 配速",
      desc: "1500m 节奏、速度耐力间歇",
      pace: `${formatPaceTime(per100(t1500, 1500))}/100m`,
      detail: `400m 用时 ${formatPaceTime(per400(t1500, 1500))}`,
    });
  }

  if (t3000) {
    rows.push({
      label: "3km 配速",
      desc: "VO₂max 间歇、中长间歇",
      pace: `${formatPaceTime(per100(t3000, 3000))}/100m`,
      detail: `400m 用时 ${formatPaceTime(per400(t3000, 3000))}，1km 用时 ${formatPaceTime(perKm(t3000, 3000))}`,
    });
  }

  if (t5000) {
    rows.push({
      label: "5km 配速",
      desc: "VO₂max 长间歇、5km 节奏",
      pace: `${formatPaceTime(perKm(t5000, 5000))}/km`,
      detail: `400m 用时 ${formatPaceTime(per400(t5000, 5000))}`,
    });
  }

  if (thresholdPerKm) {
    rows.push({
      label: "阈值配速",
      desc: "节奏跑、阈值间歇",
      pace: `${formatPaceTime(thresholdPerKm)}/km`,
      detail: `400m 用时 ${formatPaceTime(thresholdPerKm * 0.4)}`,
    });
  }

  if (easyPerKm) {
    rows.push({
      label: "轻松跑配速",
      desc: "恢复跑、有氧长跑、热身/放松",
      pace: `${formatPaceTime(easyPerKm)}/km`,
      detail: `RPE 3-4，可以正常对话`,
    });
  }

  return rows;
}

/* ===================== 7. 渲染函数 ===================== */

function renderSummary(input, analysis) {
  const weakText = analysis.weakKeys.map((key) => LABELS[key]).join("、");
  const focusText = input.model.focus.join("、");
  const typeBadge = analysis.athleteType;

  const anomalyWarning = analysis.anomalies?.length
    ? `<div class="adjustment-box" style="border-color:var(--red);background:linear-gradient(180deg,#fff5f4,#fef0ee)"><strong style="color:var(--red)">⚠ 数据异常提醒</strong>${analysis.anomalies.map((a) => `<p style="color:#a04030">${a}</p>`).join("")}</div>`
    : "";

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
      <span>运动员类型：${typeBadge.label}${input.model.name}运动员（速度偏向指数 ${typeBadge.sbi ?? "—"}，年龄修正系数 ${analysis.ageCoef}）</span>
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
    <h4 style="margin:16px 0 6px;font-size:15px;color:var(--green-dark)">训练配速参考表</h4>
    <div class="pace-table-box">
      <table class="pace-table">
        <thead><tr><th>训练类型</th><th>配速</th><th>说明</th></tr></thead>
        <tbody>${buildPaceTable(input, analysis).map((r) => `<tr><td class="pace-label">${r.label}</td><td class="pace-value">${r.pace}</td><td class="pace-desc">${r.desc}<br><small>${r.detail}</small></td></tr>`).join("")}</tbody>
      </table>
      <p class="pace-note">以上配速基于你的目标成绩和各距离估算成绩推算。实际训练中根据天气、疲劳状态上下浮动 3-5%。强化期偏快端，基础期偏慢端。</p>
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

function generateCoachAdvice(analysis, input) {
  const eventName = input.model.name.replace(" 米", "");

  const gaps = SIX_DIMENSIONS
    .filter((d) => analysis.scores[d] != null && analysis.goalDemands[d] != null)
    .map((d) => ({
      dim: d,
      gap: analysis.scores[d] - analysis.goalDemands[d],
      score: analysis.scores[d],
      demand: analysis.goalDemands[d],
    }))
    .sort((a, b) => a.gap - b.gap);

  const maxGap = gaps[0];
  const limitingFactor = maxGap && maxGap.gap < -10
    ? `${LABELS[maxGap.dim]}（当前${maxGap.score}分，目标需求${maxGap.demand}分，差距${maxGap.gap}分）`
    : "各维度基本达标，无明显限制因素";

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
  const minVal = 20;
  const maxVal = 100;
  const range = maxVal - minVal;

  const valToRadius = (val) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val ?? 0));
    return ((clamped - minVal) / range) * radius;
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

/* ===================== 8. Supabase 客户端 + 认证 + 数据库 ===================== */

let supabaseClient = null;
let currentUser = null;

function isSupabaseReady() {
  return (
    window.SUPABASE_CONFIGURED &&
    typeof window.supabase !== "undefined" &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  );
}

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!isSupabaseReady()) return null;
  supabaseClient = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
  return supabaseClient;
}

/* ---- 认证模块 ---- */
async function authSignUp(email, password) {
  const client = initSupabase();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function authSignIn(email, password) {
  const client = initSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function authSignOut() {
  const client = initSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/* ---- 数据库模块：profiles ---- */
async function saveProfile(userId, profile) {
  const client = initSupabase();
  const { error } = await client
    .from("profiles")
    .upsert({ id: userId, ...profile }, { onConflict: "id" });
  if (error) throw error;
}

async function getProfile(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ---- 数据库模块：performance_records ---- */
async function listPerformances(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from("performance_records")
    .select("*")
    .eq("user_id", userId)
    .order("record_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

async function addPerformance(userId, record) {
  const client = initSupabase();
  const { error } = await client
    .from("performance_records")
    .insert({ user_id: userId, ...record });
  if (error) throw error;
}

async function deletePerformance(userId, id) {
  const client = initSupabase();
  const { error } = await client
    .from("performance_records")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/* ---- 数据库模块：analysis_snapshots ---- */
async function saveAnalysis(userId, input, analysis, phases, weeks) {
  const client = initSupabase();
  const label = `${input.model.name} / 目标 ${formatTime(input.goalTime)}`;
  const { error } = await client.from("analysis_snapshots").insert({
    user_id: userId,
    input_json: input,
    analysis_json: analysis,
    phases_json: phases,
    plan_json: weeks,
    label,
  });
  if (error) throw error;
}

async function getLatestAnalysis(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from("analysis_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getAnalysisById(snapshotId) {
  const client = initSupabase();
  const { data, error } = await client
    .from("analysis_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ---- 数据库模块：plan_assignments（课表启用记录） ---- */
async function getActiveAssignment(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from("plan_assignments")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listAssignments(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from("plan_assignments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createAssignment(userId, snapshotId, startDate, totalWeeks) {
  const client = initSupabase();
  // 先把现有 active 课表置为 inactive
  const { error: e1 } = await client
    .from("plan_assignments")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (e1) throw e1;
  // 再插入新 active 记录
  const { data, error } = await client
    .from("plan_assignments")
    .insert({
      user_id: userId,
      snapshot_id: snapshotId,
      start_date: startDate,
      total_weeks: totalWeeks,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deactivateAssignment(userId, assignmentId) {
  const client = initSupabase();
  const { error } = await client
    .from("plan_assignments")
    .update({ is_active: false })
    .eq("id", assignmentId)
    .eq("user_id", userId);
  if (error) throw error;
}

/* ---- 数据库模块：training_logs（每日训练日志） ---- */
async function listTrainingLogs(userId, fromDate, toDate) {
  const client = initSupabase();
  let query = client
    .from("training_logs")
    .select("*")
    .eq("user_id", userId)
    .order("log_date", { ascending: false });
  if (fromDate) query = query.gte("log_date", fromDate);
  if (toDate) query = query.lte("log_date", toDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getTrainingLog(userId, date) {
  const client = initSupabase();
  const { data, error } = await client
    .from("training_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertTrainingLog(userId, date, payload) {
  const client = initSupabase();
  const { data, error } = await client
    .from("training_logs")
    .upsert(
      {
        user_id: userId,
        log_date: date,
        ...payload,
      },
      { onConflict: ["user_id", "log_date"] }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTrainingLog(userId, date) {
  const client = initSupabase();
  const { error } = await client
    .from("training_logs")
    .delete()
    .eq("user_id", userId)
    .eq("log_date", date);
  if (error) throw error;
}

// 检查某外部活动是否已导入（去重）
async function findLogByExternalId(userId, sourceType, externalId) {
  if (!externalId) return null;
  const client = initSupabase();
  const { data, error } = await client
    .from("training_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ---- 数据库模块：external_platform_connections（第三方平台连接） ---- */
async function listPlatformConnections(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from("external_platform_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function upsertPlatformConnection(userId, platform, payload) {
  const client = initSupabase();
  const { data, error } = await client
    .from("external_platform_connections")
    .upsert(
      { user_id: userId, platform, ...payload },
      { onConflict: ["user_id", "platform"] }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deletePlatformConnection(userId, platform) {
  const client = initSupabase();
  const { error } = await client
    .from("external_platform_connections")
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform);
  if (error) throw error;
}

/* ===================== 8.5 数据导入/同步模块（高驰 / Strava 文件解析） ===================== */
/*
 * 支持的导入格式：
 *   - TCX  (.tcx)  - 高驰、Strava、Garmin 都支持导出的标准 XML 训练格式
 *   - GPX  (.gpx)  - 通用轨迹 XML，含时间/海拔/心率扩展
 *   - CSV  (.csv)  - 高驰官网批量导出、或用户手动整理的简易表格
 *
 * 由于 COROS 没有公开开发者 API，本模块采用「文件导出 → 上传解析」的方案。
 * 同时预留 Strava OAuth 自动拉取的架构位（external_platform_connections 表）。
 */

/* ---- TCX 解析 ---- */
function parseTCX(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const parseErr = xml.querySelector("parsererror");
  if (parseErr) throw new Error("TCX 文件格式有误，请确认文件未损坏。");

  const activities = xml.getElementsByTagName("Activity");
  const results = [];

  for (const act of activities) {
    // 基础信息
    const sport = act.getAttribute("Sport") || "Running";
    const idEl = act.getElementsByTagName("Id")[0];
    const lapEls = act.getElementsByTagName("Lap");
    const notesEl = act.getElementsByTagName("Notes")[0];
    const actNameEl = act.getElementsByTagName("Activity")[0]?.parentNode
      ?.querySelector?.("Name");

    let startTime = idEl?.textContent?.trim();
    if (!startTime && lapEls[0]) {
      startTime = lapEls[0].getAttribute("StartTime");
    }

    // 汇总各 Lap 数据
    let totalTimeSec = 0;
    let totalDistanceM = 0;
    let totalCalories = 0;
    let maxSpeed = 0;
    const hrSamples = [];
    let triggerMethod = null;

    for (const lap of lapEls) {
      const pick = (tag) => lap.getElementsByTagName(tag)[0]?.textContent?.trim();
      totalTimeSec += Number(pick("TotalTimeSeconds")) || 0;
      totalDistanceM += Number(pick("DistanceMeters")) || 0;
      totalCalories += Number(pick("Calories")) || 0;
      const ms = Number(pick("MaximumSpeed"));
      if (ms > maxSpeed) maxSpeed = ms;
      triggerMethod = pick("TriggerMethod");

      // 从 Trackpoint 采集平均心率
      const tpEls = lap.getElementsByTagName("Trackpoint");
      for (const tp of tpEls) {
        const hrEl = tp.getElementsByTagName("HeartRateBpm")[0]
          ?.getElementsByTagName("Value")[0];
        const hr = Number(hrEl?.textContent);
        if (hr > 30 && hr < 230) hrSamples.push(hr);
      }
    }

    const avgHr = hrSamples.length
      ? Math.round(hrSamples.reduce((s, v) => s + v, 0) / hrSamples.length)
      : null;
    const maxHr = hrSamples.length ? Math.max(...hrSamples) : null;

    const durationMin = totalTimeSec ? Math.round((totalTimeSec / 60) * 10) / 10 : null;
    const distanceKm = totalDistanceM ? Math.round((totalDistanceM / 1000) * 100) / 100 : null;
    const avgPace = distanceKm && durationMin ? Math.round(durationMin / distanceKm * 10) / 10 : null; // min/km

    // 估算 RPE（根据平均心率近似）
    let rpe = null;
    if (avgHr) {
      if (avgHr < 130) rpe = 6;
      else if (avgHr < 145) rpe = 8;
      else if (avgHr < 160) rpe = 11;
      else if (avgHr < 172) rpe = 13;
      else if (avgHr < 182) rpe = 15;
      else rpe = 17;
    }

    // 标准化活动标题
    const title = actNameEl?.textContent?.trim()
      || notesEl?.textContent?.trim()
      || `${sport === "Running" ? "跑步" : sport}训练`;

    // 日期（UTC 转本地 YYYY-MM-DD）
    const startDate = startTime ? parseISODateToLocal(startTime) : null;

    // 生成去重 external_id（基于开始时间+距离+时长的哈希）
    const rawExternal = `${startTime || ""}-${totalDistanceM}-${totalTimeSec}`;
    const externalId = simpleHash(rawExternal);

    results.push({
      source_type: "file_tcx",
      external_id: externalId,
      log_date: startDate,
      planned_title: title,
      planned_detail: sport ? `运动类型：${sport}` : "",
      status: "completed",
      duration_min: durationMin,
      distance_km: distanceKm,
      avg_hr: avgHr,
      rpe,
      feeling: null,
      note: notesEl?.textContent?.trim() || null,
      // 附加原始数据备份
      external_raw_json: {
        format: "tcx",
        sport,
        startTime,
        totalTimeSec,
        totalDistanceM,
        totalCalories,
        maxSpeed,
        maxHr,
        avgPace,
        triggerMethod,
      },
    });
  }

  return results;
}

/* ---- GPX 解析 ---- */
function parseGPX(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const parseErr = xml.querySelector("parsererror");
  if (parseErr) throw new Error("GPX 文件格式有误，请确认文件未损坏。");

  const trks = xml.getElementsByTagName("trk");
  const results = [];

  for (const trk of trks) {
    const nameEl = trk.getElementsByTagName("name")[0];
    const descEl = trk.getElementsByTagName("desc")[0];
    const typeEl = trk.getElementsByTagName("type")[0];
    const segEls = trk.getElementsByTagName("trkseg");

    // 遍历所有点，汇总
    const pts = trk.getElementsByTagName("trkpt");
    let prevTime = null;
    let prevLat = null;
    let prevLon = null;
    let totalDistanceM = 0;
    let totalTimeSec = 0;
    let startTime = null;
    const hrSamples = [];
    const eleSamples = [];

    for (const pt of pts) {
      const lat = Number(pt.getAttribute("lat"));
      const lon = Number(pt.getAttribute("lon"));
      const timeEl = pt.getElementsByTagName("time")[0];
      const eleEl = pt.getElementsByTagName("ele")[0];
      // GPX 扩展心率 (Garmin/Strava 扩展: <gpxtpx:hr> 或 <hr>)
      let hrText = null;
      const extEls = pt.getElementsByTagName("extensions");
      for (const ext of extEls) {
        const all = ext.getElementsByTagName("*");
        for (const n of all) {
          if (n.localName === "hr" || n.tagName?.toLowerCase().includes("hr")) {
            hrText = n.textContent?.trim();
            break;
          }
        }
        if (hrText) break;
      }
      // 尝试直接找 hr 标签
      if (!hrText) {
        const directHr = pt.getElementsByTagName("hr")[0]?.textContent?.trim();
        if (directHr) hrText = directHr;
      }

      const hr = Number(hrText);
      if (hr > 30 && hr < 230) hrSamples.push(hr);
      const ele = Number(eleEl?.textContent);
      if (Number.isFinite(ele)) eleSamples.push(ele);

      const timeStr = timeEl?.textContent?.trim();
      const curTime = timeStr ? new Date(timeStr) : null;

      if (curTime && !startTime) startTime = curTime;
      if (prevTime && curTime) {
        totalTimeSec += (curTime - prevTime) / 1000;
      }
      if (prevLat != null && Number.isFinite(lat)) {
        totalDistanceM += haversineMeters(prevLat, prevLon, lat, lon);
      }
      prevTime = curTime;
      prevLat = lat;
      prevLon = lon;
    }

    const avgHr = hrSamples.length
      ? Math.round(hrSamples.reduce((s, v) => s + v, 0) / hrSamples.length)
      : null;
    const maxHr = hrSamples.length ? Math.max(...hrSamples) : null;
    const durationMin = totalTimeSec ? Math.round((totalTimeSec / 60) * 10) / 10 : null;
    const distanceKm = totalDistanceM ? Math.round((totalDistanceM / 1000) * 100) / 100 : null;

    let rpe = null;
    if (avgHr) {
      if (avgHr < 130) rpe = 6;
      else if (avgHr < 145) rpe = 8;
      else if (avgHr < 160) rpe = 11;
      else if (avgHr < 172) rpe = 13;
      else if (avgHr < 182) rpe = 15;
      else rpe = 17;
    }

    const title = nameEl?.textContent?.trim() || typeEl?.textContent?.trim() || "GPX 跑步活动";
    const startTimeStr = startTime ? startTime.toISOString() : null;
    const startDate = startTime ? formatDateISO(startTime) : null;

    const rawExternal = `${startTimeStr || ""}-${totalDistanceM.toFixed(0)}-${totalTimeSec.toFixed(0)}`;
    const externalId = simpleHash(rawExternal);

    results.push({
      source_type: "file_gpx",
      external_id: externalId,
      log_date: startDate,
      planned_title: title,
      planned_detail: typeEl?.textContent ? `运动类型：${typeEl.textContent}` : "",
      status: "completed",
      duration_min: durationMin,
      distance_km: distanceKm,
      avg_hr: avgHr,
      rpe,
      feeling: null,
      note: descEl?.textContent?.trim() || null,
      external_raw_json: {
        format: "gpx",
        startTime: startTimeStr,
        totalTimeSec: Math.round(totalTimeSec),
        totalDistanceM: Math.round(totalDistanceM),
        maxHr,
        elevationMin: eleSamples.length ? Math.min(...eleSamples) : null,
        elevationMax: eleSamples.length ? Math.max(...eleSamples) : null,
      },
    });
  }

  return results;
}

/* ---- CSV 解析 ----
 * 支持两种模式：
 *   A) 高驰官网导出格式（含表头：日期,活动名称,时长,距离,平均心率,配速,...）
 *   B) 极简通用格式（含表头：date,title,duration_min,distance_km,avg_hr,rpe,note）
 */
function parseCSV(text) {
  const rows = parseCSVLines(text);
  if (!rows.length) throw new Error("CSV 为空或解析失败。");
  const header = rows[0].map((c) => c.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c && c.trim()));

  // 自动判断列映射
  const col = (names) => {
    for (const n of names) {
      const idx = header.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (idx >= 0) return idx;
    }
    const partial = header.findIndex((h) =>
      names.some((n) => h.toLowerCase().includes(n.toLowerCase()))
    );
    return partial;
  };

  const iDate = col(["日期", "date", "log_date", "活动日期", "start_time", "开始时间"]);
  const iTitle = col(["活动名称", "title", "活动类型", "name", "planned_title"]);
  const iDuration = col(["时长", "duration", "duration_min", "活动时长", "moving_time"]);
  const iDistance = col(["距离", "distance", "distance_km", "公里数"]);
  const iHr = col(["平均心率", "avg_hr", "心率", "heartrate"]);
  const iRpe = col(["rpe", "RPE", "主观强度"]);
  const iNote = col(["备注", "note", "description", "描述"]);
  const iType = col(["类型", "sport", "type"]);

  const results = [];
  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rawDate = row[iDate] || "";
    const dateStr = normalizeDate(rawDate);
    if (!dateStr) continue;

    const rawDuration = row[iDuration] || "";
    let durationMin = parseDurationString(rawDuration);

    const rawDist = row[iDistance] || "";
    let distanceKm = Number(String(rawDist).replace(/[^\d.]/g, "")) || null;
    // 如果单位是米，自动换算
    if (distanceKm && distanceKm > 1000) distanceKm = distanceKm / 1000;

    const avgHr = Number(row[iHr]) || null;
    const rpe = Number(row[iRpe]) || null;
    const title = (row[iTitle] || row[iType] || "CSV 导入活动").trim();
    const note = row[iNote]?.trim() || null;

    const rawExternal = `${dateStr}-${distanceKm || ""}-${durationMin || ""}-${r}`;
    const externalId = simpleHash(rawExternal);

    results.push({
      source_type: "file_csv",
      external_id: externalId,
      log_date: dateStr,
      planned_title: title,
      planned_detail: row[iType] ? `运动类型：${row[iType].trim()}` : "",
      status: "completed",
      duration_min: durationMin,
      distance_km: distanceKm,
      avg_hr: avgHr > 30 && avgHr < 230 ? avgHr : null,
      rpe: rpe >= 6 && rpe <= 20 ? rpe : null,
      feeling: null,
      note,
      external_raw_json: { format: "csv", rowIndex: r, rawRow: row },
    });
  }
  return results;
}

/* ---- 导入辅助工具 ---- */
function parseCSVLines(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = [];
  let cur = [];
  let inQ = false;
  let buf = "";
  for (const line of lines) {
    if (!inQ && !line.trim() && !cur.length) continue;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { buf += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cur.push(buf); buf = "";
      } else {
        buf += ch;
      }
    }
    if (inQ) {
      buf += "\n";
    } else {
      cur.push(buf); buf = "";
      out.push(cur); cur = [];
    }
  }
  if (buf || cur.length) { cur.push(buf); out.push(cur); }
  return out;
}

// 把 ISO 字符串（UTC）转换到本地时区的 YYYY-MM-DD
function parseISODateToLocal(isoStr) {
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return null;
    return formatDateISO(d);
  } catch (_) { return null; }
}

function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // ISO
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // YYYYMMDD
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // 中文 2024年1月2日
  m = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // Excel 日期数字：简单兜底用 ISO 解析
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatDateISO(d);
  return null;
}

// 解析时长字符串 "1:23:45" / "45:30" / "32 分钟" / "1200" (秒) 成分钟
function parseDurationString(s) {
  if (s == null || s === "") return null;
  const str = String(s).trim();
  if (str.includes(":")) {
    const parts = str.split(":").map(Number);
    if (parts.some((p) => !Number.isFinite(p))) return null;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return null;
  }
  // "32 分钟" / "32min" / "1500秒"
  const mMin = str.match(/([\d.]+)\s*(分钟|分|min|minute)/i);
  if (mMin) return Number(mMin[1]);
  const mSec = str.match(/([\d.]+)\s*(秒|s|sec)/i);
  if (mSec) return Number(mSec[1]) / 60;
  const mHr = str.match(/([\d.]+)\s*(小时|h|hr|hour)/i);
  if (mHr) return Number(mHr[1]) * 60;
  // 纯数字：<= 500 按分钟，否则按秒（兼容某些系统导出秒数）
  const n = Number(str);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n <= 500 ? n : n / 60;
}

// 经纬度近似距离（Haversine，米）
function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 简单稳定哈希（32bit FNV-1a，hex 字符串，用于去重 ID）
function simpleHash(str) {
  let h = 0x811c9dc5;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return "h" + h.toString(16).padStart(8, "0");
}

/* ---- FIT 二进制解析（Garmin / 佳明标准活动格式） ---- */
/*
 * 使用 fit-file-parser（CDN 引入，window.FitParser）。
 * FIT 文件包含：activity / sessions（汇总）/ records（逐点采样）/ laps / events。
 * 这里只使用 sessions 汇总 + records 兜底，得到跑步活动核心字段。
 */
async function parseFIT(buffer) {
  if (typeof window === "undefined" || !window.FitParser) {
    throw new Error("FIT 解析库未加载，请检查网络（fit-file-parser CDN）。");
  }
  const FitParser = window.FitParser;
  const parser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    temperatureUnit: "celsius",
    elapsedRecordField: true,
    mode: "both",
  });

  const data = await new Promise((resolve, reject) => {
    parser.parse(buffer, (err, fitData) => {
      if (err) return reject(new Error(`FIT 解析失败：${err.message || err}`));
      resolve(fitData);
    });
  });

  const sessions = (data && data.sessions) || [];
  const records = (data && data.records) || [];
  if (!sessions.length && !records.length) {
    throw new Error("FIT 文件中未找到活动数据（无 sessions / records）。");
  }

  const results = [];
  // 若有 session 就以 session 为主
  const iterSessions = sessions.length ? sessions : [buildVirtualSessionFromRecords(records)];
  for (const sess of iterSessions) {
    const startTime = sess.start_time || sess.timestamp || null; // Date
    const startTimeMs = startTime ? startTime.getTime() : null;
    const startTimeISO = startTime ? startTime.toISOString() : null;
    const startDate = startTime ? formatDateISO(startTime) : null;

    const totalTimeSec = Number(
      sess.total_timer_time ?? sess.total_elapsed_time ?? sess.total_moving_time ?? 0
    );
    const totalDistanceM = Number(sess.total_distance ?? 0);
    const avgHr = clampHr(sess.avg_heart_rate);
    const maxHr = clampHr(sess.max_heart_rate);
    const calories = Number(sess.total_calories ?? 0);
    const avgSpeedMps = Number(sess.avg_speed ?? 0);

    // 如果 session 里没有心率，遍历 records 兜底
    let effectiveAvgHr = avgHr;
    if (!effectiveAvgHr && records.length) {
      const hrs = [];
      for (const r of records) {
        const h = clampHr(r.heart_rate);
        if (h) hrs.push(h);
      }
      if (hrs.length) {
        effectiveAvgHr = Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length);
      }
    }

    // 运动类型映射（FIT 里 sport 可能是数字或字符串）
    const sportRaw = typeof sess.sport === "number"
      ? fitSportEnumToName(sess.sport)
      : String(sess.sport || "");
    const isRunning = /run/i.test(sportRaw) || /跑/.test(sportRaw);

    const durationMin = totalTimeSec ? Math.round((totalTimeSec / 60) * 10) / 10 : null;
    const distanceKm = totalDistanceM ? Math.round((totalDistanceM / 1000) * 100) / 100 : null;
    const avgPaceMinPerKm = distanceKm && durationMin
      ? Math.round((durationMin / distanceKm) * 10) / 10
      : null;

    // RPE 估算（同 TCX/GPX 策略：平均心率近似）
    let rpe = null;
    if (effectiveAvgHr) {
      if (effectiveAvgHr < 130) rpe = 6;
      else if (effectiveAvgHr < 145) rpe = 8;
      else if (effectiveAvgHr < 160) rpe = 11;
      else if (effectiveAvgHr < 172) rpe = 13;
      else if (effectiveAvgHr < 182) rpe = 15;
      else rpe = 17;
    }

    const title = isRunning
      ? "佳明跑步活动"
      : (sportRaw ? `${sportRaw} 活动` : "FIT 导入活动");
    const detail = sportRaw ? `运动类型：${sportRaw}` : "";

    // 去重 ID：开始时间+距离+时长
    const rawExternal = `${startTimeISO || startTimeMs || ""}-${Math.round(totalDistanceM)}-${Math.round(totalTimeSec)}`;
    const externalId = simpleHash(rawExternal);

    results.push({
      source_type: "file_fit",
      external_id: externalId,
      log_date: startDate,
      planned_title: title,
      planned_detail: detail,
      status: "completed",
      duration_min: durationMin,
      distance_km: distanceKm,
      avg_hr: effectiveAvgHr,
      rpe,
      feeling: null,
      note: null,
      external_raw_json: {
        format: "fit",
        sport: sportRaw || null,
        startTime: startTimeISO,
        totalTimeSec: Math.round(totalTimeSec),
        totalDistanceM: Math.round(totalDistanceM),
        totalCalories: calories || null,
        avgSpeedMps: avgSpeedMps || null,
        maxHr: maxHr || null,
        avgPaceMinPerKm,
        numLaps: (data && Array.isArray(data.laps)) ? data.laps.length : null,
        numRecords: records.length || null,
        sessionMessage: stripDateFields(sess),
      },
    });
  }

  return results;
}

function clampHr(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 30 || n > 230) return null;
  return Math.round(n);
}

// 从逐点 record 构造一个"虚拟 session"（仅用于 FIT 文件缺失 session 的罕见情况）
function buildVirtualSessionFromRecords(records) {
  if (!records || !records.length) return {};
  let start = null;
  let end = null;
  let distM = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const t = r.timestamp || r.time_created;
    if (t) {
      if (!start) start = t;
      end = t;
    }
    const d = Number(r.distance || 0);
    if (d > distM) distM = d;
  }
  const totalSec = start && end ? (end.getTime() - start.getTime()) / 1000 : 0;
  return {
    start_time: start,
    total_timer_time: totalSec,
    total_distance: distM,
    sport: "running",
  };
}

// FIT 标准 sport 枚举（常用值，不全）
function fitSportEnumToName(n) {
  const map = {
    0: "Generic", 1: "Running", 2: "Cycling", 3: "Transition",
    4: "Fitness Equipment", 5: "Swimming", 6: "Basketball", 7: "Soccer",
    8: "Tennis", 9: "American Football", 10: "Training", 11: "Walking",
    12: "Cross Country Skiing", 13: "Alpine Skiing", 14: "Snowboarding",
    15: "Rowing", 16: "Mountaineering", 17: "Hiking", 18: "Multisport",
    19: "Paddling", 20: "Flying", 21: "EBiking", 22: "Motorcycling",
    23: "Boating", 24: "Driving", 25: "Golf", 26: "Hang Gliding",
    27: "Horseback Riding", 28: "Hunting", 29: "Fishing", 30: "Inline Skating",
    31: "Rock Climbing", 32: "Sailing", 33: "Ice Skating", 34: "Sky Diving",
    35: "Snowshoeing", 36: "Snowmobiling", 37: "Stand Up Paddleboarding",
    38: "Surfing", 39: "Wakeboarding", 40: "Water Skiing", 41: "Kayaking",
    42: "Rafting", 43: "Windsurfing", 44: "Kitesurfing",
    53: "HIIT", 58: "Cardio Training", 62: "Strength Training",
  };
  return map[Number(n)] || "";
}

// 去掉 Date 对象字段，避免 JSON 序列化后体积膨胀（FIT 原始 session 里有大量重复 Date）
function stripDateFields(obj) {
  try {
    const clone = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (v instanceof Date) continue;
      if (v && typeof v === "object" && !Array.isArray(v)) continue;
      if (Array.isArray(v)) continue;
      clone[k] = v;
    }
    return clone;
  } catch (_) { return null; }
}

/* ---- 格式探测 + 统一入口 ---- */
/*
 * 参数兼容两种调用形式：
 *   detectAndParseFile(filename, textContent)   // TCX/GPX/CSV
 *   detectAndParseFile(filename, {text, buffer})// FIT（buffer 是 ArrayBuffer）
 * 统一返回 { format, activities }
 */
function detectAndParseFile(filename, payload) {
  const lower = filename.toLowerCase();
  const hasObj = payload && typeof payload === "object" && !Array.isArray(payload) && ("text" in payload || "buffer" in payload);
  const text = hasObj ? payload.text : payload;
  const buffer = hasObj ? payload.buffer : null;

  // FIT：二进制格式，必须提供 ArrayBuffer
  if (lower.endsWith(".fit")) {
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      throw new Error(`FIT 文件需要以二进制方式读取：${filename}`);
    }
    // 交给外层 async 调用，这里返回一个特殊标记以避免同步解析
    // 注：由于 FIT 解析是异步回调，detectAndParseFile 本身被设计为同步入口时只负责探测；
    // 真正的解析在 handleFiles 里通过 parseFIT(buffer) 直接调用。
    return { format: "fit", activities: [] };
  }

  if (lower.endsWith(".tcx")) {
    return { format: "tcx", activities: parseTCX(text) };
  }
  if (lower.endsWith(".gpx")) {
    return { format: "gpx", activities: parseGPX(text) };
  }
  if (lower.endsWith(".csv")) {
    return { format: "csv", activities: parseCSV(text) };
  }
  // 兜底：按文件内容探测（只对文本格式）
  if (typeof text === "string") {
    const trimmed = text.trim();
    if (trimmed.startsWith("<?xml") || trimmed.startsWith("<TrainingCenterDatabase")) {
      return { format: "tcx", activities: parseTCX(text) };
    }
    if (trimmed.startsWith("<gpx")) {
      return { format: "gpx", activities: parseGPX(text) };
    }
  }
  throw new Error(`不支持的文件格式：${filename}。支持 .fit / .tcx / .gpx / .csv`);
}

/* ---- 导入流程：解析 → 补齐训练负荷 → 去重 → 批量写入 ---- */
function finalizeActivityImport(activity, age) {
  // 计算训练负荷
  const load = calcTrainingLoad(
    activity.duration_min,
    activity.rpe,
    activity.avg_hr,
    age
  );
  const intensityFactor = activity.duration_min && load
    ? Math.round((load / activity.duration_min) * 100) / 100
    : rpeToIntensityFactor(activity.rpe);
  return {
    ...activity,
    intensity_factor: intensityFactor || null,
    training_load: load || null,
  };
}

/* ---- 训练负荷计算 ---- */
// 训练负荷 = 训练时长(分钟) × 强度系数
// 强度系数基于 RPE 推算（若提供心率则综合心率区间校准）
function rpeToIntensityFactor(rpe) {
  if (!rpe || rpe < 6) return 0;
  if (rpe <= 8) return 0.6;   // 轻松
  if (rpe <= 11) return 0.8;  // 中等
  if (rpe <= 14) return 1.0;  // 阈值
  if (rpe <= 17) return 1.2;  // 高强度
  return 1.4;                  // 极限
}

// 心率区间 -> 强度系数（基于最大心率估算，作为 RPE 的校准参考）
function hrToIntensityFactor(avgHr, age) {
  if (!avgHr || avgHr < 50) return null;
  const maxHr = age ? 220 - age : 190;
  const ratio = avgHr / maxHr;
  if (ratio < 0.6) return 0.5;
  if (ratio < 0.72) return 0.7;
  if (ratio < 0.82) return 0.9;
  if (ratio < 0.9) return 1.1;
  if (ratio < 0.95) return 1.3;
  return 1.4;
}

function calcTrainingLoad(durationMin, rpe, avgHr, age) {
  if (!durationMin) return 0;
  const rpeFactor = rpeToIntensityFactor(rpe);
  const hrFactor = hrToIntensityFactor(avgHr, age);
  // 若两者都有，取平均；只有 RPE 就用 RPE；只有心率就用心率
  let factor = rpeFactor;
  if (hrFactor != null) {
    factor = rpeFactor > 0 ? (rpeFactor + hrFactor) / 2 : hrFactor;
  }
  return Math.round(durationMin * factor * 10) / 10;
}

/* ---- 日期工具 ---- */
function formatDateISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateISO(str) {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(a, b) {
  const ms = parseDateISO(a).getTime() - parseDateISO(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function weekdayName(date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(date).getDay()];
}

// 根据 plan_assignments + plan_json 计算指定日期的"计划训练"
function getPlannedDayForDate(assignment, snapshot, dateStr) {
  if (!assignment || !snapshot) return null;
  const weeks = snapshot.plan_json || [];
  const startDate = assignment.start_date;
  const dayOffset = diffDays(dateStr, startDate);
  if (dayOffset < 0 || dayOffset >= assignment.total_weeks * 7) return null;

  const weekIdx = Math.floor(dayOffset / 7);          // 第几周（0-based）
  const dayInWeek = dayOffset % 7;                    // 周内第几天
  const week = weeks[weekIdx];
  if (!week || !Array.isArray(week.days)) return null;

  // 课表默认顺序：周一~周日，但 daysPerWeek 可能是 4/5/6，缺失天为休息
  // 这里简化处理：把课表按 buildWeekDays 实际生成的天数对齐到周内
  // buildWeekDays 返回的实际是 daysPerWeek 个训练日（不含休息日）
  // 为简化，我们把生成的训练日按一周 7 天分布：休息日的 planned 返回 null
  const daysPerWeek = week.days.length;
  // 周内对应位置（0=周一）
  const dayMapFor4 = [0, 1, 3, 6];       // 周一/二/四/日
  const dayMapFor5 = [0, 1, 2, 3, 6];     // 周一/二/三/四/日
  const dayMapFor6 = [0, 1, 2, 3, 4, 6]; // 周一/二/三/四/五/日
  let dayMap = dayMapFor5;
  if (daysPerWeek === 4) dayMap = dayMapFor4;
  else if (daysPerWeek === 6) dayMap = dayMapFor6;

  const dayIdx = dayMap.indexOf(dayInWeek);
  if (dayIdx < 0) {
    return { weekNo: week.weekNo, phase: week.phase, isRest: true };
  }
  const day = week.days[dayIdx];
  return { weekNo: week.weekNo, phase: week.phase, ...day, isRest: false };
}

// 获取指定日期范围的训练负荷汇总
function summarizeLoad(logs) {
  let totalLoad = 0;
  let totalDuration = 0;
  let totalDistance = 0;
  let completed = 0;
  let partial = 0;
  let skipped = 0;
  logs.forEach((l) => {
    totalLoad += Number(l.training_load) || 0;
    totalDuration += Number(l.duration_min) || 0;
    totalDistance += Number(l.distance_km) || 0;
    if (l.status === "completed") completed++;
    else if (l.status === "partial") partial++;
    else if (l.status === "skipped") skipped++;
  });
  return {
    totalLoad: Math.round(totalLoad * 10) / 10,
    totalDuration: Math.round(totalDuration),
    totalDistance: Math.round(totalDistance * 10) / 10,
    sessions: logs.length,
    completed,
    partial,
    skipped,
  };
}

/* ===================== 9. Hash 路由 + 页面渲染器 ===================== */

const ROUTES = {
  "/": renderDashboardPage,
  "/auth": renderAuthPage,
  "/profile": renderProfilePage,
  "/performance": renderPerformancePage,
  "/analysis": renderAnalysisPage,
  "/plan": renderPlanPage,
  "/calendar": renderCalendarPage,
  "/logs": renderLogsPage,
  "/sync": renderSyncPage,
};

// 需要登录才能访问的路由前缀
const PROTECTED_ROUTES = ["/profile", "/performance", "/plan", "/calendar", "/logs", "/day", "/sync"];

function currentRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
}

// 解析带参数的路由（如 /day/2026-08-11 → { name: "/day", param: "2026-08-11" }）
function matchRoute(path) {
  // 精确匹配
  if (ROUTES[path]) return { renderer: ROUTES[path], param: null };
  // /day/:date 参数化路由
  if (path.startsWith("/day/")) {
    const date = path.slice("/day/".length).split("/")[0];
    return { renderer: renderDayPage, param: date };
  }
  return { renderer: renderDashboardPage, param: null };
}

function isProtectedRoute(path) {
  return PROTECTED_ROUTES.some((r) => path === r || path.startsWith(r + "/") || path.startsWith(r));
}

function navigate(path) {
  if (currentRoute() === path) {
    router();
  } else {
    window.location.hash = path;
  }
}

function updateNavActive(path) {
  document.querySelectorAll("#navLinks a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-route") === path);
  });
}

function renderNavAuth() {
  const el = document.getElementById("navAuth");
  if (!el) return;
  if (currentUser) {
    const email = currentUser.email || "";
    el.innerHTML = `
      <span class="nav-user">已登录 <strong>${escapeHtml(email)}</strong></span>
      <button class="ghost-button" id="logoutBtn">退出</button>
    `;
    const btn = document.getElementById("logoutBtn");
    if (btn) {
      btn.addEventListener("click", async () => {
        try {
          await authSignOut();
          showToast("已退出登录");
        } catch (e) {
          showToast(e.message || "退出失败", "error");
        }
      });
    }
  } else {
    el.innerHTML = `<a class="primary-button" href="#/auth">登录 / 注册</a>`;
  }
}

function guardHTML(title, desc, btnLabel, btnHref) {
  return `<section class="guard"><h2>${title}</h2><p>${desc}</p><a class="primary-button" href="${btnHref}">${btnLabel}</a></section>`;
}

async function router() {
  const path = currentRoute();
  const app = document.getElementById("app");
  updateNavActive(path);

  const { renderer, param } = matchRoute(path);

  if (isProtectedRoute(path) && !currentUser) {
    app.innerHTML = guardHTML("请先登录", "访问该页面需要登录账户。注册后即可保存运动档案、成绩和分析结果。", "去登录", "#/auth");
    return;
  }

  try {
    await renderer(app, currentUser, param);
  } catch (err) {
    app.innerHTML = `<div class="guard"><h2>出错了</h2><p>${escapeHtml(err.message || String(err))}</p></div>`;
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

/* ---- 首页 / Dashboard ---- */
async function renderDashboardPage(app, user) {
  if (!user) {
    renderLanding(app);
    return;
  }

  app.innerHTML = `<div class="page"><div class="loading">加载中…</div></div>`;

  let snap = null;
  let profile = null;
  try {
    [snap, profile] = await Promise.all([getLatestAnalysis(user.id), getProfile(user.id)]);
  } catch (e) {
    /* 忽略，按空状态展示 */
  }

  const nickname = profile?.nickname || user.email?.split("@")[0] || "运动员";
  let statusCards = "";

  if (profile) {
    const goalText = profile.goal_event && profile.goal_time
      ? `${profile.goal_event} 米 ${profile.goal_time}`
      : (profile.goal_event ? `${profile.goal_event} 米` : (profile.goal_time || "未设置"));
    statusCards += `
      <div class="status-card">
        <span class="label">目标</span>
        <span class="value">${escapeHtml(goalText)}</span>
        ${profile.race_date ? `<span class="sub">比赛日期 ${escapeHtml(profile.race_date)}</span>` : ""}
      </div>`;
  }

  if (snap) {
    const input = snap.input_json || {};
    const analysis = snap.analysis_json || {};
    const eventName = input.event ? EVENT_MODELS[input.event]?.name : "";
    const predicted = analysis.estimated && input.event ? formatTime(analysis.estimated[input.event]) : "—";
    const limiting = analysis.weakKeys?.length
      ? analysis.weakKeys.map((k) => LABELS[k]).join("、")
      : "各维度基本达标";
    const typeLabel = analysis.athleteType?.label || "—";
    statusCards += `
      <div class="status-card">
        <span class="label">当前预测 (${escapeHtml(eventName)})</span>
        <span class="value">${escapeHtml(predicted)}</span>
        <span class="sub">运动员类型：${escapeHtml(typeLabel)}</span>
      </div>
      <div class="status-card">
        <span class="label">主要限制</span>
        <span class="value">${escapeHtml(limiting)}</span>
        <span class="sub">专项综合评分 ${analysis.weightedScore ?? "—"}/100</span>
      </div>`;
  }

  if (!statusCards) {
    statusCards = `
      <div class="status-card">
        <span class="label">开始使用</span>
        <span class="value">欢迎，${escapeHtml(nickname)}</span>
        <span class="sub">完善运动档案并生成首次能力分析，开启你的训练计划。</span>
      </div>`;
  }

  app.innerHTML = `
    <section class="page">
      <div class="page-head">
        <p class="eyebrow">Dashboard</p>
        <h2>欢迎回来，${escapeHtml(nickname)}</h2>
      </div>
      <div class="dashboard-grid">${statusCards}</div>
      <div class="quick-actions">
        <a class="primary-button" href="#/profile">完善运动档案</a>
        <a class="secondary-button" href="#/performance">记录我的成绩</a>
        <a class="secondary-button" href="#/analysis">生成能力分析</a>
        <a class="secondary-button" href="#/plan">查看训练计划</a>
      </div>
    </section>
  `;
}

function renderLanding(app) {
  app.innerHTML = `
    <section class="page">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">800m · 1500m · 3000m · 5000m</p>
          <h1>面向进阶跑者的 AI 中长跑训练系统</h1>
          <p class="hero-copy">
            建立个人运动档案，记录成绩变化，生成六维能力分析与周期训练计划。
            注册账户后，数据将长期保存到云端，跨设备同步使用。
          </p>
          <div class="hero-actions">
            <a class="primary-button" href="#/auth">注册 / 登录</a>
            <a class="secondary-button" href="#/analysis">直接试用分析</a>
          </div>
        </div>
        <div class="hero-card">
          <div class="metric">
            <span>训练阶段</span>
            <strong>基础期 → 强化期 → 专项期 → 调整期</strong>
          </div>
          <div class="metric">
            <span>能力指标</span>
            <strong>速度、速度耐力、乳酸、VO₂max、乳酸阈、有氧</strong>
          </div>
          <div class="metric">
            <span>账户与数据</span>
            <strong>注册账户、运动档案、成绩数据库、分析快照</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="page panel model">
      <div class="page-head">
        <p class="eyebrow">Model</p>
        <h2>训练模型逻辑</h2>
      </div>
      <div class="model-grid">
        <article>
          <h3>专项化</h3>
          <p>按目标项目分配能力权重：800 米偏速度、速度耐力与乳酸能力；5000 米偏有氧、阈值与 VO₂max。</p>
        </article>
        <article>
          <h3>周期化</h3>
          <p>训练周期分为基础期、强化期、专项期和调整期，逐步从能力建设过渡到比赛状态。</p>
        </article>
        <article>
          <h3>数据驱动</h3>
          <p>根据当前成绩计算能力评分，识别低于目标需求的能力短板，并将短板转化为训练重点。</p>
        </article>
        <article>
          <h3>训练动作库</h3>
          <p>内置 300m、400m、500m、1200m、1600m、2000m，800m 专项刺激和 1500m 金字塔训练，并按周轮换训练内容。</p>
        </article>
      </div>

      <div class="page-head" style="margin-top:28px">
        <p class="eyebrow">Science</p>
        <h2>各项目科学依据</h2>
      </div>
      <div class="science-grid">
        <article class="science-card">
          <h3>800 米</h3>
          <p class="science-desc">非单纯速度或耐力，由无氧能力（速度、乳酸产生）、速度耐力、VO₂max 和乳酸清除能力共同决定。研究显示 800 成绩与峰值摄氧量、乳酸动力学存在显著相关。</p>
          <div class="science-tags">
            <span>无氧能力</span><span>速度耐力</span><span>VO₂max</span><span>乳酸清除</span>
          </div>
        </article>
        <article class="science-card">
          <h3>1500 米</h3>
          <p class="science-desc">偏混合型，核心依赖 VO₂max、vVO₂max、乳酸阈、跑步经济性和速度储备。研究表明 VO₂max、乳酸阈速度和跑步经济性都是中距离表现的重要预测因素。</p>
          <div class="science-tags">
            <span>VO₂max</span><span>vVO₂max</span><span>乳酸阈</span><span>跑步经济性</span><span>速度储备</span>
          </div>
        </article>
        <article class="science-card">
          <h3>3000 / 5000 米</h3>
          <p class="science-desc">明显向有氧倾斜，主要依赖乳酸阈、VO₂max、跑步经济性和有氧耐力。随距离增加，乳酸反应和有氧参数的重要性提高。</p>
          <div class="science-tags">
            <span>乳酸阈</span><span>VO₂max</span><span>跑步经济性</span><span>有氧耐力</span>
          </div>
        </article>
      </div>

      <div class="page-head" style="margin-top:28px">
        <p class="eyebrow">Formulas</p>
        <h2>评分公式与标准化方法</h2>
      </div>
      <div class="formula-grid">
        <div class="formula-card">
          <h4>绝对速度</h4>
          <code>score = 100 × (参考400m ÷ 实际400m)^2.1</code>
          <p>参考值 47 秒（精英级 400m），衡量爆发力和最大速度能力。</p>
        </div>
        <div class="formula-card">
          <h4>速度耐力</h4>
          <code>score = 100 × (理论600m ÷ 实际600m)^2.5</code>
          <p>通过 400m 延伸理论 600m 与实际 600m 的速度保持率评估。</p>
        </div>
        <div class="formula-card">
          <h4>乳酸能力</h4>
          <code>score = 100 × (1 ÷ 末段速度下降比)^3</code>
          <p>衡量 600m 后最后 200m 速度下降程度，下降越小乳酸能力越强。</p>
        </div>
        <div class="formula-card">
          <h4>VO₂max</h4>
          <code>score = avg(1500m, 3000m 评分)</code>
          <p>取中距离项目的评分均值，反映最大摄氧能力。</p>
        </div>
        <div class="formula-card">
          <h4>乳酸阈</h4>
          <code>score = avg(5000m, 10000m 评分)</code>
          <p>基于 5000m 和 10km 成绩评估长时间高强度维持能力。</p>
        </div>
        <div class="formula-card">
          <h4>有氧能力</h4>
          <code>score = avg(3000m, 5000m, 10000m 评分)</code>
          <p>综合长距离成绩评估基础有氧耐力水平。</p>
        </div>
        <div class="formula-card">
          <h4>年龄修正</h4>
          <code>最终评分 = 基础评分 × 年龄修正系数</code>
          <p>18-22 岁系数 1.0，每增加 5 岁递减，青少年适当上调。</p>
        </div>
        <div class="formula-card">
          <h4>目标需求</h4>
          <code>需求 = 目标成绩 → 六维能力画像（线性插值）</code>
          <p>根据目标成绩在档位间插值，动态计算各维度所需能力。</p>
        </div>
      </div>
    </section>
  `;
}

/* ---- 认证页 ---- */
async function renderAuthPage(app, user) {
  if (user) {
    app.innerHTML = `
      <section class="guard">
        <h2>已登录</h2>
        <p>当前账户：${escapeHtml(user.email || "")}</p>
        <div class="quick-actions" style="justify-content:center">
          <a class="primary-button" href="#/">前往首页</a>
          <a class="secondary-button" href="#/profile">运动档案</a>
        </div>
      </section>`;
    return;
  }

  if (!isSupabaseReady()) {
    app.innerHTML = `
      <section class="auth-wrap">
        <div class="auth-card">
          <h2>账户系统尚未配置</h2>
          <div class="config-warn" style="margin-top:16px">
            <strong>使用前请先配置 Supabase：</strong>
            <ol style="margin:10px 0 0 18px;line-height:1.9">
              <li>前往 <code>supabase.com</code> 注册并新建项目。</li>
              <li>在 Supabase 控制台 <code>SQL Editor</code> 中运行 <code>schema.sql</code> 创建数据表。</li>
              <li>在 <code>Settings → API</code> 中复制 Project URL 和 anon public key。</li>
              <li>打开 <code>supabase-config.js</code>，填入 <code>url</code> 与 <code>anonKey</code>。</li>
              <li>刷新本页面即可使用注册 / 登录 / 数据保存功能。</li>
            </ol>
          </div>
        </div>
      </section>`;
    return;
  }

  app.innerHTML = `
    <section class="auth-wrap">
      <div class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab active" data-mode="signin" id="tabSignin">登录</button>
          <button class="auth-tab" data-mode="signup" id="tabSignup">注册</button>
        </div>
        <form class="auth-form" id="authForm">
          <label>
            邮箱
            <input id="authEmail" type="email" placeholder="you@example.com" required autocomplete="email" />
          </label>
          <label>
            密码
            <input id="authPassword" type="password" placeholder="至少 6 位" required autocomplete="current-password" minlength="6" />
          </label>
          <button class="primary-button full" type="submit" id="authSubmit">登录</button>
          <p class="auth-hint" id="authHint">已有账户？输入邮箱密码即可登录。新用户请点击「注册」。</p>
        </form>
      </div>
    </section>
  `;

  let mode = "signin";
  const tabSignin = document.getElementById("tabSignin");
  const tabSignup = document.getElementById("tabSignup");
  const submitBtn = document.getElementById("authSubmit");
  const hint = document.getElementById("authHint");

  function setMode(next) {
    mode = next;
    tabSignin.classList.toggle("active", mode === "signin");
    tabSignup.classList.toggle("active", mode === "signup");
    submitBtn.textContent = mode === "signin" ? "登录" : "注册";
    if (mode === "signin") {
      hint.textContent = "已有账户？输入邮箱密码即可登录。新用户请点击「注册」。";
    } else {
      hint.textContent = "注册后即可保存运动档案、成绩和分析结果。请使用至少 6 位密码。";
    }
  }

  tabSignin.addEventListener("click", () => setMode("signin"));
  tabSignup.addEventListener("click", () => setMode("signup"));

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = getFieldValue("authEmail").trim();
    const password = getFieldValue("authPassword");
    if (!email || !password) {
      showToast("请填写邮箱和密码", "error");
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = mode === "signin" ? "登录中…" : "注册中…";
    try {
      if (mode === "signup") {
        const data = await authSignUp(email, password);
        if (data?.user && data?.session) {
          showToast("注册成功，已登录", "success");
          navigate("/");
        } else {
          showToast("注册成功，请到邮箱确认后登录", "success");
          setMode("signin");
        }
      } else {
        await authSignIn(email, password);
        showToast("登录成功", "success");
        navigate("/");
      }
    } catch (err) {
      showToast(err.message || "操作失败", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "signin" ? "登录" : "注册";
    }
  });
}

/* ---- 运动档案页 ---- */
async function renderProfilePage(app, user) {
  app.innerHTML = `<div class="page"><div class="loading">加载中…</div></div>`;

  let profile = null;
  try {
    profile = await getProfile(user.id);
  } catch (e) {
    /* 忽略，按空表单展示 */
  }

  const p = profile || {};
  app.innerHTML = `
    <section class="page">
      <div class="page-head">
        <p class="eyebrow">Profile</p>
        <h2>我的运动档案</h2>
      </div>
      <form id="profileForm" class="form-card panel" style="box-shadow:none">
        <div class="profile-section">
          <h3>基础信息</h3>
          <div class="form-grid cols-3">
            <label>昵称<input id="pf_nickname" type="text" value="${escapeHtml(p.nickname || "")}" placeholder="如 小跑"/></label>
            <label>年龄<input id="pf_age" type="number" min="10" max="70" value="${p.age ?? ""}" placeholder="如 25"/></label>
            <label>性别
              <select id="pf_gender">
                <option value="">未填写</option>
                <option value="male" ${p.gender === "male" ? "selected" : ""}>男</option>
                <option value="female" ${p.gender === "female" ? "selected" : ""}>女</option>
              </select>
            </label>
            <label>身高 (cm)<input id="pf_height" type="number" min="120" max="230" value="${p.height ?? ""}" placeholder="如 175"/></label>
            <label>体重 (kg)<input id="pf_weight" type="number" min="30" max="150" value="${p.weight ?? ""}" placeholder="如 62"/></label>
          </div>
        </div>

        <div class="profile-section" style="margin-top:16px">
          <h3>训练信息</h3>
          <div class="form-grid cols-3">
            <label>主要项目
              <select id="pf_main_event">
                <option value="">未选择</option>
                <option value="800" ${p.main_event === "800" ? "selected" : ""}>800 米</option>
                <option value="1500" ${p.main_event === "1500" ? "selected" : ""}>1500 米</option>
                <option value="3000" ${p.main_event === "3000" ? "selected" : ""}>3000 米</option>
                <option value="5000" ${p.main_event === "5000" ? "selected" : ""}>5000 米</option>
              </select>
            </label>
            <label>训练年限 (年)<input id="pf_training_years" type="number" min="0" max="40" step="0.5" value="${p.training_years ?? ""}" placeholder="如 3"/></label>
            <label>每周训练次数<input id="pf_sessions" type="number" min="1" max="14" value="${p.sessions_per_week ?? ""}" placeholder="如 6"/></label>
            <label>当前周跑量 (km)<input id="pf_weekly_volume" type="number" min="0" max="300" step="0.5" value="${p.weekly_volume ?? ""}" placeholder="如 50"/></label>
            <label>是否有教练指导
              <select id="pf_has_coach">
                <option value="">未填写</option>
                <option value="true" ${p.has_coach === true ? "selected" : ""}>有</option>
                <option value="false" ${p.has_coach === false ? "selected" : ""}>无</option>
              </select>
            </label>
          </div>
        </div>

        <div class="profile-section" style="margin-top:16px">
          <h3>目标信息</h3>
          <div class="form-grid cols-3">
            <label>目标项目
              <select id="pf_goal_event">
                <option value="">未选择</option>
                <option value="800" ${p.goal_event === "800" ? "selected" : ""}>800 米</option>
                <option value="1500" ${p.goal_event === "1500" ? "selected" : ""}>1500 米</option>
                <option value="3000" ${p.goal_event === "3000" ? "selected" : ""}>3000 米</option>
                <option value="5000" ${p.goal_event === "5000" ? "selected" : ""}>5000 米</option>
              </select>
            </label>
            <label>目标成绩<input id="pf_goal_time" type="text" value="${escapeHtml(p.goal_time || "")}" placeholder="如 2:05 / 4:30 / 18:00"/></label>
            <label>比赛日期<input id="pf_race_date" type="date" value="${p.race_date || ""}"/></label>
          </div>
        </div>

        <button class="primary-button full" type="submit" id="profileSubmit">保存运动档案</button>
        <p class="form-note">档案会保存到你的账户，并在能力分析时自动填充目标项目与目标成绩。</p>
      </form>
    </section>
  `;

  document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("profileSubmit");
    const profile = {
      nickname: getFieldValue("pf_nickname").trim() || null,
      age: Number(getFieldValue("pf_age")) || null,
      gender: getFieldValue("pf_gender") || null,
      height: Number(getFieldValue("pf_height")) || null,
      weight: Number(getFieldValue("pf_weight")) || null,
      main_event: getFieldValue("pf_main_event") || null,
      training_years: Number(getFieldValue("pf_training_years")) || null,
      sessions_per_week: Number(getFieldValue("pf_sessions")) || null,
      weekly_volume: Number(getFieldValue("pf_weekly_volume")) || null,
      has_coach: getFieldValue("pf_has_coach") === "" ? null : getFieldValue("pf_has_coach") === "true",
      goal_event: getFieldValue("pf_goal_event") || null,
      goal_time: getFieldValue("pf_goal_time").trim() || null,
      race_date: getFieldValue("pf_race_date") || null,
    };
    btn.disabled = true;
    btn.textContent = "保存中…";
    try {
      await saveProfile(user.id, profile);
      showToast("档案已保存", "success");
    } catch (err) {
      showToast(err.message || "保存失败", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "保存运动档案";
    }
  });
}

/* ---- 成绩数据库页 ---- */
async function renderPerformancePage(app, user) {
  app.innerHTML = `<div class="page"><div class="loading">加载中…</div></div>`;
  await renderPerformanceList(app, user);
}

async function renderPerformanceList(app, user) {
  let records = [];
  try {
    records = await listPerformances(user.id);
  } catch (e) {
    /* 忽略 */
  }

  const rows = records.length
    ? records.map((r) => `
        <tr>
          <td class="col-event">${escapeHtml(r.event)} 米</td>
          <td class="col-time">${escapeHtml(r.time_text || (r.time_seconds ? formatTime(r.time_seconds) : "—"))}</td>
          <td class="col-date">${escapeHtml(r.record_date || "—")}</td>
          <td class="col-date">${escapeHtml(r.note || "")}</td>
          <td class="col-action"><button class="del-btn" data-id="${escapeHtml(r.id)}">删除</button></td>
        </tr>
      `).join("")
    : `<tr class="empty-row"><td colspan="5">还没有成绩记录。在下方添加你的第一条成绩。</td></tr>`;

  app.innerHTML = `
    <section class="page">
      <div class="page-head">
        <p class="eyebrow">Performance</p>
        <h2>我的成绩</h2>
      </div>

      <div class="perf-table-box" style="border-radius:18px;border:1px solid var(--line);overflow:hidden;background:#fff">
        <table class="perf-table">
          <thead><tr><th>项目</th><th>成绩</th><th>日期</th><th>备注</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="form-card panel" style="box-shadow:none">
        <div class="page-head"><h3 style="margin:0">添加成绩记录</h3></div>
        <form id="perfForm">
          <div class="form-grid cols-3">
            <label>项目
              <select id="pf_event">
                <option value="400">400 米</option>
                <option value="600">600 米</option>
                <option value="800">800 米</option>
                <option value="1500">1500 米</option>
                <option value="3000">3000 米</option>
                <option value="5000">5000 米</option>
              </select>
            </label>
            <label>成绩<input id="pf_time_text" type="text" placeholder="如 2:05 / 4:30 / 18:00" required/></label>
            <label>日期<input id="pf_date" type="date" value="${todayISO()}"/></label>
          </div>
          <label class="full-field" style="margin-top:14px">备注（选填）<input id="pf_note" type="text" placeholder="如 训练测试 / 正式比赛"/></label>
          <button class="primary-button full" type="submit" id="perfSubmit">添加成绩</button>
          <p class="form-note">成绩会保存到你的账户。能力分析页会自动读取最新成绩填充分析表单。</p>
        </form>
      </div>
    </section>
  `;

  document.getElementById("perfForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("perfSubmit");
    const timeText = getFieldValue("pf_time_text").trim();
    const seconds = parseTime(timeText);
    if (!seconds) {
      showToast("成绩格式不正确，支持秒数或 分:秒 格式", "error");
      return;
    }
    const record = {
      event: getFieldValue("pf_event"),
      time_seconds: seconds,
      time_text: timeText,
      record_date: getFieldValue("pf_date") || null,
      note: getFieldValue("pf_note").trim() || null,
    };
    btn.disabled = true;
    btn.textContent = "添加中…";
    try {
      await addPerformance(user.id, record);
      showToast("成绩已添加", "success");
      await renderPerformanceList(app, user);
    } catch (err) {
      showToast(err.message || "添加失败", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "添加成绩";
    }
  });

  document.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      try {
        await deletePerformance(user.id, id);
        showToast("已删除", "success");
        await renderPerformanceList(app, user);
      } catch (err) {
        showToast(err.message || "删除失败", "error");
      }
    });
  });
}

/* ---- 能力分析页 ---- */
async function renderAnalysisPage(app, user) {
  app.innerHTML = `
    <section class="page">
      <div class="page-head">
        <p class="eyebrow">Step 1</p>
        <h2>输入训练需求</h2>
      </div>
      <div class="analysis-layout">
        <form id="planForm" class="form-card">
          <div class="form-grid">
            <label>目标项目
              <select id="event" required>
                <option value="800">800 米</option>
                <option value="1500">1500 米</option>
                <option value="3000">3000 米</option>
                <option value="5000">5000 米</option>
              </select>
            </label>
            <label>训练周期（周）<input id="weeks" type="number" min="4" max="24" value="12" required/></label>
            <label>目标成绩<input id="goalTime" placeholder="如 2:05 / 4:30 / 18:00" required/></label>
            <label>每周训练天数
              <select id="daysPerWeek">
                <option value="4">4 天</option>
                <option value="5" selected>5 天</option>
                <option value="6">6 天</option>
              </select>
            </label>
            <label>年龄<input id="age" type="number" min="10" max="70" value="20"/></label>
            <label>400m 当前成绩<input id="time400" placeholder="如 58"/></label>
            <label>600m 当前成绩<input id="time600" placeholder="如 1:35"/></label>
            <label>800m 当前成绩<input id="time800" placeholder="如 2:12"/></label>
            <label>1500m 当前成绩<input id="time1500" placeholder="如 4:50"/></label>
            <label>3000m 当前成绩<input id="time3000" placeholder="如 10:45"/></label>
            <label>5000m 当前成绩<input id="time5000" placeholder="如 19:30"/></label>
            <label>10km 当前成绩<input id="time10000" placeholder="如 42:00"/></label>
            <label>力量能力自评
              <select id="strength">
                <option value="50">较弱</option>
                <option value="65" selected>一般</option>
                <option value="80">较好</option>
                <option value="92">很好</option>
              </select>
            </label>
            <label>最长轻松跑距离（km）<input id="longRun" type="number" min="3" max="30" value="8"/></label>
            <label>恢复能力
              <select id="recovery">
                <option value="low">恢复慢</option>
                <option value="normal" selected>正常</option>
                <option value="high">恢复快</option>
              </select>
            </label>
            <label>伤病风险
              <select id="injuryRisk">
                <option value="low" selected>低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>
          </div>
          <label class="full-field">进一步需求 / 近期反馈
            <textarea id="additionalNeeds" rows="5" placeholder="例如：最近小腿有点紧，想降低强度；或者希望加强速度耐力和最后 300m 冲刺；也可以写时间比较紧、想少做力量、想增加有氧等。"></textarea>
          </label>
          <button class="primary-button full" type="submit">生成能力分析</button>
          <p class="form-note">时间支持秒数或「分:秒」格式。${user ? "已登录，分析结果会自动保存到你的账户，并可在训练计划页查看。" : "登录后可保存分析结果与训练计划。"}</p>
        </form>

        <aside class="output-card" id="summary">
          <div class="empty-state">
            <h2>等待生成</h2>
            <p>填写左侧信息后，这里会展示六维能力雷达图、运动员类型分类、目标需求对比、短板分析和训练权重调整。</p>
          </div>
        </aside>
      </div>
    </section>
  `;

  document.getElementById("planForm").addEventListener("submit", handleAnalysisSubmit);

  if (user) {
    prefillAnalysisForm(user);
  }
}

async function prefillAnalysisForm(user) {
  try {
    const [profile, perfs] = await Promise.all([getProfile(user.id), listPerformances(user.id)]);
    if (profile) {
      const eventVal = profile.goal_event || profile.main_event;
      if (eventVal) setFieldValue("event", String(eventVal));
      if (profile.goal_time) setFieldValue("goalTime", profile.goal_time);
      if (profile.age) setFieldValue("age", String(profile.age));
      if (profile.sessions_per_week) setFieldValue("daysPerWeek", String(Math.min(6, Math.max(4, profile.sessions_per_week))));
    }
    const latestByEvent = {};
    perfs.forEach((p) => { if (!latestByEvent[p.event]) latestByEvent[p.event] = p; });
    const eventToField = { "400": "time400", "600": "time600", "800": "time800", "1500": "time1500", "3000": "time3000", "5000": "time5000", "10000": "time10000" };
    Object.entries(latestByEvent).forEach(([ev, p]) => {
      const field = eventToField[String(ev)];
      if (field && p.time_text) setFieldValue(field, p.time_text);
    });
  } catch (e) {
    /* 静默忽略预填失败 */
  }
}

async function handleAnalysisSubmit(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector("button[type=submit]");
  try {
    const input = readInput();
    const analysis = analyzeAthlete(input);
    const phases = splitPhases(input.weeks);
    const weeks = buildPlan(input, analysis, phases);

    renderSummary(input, analysis);

    if (currentUser) {
      submitBtn.disabled = true;
      submitBtn.textContent = "保存中…";
      try {
        await saveAnalysis(currentUser.id, input, analysis, phases, weeks);
        showToast("分析已保存到你的账户", "success");
      } catch (err) {
        showToast("分析已生成，但保存失败：" + (err.message || err), "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "生成能力分析";
      }
    } else {
      showToast("分析已生成（登录后可保存）", "success");
    }
  } catch (err) {
    showToast(err.message || "生成失败", "error");
  }
}

/* ---- 训练计划页 ---- */
async function renderPlanPage(app, user) {
  app.innerHTML = `<div class="page"><div class="loading">加载中…</div></div>`;

  let snap = null;
  try {
    snap = await getLatestAnalysis(user.id);
  } catch (e) {
    /* 忽略 */
  }

  if (!snap) {
    app.innerHTML = `
      <section class="guard">
        <h2>暂无训练计划</h2>
        <p>先生成一次能力分析，系统会自动保存训练计划，然后回到本页查看完整周期安排。</p>
        <a class="primary-button" href="#/analysis">去能力分析</a>
      </section>`;
    return;
  }

  const input = snap.input_json || {};
  const analysis = snap.analysis_json || {};
  const phases = snap.phases_json || [];
  const weeks = snap.plan_json || [];
  const label = snap.label || (input.model?.name || "");

  // 查询当前是否已启用此课表
  let activeAssignment = null;
  try {
    activeAssignment = await getActiveAssignment(user.id);
  } catch (e) { /* 忽略 */ }

  const isActiveThis = activeAssignment && activeAssignment.snapshot_id === snap.id;
  const totalWeeks = weeks.length || input.weeks || 12;

  app.innerHTML = `
    <section class="page">
      <div class="page-head">
        <p class="eyebrow">Step 2</p>
        <h2>周期训练计划</h2>
        <p class="form-note">${escapeHtml(label)} · 生成于 ${escapeHtml(snap.created_at ? new Date(snap.created_at).toLocaleString("zh-CN") : "—")}</p>
      </div>

      <div class="plan-action-bar">
        ${isActiveThis
          ? `<div class="plan-status plan-status-active">✓ 已启用 · 开始日期 ${escapeHtml(activeAssignment.start_date)} · 共 ${activeAssignment.total_weeks} 周 · <a href="#/calendar">查看训练日历 →</a></div>
             <button class="ghost-button danger-btn" id="revokePlanBtn">撤回启用</button>`
          : `<button class="primary-button" id="enablePlanBtn">启用此课表</button>
             ${activeAssignment ? `<span class="plan-status plan-status-other">当前已启用其他课表，启用新课表会覆盖原课表</span>` : ""}`
        }
      </div>

      <div id="phaseTimeline" class="timeline"></div>
      <div id="weeklyPlan" class="week-grid"></div>
    </section>
  `;

  if (phases.length) renderTimeline(phases);
  else document.getElementById("phaseTimeline").innerHTML = "";

  if (weeks.length) renderPlan(weeks);
  else document.getElementById("weeklyPlan").innerHTML = `<div class="guard"><p>该次分析未保存训练计划，请重新生成。</p></div>`;

  // 绑定「启用此课表」按钮
  const enableBtn = document.getElementById("enablePlanBtn");
  if (enableBtn) {
    enableBtn.addEventListener("click", () => openEnablePlanModal(snap, totalWeeks));
  }

  // 绑定「撤回启用」按钮
  const revokeBtn = document.getElementById("revokePlanBtn");
  if (revokeBtn && activeAssignment) {
    revokeBtn.addEventListener("click", () => {
      openRevokePlanModal(activeAssignment.id, () => router());
    });
  }
}

/* ---- 启用课表弹窗 ---- */
function openEnablePlanModal(snapshot, totalWeeks) {
  const today = formatDateISO(new Date());
  // 默认下周一
  const nextMonday = addDays(new Date(), (8 - new Date().getDay()) % 7 || 7);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>启用此训练课表</h3>
        <button class="modal-close" aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-desc">选择这份课表从哪一天开始执行。系统会按 12 周生成训练日历，每天都可以记录完成情况并计算训练负荷。</p>
        <label>
          课表开始日期
          <input type="date" id="planStartDate" value="${formatDateISO(nextMonday)}" min="${today}" />
        </label>
        <div class="modal-hint">默认从下周一开规划，你也能改成今天或其他日期。</div>
      </div>
      <div class="modal-foot">
        <button class="ghost-button" id="planCancelBtn">取消</button>
        <button class="primary-button" id="planConfirmBtn">确认启用</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.querySelector("#planCancelBtn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector("#planConfirmBtn").addEventListener("click", async () => {
    const startDate = document.getElementById("planStartDate").value;
    if (!startDate) {
      showToast("请选择开始日期", "error");
      return;
    }
    const btn = overlay.querySelector("#planConfirmBtn");
    btn.disabled = true;
    btn.textContent = "启用中…";
    try {
      await createAssignment(currentUser.id, snapshot.id, startDate, totalWeeks);
      showToast("课表已启用，可以开始训练了！", "success");
      close();
      navigate("/calendar");
    } catch (err) {
      showToast("启用失败：" + (err.message || err), "error");
      btn.disabled = false;
      btn.textContent = "确认启用";
    }
  });
}

/* ---- 撤回课表确认弹窗 ---- */
function openRevokePlanModal(assignmentId, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>撤回课表启用</h3>
        <button class="modal-close" aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <div class="adjustment-box" style="border-color:rgba(196,82,70,0.25);background:linear-gradient(180deg,#fff5f3,#fdecea);">
          <strong>确认要撤回这份课表吗？</strong>
          <p>撤回后：训练日历将不再显示这份课表，你需要重新启用才能继续打卡。</p>
          <p>之前已经记录过的训练日志和历史数据不会被删除，随时可以重新启用查看。</p>
        </div>
      </div>
      <div class="modal-foot">
        <button class="ghost-button" id="revokeCancelBtn">取消</button>
        <button class="danger-button" id="revokeConfirmBtn">确认撤回</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.querySelector("#revokeCancelBtn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector("#revokeConfirmBtn").addEventListener("click", async () => {
    const btn = overlay.querySelector("#revokeConfirmBtn");
    btn.disabled = true;
    btn.textContent = "撤回中…";
    try {
      await deactivateAssignment(currentUser.id, assignmentId);
      showToast("课表已撤回", "success");
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast("撤回失败：" + (err.message || err), "error");
      btn.disabled = false;
      btn.textContent = "确认撤回";
    }
  });
}

/* ---- 删除训练日志确认弹窗 ---- */
function openDeleteLogModal(dateStr, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>删除训练日志</h3>
        <button class="modal-close" aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <div class="adjustment-box" style="border-color:rgba(196,82,70,0.25);background:linear-gradient(180deg,#fff5f3,#fdecea);">
          <strong>确认要删除 ${escapeHtml(dateStr)} 的训练日志吗？</strong>
          <p>删除后该日的训练记录、训练负荷数据将一并清除，无法恢复。</p>
          <p>如果只是想修改内容，建议直接修改后点「更新日志」而不是删除重建。</p>
        </div>
      </div>
      <div class="modal-foot">
        <button class="ghost-button" id="delLogCancelBtn">取消</button>
        <button class="danger-button" id="delLogConfirmBtn">确认删除</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.querySelector("#delLogCancelBtn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector("#delLogConfirmBtn").addEventListener("click", async () => {
    const btn = overlay.querySelector("#delLogConfirmBtn");
    btn.disabled = true;
    btn.textContent = "删除中…";
    try {
      await deleteTrainingLog(currentUser.id, dateStr);
      showToast("日志已删除", "success");
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast("删除失败：" + (err.message || err), "error");
      btn.disabled = false;
      btn.textContent = "确认删除";
    }
  });
}

/* ===================== 11. 训练日历 / 每日日志 / 训练负荷 ===================== */

/* ---- /calendar 训练日历总览页 ---- */
async function renderCalendarPage(app, user) {
  app.innerHTML = `<div class="page"><div class="loading">加载中…</div></div>`;

  let assignment = null;
  let snapshot = null;
  let logs = [];
  try {
    assignment = await getActiveAssignment(user.id);
    if (assignment) {
      snapshot = await getAnalysisById(assignment.snapshot_id);
      const startDate = assignment.start_date;
      const endDate = formatDateISO(addDays(parseDateISO(startDate), assignment.total_weeks * 7 - 1));
      logs = await listTrainingLogs(user.id, startDate, endDate);
    }
  } catch (e) {
    app.innerHTML = `<div class="guard"><h2>加载失败</h2><p>${escapeHtml(e.message || String(e))}</p></div>`;
    return;
  }

  if (!assignment || !snapshot) {
    app.innerHTML = `
      <section class="page">
        <div class="page-head">
          <p class="eyebrow">训练日历</p>
          <h2>还没有启用训练课表</h2>
        </div>
        <div class="guard">
          <p>先生成一次能力分析，然后在「训练计划」页面点「启用此课表」按钮，选择开始日期后即可生成 12 周训练日历。</p>
          <a class="primary-button" href="#/plan">去训练计划</a>
        </div>
      </section>`;
    return;
  }

  const weeks = snapshot.plan_json || [];
  const startDate = parseDateISO(assignment.start_date);

  // 把日志按日期索引
  const logMap = {};
  logs.forEach((l) => { logMap[l.log_date] = l; });

  const todayStr = formatDateISO(new Date());

  // 按周分组渲染
  const weekBlocks = [];
  for (let w = 0; w < assignment.total_weeks; w++) {
    const weekStart = addDays(startDate, w * 7);
    const weekEnd = addDays(weekStart, 6);
    const weekPlan = weeks[w] || {};
    const phaseName = weekPlan.phase?.name || "—";
    const phaseId = weekPlan.phase?.id || "";
    const emphasis = weekPlan.emphasis || [];
    const emphasisLabels = (emphasis || []).map((k) => LABELS[k] || k).join(" · ");

    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const dateStr = formatDateISO(date);
      const planned = getPlannedDayForDate(assignment, snapshot, dateStr);
      const log = logMap[dateStr];
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      const isPast = dateStr < todayStr;

      let statusClass = "cal-day-future";
      let statusLabel = "未开始";
      if (isToday) { statusClass = "cal-day-today"; statusLabel = "今天"; }
      else if (isPast) {
        statusClass = "cal-day-past";
        statusLabel = "已过";
        if (log) {
          if (log.status === "completed") { statusClass = "cal-day-done"; statusLabel = "已完成"; }
          else if (log.status === "partial") { statusClass = "cal-day-partial"; statusLabel = "部分完成"; }
          else if (log.status === "skipped") { statusClass = "cal-day-skip"; statusLabel = "跳过"; }
          else { statusClass = "cal-day-missed"; statusLabel = "未记录"; }
        }
      }

      const dayTitle = planned?.isRest ? "休息日" : (planned?.title || "—");
      const dayShort = planned?.isRest ? "休息" : (planned?.title ? planned.title.split(" ")[0] : "—");

      days.push(`
        <a class="cal-day ${statusClass} ${isToday ? "cal-day-today" : ""}" href="#/day/${dateStr}">
          <div class="cal-day-head">
            <span class="cal-wd">${weekdayName(date)}</span>
            <span class="cal-date">${date.getMonth() + 1}/${date.getDate()}</span>
          </div>
          <div class="cal-day-title">${escapeHtml(dayShort)}</div>
          <div class="cal-day-status">${statusLabel}</div>
          ${log?.training_load ? `<div class="cal-day-load">${log.training_load} AU</div>` : ""}
        </a>
      `);
    }

    const weekLoad = days
      .map((_, i) => {
        const date = addDays(weekStart, i);
        const l = logMap[formatDateISO(date)];
        return l?.training_load ? Number(l.training_load) : 0;
      })
      .reduce((a, b) => a + b, 0);

    weekBlocks.push(`
      <article class="cal-week">
        <header class="cal-week-head">
          <div class="cal-week-title">
            第 ${w + 1} 周
            <span class="cal-week-phase phase-${phaseId}">${escapeHtml(phaseName)}</span>
          </div>
          <div class="cal-week-meta">
            ${formatDateISO(weekStart)} ~ ${formatDateISO(weekEnd)}
            ${emphasisLabels ? ` · 重点：${escapeHtml(emphasisLabels)}` : ""}
            ${weekLoad ? ` · 周负荷 ${weekLoad.toFixed(0)} AU` : ""}
          </div>
        </header>
        <div class="cal-week-grid">${days.join("")}</div>
      </article>
    `);
  }

  // 本周 + 4 周负荷汇总
  const recentLogs = logs.filter((l) => l.log_date <= todayStr);
  const recentSummary = summarizeLoad(recentLogs);

  app.innerHTML = `
    <section class="page calendar-page">
      <div class="page-head">
        <p class="eyebrow">训练日历</p>
        <h2>12 周训练日历</h2>
        <p class="form-note">
          ${escapeHtml(snapshot.label || "")} · 开始 ${escapeHtml(assignment.start_date)} · 共 ${assignment.total_weeks} 周
          · <a href="#/logs">查看训练历史 →</a>
        </p>
      </div>

      <div class="cal-top-actions">
        <button class="ghost-button danger-btn" id="revokeCalBtn" data-id="${escapeHtml(assignment.id)}">↺ 撤回当前课表</button>
      </div>

      <div class="cal-summary">
        <div class="cal-summary-item">
          <span>累计训练负荷</span>
          <strong>${recentSummary.totalLoad} AU</strong>
        </div>
        <div class="cal-summary-item">
          <span>累计训练时长</span>
          <strong>${recentSummary.totalDuration} 分钟</strong>
        </div>
        <div class="cal-summary-item">
          <span>累计训练距离</span>
          <strong>${recentSummary.totalDistance} km</strong>
        </div>
        <div class="cal-summary-item">
          <span>完成 / 部分 / 跳过</span>
          <strong>${recentSummary.completed} / ${recentSummary.partial} / ${recentSummary.skipped}</strong>
        </div>
      </div>

      <div class="cal-weeks">${weekBlocks.join("")}</div>
    </section>
  `;

  // 绑定「撤回当前课表」按钮
  const revokeCal = document.getElementById("revokeCalBtn");
  if (revokeCal) {
    const aId = revokeCal.getAttribute("data-id");
    revokeCal.addEventListener("click", () => {
      openRevokePlanModal(aId, () => router());
    });
  }
}

/* ---- /day/:date 每日训练详情页 ---- */
async function renderDayPage(app, user, dateStr) {
  if (!dateStr) {
    app.innerHTML = `<div class="guard"><h2>日期无效</h2><a class="primary-button" href="#/calendar">返回日历</a></div>`;
    return;
  }

  app.innerHTML = `<div class="page"><div class="loading">加载中…</div></div>`;

  let assignment = null;
  let snapshot = null;
  let log = null;
  try {
    assignment = await getActiveAssignment(user.id);
    if (assignment) {
      snapshot = await getAnalysisById(assignment.snapshot_id);
      log = await getTrainingLog(user.id, dateStr);
    }
  } catch (e) {
    app.innerHTML = `<div class="guard"><h2>加载失败</h2><p>${escapeHtml(e.message || String(e))}</p></div>`;
    return;
  }

  if (!assignment || !snapshot) {
    app.innerHTML = `
      <section class="page">
        <div class="page-head"><p class="eyebrow">每日训练</p><h2>尚未启用课表</h2></div>
        <div class="guard">
          <p>请先到「训练计划」页面启用课表，再来查看每日训练安排。</p>
          <a class="primary-button" href="#/plan">去训练计划</a>
        </div>
      </section>`;
    return;
  }

  const planned = getPlannedDayForDate(assignment, snapshot, dateStr);
  const date = parseDateISO(dateStr);
  const todayStr = formatDateISO(new Date());
  const isToday = dateStr === todayStr;
  const isFuture = dateStr > todayStr;

  // 邻接日期导航
  const prevDate = formatDateISO(addDays(parseDateISO(dateStr), -1));
  const nextDate = formatDateISO(addDays(parseDateISO(dateStr), 1));
  const endDate = formatDateISO(addDays(parseDateISO(assignment.start_date), assignment.total_weeks * 7 - 1));
  const showPrev = dateStr > assignment.start_date;
  const showNext = dateStr < endDate;

  const weekNo = planned?.weekNo || "—";
  const phaseName = planned?.phase?.name || "—";

  const plannedTitle = planned?.isRest ? "休息日" : (planned?.title || "—");
  const plannedDetail = planned?.isRest
    ? "今天没有安排训练课，建议做 20-30 分钟轻松活动（散步、瑜伽、拉伸），保持身体活跃但不累积疲劳。"
    : (planned?.detail || "");

  app.innerHTML = `
    <section class="page day-page">
      <div class="day-nav">
        ${showPrev ? `<a class="ghost-button" href="#/day/${prevDate}">← 前一天</a>` : `<span class="ghost-button disabled">← 前一天</span>`}
        <a class="ghost-button" href="#/calendar">日历</a>
        ${showNext ? `<a class="ghost-button" href="#/day/${nextDate}">后一天 →</a>` : `<span class="ghost-button disabled">后一天 →</span>`}
      </div>

      <div class="page-head">
        <p class="eyebrow">${escapeHtml(weekdayName(date))} · 第 ${weekNo} 周 · ${escapeHtml(phaseName)}</p>
        <h2>${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 训练</h2>
        ${isToday ? `<p class="form-note">今天</p>` : isFuture ? `<p class="form-note">未来日期（可提前规划）</p>` : `<p class="form-note">历史日期</p>`}
      </div>

      <div class="day-grid">
        <article class="day-plan panel">
          <h3>今日计划</h3>
          <div class="day-plan-title">${escapeHtml(plannedTitle)}</div>
          ${plannedDetail ? `<p class="day-plan-detail">${escapeHtml(plannedDetail)}</p>` : ""}
        </article>

        <article class="day-log panel">
          <h3>训练日志</h3>
          <form id="logForm" class="log-form">
            <label>
              完成状态
              <select id="logStatus">
                <option value="pending" ${!log || log.status === "pending" ? "selected" : ""}}>待记录</option>
                <option value="completed" ${log?.status === "completed" ? "selected" : ""}>已完成</option>
                <option value="partial" ${log?.status === "partial" ? "selected" : ""}>部分完成</option>
                <option value="skipped" ${log?.status === "skipped" ? "selected" : ""}>跳过 / 休息</option>
              </select>
            </label>
            <div class="log-grid">
              <label>
                训练时长（分钟）
                <input type="number" id="logDuration" min="0" max="600" value="${log?.duration_min ?? ""}" placeholder="如 60" />
              </label>
              <label>
                距离（km）
                <input type="number" id="logDistance" min="0" max="200" step="0.1" value="${log?.distance_km ?? ""}" placeholder="如 8.5" />
              </label>
              <label>
                平均心率
                <input type="number" id="logHr" min="40" max="220" value="${log?.avg_hr ?? ""}" placeholder="如 155" />
              </label>
              <label>
                RPE（主观强度 6-20）
                <input type="number" id="logRpe" min="6" max="20" step="0.5" value="${log?.rpe ?? ""}" placeholder="如 13" />
              </label>
            </div>
            <label>
              主观感受
              <select id="logFeeling">
                <option value="" ${!log?.feeling ? "selected" : ""}}>—</option>
                <option value="great" ${log?.feeling === "great" ? "selected" : ""}>状态很好</option>
                <option value="good" ${log?.feeling === "good" ? "selected" : ""}>感觉不错</option>
                <option value="normal" ${log?.feeling === "normal" ? "selected" : ""}>一般</option>
                <option value="tired" ${log?.feeling === "tired" ? "selected" : ""}>有些累</option>
                <option value="bad" ${log?.feeling === "bad" ? "selected" : ""}>很疲惫</option>
              </select>
            </label>
            <label>
              备注
              <textarea id="logNote" rows="3" placeholder="如：小腿略紧，最后 2 组降速">${escapeHtml(log?.note || "")}</textarea>
            </label>
            <div class="log-preview" id="logPreview">
              ${log?.training_load ? `当前训练负荷：<strong>${log.training_load} AU</strong>` : "填写时长和强度后自动计算训练负荷"}
            </div>
            <div class="log-actions">
              <button type="submit" class="primary-button" id="logSubmit">${log ? "更新日志" : "保存日志"}</button>
              ${log ? `<button type="button" class="ghost-button" id="logDelete">删除</button>` : ""}
            </div>
          </form>
        </article>
      </div>

      <div id="logFeedback" class="log-feedback"></div>
    </section>
  `;

  // 实时计算训练负荷
  const updatePreview = () => {
    const dur = Number(document.getElementById("logDuration").value) || 0;
    const rpe = Number(document.getElementById("logRpe").value) || 0;
    const hr = Number(document.getElementById("logHr").value) || 0;
    const age = snapshot.input_json?.age || 20;
    const load = calcTrainingLoad(dur, rpe, hr, age);
    const preview = document.getElementById("logPreview");
    preview.innerHTML = load > 0
      ? `当前训练负荷：<strong>${load} AU</strong>`
      : "填写时长和强度后自动计算训练负荷";
  };
  ["logDuration", "logRpe", "logHr"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updatePreview);
  });

  // 提交日志
  document.getElementById("logForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("logSubmit");
    btn.disabled = true;
    btn.textContent = "保存中…";

    const duration = Number(document.getElementById("logDuration").value) || null;
    const rpe = Number(document.getElementById("logRpe").value) || null;
    const hr = Number(document.getElementById("logHr").value) || null;
    const age = snapshot.input_json?.age || 20;
    const load = calcTrainingLoad(duration || 0, rpe || 0, hr || 0, age);

    const payload = {
      planned_title: plannedTitle,
      planned_detail: plannedDetail,
      status: document.getElementById("logStatus").value,
      duration_min: duration,
      distance_km: Number(document.getElementById("logDistance").value) || null,
      avg_hr: hr,
      rpe: rpe,
      intensity_factor: rpeToIntensityFactor(rpe || 0),
      training_load: load,
      feeling: document.getElementById("logFeeling").value || null,
      note: document.getElementById("logNote").value.trim() || null,
    };

    try {
      const saved = await upsertTrainingLog(user.id, dateStr, payload);
      showToast("日志已保存", "success");
      renderDayFeedback(saved, planned);
      btn.disabled = false;
      btn.textContent = "更新日志";
      if (!document.getElementById("logDelete")) {
        // 重新渲染以显示删除按钮
        renderDayPage(app, user, dateStr);
      }
    } catch (err) {
      showToast("保存失败：" + (err.message || err), "error");
      btn.disabled = false;
      btn.textContent = log ? "更新日志" : "保存日志";
    }
  });

  // 删除日志
  const delBtn = document.getElementById("logDelete");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      openDeleteLogModal(dateStr, () => renderDayPage(app, user, dateStr));
    });
  }

  // 渲染已有日志的反馈
  if (log) {
    renderDayFeedback(log, planned);
  }
}

// 渲染训练日志的评估反馈
function renderDayFeedback(log, planned) {
  const box = document.getElementById("logFeedback");
  if (!box) return;
  if (!log || log.status === "pending") {
    box.innerHTML = "";
    return;
  }

  const feedback = [];

  if (log.status === "skipped") {
    feedback.push("今天跳过了训练。如果连续 2 天以上跳过，建议调整课表或降低负荷。");
  } else if (log.status === "completed" || log.status === "partial") {
    const load = Number(log.training_load) || 0;
    if (load > 0) {
      if (load < 30) feedback.push(`训练负荷 ${load} AU，属于轻量训练，适合恢复或保持状态。`);
      else if (load < 60) feedback.push(`训练负荷 ${load} AU，属于中等训练，保持这个节奏不错。`);
      else if (load < 100) feedback.push(`训练负荷 ${load} AU，属于较大训练量，注意后续 24 小时的恢复。`);
      else feedback.push(`训练负荷 ${load} AU，属于高强度训练，建议明天安排轻松或休息日。`);
    }

    if (log.rpe) {
      const rpe = Number(log.rpe);
      if (rpe >= 16 && log.status === "completed") {
        feedback.push(`RPE ${rpe} 偏高，说明这节课对你来说比较吃力。如果连续几次都偏高，建议降低强度或增加恢复。`);
      } else if (rpe <= 9 && log.status === "completed") {
        feedback.push(`RPE ${rpe} 较低，训练较为轻松，可考虑在状态好的时候适度上调强度。`);
      }
    }

    if (log.feeling === "bad" || log.feeling === "tired") {
      feedback.push("主观感受偏疲累，明天可降低负荷或改为轻松跑 + 拉伸。");
    } else if (log.feeling === "great") {
      feedback.push("状态很好！可以按计划推进，但不要冲到力竭。");
    }

    if (log.status === "partial") {
      feedback.push("部分完成：记录好跳过的部分，下一次同类训练课可以补回。");
    }
  }

  box.innerHTML = feedback.length
    ? `<article class="panel advice-box"><h3>系统评估</h3><ul class="feedback-list">${feedback.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul></article>`
    : "";
}

/* ---- /logs 训练日志历史页 ---- */
async function renderLogsPage(app, user) {
  app.innerHTML = `<div class="page"><div class="loading">加载中…</div></div>`;

  const today = new Date();
  const todayStr = formatDateISO(today);
  const sevenDaysAgo = formatDateISO(addDays(today, -6));
  const twentyEightDaysAgo = formatDateISO(addDays(today, -27));

  let logs7 = [];
  let logs28 = [];
  let allLogs = [];
  try {
    [logs7, logs28] = await Promise.all([
      listTrainingLogs(user.id, sevenDaysAgo, todayStr),
      listTrainingLogs(user.id, twentyEightDaysAgo, todayStr),
    ]);
    allLogs = logs28;
  } catch (e) {
    app.innerHTML = `<div class="guard"><h2>加载失败</h2><p>${escapeHtml(e.message || String(e))}</p></div>`;
    return;
  }

  const summary7 = summarizeLoad(logs7);
  const summary28 = summarizeLoad(logs28);

  // 7 天每日负荷条形图
  const daily7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const ds = formatDateISO(d);
    const l = logs7.find((x) => x.log_date === ds);
    const load = l?.training_load ? Number(l.training_load) : 0;
    daily7.push({ date: d, load, status: l?.status || "pending", label: `${d.getMonth() + 1}/${d.getDate()}`, wd: weekdayName(d) });
  }
  const maxLoad7 = Math.max(20, ...daily7.map((d) => d.load));

  // 4 周每周负荷趋势
  const weekly28 = [];
  for (let w = 3; w >= 0; w--) {
    const wEnd = addDays(today, -w * 7);
    const wStart = addDays(wEnd, -6);
    const wLogs = logs28.filter((l) => l.log_date >= formatDateISO(wStart) && l.log_date <= formatDateISO(wEnd));
    const s = summarizeLoad(wLogs);
    weekly28.push({ start: wStart, end: wEnd, ...s });
  }
  const maxWeeklyLoad = Math.max(50, ...weekly28.map((w) => w.totalLoad));

  app.innerHTML = `
    <section class="page logs-page">
      <div class="page-head">
        <p class="eyebrow">训练历史</p>
        <h2>训练负荷与趋势</h2>
        <p class="form-note">基于每日训练日志，自动汇总 7 天与 28 天训练数据。</p>
      </div>

      <div class="logs-grid">
        <article class="panel logs-block">
          <h3>最近 7 天</h3>
          <div class="logs-summary">
            <div><span>训练负荷</span><strong>${summary7.totalLoad} AU</strong></div>
            <div><span>训练时长</span><strong>${summary7.totalDuration} 分钟</strong></div>
            <div><span>训练距离</span><strong>${summary7.totalDistance} km</strong></div>
            <div><span>训练次数</span><strong>${summary7.sessions}</strong></div>
          </div>
          <div class="logs-bar-chart">
            ${daily7.map((d) => `
              <div class="bar-col">
                <div class="bar-track">
                  <div class="bar-fill ${d.status === "completed" ? "bar-done" : d.status === "partial" ? "bar-partial" : d.status === "skipped" ? "bar-skip" : d.load ? "bar-done" : "bar-empty"}"
                       style="height: ${Math.max(4, (d.load / maxLoad7) * 100)}%"></div>
                </div>
                <div class="bar-label">${d.label}</div>
                <div class="bar-value">${d.load > 0 ? d.load.toFixed(0) : "—"}</div>
              </div>
            `).join("")}
          </div>
        </article>

        <article class="panel logs-block">
          <h3>最近 28 天</h3>
          <div class="logs-summary">
            <div><span>训练负荷</span><strong>${summary28.totalLoad} AU</strong></div>
            <div><span>训练时长</span><strong>${summary28.totalDuration} 分钟</strong></div>
            <div><span>训练距离</span><strong>${summary28.totalDistance} km</strong></div>
            <div><span>完成率</span><strong>${summary28.sessions ? Math.round((summary28.completed / summary28.sessions) * 100) : 0}%</strong></div>
          </div>
          <div class="logs-weekly">
            ${weekly28.map((w, i) => `
              <div class="weekly-col">
                <div class="weekly-bar" style="height: ${Math.max(4, (w.totalLoad / maxWeeklyLoad) * 100)}%"></div>
                <div class="weekly-label">第 ${i + 1} 周</div>
                <div class="weekly-value">${w.totalLoad.toFixed(0)} AU</div>
              </div>
            `).join("")}
          </div>
        </article>

        <article class="panel logs-block logs-list-block">
          <h3>训练日志记录</h3>
          ${allLogs.length === 0
            ? `<p class="form-note">还没有训练日志，去训练日历选择一天开始记录吧。</p>`
            : `<table class="logs-table">
                <thead>
                  <tr><th>日期</th><th>项目</th><th>状态</th><th>负荷</th><th>时长</th><th>RPE</th><th>操作</th></tr>
                </thead>
                <tbody>
                  ${allLogs.slice(0, 30).map((l) => `
                    <tr>
                      <td><a href="#/day/${l.log_date}">${l.log_date}</a></td>
                      <td>${escapeHtml(l.planned_title || "—")}</td>
                      <td class="status-${l.status}">${statusLabel(l.status)}</td>
                      <td>${l.training_load ? Number(l.training_load).toFixed(0) : "—"}</td>
                      <td>${l.duration_min || "—"}</td>
                      <td>${l.rpe || "—"}</td>
                      <td><button class="ghost-button danger-btn log-del-btn" data-date="${escapeHtml(l.log_date)}">删除</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>`
          }
        </article>
      </div>
    </section>
  `;

  // 绑定日志删除按钮
  document.querySelectorAll(".log-del-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dateStr = btn.getAttribute("data-date");
      openDeleteLogModal(dateStr, () => renderLogsPage(app, user));
    });
  });
}

function statusLabel(status) {
  return { pending: "待记录", completed: "已完成", partial: "部分", skipped: "跳过" }[status] || status;
}

function sourceTypeLabel(type) {
  return {
    manual: "手动填写",
    coros: "高驰 COROS",
    garmin: "佳明 Garmin",
    strava: "Strava",
    file_tcx: "TCX 导入",
    file_gpx: "GPX 导入",
    file_csv: "CSV 导入",
    file_fit: "FIT 导入 / 佳明",
  }[type] || type || "未知";
}

function platformLabel(p) {
  return {
    coros: "高驰 COROS",
    strava: "Strava",
    garmin: "佳明 Garmin",
  }[p] || p;
}

function platformStatusLabel(s) {
  return {
    pending: "未连接",
    connected: "已连接",
    expired: "已过期",
    revoked: "已撤销",
  }[s] || s;
}

function platformStatusBadge(s) {
  const map = {
    pending: "badge-balanced",
    connected: "badge-endurance",
    expired: "badge-speed",
    revoked: "badge-speed",
  };
  return map[s] || "badge-balanced";
}

/* ===================== 9.5 数据同步页面 ===================== */
async function renderSyncPage(app, user) {
  const appRoot = document.getElementById("app");
  const userId = user.id;

  // 加载平台连接、用户年龄、最近日志（数据源分布）
  const [connections, profile, recentLogs] = await Promise.all([
    listPlatformConnections(userId).catch((e) => []),
    getProfile(userId).catch((e) => null),
    listTrainingLogs(userId).catch((e) => []),
  ]);
  const age = profile?.age || 25;

  // 统计各来源导入量
  const sourceStats = {};
  recentLogs.forEach((l) => {
    const s = l.source_type || "manual";
    sourceStats[s] = (sourceStats[s] || 0) + 1;
  });

  appRoot.innerHTML = `
    <section class="page sync-page">
      <header class="page-head">
        <h2>数据同步 / 高驰 + 佳明导入</h2>
        <p class="page-sub">从高驰（COROS）、佳明（Garmin）、Strava 等运动平台把训练数据自动导入到训练日历和日志。</p>
      </header>

      <!-- 提示条 -->
      <div class="sync-info-card">
        <div class="sync-info-icon">💡</div>
        <div class="sync-info-body">
          <strong>快速上手（高驰 + 佳明通用）</strong>
          <ol class="sync-steps">
            <li><strong>佳明（Garmin）用户</strong>：打开佳明 Connect APP → 活动详情 → 右上角「…」→「导出原始文件 (FIT)」。或佳明官网 <code>connectcn.garmin.cn</code> → 活动详情 →「导出」。
            </li>
            <li><strong>高驰（COROS）用户</strong>：高驰 APP → 活动详情 → 右上角「…」→ 导出 → 选择 <strong>TCX</strong> 格式（推荐）。</li>
            <li>在下方 <strong>「批量上传文件」</strong> 区域把导出的 .fit / .tcx / .gpx / .csv 文件拖进来，或点击选择。</li>
            <li>系统会自动解析、去重、换算训练负荷，并写入你的训练日志。同一活动不会被重复导入。</li>
          </ol>
          <p class="muted"><strong>格式选择指南：</strong>佳明推荐 <code>.fit</code>（原厂二进制，含步频/触地时间/垂直振幅等跑步动态）；高驰推荐 <code>.tcx</code>；通用互转选 <code>.gpx</code>；Excel 整理用 <code>.csv</code>。</p>
          <p class="muted"><strong>进阶：</strong>如果已经把高驰/佳明数据同步到 Strava，未来可以部署简单后端实现 Strava OAuth 自动拉取（本系统已预留连接表架构）。</p>
        </div>
      </div>

      <!-- 平台连接卡片（预留 Strava OAuth 接口） -->
      <div class="card-grid">
        <article class="card platform-card">
          <div class="platform-card-head">
            <div class="platform-brand coros-brand">
              <div class="platform-logo" aria-label="COROS 高驰官方 LOGO">
                <!--
                  COROS 官方 LOGO（直接从 coros.com 官网提取的真实矢量，1:1 还原）
                  圆形黑底 + 红色左转箭头（速度计造型）+ 红色水平线
                  官方源 SVG viewBox: 0 0 45 34
                  嵌入到 64x64 黑圆底中央居中
                -->
                <svg viewBox="0 0 64 64" width="46" height="46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <!-- 黑色圆形背景（COROS 官方 App 图标底色） -->
                  <circle cx="32" cy="32" r="31" fill="#000000"/>
                  <!--
                    真实 COROS 品牌标志：
                    1) 左转六角箭头（指向左方，官方核心图形）
                    2) 一条速度水平线（速度计造型）
                    填充颜色：COROS 官方品牌红 #FF1F2E
                    viewBox 0 0 45 34 → 居中到 64x64 → 偏移 (x=9.5, y=15)，等比缩放到宽 45，高 34
                  -->
                  <g transform="translate(9.5 15) scale(1)">
                    <path d="M20.0327 2.8765 L5.17725 17.0005 L20.0327 31.1236 L17.9663 33.2974 L1.96631 18.0874 L0.822754 16.9995 L1.96631 15.9126 L17.9663 0.702667 L20.0327 2.8765 Z"
                          fill="#FF1F2E"/>
                    <path d="M40.9995 18.4995 H14.9995 V15.4995 H40.9995 V18.4995 Z"
                          fill="#FF1F2E"/>
                  </g>
                </svg>
              </div>
              <div>
                <h3>高驰 COROS</h3>
                <p class="muted">推荐：导出 TCX 文件后上传导入</p>
              </div>
            </div>
            <span class="badge badge-endurance">文件导入</span>
          </div>
          <div class="platform-card-body">
            <p><strong>导出位置：</strong></p>
            <ul class="muted small">
              <li>高驰 APP：活动详情 → 右上角「…」→ 导出 → TCX 格式</li>
              <li>高驰官网：活动详情 → 「导出 TCX / GPX」按钮</li>
            </ul>
            <p><strong>支持格式：</strong><code>.tcx</code>（数据最全，心率/圈数/配速）、<code>.gpx</code>、<code>.csv</code></p>
          </div>
          <div class="platform-card-foot">
            <a class="primary-button" href="#file-drop-area">去上传文件 ↓</a>
          </div>
        </article>

        <article class="card platform-card">
          <div class="platform-card-head">
            <div class="platform-brand garmin-brand">
              <div class="platform-logo" aria-label="Garmin 佳明官方 LOGO">
                <img src="https://cdn.jsdelivr.net/npm/simple-icons@14.6.0/icons/garmin.svg"
                     alt="Garmin" class="brand-icon" loading="lazy" />
              </div>
              <div>
                <h3>佳明 Garmin</h3>
                <p class="muted">推荐：导出 FIT 原始文件（含跑步动态）</p>
              </div>
            </div>
            <span class="badge badge-endurance">文件导入</span>
          </div>
          <div class="platform-card-body">
            <p><strong>导出位置：</strong></p>
            <ul class="muted small">
              <li>佳明 Connect APP：活动详情 → 右上角「…」→「导出原始文件 (FIT)」</li>
              <li>佳明中国官网 connectcn.garmin.cn：活动详情 → 右上角菜单 → 导出</li>
              <li>佳明国际官网 connect.garmin.com：活动详情 → Export → Original（.fit）或 TCX</li>
            </ul>
            <p><strong>支持格式：</strong><code>.fit</code>（佳明原厂格式，数据最完整）、<code>.tcx</code>、<code>.gpx</code>、<code>.csv</code></p>
          </div>
          <div class="platform-card-foot">
            <a class="primary-button" href="#file-drop-area">去上传文件 ↓</a>
          </div>
        </article>

        <article class="card platform-card">
          <div class="platform-card-head">
            <div class="platform-brand strava-brand">
              <div class="platform-logo" aria-label="Strava 官方 LOGO">
                <img src="https://cdn.jsdelivr.net/npm/simple-icons@14.6.0/icons/strava.svg"
                     alt="Strava" class="brand-icon" loading="lazy" />
              </div>
              <div>
                <h3>Strava</h3>
                <p class="muted">高驰/佳明同步 → Strava → 自动拉取</p>
              </div>
            </div>
            <span class="badge badge-balanced">需要后端支持</span>
          </div>
          <div class="platform-card-body">
            <p><strong>流程：</strong></p>
            <ul class="muted small">
              <li>高驰 APP / 佳明 Connect → 设置 → 第三方连接 → 绑定 Strava</li>
              <li>每次运动后会自动同步到 Strava</li>
              <li>需要部署 OAuth 回调后端（Node/Cloudflare Workers）才能自动拉取</li>
            </ul>
            <p class="muted small"><strong>替代方案：</strong>Strava 活动详情 → 菜单 → 导出 TCX → 按文件方式上传</p>
          </div>
          <div class="platform-card-foot">
            <button class="ghost-button" id="stravaHelpBtn">查看 Strava 对接说明</button>
          </div>
        </article>
      </div>

      <!-- 当前平台连接状态 -->
      <section class="section">
        <h3 class="section-title">平台连接状态</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>平台</th><th>状态</th><th>外部 ID</th><th>最后同步</th><th>创建时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${connections.length ? connections.map((c) => `
                <tr>
                  <td><strong>${escapeHtml(platformLabel(c.platform))}</strong></td>
                  <td><span class="badge ${escapeHtml(platformStatusBadge(c.status))}">${escapeHtml(platformStatusLabel(c.status))}</span></td>
                  <td>${escapeHtml(c.external_user_id || "—")}</td>
                  <td>${escapeHtml(c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "—")}</td>
                  <td>${escapeHtml(new Date(c.created_at).toLocaleDateString())}</td>
                  <td>
                    <button class="danger-btn small" data-disconnect="${escapeHtml(c.platform)}">断开</button>
                  </td>
                </tr>
              `).join("") : `
                <tr><td colspan="6" class="empty-state">暂无平台连接，先从下方上传文件开始吧。</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </section>

      <!-- 上传区域 -->
      <section class="section" id="file-drop-area">
        <h3 class="section-title">批量上传文件（支持佳明 FIT / 高驰 TCX / GPX / CSV）</h3>

        <div class="upload-zone" id="uploadZone">
          <div class="upload-zone-icon">📤</div>
          <h4>拖拽文件到这里，或点击选择文件</h4>
          <p class="muted">支持 <strong>.fit</strong>（佳明原厂）、<strong>.tcx</strong>、<strong>.gpx</strong>、<strong>.csv</strong>，可多选，系统会自动合并导入并去重。</p>
          <input type="file" id="fileInput" multiple accept=".fit,.tcx,.gpx,.csv,application/xml,text/csv,application/octet-stream" hidden />
          <button class="primary-button" id="pickFilesBtn">选择文件</button>
        </div>

        <!-- 预览区域 -->
        <div id="previewArea" class="preview-area" style="display:none;">
          <div class="preview-head">
            <h4>导入预览</h4>
            <div>
              <button class="ghost-button" id="clearPreviewBtn">清空</button>
              <button class="primary-button" id="confirmImportBtn">确认导入到我的训练日志</button>
            </div>
          </div>
          <div class="preview-summary" id="previewSummary"></div>
          <div class="table-wrap">
            <table class="data-table preview-table">
              <thead>
                <tr>
                  <th><input type="checkbox" id="selectAllChk" checked /></th>
                  <th>日期</th><th>活动</th><th>时长</th><th>距离</th>
                  <th>平均心率</th><th>RPE</th><th>训练负荷</th>
                  <th>来源</th><th>状态</th>
                </tr>
              </thead>
              <tbody id="previewTbody"></tbody>
            </table>
          </div>
        </div>

        <!-- 导入结果 -->
        <div id="importResult" style="display:none;"></div>
      </section>

      <!-- 导入统计 -->
      <section class="section">
        <h3 class="section-title">已导入数据分布</h3>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-num">${recentLogs.length}</div>
            <div class="stat-label">条训练日志总计</div>
          </div>
          ${Object.entries(sourceStats).map(([type, n]) => `
            <div class="stat-card stat-${type === "manual" ? "manual" : "import"}">
              <div class="stat-num">${n}</div>
              <div class="stat-label">${escapeHtml(sourceTypeLabel(type))}</div>
            </div>
          `).join("")}
        </div>
      </section>

    </section>
  `;

  // 状态：待导入活动列表
  let pendingActivities = []; // [{ ...finalizedActivity, file, format, __skip: false, __dup: false, __dupLogDate: null }]

  // 绑定：选择文件
  const fileInput = document.getElementById("fileInput");
  const pickBtn = document.getElementById("pickFilesBtn");
  const uploadZone = document.getElementById("uploadZone");

  pickBtn?.addEventListener("click", () => fileInput?.click());
  uploadZone?.addEventListener("click", (e) => {
    if (e.target.tagName !== "BUTTON") fileInput?.click();
  });
  fileInput?.addEventListener("change", (e) => handleFiles(e.target.files));

  // 拖拽
  ["dragenter", "dragover"].forEach((evt) => {
    uploadZone?.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadZone.classList.add("active");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    uploadZone?.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadZone.classList.remove("active");
    });
  });
  uploadZone?.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    showToast(`正在解析 ${files.length} 个文件…`);

    const newItems = [];
    for (const f of files) {
      try {
        const lower = f.name.toLowerCase();
        let format;
        let activities;
        if (lower.endsWith(".fit")) {
          // FIT 是二进制，必须用 ArrayBuffer 读取
          const buffer = await f.arrayBuffer();
          format = "fit";
          activities = await parseFIT(buffer);
        } else {
          // 文本格式（TCX / GPX / CSV）
          const content = await f.text();
          const parsed = detectAndParseFile(f.name, content);
          format = parsed.format;
          activities = parsed.activities;
        }
        for (const act of activities) {
          const finalized = finalizeActivityImport(act, age);
          // 去重检查：external_id
          let dupLog = null;
          if (finalized.external_id) {
            dupLog = await findLogByExternalId(userId, finalized.source_type, finalized.external_id);
          }
          // 同日也做提示
          let dupDateLog = null;
          if (!dupLog && finalized.log_date) {
            dupDateLog = recentLogs.find((l) => l.log_date === finalized.log_date);
          }
          newItems.push({
            ...finalized,
            __file: f.name,
            __format: format,
            __selected: !dupLog,
            __dup: !!dupLog,
            __dupByDate: !!dupDateLog && !dupLog,
            __dupLogDate: dupLog?.log_date || dupDateLog?.log_date || null,
          });
        }
      } catch (err) {
        showToast(`文件 ${f.name} 解析失败：${err.message || err}`, "error");
      }
    }

    // 追加并展示
    pendingActivities = [...pendingActivities, ...newItems];
    renderPreview();
    showToast(`已解析 ${newItems.length} 条活动`);
  }

  function renderPreview() {
    const preview = document.getElementById("previewArea");
    const tbody = document.getElementById("previewTbody");
    const summary = document.getElementById("previewSummary");
    if (!preview || !tbody) return;

    if (!pendingActivities.length) {
      preview.style.display = "none";
      return;
    }
    preview.style.display = "block";

    const total = pendingActivities.length;
    const dups = pendingActivities.filter((a) => a.__dup).length;
    const selected = pendingActivities.filter((a) => a.__selected && !a.__dup).length;
    const totalLoad = pendingActivities
      .filter((a) => a.__selected && !a.__dup)
      .reduce((s, a) => s + (Number(a.training_load) || 0), 0);
    const totalDist = pendingActivities
      .filter((a) => a.__selected && !a.__dup)
      .reduce((s, a) => s + (Number(a.distance_km) || 0), 0);
    const totalDur = pendingActivities
      .filter((a) => a.__selected && !a.__dup)
      .reduce((s, a) => s + (Number(a.duration_min) || 0), 0);

    summary.innerHTML = `
      <div class="summary-pills">
        <span class="pill pill-info">解析 <strong>${total}</strong> 条</span>
        <span class="pill pill-warn">已导入过（自动跳过）<strong>${dups}</strong> 条</span>
        <span class="pill pill-ok">待导入 <strong>${selected}</strong> 条</span>
        <span class="pill pill-info">总距离 <strong>${totalDist.toFixed(1)} km</strong></span>
        <span class="pill pill-info">总时长 <strong>${Math.round(totalDur)} 分钟</strong></span>
        <span class="pill pill-info">训练负荷 <strong>${totalLoad.toFixed(0)}</strong></span>
      </div>
    `;

    tbody.innerHTML = pendingActivities.map((a, i) => {
      const disabled = a.__dup;
      const check = a.__selected && !a.__dup;
      return `
        <tr class="${a.__dup ? "row-dup" : a.__dupByDate ? "row-warn" : ""}">
          <td>
            <input type="checkbox" class="row-chk" data-idx="${i}"
              ${disabled ? "disabled" : ""} ${check ? "checked" : ""} />
          </td>
          <td>${escapeHtml(a.log_date || "—")}</td>
          <td><strong>${escapeHtml(a.planned_title || "未命名活动")}</strong>
            ${a.planned_detail ? `<div class="muted small">${escapeHtml(a.planned_detail)}</div>` : ""}
            ${a.note ? `<div class="muted small">备注：${escapeHtml(a.note)}</div>` : ""}
          </td>
          <td>${a.duration_min != null ? `${a.duration_min.toFixed(1)} 分` : "—"}</td>
          <td>${a.distance_km != null ? `${a.distance_km.toFixed(2)} km` : "—"}</td>
          <td>${a.avg_hr || "—"}</td>
          <td>${a.rpe || "—"}</td>
          <td><strong>${a.training_load != null ? a.training_load.toFixed(1) : "—"}</strong></td>
          <td><span class="badge badge-balanced">${escapeHtml(sourceTypeLabel(a.source_type))}</span>
            <div class="muted small">文件：${escapeHtml(a.__file || "")}</div>
          </td>
          <td>
            ${a.__dup ? `<span class="tag tag-dup">已导入过</span><div class="muted small">同活动 ID</div>`
              : a.__dupByDate ? `<span class="tag tag-warn">该日已有日志</span><div class="muted small">${escapeHtml(a.__dupLogDate || "")}</div>`
              : `<span class="tag tag-ok">待导入</span>`}
          </td>
        </tr>
      `;
    }).join("");

    // 绑定复选框
    const selectAll = document.getElementById("selectAllChk");
    const importable = pendingActivities.filter((a) => !a.__dup);
    selectAll.checked = importable.length > 0 && importable.every((a) => a.__selected);
    selectAll.onchange = () => {
      pendingActivities.forEach((a) => { if (!a.__dup) a.__selected = selectAll.checked; });
      renderPreview();
    };
    document.querySelectorAll(".row-chk").forEach((cb) => {
      cb.addEventListener("change", () => {
        const i = Number(cb.getAttribute("data-idx"));
        pendingActivities[i].__selected = cb.checked;
        renderPreview();
      });
    });
  }

  document.getElementById("clearPreviewBtn")?.addEventListener("click", () => {
    pendingActivities = [];
    renderPreview();
    if (fileInput) fileInput.value = "";
  });

  document.getElementById("confirmImportBtn")?.addEventListener("click", async () => {
    const toImport = pendingActivities.filter((a) => a.__selected && !a.__dup);
    if (!toImport.length) {
      showToast("没有可导入的活动", "error");
      return;
    }
    const btn = document.getElementById("confirmImportBtn");
    btn.disabled = true;
    btn.textContent = `导入中 0/${toImport.length}…`;

    let done = 0, failed = 0, skipped = 0;
    const errors = [];

    for (const a of toImport) {
      try {
        if (!a.log_date) { skipped++; continue; }
        // 构造入库 payload（去掉 __ 前缀临时字段）
        const payload = {};
        Object.entries(a).forEach(([k, v]) => {
          if (!k.startsWith("__")) payload[k] = v;
        });
        await upsertTrainingLog(userId, a.log_date, payload);
        done++;
      } catch (e) {
        failed++;
        errors.push({ date: a.log_date, title: a.planned_title, err: e.message || String(e) });
      }
      btn.textContent = `导入中 ${done + failed + skipped}/${toImport.length}…`;
    }

    btn.disabled = false;
    btn.textContent = "确认导入到我的训练日志";

    // 展示结果
    const result = document.getElementById("importResult");
    result.style.display = "block";
    result.innerHTML = `
      <div class="import-result-card ${failed ? "has-error" : "ok"}">
        <h4>🎉 导入完成</h4>
        <div class="summary-pills">
          <span class="pill pill-ok">成功 <strong>${done}</strong></span>
          <span class="pill pill-info">跳过（无日期）<strong>${skipped}</strong></span>
          ${failed ? `<span class="pill pill-warn">失败 <strong>${failed}</strong></span>` : ""}
        </div>
        ${errors.length ? `
          <details>
            <summary>查看失败明细</summary>
            <ul class="error-list">
              ${errors.map((e) => `
                <li><strong>${escapeHtml(e.date || "—")} ${escapeHtml(e.title || "")}</strong> — ${escapeHtml(e.err)}</li>
              `).join("")}
            </ul>
          </details>
        ` : ""}
        <div style="margin-top:12px;">
          <a class="primary-button" href="#/calendar">查看训练日历 →</a>
          <a class="ghost-button" href="#/logs">查看训练日志 →</a>
          <button class="ghost-button" id="clearResultBtn">继续导入</button>
        </div>
      </div>
    `;
    document.getElementById("clearResultBtn")?.addEventListener("click", () => {
      pendingActivities = [];
      renderPreview();
      result.style.display = "none";
      if (fileInput) fileInput.value = "";
    });
    if (!failed) showToast(`成功导入 ${done} 条训练日志！`);
    else showToast(`导入完成，成功 ${done}，失败 ${failed}`, "error");
  });

  // 断开平台连接
  document.querySelectorAll("[data-disconnect]").forEach((b) => {
    b.addEventListener("click", async () => {
      const p = b.getAttribute("data-disconnect");
      if (!confirm(`确认断开与 ${platformLabel(p)} 的连接？这只会删除本地连接记录，不会影响你在平台的数据。`)) return;
      try {
        await deletePlatformConnection(userId, p);
        showToast("已断开");
        renderSyncPage(app, user);
      } catch (e) {
        showToast(e.message || "操作失败", "error");
      }
    });
  });

  // Strava 帮助
  document.getElementById("stravaHelpBtn")?.addEventListener("click", () => {
    alert(
      "Strava 自动拉取对接说明（需后端）：\n\n" +
      "1) 在 https://www.strava.com/settings/api 申请开发者应用，\n" +
      "   Authorization Callback Domain 填你的后端域名。\n" +
      "2) 部署一个简单后端（推荐 Cloudflare Workers / Vercel Node），\n" +
      "   实现 /strava/auth、/strava/callback、/strava/sync 三个接口：\n" +
      "   - auth: 跳转到 Strava OAuth 授权\n" +
      "   - callback: 接收 code，换 access_token/refresh_token，加密后写入 external_platform_connections\n" +
      "   - sync: 读取 token，调用 GET https://www.strava.com/api/v3/athlete/activities?after=xxx\n" +
      "     把返回活动转换后批量调用本系统的训练日志 upsert。\n" +
      "3) 把本系统「数据同步」页上的「Strava 对接」按钮改为跳转 /strava/auth。\n\n" +
      "当前纯前端版本仅支持文件上传导入，这是最稳定、不依赖第三方服务的方案。"
    );
  });
}

/* ===================== 10. 启动引导 ===================== */

function bootstrap() {
  initSupabase();

  if (isSupabaseReady()) {
    const client = supabaseClient;
    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      renderNavAuth();
      router();
    });
    // 首次手动获取会话，避免某些环境下 onAuthStateChange 延迟
    client.auth.getSession().then(({ data }) => {
      currentUser = data.session?.user || null;
      renderNavAuth();
      router();
    });
  } else {
    currentUser = null;
    renderNavAuth();
    router();
  }

  window.addEventListener("hashchange", router);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
