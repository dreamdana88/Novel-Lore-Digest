(function (global) {
  "use strict";

  var STRUCTURE_TYPE_OPTIONS = [
    { id: "unit-stories", label: "单元故事型" },
    { id: "serial-novel", label: "连续长篇型" },
    { id: "series-novel", label: "系列长篇型" },
    { id: "case-unit", label: "案件单元型" },
    { id: "adventure-arc", label: "冒险篇章型" },
    { id: "ensemble-epic", label: "群像史诗型" },
    { id: "fantasy-world", label: "奇幻世界观型" },
    { id: "urban-fantasy", label: "都市奇幻型" },
    { id: "folk-mystery", label: "民俗悬疑型" },
    { id: "spirit-investigation", label: "灵异调查型" },
  ];

  var ANALYSIS_FOCUS_OPTIONS = [
    { id: "main-characters", label: "主要角色人设" },
    { id: "relations", label: "角色关系网" },
    { id: "worldview", label: "世界观设定" },
    { id: "outline", label: "剧情大纲" },
    { id: "timeline", label: "时间线" },
    { id: "factions", label: "组织/势力" },
    { id: "locations", label: "地点地图" },
    { id: "species", label: "物种/妖怪/异类规则" },
    { id: "abilities", label: "能力系统" },
    { id: "folk-religion", label: "民俗/宗教/禁忌" },
    { id: "mystery", label: "悬疑伏笔" },
    { id: "style", label: "文风分析" },
  ];

  var OUTPUT_TARGET_OPTIONS = [
    {
      key: "worldbook",
      id: "output-worldbook",
      label: "是否生成 SillyTavern 世界书",
      defaultValue: "是",
    },
    {
      key: "characterSummary",
      id: "output-character-summary",
      label: "是否生成 SillyTavern 角色汇总",
      defaultValue: "是",
    },
    {
      key: "outline",
      id: "output-outline",
      label: "是否生成剧情大纲",
      defaultValue: "否",
    },
    {
      key: "timeline",
      id: "output-timeline",
      label: "是否生成时间线",
      defaultValue: "否",
    },
    {
      key: "style",
      id: "output-style",
      label: "是否生成文风条目",
      defaultValue: "否",
    },
  ];

  var GRANULARITY_DEFAULTS = {
    chunkSize: "12000-15000 中文字",
    splitLargeChapters: "是",
    keepOverlap: "是",
    overlapChars: "500",
  };

  var SOURCE_EXTENSIONS = [".txt", ".md"];

  var COMPLETION_STATUS = {
    READY: "完成，可以启动",
    WAITING_SOURCE: "配置已生成，等待原文",
    NOT_GENERATED: "未生成",
  };

  var COMPLETION_CODE = {
    READY: "ready",
    WAITING_SOURCE: "waiting-source",
    NOT_GENERATED: "not-generated",
  };

  var OTHER_STRUCTURE_LABEL = "其他";
  var ROLE_GROUP_LABELS = {
    deep: "需要深度分析的主要角色",
    brief: "只需简要记录的角色",
    ignored: "暂不分析/忽略的角色",
  };

  var YES_VALUES = { 是: true, yes: true, y: true, true: true, "1": true };
  var NO_VALUES = { 否: true, no: true, n: true, false: true, "0": true };

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatLocalDate(date) {
    var source = date instanceof Date ? date : new Date();
    return (
      source.getFullYear() +
      "-" +
      pad2(source.getMonth() + 1) +
      "-" +
      pad2(source.getDate())
    );
  }

  function formatBackupTimestamp(date) {
    var source = date instanceof Date ? date : new Date();
    return (
      source.getFullYear() +
      pad2(source.getMonth() + 1) +
      pad2(source.getDate()) +
      "-" +
      pad2(source.getHours()) +
      pad2(source.getMinutes()) +
      pad2(source.getSeconds())
    );
  }

  function asString(value) {
    if (value == null) {
      return "";
    }
    return String(value);
  }

  function collapseSingleLine(value) {
    return asString(value)
      .replace(/\r\n|\r|\n/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function uniqueKeepOrder(items) {
    var seen = Object.create(null);
    var result = [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      if (!item || seen[item]) {
        continue;
      }
      seen[item] = true;
      result.push(item);
    }
    return result;
  }

  function asList(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value == null || value === "") {
      return [];
    }
    return [value];
  }

  function normalizeNameList(value) {
    var items = [];
    var source = asList(value);
    for (var i = 0; i < source.length; i += 1) {
      var collapsed = collapseSingleLine(source[i]);
      if (collapsed) {
        items.push(collapsed);
      }
    }
    return uniqueKeepOrder(items);
  }

  function hasExplicitRoleSeparators(text) {
    return /[,，、;；\r\n]/.test(asString(text));
  }

  function parseRoleNames(value) {
    if (Array.isArray(value)) {
      return normalizeNameList(value);
    }
    var text = asString(value);
    if (!text.trim()) {
      return [];
    }
    var parts = hasExplicitRoleSeparators(text)
      ? text.split(/[,，、;；\r\n]+/)
      : text.split(/[ \t]+/);
    var items = [];
    for (var i = 0; i < parts.length; i += 1) {
      var item = asString(parts[i]).replace(/[ \t]+/g, " ").trim();
      if (item) {
        items.push(item);
      }
    }
    return uniqueKeepOrder(items);
  }

  function toYesNo(value, fallback) {
    if (value === true) {
      return "是";
    }
    if (value === false) {
      return "否";
    }
    if (value == null || value === "") {
      return fallback;
    }
    var normalized = collapseSingleLine(value).toLowerCase();
    if (YES_VALUES[normalized] || YES_VALUES[collapseSingleLine(value)]) {
      return "是";
    }
    if (NO_VALUES[normalized] || NO_VALUES[collapseSingleLine(value)]) {
      return "否";
    }
    if (collapseSingleLine(value) === "是") {
      return "是";
    }
    if (collapseSingleLine(value) === "否") {
      return "否";
    }
    return fallback;
  }

  function knownStructureLabels() {
    var labels = [];
    for (var i = 0; i < STRUCTURE_TYPE_OPTIONS.length; i += 1) {
      labels.push(STRUCTURE_TYPE_OPTIONS[i].label);
    }
    return labels;
  }

  function knownFocusLabels() {
    var labels = [];
    for (var i = 0; i < ANALYSIS_FOCUS_OPTIONS.length; i += 1) {
      labels.push(ANALYSIS_FOCUS_OPTIONS[i].label);
    }
    return labels;
  }

  function defaultOutputs() {
    var outputs = {};
    for (var i = 0; i < OUTPUT_TARGET_OPTIONS.length; i += 1) {
      var option = OUTPUT_TARGET_OPTIONS[i];
      outputs[option.key] = option.defaultValue;
    }
    return outputs;
  }

  function createEmptyDraft(now) {
    return {
      title: "",
      author: "",
      language: "中文",
      source: "",
      analysisDate: formatLocalDate(now instanceof Date ? now : new Date()),
      structureTypes: [],
      otherStructure: "",
      analysisFocus: [],
      deepRoles: [],
      briefRoles: [],
      ignoredRoles: [],
      outputs: defaultOutputs(),
      specialNotes: [],
      granularity: {
        chunkSize: GRANULARITY_DEFAULTS.chunkSize,
        splitLargeChapters: GRANULARITY_DEFAULTS.splitLargeChapters,
        keepOverlap: GRANULARITY_DEFAULTS.keepOverlap,
        overlapChars: GRANULARITY_DEFAULTS.overlapChars,
      },
    };
  }

  function filterKnown(list, known) {
    var allowed = Object.create(null);
    for (var i = 0; i < known.length; i += 1) {
      allowed[known[i]] = true;
    }
    var result = [];
    var source = asList(list);
    for (var j = 0; j < source.length; j += 1) {
      var item = collapseSingleLine(source[j]);
      if (item && allowed[item]) {
        result.push(item);
      }
    }
    return uniqueKeepOrder(result);
  }

  function normalizeOutputs(rawOutputs) {
    var source = rawOutputs && typeof rawOutputs === "object" ? rawOutputs : {};
    var outputs = {};
    for (var i = 0; i < OUTPUT_TARGET_OPTIONS.length; i += 1) {
      var option = OUTPUT_TARGET_OPTIONS[i];
      outputs[option.key] = toYesNo(source[option.key], option.defaultValue);
    }
    return outputs;
  }

  function hasNoFinalOutputs(outputs) {
    var normalized = normalizeOutputs(outputs);
    for (var i = 0; i < OUTPUT_TARGET_OPTIONS.length; i += 1) {
      if (normalized[OUTPUT_TARGET_OPTIONS[i].key] === "是") {
        return false;
      }
    }
    return true;
  }

  function normalizeTaskDraft(rawDraft) {
    var raw = rawDraft && typeof rawDraft === "object" ? rawDraft : {};
    var outputs = normalizeOutputs(raw.outputs);
    var structureTypes = filterKnown(raw.structureTypes, knownStructureLabels());
    var otherStructure = collapseSingleLine(raw.otherStructure);
    var analysisDate = collapseSingleLine(raw.analysisDate);

    return {
      title: collapseSingleLine(raw.title),
      author: collapseSingleLine(raw.author),
      language: collapseSingleLine(raw.language) || "中文",
      source: collapseSingleLine(raw.source),
      analysisDate: analysisDate,
      structureTypes: structureTypes,
      otherStructure: otherStructure,
      analysisFocus: uniqueKeepOrder(filterKnown(asList(raw.analysisFocus), knownFocusLabels())),
      deepRoles: parseRoleNames(raw.deepRoles),
      briefRoles: parseRoleNames(raw.briefRoles),
      ignoredRoles: parseRoleNames(raw.ignoredRoles),
      outputs: outputs,
      specialNotes: normalizeNameList(raw.specialNotes),
      granularity: {
        chunkSize: GRANULARITY_DEFAULTS.chunkSize,
        splitLargeChapters: GRANULARITY_DEFAULTS.splitLargeChapters,
        keepOverlap: GRANULARITY_DEFAULTS.keepOverlap,
        overlapChars: GRANULARITY_DEFAULTS.overlapChars,
      },
    };
  }

  function findRoleConflicts(draft) {
    var groups = [
      { key: "deep", names: draft.deepRoles },
      { key: "brief", names: draft.briefRoles },
      { key: "ignored", names: draft.ignoredRoles },
    ];
    var owners = Object.create(null);
    for (var i = 0; i < groups.length; i += 1) {
      var group = groups[i];
      for (var j = 0; j < group.names.length; j += 1) {
        var name = group.names[j];
        if (!owners[name]) {
          owners[name] = [];
        }
        owners[name].push(group.key);
      }
    }
    var conflicts = [];
    var names = Object.keys(owners);
    for (var k = 0; k < names.length; k += 1) {
      var roleName = names[k];
      if (owners[roleName].length > 1) {
        conflicts.push({
          name: roleName,
          groups: owners[roleName].slice(),
        });
      }
    }
    return conflicts;
  }

  function pushError(errors, field, message, extra) {
    var item = { field: field, message: message };
    if (extra) {
      var keys = Object.keys(extra);
      for (var i = 0; i < keys.length; i += 1) {
        item[keys[i]] = extra[keys[i]];
      }
    }
    errors.push(item);
  }

  function validateTaskDraft(draft) {
    var normalized = normalizeTaskDraft(draft);
    var errors = [];

    if (!normalized.title) {
      pushError(errors, "title", "请填写作品名。");
    }
    if (!normalized.author) {
      pushError(errors, "author", "请填写作者；不知道时请填写「不详」。");
    }
    if (!normalized.structureTypes.length && !normalized.otherStructure) {
      pushError(errors, "structureTypes", "请至少选择一项作品结构类型，或填写「其他」。");
    }
    if (!normalized.analysisFocus.length) {
      pushError(errors, "analysisFocus", "请至少选择一项分析重点。");
    }
    if (!normalized.deepRoles.length) {
      pushError(errors, "deepRoles", "请至少填写一个需要深度分析的主要角色。");
    }

    var roleConflicts = findRoleConflicts(normalized);
    for (var i = 0; i < roleConflicts.length; i += 1) {
      var conflict = roleConflicts[i];
      var groupLabels = [];
      for (var j = 0; j < conflict.groups.length; j += 1) {
        groupLabels.push(ROLE_GROUP_LABELS[conflict.groups[j]]);
      }
      pushError(
        errors,
        "roleConflict",
        "「" + conflict.name + "」不能同时出现在多个分组：" + groupLabels.join("、") + "。",
        { name: conflict.name, groups: conflict.groups }
      );
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      draft: normalized,
    };
  }

  function joinSelected(items) {
    return items.join("、");
  }

  function selectedStructureLine(draft) {
    var items = draft.structureTypes.slice();
    if (draft.otherStructure && items.indexOf(OTHER_STRUCTURE_LABEL) === -1) {
      items.push(OTHER_STRUCTURE_LABEL);
    }
    return joinSelected(items);
  }

  function renderListOrPlaceholder(names) {
    if (!names.length) {
      return "-";
    }
    var lines = [];
    for (var i = 0; i < names.length; i += 1) {
      lines.push("- " + names[i]);
    }
    return lines.join("\n");
  }

  function renderProjectConfig(draft) {
    var normalized = normalizeTaskDraft(draft);
    var lines = [];
    var i;

    lines.push("# PROJECT_CONFIG");
    lines.push("");
    lines.push("## 作品基本信息");
    lines.push("- 作品名：" + normalized.title);
    lines.push("- 作者：" + normalized.author);
    lines.push("- 语言：" + normalized.language);
    lines.push("- 文本来源：" + normalized.source);
    lines.push("- 分析日期：" + normalized.analysisDate);
    lines.push("");
    lines.push("## 作品结构类型");
    lines.push("请在下列类型中选择或组合：");
    lines.push("- 已选择：" + selectedStructureLine(normalized));
    for (i = 0; i < STRUCTURE_TYPE_OPTIONS.length; i += 1) {
      lines.push("- " + STRUCTURE_TYPE_OPTIONS[i].label);
    }
    lines.push("- 其他：" + normalized.otherStructure);
    lines.push("");
    lines.push("## 分析重点");
    lines.push("请勾选或填写：");
    lines.push("- 已选择：" + joinSelected(normalized.analysisFocus));
    for (i = 0; i < ANALYSIS_FOCUS_OPTIONS.length; i += 1) {
      lines.push("- " + ANALYSIS_FOCUS_OPTIONS[i].label);
    }
    lines.push("");
    lines.push("## 目标角色清单");
    lines.push("");
    lines.push("### 需要深度分析的主要角色");
    lines.push(renderListOrPlaceholder(normalized.deepRoles));
    lines.push("");
    lines.push("### 只需简要记录的角色");
    lines.push(renderListOrPlaceholder(normalized.briefRoles));
    lines.push("");
    lines.push("### 暂不分析/忽略的角色");
    lines.push(renderListOrPlaceholder(normalized.ignoredRoles));
    lines.push("");
    lines.push("## 分析粒度");
    lines.push("- 默认分块大小：" + GRANULARITY_DEFAULTS.chunkSize);
    lines.push("- 超大章节是否拆分：" + GRANULARITY_DEFAULTS.splitLargeChapters);
    lines.push("- 是否保留上下文 overlap：" + GRANULARITY_DEFAULTS.keepOverlap);
    lines.push("- overlap 字数：" + GRANULARITY_DEFAULTS.overlapChars);
    lines.push("");
    lines.push("## 输出目标");
    for (i = 0; i < OUTPUT_TARGET_OPTIONS.length; i += 1) {
      var option = OUTPUT_TARGET_OPTIONS[i];
      lines.push("- " + option.label + "：" + normalized.outputs[option.key]);
    }
    lines.push("");
    lines.push("## 特别注意");
    if (normalized.specialNotes.length) {
      for (i = 0; i < normalized.specialNotes.length; i += 1) {
        lines.push("- " + normalized.specialNotes[i]);
      }
    }
    lines.push("");

    return lines.join("\n");
  }

  function hasSourceExtension(name) {
    var lower = asString(name).toLowerCase();
    for (var i = 0; i < SOURCE_EXTENSIONS.length; i += 1) {
      if (lower.endsWith(SOURCE_EXTENSIONS[i])) {
        return true;
      }
    }
    return false;
  }

  function sanitizeRelativePath(raw) {
    if (raw == null) {
      return { ok: false, error: "路径为空" };
    }
    var value = asString(raw).replace(/\\/g, "/");
    if (/[\u0000]/.test(value)) {
      return { ok: false, error: "路径不合法" };
    }
    if (/^[a-zA-Z]:/.test(value) || value.startsWith("/") || value.startsWith("//")) {
      return { ok: false, error: "不允许使用绝对路径" };
    }

    var parts = value.split("/");
    var clean = [];
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];
      if (part === "" || part === ".") {
        continue;
      }
      if (part === "..") {
        return { ok: false, error: "路径不能包含上级目录" };
      }
      if (/^[a-zA-Z]:$/.test(part)) {
        return { ok: false, error: "不允许使用绝对路径" };
      }
      clean.push(part);
    }
    if (!clean.length) {
      return { ok: false, error: "路径为空" };
    }
    return { ok: true, path: clean.join("/") };
  }

  function comparePathKey(relativePath) {
    return asString(relativePath).replace(/\\/g, "/").toLowerCase();
  }

  function fileNameFromPath(relativePath) {
    var parts = asString(relativePath).replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "";
  }

  function passThroughItem(entry, relativePath, name) {
    return {
      relativePath: relativePath,
      name: name || fileNameFromPath(relativePath),
      size: Number(entry && entry.size) || 0,
      file: entry && entry.file ? entry.file : null,
      source: entry || null,
    };
  }

  function buildImportPlan(entries) {
    var source = Array.isArray(entries) ? entries : [];
    var ignored = [];
    var rejected = [];
    var valid = [];

    for (var i = 0; i < source.length; i += 1) {
      var entry = source[i] || {};
      var rawPath = entry.relativePath || entry.name || "";
      var displayName = entry.name || fileNameFromPath(rawPath);
      if (!hasSourceExtension(displayName) && !hasSourceExtension(rawPath)) {
        ignored.push({
          relativePath: rawPath,
          name: displayName,
          size: Number(entry.size) || 0,
          reason: "不支持的文件类型",
        });
        continue;
      }
      var safe = sanitizeRelativePath(rawPath || displayName);
      if (!safe.ok) {
        rejected.push({
          relativePath: rawPath || displayName,
          name: displayName,
          size: Number(entry.size) || 0,
          reason: safe.error,
        });
        continue;
      }
      valid.push(passThroughItem(entry, safe.path, displayName));
    }

    var groups = Object.create(null);
    var order = [];
    for (var j = 0; j < valid.length; j += 1) {
      var item = valid[j];
      var key = comparePathKey(item.relativePath);
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(item);
    }

    var pending = [];
    var conflicts = rejected.slice();
    for (var k = 0; k < order.length; k += 1) {
      var group = groups[order[k]];
      if (group.length > 1) {
        conflicts.push({
          relativePath: group[0].relativePath,
          name: group[0].name,
          reason: "多次选择产生了相同的目标路径",
          count: group.length,
          items: group,
        });
      } else {
        pending.push(group[0]);
      }
    }

    return {
      pending: pending,
      ignored: ignored,
      ignoredCount: ignored.length,
      conflicts: conflicts,
    };
  }

  function findExistingSourceConflicts(pendingItems, existingRelativePaths) {
    var existing = Object.create(null);
    var source = Array.isArray(existingRelativePaths) ? existingRelativePaths : [];
    for (var i = 0; i < source.length; i += 1) {
      var safe = sanitizeRelativePath(source[i]);
      if (safe.ok) {
        existing[comparePathKey(safe.path)] = safe.path;
      }
    }

    var conflicts = [];
    var pending = Array.isArray(pendingItems) ? pendingItems : [];
    for (var j = 0; j < pending.length; j += 1) {
      var item = pending[j];
      var key = comparePathKey(item.relativePath);
      if (existing[key]) {
        conflicts.push({
          relativePath: item.relativePath,
          name: item.name || fileNameFromPath(item.relativePath),
          reason: "source_raw/ 中已存在同名文件",
          existingPath: existing[key],
        });
      }
    }
    return conflicts;
  }

  function detectBrowserCapabilities(globalObj) {
    var host = globalObj || global;
    var hasPicker = !!(host && typeof host.showDirectoryPicker === "function");
    var secure = !!(host && host.isSecureContext);
    var supported = hasPicker && secure;
    return {
      hasDirectoryPicker: hasPicker,
      isSecureContext: secure,
      supported: supported,
      message: supported
        ? ""
        : "当前页面无法授权写入本地项目目录。请使用最新版 Microsoft Edge 或 Google Chrome 打开本文件。",
    };
  }

  function normalizeConfigText(text) {
    return (
      asString(text)
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n+$/, "") + "\n"
    );
  }

  function isBlankProjectConfig(existingText, templateText) {
    var existing = asString(existingText).replace(/^\uFEFF/, "").trim();
    if (!existing) {
      return true;
    }
    if (!templateText) {
      return false;
    }
    return normalizeConfigText(existingText) === normalizeConfigText(templateText);
  }

  var exported = {
    STRUCTURE_TYPE_OPTIONS: STRUCTURE_TYPE_OPTIONS,
    ANALYSIS_FOCUS_OPTIONS: ANALYSIS_FOCUS_OPTIONS,
    OUTPUT_TARGET_OPTIONS: OUTPUT_TARGET_OPTIONS,
    GRANULARITY_DEFAULTS: GRANULARITY_DEFAULTS,
    SOURCE_EXTENSIONS: SOURCE_EXTENSIONS,
    COMPLETION_STATUS: COMPLETION_STATUS,
    COMPLETION_CODE: COMPLETION_CODE,
    OTHER_STRUCTURE_LABEL: OTHER_STRUCTURE_LABEL,
    ROLE_GROUP_LABELS: ROLE_GROUP_LABELS,
    formatLocalDate: formatLocalDate,
    formatBackupTimestamp: formatBackupTimestamp,
    createEmptyDraft: createEmptyDraft,
    normalizeTaskDraft: normalizeTaskDraft,
    validateTaskDraft: validateTaskDraft,
    renderProjectConfig: renderProjectConfig,
    findRoleConflicts: findRoleConflicts,
    hasSourceExtension: hasSourceExtension,
    sanitizeRelativePath: sanitizeRelativePath,
    comparePathKey: comparePathKey,
    buildImportPlan: buildImportPlan,
    findExistingSourceConflicts: findExistingSourceConflicts,
    detectBrowserCapabilities: detectBrowserCapabilities,
    normalizeConfigText: normalizeConfigText,
    isBlankProjectConfig: isBlankProjectConfig,
    parseRoleNames: parseRoleNames,
    hasNoFinalOutputs: hasNoFinalOutputs,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
  global.NovelLoreDigestConfigGenerator = Object.assign(
    global.NovelLoreDigestConfigGenerator || {},
    exported
  );
})(typeof window !== "undefined" ? window : globalThis);
