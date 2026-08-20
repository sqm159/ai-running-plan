/**
 * Training Load V2 · Beta — App adapter
 *
 * Maps training_logs (+ optional load_v2_input) onto the verified prototype
 * session shape, then calls analyzeIncomplete. Does not reimplement scoring,
 * recovery, or incomplete-data representation.
 *
 * Scores are recomputed on read. This module never invents rest = 0s for
 * unknown recovery.
 */

"use strict";

(function (root) {
  function getProto() {
    if (typeof require === "function") {
      try {
        return require("../prototypes/training-load-v2-prototype");
      } catch (_) {
        /* browser classic scripts do not have require */
      }
    }
    return root.TrainingLoadV2;
  }
  function getIncomplete() {
    if (typeof require === "function") {
      try {
        return require("../prototypes/training-load-v2-incomplete");
      } catch (_) {
        /* browser classic scripts do not have require */
      }
    }
    return root.TrainingLoadV2Incomplete;
  }

  const DIMS = ["CV", "MET", "NM", "MECH"];
  const DIM_LABEL = {
    CV: "Cardiovascular",
    MET: "Metabolic",
    NM: "Neuromuscular",
    MECH: "Mechanical Exposure",
  };
  const DIM_LABEL_ZH = {
    CV: "心血管",
    MET: "代谢",
    NM: "神经肌肉",
    MECH: "机械暴露",
  };
  const LEVEL_LABEL = {
    low: "Low",
    medium: "Medium",
    high: "High",
    veryHigh: "Very High",
  };
  const LEVEL_LABEL_ZH = {
    low: "低",
    medium: "中",
    high: "高",
    veryHigh: "很高",
  };
  const CONF_LABEL = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  const CONF_LABEL_ZH = {
    low: "低",
    medium: "中",
    high: "高",
  };
  const LEVEL_BAR_FILLS = {
    low: 1,
    medium: 3,
    high: 4,
    veryHigh: 5,
  };

  function workRep(fields) {
    return {
      activity: "run",
      role: null,
      rest_s: null,
      reps: 1,
      block: "work",
      ...fields,
    };
  }

  function looksLikeIntervalText(text) {
    return /(\d+)\s*[x×]\s*(\d+)/i.test(String(text || ""));
  }

  function parseClockToSec(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      return n > 0 ? n : null;
    }
    const m = s.match(/^(\d+)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const sec = Number(m[1]) * 60 + Number(m[2]);
    return sec > 0 ? sec : null;
  }

  function parseDurationToken(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    const approx = /约|approx|~|大概/i.test(s);
    const minute = s.match(/(\d+(?:\.\d+)?)\s*(分钟|min|mins|minute)/i);
    if (minute) {
      return { sec: Number(minute[1]) * 60, approximate: approx };
    }
    const clock = parseClockToSec(s.replace(/约|approx|~|大概/gi, "").trim());
    if (clock != null) return { sec: clock, approximate: approx };
    return null;
  }

  function parseRangePair(raw) {
    const s = String(raw || "").replace(/～|—|–/g, "-");
    const m = s.match(/(\d+(?:\.\d+)?(?:\s*:\s*\d+(?:\.\d+)?)?)\s*-\s*(\d+(?:\.\d+)?(?:\s*:\s*\d+(?:\.\d+)?)?)/);
    if (!m) return null;
    const a = parseDurationToken(m[1]);
    const b = parseDurationToken(m[2]);
    if (!a || !b) return null;
    return { min: Math.min(a.sec, b.sec), max: Math.max(a.sec, b.sec) };
  }

  function parseRepTimeField(raw) {
    const text = String(raw || "").trim();
    if (!text) return { kind: "empty" };
    if (/\/\s*km/i.test(text) || /约/.test(text) && /km/i.test(text)) {
      return { kind: "pace", pace_text: text };
    }
    const range = parseRangePair(text);
    if (range) return { kind: "range", range };
    const parts = text.split(/[,，;；/\s]+/).map((t) => t.trim()).filter(Boolean);
    const times = parts.map(parseClockToSec).filter((n) => n != null);
    if (times.length >= 2) return { kind: "list", times };
    if (times.length === 1) return { kind: "single", sec: times[0] };
    return { kind: "empty" };
  }

  function parseRecoveryField(raw) {
    const text = String(raw || "").trim();
    if (!text) return { kind: "empty" };
    const range = parseRangePair(text);
    if (range) return { kind: "range", range, approximate: /约|approx|~/.test(text) };
    const one = parseDurationToken(text);
    if (one) return { kind: "exact", sec: one.sec, approximate: one.approximate };
    return { kind: "empty" };
  }

  function athleteFromSnapshot(snapshot) {
    const times = (snapshot && snapshot.input_json && snapshot.input_json.times) || {};
    const pick = (k) => {
      const n = Number(times[k]);
      return n > 0 ? n : null;
    };
    return {
      times: {
        400: pick(400),
        800: pick(800),
        1500: pick(1500),
        3000: pick(3000),
        5000: pick(5000),
      },
    };
  }

  function athleteTimesIncomplete(athlete) {
    const t = athlete && athlete.times;
    if (!t) return true;
    return !(t[400] > 0 && t[5000] > 0);
  }

  function parsePaceSecPerKm(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    const m = s
      .replace(/／/g, "/")
      .replace(/'/g, ":")
      .match(/(\d+)\s*:\s*(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const sec = Number(m[1]) * 60 + Number(m[2]);
    return sec > 0 ? sec : null;
  }

  function collectAuxBout(prefix) {
    const el = (id) => document.getElementById(id);
    if (!el(prefix + "Skip") && !el(prefix + "Duration")) return null;
    const skipped = Boolean(el(prefix + "Skip") && el(prefix + "Skip").checked);
    const durationMin = Number(el(prefix + "Duration") && el(prefix + "Duration").value) || null;
    const distanceKm = Number(el(prefix + "Distance") && el(prefix + "Distance").value) || null;
    const paceRaw = ((el(prefix + "Pace") && el(prefix + "Pace").value) || "").trim() || null;
    const avgHr = Number(el(prefix + "Hr") && el(prefix + "Hr").value) || null;
    if (skipped) return { skipped: true, durationMin, distanceKm, paceRaw, avgHr };
    if (!durationMin && !distanceKm && !paceRaw && !avgHr) return null;
    return {
      skipped: false,
      durationMin,
      distanceKm,
      paceRaw,
      avgHr,
    };
  }

  function fillAuxBout(prefix, bout) {
    const set = (id, v) => {
      const n = document.getElementById(id);
      if (n) n.value = v == null || v === "" ? "" : String(v);
    };
    const skip = document.getElementById(prefix + "Skip");
    if (skip) skip.checked = Boolean(bout && bout.skipped);
    set(prefix + "Duration", bout ? bout.durationMin : "");
    set(prefix + "Distance", bout ? bout.distanceKm : "");
    set(prefix + "Pace", bout ? bout.paceRaw : "");
    set(prefix + "Hr", bout ? bout.avgHr : "");
  }

  function applyAuxSkipVisibility() {
    if (typeof document === "undefined") return;
    ["logWarmup", "logCooldown"].forEach((prefix) => {
      const skip = document.getElementById(prefix + "Skip");
      const fields = document.getElementById(prefix + "Fields");
      if (fields) fields.hidden = Boolean(skip && skip.checked);
    });
  }

  function auxPartFromBout(block, bout) {
    if (!bout || bout.skipped) return null;
    let durationS = Number(bout.durationMin) > 0 ? Number(bout.durationMin) * 60 : null;
    let distanceM = Number(bout.distanceKm) > 0 ? Number(bout.distanceKm) * 1000 : null;
    const pace = parsePaceSecPerKm(bout.paceRaw);
    if (pace && distanceM && !durationS) durationS = (distanceM / 1000) * pace;
    if (pace && durationS && !distanceM) distanceM = (durationS / pace) * 1000;
    if (!(durationS > 0) && !(distanceM > 0)) return null;
    return workRep({
      block,
      distance_m: distanceM,
      duration_s: durationS,
      rest_s: 0,
      restProvenance: "none",
      hr_avg: Number(bout.avgHr) > 0 ? Number(bout.avgHr) : null,
    });
  }

  function attachAuxParts(session, input) {
    if (!session || !input) return session;
    const existing = session.parts || [];
    const alreadyWrapped = existing.some((p) => p && (p.block === "warmup" || p.block === "cooldown"));
    if (alreadyWrapped) return session;
    const warmup = auxPartFromBout("warmup", input.warmup);
    const cooldown = auxPartFromBout("cooldown", input.cooldown);
    if (!warmup && !cooldown) return session;
    session.parts = [warmup, ...existing, cooldown].filter(Boolean);
    session.warmup = warmup || null;
    session.cooldown = cooldown || null;
    return session;
  }

  function sessionShellFromLog(log, extra) {
    return {
      id: log.id || "app-log",
      name: log.planned_title || "session",
      source: "training_log",
      completed: log.status === "completed" || log.status === "partial",
      type_hint: "run",
      warmup: null,
      cooldown: null,
      hrSessionAvg: log.avg_hr != null ? Number(log.avg_hr) : null,
      rpe_6_20: log.rpe != null ? Number(log.rpe) : null,
      prescription: log.planned_detail || "",
      parts: [],
      ...extra,
    };
  }

  function comboId() {
    return "g" + Math.random().toString(36).slice(2, 9);
  }

  function parseComboGroups(raw) {
    try {
      const parsed = JSON.parse(String(raw || ""));
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.groups)) return parsed.groups;
    } catch (_) {
      /* ignore broken draft */
    }
    return [];
  }

  function makeComboStep(distanceM) {
    return {
      id: comboId(),
      distanceM: Number(distanceM) > 0 ? Number(distanceM) : null,
      durationRaw: "",
      restRaw: "",
    };
  }

  function exampleComboGroups() {
    return [
      {
        id: comboId(),
        times: 2,
        steps: [makeComboStep(1000), makeComboStep(600), makeComboStep(400)],
      },
    ];
  }

  function comboGroupsHaveWork(groups) {
    return (groups || []).some((group) =>
      (group.steps || []).some(
        (step) => Number(step.distanceM) > 0 || Boolean(parseDurationToken(step.durationRaw))
      )
    );
  }

  function formatComboStepShort(step) {
    const n = Number(step && step.distanceM);
    if (n > 0) {
      if (n % 1000 === 0) return n / 1000 + "km";
      if (n >= 1000) return (n / 1000).toFixed(n % 100 === 0 ? 1 : 2) + "km";
      return Math.round(n) + "m";
    }
    return String((step && step.durationRaw) || "").trim() || "?";
  }

  function formatComboGroupsSummary(groups) {
    if (!comboGroupsHaveWork(groups)) return "";
    return groups
      .map((group) => {
        const inner = (group.steps || []).map(formatComboStepShort).join("+");
        return String(group.times || 1) + "×(" + inner + ")";
      })
      .join(" + ");
  }

  function sessionFromComboGroups(log, input) {
    const groups = input && input.comboGroups;
    if (!comboGroupsHaveWork(groups)) return null;
    const parts = [];
    groups.forEach((group, groupIndex) => {
      const times = Math.max(1, Number(group.times) || 1);
      const steps = group.steps || [];
      for (let i = 0; i < times; i += 1) {
        steps.forEach((step, stepIndex) => {
          const isLast =
            groupIndex === groups.length - 1 && i === times - 1 && stepIndex === steps.length - 1;
          const restParsed = parseDurationToken(step.restRaw);
          let rest_s = null;
          let restProvenance = "unknown";
          if (restParsed) {
            rest_s = restParsed.sec;
            restProvenance = restParsed.approximate ? "user_recalled_approx" : "specified";
          } else if (isLast) {
            rest_s = 0;
            restProvenance = "last_none";
          }
          const distanceM = Number(step.distanceM) > 0 ? Number(step.distanceM) : null;
          const parsed = parseDurationToken(step.durationRaw);
          parts.push(
            workRep({
              distance_m: distanceM,
              duration_s: parsed ? parsed.sec : null,
              rest_s,
              restProvenance,
            })
          );
        });
      }
    });
    if (!parts.length) return null;
    const summary = formatComboGroupsSummary(groups);
    return sessionShellFromLog(log, {
      name: summary || log.planned_title || "自由组合",
      type_hint: parts.length > 1 ? "interval" : "run",
      prescription: summary,
      parts,
      recoveryType: parts.some((p) => p.restProvenance === "unknown") ? "unknown" : "specified",
    });
  }

  function readComboGroupsFromForm() {
    if (typeof document === "undefined") return [];
    const node = document.getElementById("logV2ComboJson");
    return parseComboGroups(node && node.value);
  }

  function writeComboGroupsToForm(groups) {
    if (typeof document === "undefined") return;
    const node = document.getElementById("logV2ComboJson");
    if (node) node.value = JSON.stringify(groups || []);
    const summary = document.getElementById("logComboSummary");
    if (summary) {
      summary.textContent = formatComboGroupsSummary(groups) || "还没有重复组。";
    }
  }

  function comboStepHtml(step) {
    const distanceVal = Number(step.distanceM) > 0 ? String(step.distanceM) : "";
    const durationVal = step.durationRaw || "";
    const restVal = step.restRaw || "";
    return `<div class="combo-step-row" data-combo-id="${escapeText(step.id)}" data-combo-kind="step">
      <label>距离（m）<input data-combo-field="distanceM" type="number" min="0" step="1" value="${escapeText(distanceVal)}" placeholder="如 1000" /></label>
      <label>成绩 / 时间<input data-combo-field="durationRaw" value="${escapeText(durationVal)}" placeholder="可选，如 3:20" /></label>
      <label>组间恢复<input data-combo-field="restRaw" value="${escapeText(restVal)}" placeholder="如 60 或 2:00" /></label>
      <button type="button" class="ghost-button combo-mini" data-combo-act="remove">删除</button>
    </div>`;
  }

  function comboGroupHtml(group, index) {
    const steps = (group.steps || []).map(comboStepHtml).join("");
    return `<div class="combo-group" data-combo-id="${escapeText(group.id)}" data-combo-kind="group">
      <div class="combo-group-head">
        <strong>重复组 ${escapeText(String(index + 1))}</strong>
        <div class="combo-times">
          <button type="button" class="ghost-button combo-mini" data-combo-act="dec-times">−</button>
          <span>${escapeText(String(group.times || 1))} 次</span>
          <button type="button" class="ghost-button combo-mini" data-combo-act="inc-times">+</button>
        </div>
        <button type="button" class="ghost-button combo-mini" data-combo-act="remove">删除整组</button>
      </div>
      <div class="combo-group-steps">${steps}</div>
      <div class="combo-group-foot">
        <button type="button" class="ghost-button combo-mini" data-combo-act="add-step">组内加一段</button>
      </div>
    </div>`;
  }

  function renderComboGroupsHtml(groups) {
    const body = (groups || []).map(comboGroupHtml).join("");
    return `<p class="combo-summary" id="logComboSummary">${escapeText(formatComboGroupsSummary(groups) || "还没有重复组。")}</p>
      <div class="combo-list">${body || `<p class="form-note">还没有重复组。可点「填入示例」看 2×(1000+600+400)。</p>`}</div>
      <div class="combo-toolbar">
        <button type="button" class="ghost-button" data-combo-act="add-group">添加重复组</button>
        <button type="button" class="ghost-button" data-combo-act="example">填入示例</button>
      </div>`;
  }

  function findComboItem(groups, id) {
    for (let i = 0; i < groups.length; i += 1) {
      if (groups[i].id === id) return { list: groups, index: i, item: groups[i], group: groups[i] };
      const steps = groups[i].steps || [];
      for (let j = 0; j < steps.length; j += 1) {
        if (steps[j].id === id) return { list: steps, index: j, item: steps[j], group: groups[i] };
      }
    }
    return null;
  }

  function mountComboBuilder(host, onChange) {
    if (!host) return;
    let groups = readComboGroupsFromForm();

    const redraw = () => {
      writeComboGroupsToForm(groups);
      host.innerHTML = renderComboGroupsHtml(groups);
      writeComboGroupsToForm(groups);
      if (typeof onChange === "function") onChange(groups);
    };

    host.onclick = (event) => {
      const btn = event.target.closest("[data-combo-act]");
      if (!btn || !host.contains(btn)) return;
      const act = btn.getAttribute("data-combo-act");
      const card = btn.closest("[data-combo-id]");
      const id = card ? card.getAttribute("data-combo-id") : null;
      if (act === "example") {
        groups = exampleComboGroups();
        redraw();
        return;
      }
      if (act === "add-group") {
        groups.push({
          id: comboId(),
          times: 2,
          steps: [makeComboStep(400)],
        });
        redraw();
        return;
      }
      if (!id) return;
      const found = findComboItem(groups, id);
      if (!found) return;
      if (act === "remove") {
        found.list.splice(found.index, 1);
        redraw();
        return;
      }
      if (act === "inc-times") {
        found.group.times = Math.min(20, (Number(found.group.times) || 1) + 1);
        redraw();
        return;
      }
      if (act === "dec-times") {
        found.group.times = Math.max(1, (Number(found.group.times) || 1) - 1);
        redraw();
        return;
      }
      if (act === "add-step") {
        found.group.steps = found.group.steps || [];
        found.group.steps.push(makeComboStep(null));
        redraw();
      }
    };

    const saveField = (event) => {
      const field = event.target.getAttribute("data-combo-field");
      if (!field) return;
      const card = event.target.closest("[data-combo-id]");
      if (!card) return;
      const found = findComboItem(groups, card.getAttribute("data-combo-id"));
      if (!found) return;
      const raw = String(event.target.value || "").trim();
      if (field === "distanceM") found.item.distanceM = Number(raw) > 0 ? Number(raw) : null;
      if (field === "durationRaw") found.item.durationRaw = raw;
      if (field === "restRaw") found.item.restRaw = raw;
      writeComboGroupsToForm(groups);
      if (typeof onChange === "function") onChange(groups);
    };

    host.oninput = saveField;
    host.onchange = saveField;
    redraw();
  }

  function collectLoadV2InputFromForm() {
    if (typeof document === "undefined") return null;
    const el = (id) => document.getElementById(id);
    if (!el("logV2Reps") && !el("logWarmupSkip") && !el("logCooldownSkip")) return null;
    const repetitions = Number(el("logV2Reps") && el("logV2Reps").value) || null;
    const repDistanceM = Number(el("logV2RepDistance") && el("logV2RepDistance").value) || null;
    const repTimeRaw = ((el("logV2RepTime") && el("logV2RepTime").value) || "").trim();
    const recoveryRaw = ((el("logV2Recovery") && el("logV2Recovery").value) || "").trim();
    const recoveryType = ((el("logV2RecoveryType") && el("logV2RecoveryType").value) || "").trim() || null;
    const provenance = ((el("logV2Provenance") && el("logV2Provenance").value) || "").trim() || null;
    const intervalStructure = ((el("logV2IntervalStructure") && el("logV2IntervalStructure").value) || "").trim() || null;
    const heatHot = Boolean(el("logV2HeatHot") && el("logV2HeatHot").checked);
    const warmup = collectAuxBout("logWarmup");
    const cooldown = collectAuxBout("logCooldown");
    const comboGroups = readComboGroupsFromForm();
    const comboEmpty = !comboGroupsHaveWork(comboGroups);
    if (
      !repetitions &&
      !repDistanceM &&
      !repTimeRaw &&
      !recoveryRaw &&
      !recoveryType &&
      !intervalStructure &&
      !heatHot &&
      !warmup &&
      !cooldown &&
      comboEmpty &&
      (!provenance || provenance === "exact")
    ) {
      return null;
    }
    return {
      warmup,
      cooldown,
      comboGroups: comboEmpty ? null : comboGroups,
      repetitions,
      repDistanceM,
      repTimeRaw: repTimeRaw || null,
      recoveryRaw: recoveryRaw || null,
      recoveryType,
      provenance,
      intervalStructure,
      heatHot,
    };
  }

  function fillLoadV2Form(input) {
    if (typeof document === "undefined" || !input) return;
    const set = (id, v) => {
      const n = document.getElementById(id);
      if (n) n.value = v == null || v === "" ? "" : String(v);
    };
    fillAuxBout("logWarmup", input.warmup);
    fillAuxBout("logCooldown", input.cooldown);
    set("logV2ComboJson", input.comboGroups ? JSON.stringify(input.comboGroups) : "");
    set("logV2Reps", input.repetitions);
    set("logV2RepDistance", input.repDistanceM);
    set("logV2RepTime", input.repTimeRaw);
    set("logV2Recovery", input.recoveryRaw);
    set("logV2RecoveryType", input.recoveryType || "");
    set("logV2Provenance", input.provenance || "exact");
    set("logV2IntervalStructure", input.intervalStructure);
    const heat = document.getElementById("logV2HeatHot");
    if (heat) heat.checked = Boolean(input.heatHot);
    const details = document.getElementById("logV2Details");
    if (details && (input.repetitions || input.repDistanceM || input.repTimeRaw || input.recoveryRaw || input.intervalStructure)) {
      details.open = true;
    }
    applyAuxSkipVisibility();
  }

  function restOnParts(n, recovery, recoveryType) {
    const lastNone = { rest_s: 0, restProvenance: "last_none" };
    if (recoveryType === "none") {
      return Array.from({ length: n }, () => ({ rest_s: 0, restProvenance: "none" }));
    }
    if (!recovery || recovery.kind === "empty") {
      /* unknown recovery ≠ 0s */
      return Array.from({ length: n }, (_, i) =>
        i === n - 1 ? lastNone : { rest_s: null, restProvenance: "unknown" }
      );
    }
    if (recovery.kind === "range") {
      const mid = (recovery.range.min + recovery.range.max) / 2;
      return Array.from({ length: n }, (_, i) =>
        i === n - 1
          ? lastNone
          : {
              rest_s: mid,
              restApproximate: true,
              restProvenance: "user_recalled_range",
            }
      );
    }
    return Array.from({ length: n }, (_, i) =>
      i === n - 1
        ? lastNone
        : {
            rest_s: recovery.sec,
            restApproximate: Boolean(recovery.approximate),
            restProvenance: recovery.approximate ? "user_recalled_approx" : "specified",
          }
    );
  }

  function sessionFromStructuredInput(log, input) {
    const comboSession = sessionFromComboGroups(log, input);
    if (comboSession) return comboSession;
    const n = Number(input.repetitions) > 0 ? Math.round(Number(input.repetitions)) : 0;
    const dist = Number(input.repDistanceM) > 0 ? Number(input.repDistanceM) : null;
    const parsedTime = parseRepTimeField(input.repTimeRaw);
    const recovery = parseRecoveryField(input.recoveryRaw);
    const recoveryType = input.recoveryType || (recovery.kind === "empty" && n > 1 ? "unknown" : null);
    const provenance = input.provenance || null;
    const name = input.intervalStructure || log.planned_title || "session";

    const session = {
      id: log.id || "app-log",
      name,
      source: "training_log",
      completed: log.status === "completed" || log.status === "partial",
      type_hint: n > 1 ? "interval" : "run",
      warmup: null,
      cooldown: null,
      hrSessionAvg: log.avg_hr != null ? Number(log.avg_hr) : null,
      hrWorkAvg: null,
      hrMax: null,
      rpe_6_20: log.rpe != null ? Number(log.rpe) : null,
      shoes: null,
      surface: null,
      grade_pct: log.grade_pct != null ? Number(log.grade_pct) : null,
      prescription: input.intervalStructure || log.planned_detail || "",
    };

    if (recoveryType) session.recoveryType = recoveryType;
    if (recovery.kind === "range") {
      session.recovery_range_sec = recovery.range;
      session.recovery_duration_sec = (recovery.range.min + recovery.range.max) / 2;
      session.recoveryApproximate = true;
      session.recoveryProvenance = "user_recalled_range";
    } else if (recovery.kind === "exact") {
      session.recovery_duration_sec = recovery.sec;
      session.recoveryApproximate = Boolean(recovery.approximate);
      session.recoveryProvenance = recovery.approximate ? "user_recalled_approx" : "specified";
    }

    if (n > 0) session.reps = n;
    if (dist) session.rep_distance_m = dist;

    const restFields = n > 0 ? restOnParts(n, recovery, recoveryType) : [];

    if (provenance === "range" || parsedTime.kind === "range") {
      const range = parsedTime.range || null;
      if (range && dist && n > 0) {
        session.rep_time_range_sec = {
          min: range.min,
          max: range.max,
          approximate: provenance === "approx",
          per_rep_exact: false,
        };
        session.parts = Array.from({ length: n }, (_, i) =>
          workRep({ distance_m: dist, duration_s: null, ...restFields[i] })
        );
        return session;
      }
    }

    if (provenance === "summary" || (parsedTime.kind === "list" && n > parsedTime.times.length)) {
      const times = parsedTime.times || (parsedTime.kind === "single" ? [parsedTime.sec] : []);
      session.known_rep_times = times.map((duration_s) => ({ duration_s }));
      session.unknown_rep_time_count = Math.max(0, n - times.length);
      if (dist) session.rep_distance_m = dist;
      session.parts = Array.from({ length: n || times.length }, (_, i) =>
        workRep({
          distance_m: dist,
          duration_s: times[i] != null ? times[i] : null,
          ...((n ? restFields : restOnParts(times.length, recovery, recoveryType))[i] || {}),
        })
      );
      return session;
    }

    if (parsedTime.kind === "pace") {
      session.pace_text = parsedTime.pace_text;
      session.paceApproximate = true;
      const count = n || 1;
      const durationMin = Number(log.duration_min);
      const perDur =
        durationMin > 0 && count > 0 ? (durationMin * 60) / count : null;
      session.parts = Array.from({ length: count }, (_, i) =>
        workRep({
          distance_m: dist,
          duration_s: perDur,
          durationApproximate: perDur != null,
          ...restOnParts(count, recovery, recoveryType)[i],
        })
      );
      return session;
    }

    if (parsedTime.kind === "list" && n > 0) {
      session.parts = Array.from({ length: n }, (_, i) =>
        workRep({
          distance_m: dist,
          duration_s: parsedTime.times[i] != null ? parsedTime.times[i] : parsedTime.times[0],
          durationApproximate: provenance === "approx",
          ...restFields[i],
        })
      );
      return session;
    }

    if (parsedTime.kind === "single" && n > 0) {
      session.parts = Array.from({ length: n }, (_, i) =>
        workRep({
          distance_m: dist,
          duration_s: parsedTime.sec,
          durationApproximate: provenance === "approx",
          ...restFields[i],
        })
      );
      return session;
    }

    if (n > 0) {
      /* reps known, times unknown — do not fabricate 0s splits */
      session.parts = Array.from({ length: n }, (_, i) =>
        workRep({ distance_m: dist, duration_s: null, ...restFields[i] })
      );
      return session;
    }

    return null;
  }

  function sessionFromLegacyLog(log) {
    const durationMin = Number(log.duration_min);
    const distanceKm = Number(log.distance_km);
    const durationS = durationMin > 0 ? durationMin * 60 : null;
    const distanceM = distanceKm > 0 ? distanceKm * 1000 : null;
    if (!(durationS > 0) && !(distanceM > 0)) return null;

    const intervalClaim = looksLikeIntervalText(log.planned_title) || looksLikeIntervalText(log.planned_detail);
    const session = {
      id: log.id || "app-log",
      name: log.planned_title || "session",
      source: "training_log",
      completed: log.status === "completed" || log.status === "partial",
      type_hint: intervalClaim ? "interval" : "run",
      warmup: null,
      cooldown: null,
      hrSessionAvg: log.avg_hr != null ? Number(log.avg_hr) : null,
      rpe_6_20: log.rpe != null ? Number(log.rpe) : null,
      distance_km: distanceKm > 0 ? distanceKm : null,
      prescription: log.planned_detail || "",
      parts: [
        workRep({
          distance_m: distanceM,
          duration_s: durationS,
          rest_s: intervalClaim ? null : 0,
          restProvenance: intervalClaim ? "unknown" : "none",
        }),
      ],
    };
    if (intervalClaim) {
      session.lostStructure = true;
      session.structureFidelity = "session_average";
      session.recoveryType = "unknown";
    } else {
      session.recoveryType = "none";
    }
    return session;
  }

  function logRowToV2Session(log) {
    if (!log) return null;
    const input = log.load_v2_input;
    let session = null;
    if (input && typeof input === "object") {
      session = sessionFromStructuredInput(log, input);
    }
    if (!session) session = sessionFromLegacyLog(log);
    if (!session && input && (input.warmup || input.cooldown)) {
      session = sessionShellFromLog(log, { recoveryType: "none" });
    }
    if (session && input) session = attachAuxParts(session, input);
    return session;
  }

  function confidenceBand(x) {
    const n = Number(x);
    if (!(n > 0)) return "low";
    if (n < 0.45) return "low";
    if (n < 0.7) return "medium";
    return "high";
  }

  function dominantStress(scores) {
    const proto = getProto();
    if (!scores || !proto || typeof proto.highestDim !== "function") {
      return DIMS.slice().sort((a, b) => (scores[b] || 0) - (scores[a] || 0))[0];
    }
    return proto.highestDim(scores);
  }

  function scoreTrainingLogV2(log, snapshot) {
    const incomplete = getIncomplete();
    if (!incomplete || typeof incomplete.analyzeIncomplete !== "function") {
      return { ok: false, reason: "scorer_unavailable" };
    }
    const session = logRowToV2Session(log);
    if (!session) return { ok: false, reason: "insufficient_input" };
    const athlete = athleteFromSnapshot(snapshot);
    let result;
    try {
      result = incomplete.analyzeIncomplete(session, athlete);
    } catch (err) {
      return { ok: false, reason: "score_error", detail: String(err && err.message ? err.message : err) };
    }
    const dim = dominantStress(result.scores);
    return {
      ok: true,
      session,
      athlete,
      athleteTimesIncomplete: athleteTimesIncomplete(athlete),
      result,
      primaryStress: dim,
      primaryStressLabel: DIM_LABEL[dim] || dim,
      primaryStressLabelZh: DIM_LABEL_ZH[dim] || dim,
      overallConfidenceBand: confidenceBand(result.confidence),
      heatHot: Boolean(log && log.load_v2_input && log.load_v2_input.heatHot),
      dimConfidenceBand: {
        CV: confidenceBand(result.confidenceByDimension && result.confidenceByDimension.CV),
        MET: confidenceBand(result.confidenceByDimension && result.confidenceByDimension.MET),
        NM: confidenceBand(result.confidenceByDimension && result.confidenceByDimension.NM),
        MECH: confidenceBand(result.confidenceByDimension && result.confidenceByDimension.MECH),
      },
    };
  }

  function escapeText(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bilingualLevel(level) {
    const zh = LEVEL_LABEL_ZH[level] || level;
    const en = LEVEL_LABEL[level] || level;
    return `${zh} ${en}`;
  }

  function bilingualConf(band) {
    const zh = CONF_LABEL_ZH[band] || band;
    const en = CONF_LABEL[band] || band;
    return `${zh} ${en}`;
  }

  function renderLevelBar(level) {
    const fills = LEVEL_BAR_FILLS[level] || 1;
    const segs = Array.from({ length: 5 }, (_, i) =>
      `<span class="load-v2-seg${i < fills ? " is-on" : ""}"></span>`
    ).join("");
    return `<div class="load-v2-bar" aria-hidden="true">${segs}</div>`;
  }

  function levelRank(level) {
    return { low: 0, medium: 1, high: 2, veryHigh: 3 }[level] || 0;
  }

  function sessionKindLine(levels) {
    const cv = levelRank(levels.CV);
    const met = levelRank(levels.MET);
    const nm = levelRank(levels.NM);
    const mech = levelRank(levels.MECH);
    const peak = Math.max(cv, met, nm, mech);
    if (peak <= 1) return "整体刺激不深，更接近保持或恢复性质。";
    if (nm >= 2 && met <= 1 && cv <= 1) return "这更像速度或神经刺激课，心肺堆积不是主体。";
    if (met >= 2 && cv >= 2) return "这更像一堂有氧和代谢都吃得比较深的质量课，不是轻松有氧。";
    if (met >= 2 && nm >= 2) return "代谢和神经肌肉都上来了，属于比较完整的间歇质量课。";
    if (mech >= 2 && cv <= 1 && nm <= 1) return "机械暴露相对更明显，常见于跑量或受力偏高、速度并不极端的课。机械暴露不是伤病判断。";
    if (cv >= 2 && met <= 1 && nm <= 1) return "主要是持续有氧压力，速度刺激不算突出。";
    if (peak >= 3) return "至少有一维已经到很高，今天这堂课吃得比较深。";
    return "今天有一定质量刺激，但还没到需要特别保守的程度。";
  }

  function degreeHeadline(levels) {
    const peak = Math.max(
      levelRank(levels.CV),
      levelRank(levels.MET),
      levelRank(levels.NM),
      levelRank(levels.MECH)
    );
    if (peak >= 3) return "今天练得比较重。";
    if (peak >= 2) return "今天是一堂有质量的课。";
    if (peak >= 1) return "今天负荷中等偏轻。";
    return "今天整体比较轻松。";
  }

  function coachBrief(scored, log) {
    const status = log && log.status;
    if (status === "skipped") {
      return {
        how: [
          "今天跳过了训练，没有可评的四维负荷。",
          "跳过本身可以，但不要第二天硬补一堂更重的来「还债」。",
        ],
        improve: ["如果是疲劳、睡眠或时间问题，在备注里写一句原因，后面看趋势会更有用。"],
        next: [
          "后面仍按原计划走即可；若连续跳过两天以上，再考虑把质量课顺延，而不是加量补课。",
          "这是教练语言参考，不会自动改课表。",
        ],
      };
    }

    if (!scored || !scored.ok) {
      return {
        how: ["还没有足够的时长、距离或间歇结构，暂时评不了今天练到什么程度。"],
        improve: ["先把时长和距离填上。如果是间歇课，尽量补组数、单组距离、大概成绩和组间休息。"],
        next: ["数据齐了之后，这里会给出后续强度怎么排的参考。现在先按原计划执行即可。"],
      };
    }

    const r = scored.result;
    const levels = r.levels || {};
    const flags = (r.dataQualityFlags || {});
    const names = DIM_LABEL_ZH;
    const lv = (d) => LEVEL_LABEL_ZH[levels[d]] || levels[d];
    const how = [];
    const planned = log && log.planned_title ? String(log.planned_title).trim() : "";

    how.push(degreeHeadline(levels));
    if (planned) how.push(`对照计划「${planned}」来看。`);
    if (status === "partial") how.push("课没有完全完成，实际刺激可能比计划浅一些。");
    else if (status === "pending") how.push("日志还没记成完成，下面先按当前填写给粗参考。");
    how.push(
      `主要压力在${names[scored.primaryStress] || scored.primaryStress}。四维参考：心血管${lv("CV")}、代谢${lv("MET")}、神经肌肉${lv("NM")}、机械暴露${lv("MECH")}。`
    );
    how.push(sessionKindLine(levels));
    if (scored.overallConfidenceBand === "low") {
      how.push("这次记录不够完整，上面判断只能当粗参考，不要看得太精确。");
    }

    const rpe = log && Number(log.rpe);
    if (rpe >= 16) {
      how.push(`你填的 RPE ${rpe} 偏高，说明主观吃力，但不拿它改四维分数。`);
    } else if (rpe > 0 && rpe <= 9 && levelRank(levels.MET) >= 2) {
      how.push(`结构上看有质量刺激，但 RPE ${rpe} 偏低，可能跑得比较从容，或强度没完全落到纸面结构上。`);
    }
    if (log && (log.feeling === "tired" || log.feeling === "bad")) {
      how.push("主观感受偏疲，后续安排应比分数看起来更保守一点。");
    } else if (log && log.feeling === "great" && Math.max(levelRank(levels.NM), levelRank(levels.MET)) >= 2) {
      how.push("状态很好，但今天已经有质量刺激，不要因为感觉好就临时加组。");
    }
    if (scored.heatHot) {
      how.push("你标记了今日天气较热：同样配速时，主观疲劳和次日恢复通常会比分数看起来更重。热负荷只作参考，没有改四维分数。");
    }

    const improve = [];
    if (flags.collapsedAverage) {
      improve.push("这堂课看起来像间歇，但结构记得不完整。下次尽量补组数、单组距离、大概成绩和组间休息，判断会准很多。");
    }
    if (flags.missingRest || flags.recoveryUnknown) {
      improve.push("组间恢复不要空着，也不要当成 0 秒。写大约多久、走停还是慢跑即可。");
    }
    if (scored.athleteTimesIncomplete) {
      improve.push("成绩档案请补 400m 和 5000m，速度锚点会更稳。");
    }
    if (flags.missingHr) {
      improve.push("有平均心率的话建议填上，心血管这一维会更有底。");
    }
    const lowDims = DIMS.filter((d) => scored.dimConfidenceBand && scored.dimConfidenceBand[d] === "low")
      .map((d) => names[d]);
    if (lowDims.length) {
      improve.push(`${lowDims.join("、")} 置信度偏低，先别把那一维看得太精确。`);
    }
    if (!improve.length) {
      improve.push("这次记录已经够用来做参考，保持这样记即可。");
    }

    const next = [];
    const cv = levelRank(levels.CV);
    const met = levelRank(levels.MET);
    const nm = levelRank(levels.NM);
    const mech = levelRank(levels.MECH);
    const peak = Math.max(cv, met, nm, mech);
    if (scored.overallConfidenceBand === "low") {
      next.push("置信度偏低时，不要据此大幅改后面的课表，先把记录补全。");
    }
    if (nm >= 3 || (nm >= 2 && mech >= 2)) {
      next.push("后面 24–48 小时更适合轻松跑或技术，不建议连排短冲或高强度速度课。");
      next.push("下一堂质量课至少隔开一天；质量课本身不必加量。");
    } else if (met >= 2 && cv >= 2) {
      next.push("今晚优先睡眠和补液。明天适合轻松有氧，不要连着再上同样的重复跑。");
      next.push("若计划里明天已是质量课，建议降成有氧，或把强度课往后挪一天。需要改课时，在计划页手动调整。");
    } else if (cv >= 2 || met >= 2) {
      next.push("次日适合轻松跑或技术课，不建议马上再叠一堂同样强度。");
      next.push("后面的质量课可按原计划上，但不要临时加组或把配速再往上拧。");
    } else if (peak >= 2) {
      next.push("明天以轻松跑为主即可。后面仍可按原计划上质量课，不要临时加量。");
    } else {
      next.push("这次刺激不深，可按原计划推进，注意睡眠即可。");
    }
    if (log && (log.feeling === "tired" || log.feeling === "bad") && peak >= 2) {
      next.push("因为今天已经偏累，后面 48 小时宁可少练一点，也不要靠感觉好就加课。");
    }
    next.push("以上是教练语言参考，四维负荷只作对照，不会自动改课表。");

    return { how, improve, next };
  }

  function renderCoachCardHtml(scored, log) {
    const brief = coachBrief(scored, log);
    const block = (title, lines) => `
      <div class="load-v2-coach-block">
        <h4>${escapeText(title)}</h4>
        ${(lines || []).map((line) => `<p>${escapeText(line)}</p>`).join("")}
      </div>`;
    return `<article class="panel load-v2-coach" id="loadV2Coach">
      <p class="load-v2-kicker">教练点评 · Beta</p>
      <h3>今天这堂课怎么看</h3>
      ${block("今日程度", brief.how)}
      ${block("可改进", brief.improve)}
      ${block("后续安排", brief.next)}
      <p class="load-v2-disclaimer">展示建议，不改四维公式，也不自动改课表。</p>
    </article>`;
  }

  function renderLoadV2CardHtml(scored, log) {
    if (!scored || !scored.ok) {
      const hint =
        scored && scored.reason === "insufficient_input"
          ? "填写时长、距离或间歇结构后计算 Training Load V2 · Beta"
          : scored && scored.reason === "score_error"
            ? "Training Load V2 · Beta 计算失败，请刷新后重试"
            : "Training Load V2 · Beta 暂不可用";
      return `<div class="load-v2-layout" id="loadV2Layout">
        <article class="panel load-v2-card" id="loadV2Card">
          <p class="load-v2-kicker">Training Load V2 · Beta · 参考对照</p>
          <h3>训练负荷</h3>
          <p class="form-note">${escapeText(hint)}</p>
        </article>
        ${renderCoachCardHtml(scored, log)}
      </div>`;
    }
    const r = scored.result;
    const rows = DIMS.map((d) => {
      const level = r.levels[d];
      const band = scored.dimConfidenceBand[d];
      const low = band === "low";
      const score = r.scores[d];
      const scoreText =
        r.scoreRange && r.scoreRange[d]
          ? `${r.scoreRange[d].low.toFixed(0)}–${r.scoreRange[d].high.toFixed(0)}`
          : Number(score).toFixed(0);
      return `<div class="load-v2-metric">
        <div class="load-v2-metric-top">
          <div>
            <div class="load-v2-dim-zh">${escapeText(DIM_LABEL_ZH[d])}</div>
            <div class="load-v2-dim-en">${escapeText(DIM_LABEL[d])}</div>
          </div>
          <div class="load-v2-values">
            <span class="load-v2-level load-v2-level-${escapeText(level)}">${escapeText(bilingualLevel(level))}</span>
            <span class="load-v2-score">${escapeText(scoreText)}</span>
          </div>
        </div>
        ${renderLevelBar(level)}
        ${low ? `<p class="load-v2-low-conf">置信度低 Low confidence</p>` : ""}
      </div>`;
    }).join("");

    const overallLabel = bilingualConf(scored.overallConfidenceBand);
    const note = scored.athleteTimesIncomplete
      ? `<p class="form-note">成绩档案不完整时，速度锚点会变粗，请优先补 400m / 5000m 成绩。</p>`
      : "";
    const kind = r.valueKind ? `<span class="load-v2-kind">${escapeText(r.valueKind)}</span>` : "";

    return `<div class="load-v2-layout" id="loadV2Layout">
      <article class="panel load-v2-card" id="loadV2Card">
        <p class="load-v2-kicker">Training Load V2 · Beta · 参考对照</p>
        <h3>训练负荷</h3>
        <div class="load-v2-grid">${rows}</div>
        <div class="load-v2-meta">
          <p><span class="load-v2-meta-label">主要压力 Primary stress</span> ${escapeText(scored.primaryStressLabelZh)} ${escapeText(scored.primaryStressLabel)}</p>
          <p><span class="load-v2-meta-label">置信度 Confidence</span> ${escapeText(overallLabel)} ${kind}</p>
        </div>
        ${note}
        <details class="load-v2-help">
          <summary>四维负荷说明</summary>
          <ul>
            <li><strong>心血管 Cardiovascular</strong>：有氧和心率相关的系统压力，常见于持续跑、节奏跑、较长间歇。</li>
            <li><strong>代谢 Metabolic</strong>：糖酵解和重复高强度带来的代谢压力，常见于较短休息的重复跑。</li>
            <li><strong>神经肌肉 Neuromuscular</strong>：高速、神经募集和加速相关的刺激，常见于短冲、短间歇。</li>
            <li><strong>机械暴露 Mechanical Exposure</strong>：跑量和高受力相关的机械暴露指数，<em>不是</em>伤病风险、肌腱损伤或真实组织损伤。</li>
          </ul>
        </details>
        <p class="load-v2-disclaimer">四维负荷只作参考对照，不合成综合指数，也不自动改课表。</p>
      </article>
      ${renderCoachCardHtml(scored, log)}
    </div>`;
  }

  const api = {
    DIM_LABEL,
    LEVEL_LABEL,
    collectLoadV2InputFromForm,
    fillLoadV2Form,
    logRowToV2Session,
    athleteFromSnapshot,
    scoreTrainingLogV2,
    renderLoadV2CardHtml,
    parseRepTimeField,
    parseRecoveryField,
    confidenceBand,
    applyAuxSkipVisibility,
    mountComboBuilder,
    formatComboGroupsSummary,
    exampleComboGroups,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TrainingLoadV2App = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
