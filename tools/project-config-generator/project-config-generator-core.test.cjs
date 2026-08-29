"use strict";

const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const core = require("./project-config-generator-core.js");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const NEXT_STEP_PY = path.join(REPO_ROOT, "scripts", "next_step.py");

function minDraft(overrides) {
  return Object.assign(
    {
      title: "测试作品",
      author: "不详",
      language: "中文",
      source: "本地 txt",
      analysisDate: "2026-08-29",
      structureTypes: ["单元故事型"],
      otherStructure: "",
      analysisFocus: ["主要角色人设"],
      deepRoles: ["林浅"],
      briefRoles: [],
      ignoredRoles: [],
      outputs: {
        worldbook: "是",
        characterSummary: "是",
        outline: "否",
        timeline: "否",
        relations: "否",
        style: "否",
      },
      specialNotes: [],
    },
    overrides || {}
  );
}

function nextStepMissing(markdown) {
  const py = [
    "import importlib.util, json, sys",
    "spec = importlib.util.spec_from_file_location('next_step', sys.argv[1])",
    "mod = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(mod)",
    "text = sys.stdin.read()",
    "missing = []",
    "if '- 作品名：' in text and not mod._value_after_label(text, '作品名'):",
    "    missing.append('作品名')",
    "if '- 作者：' in text and not mod._value_after_label(text, '作者'):",
    "    missing.append('作者')",
    "if not mod._section_has_selected(text, '## 作品结构类型') and not mod._value_after_label(text, '其他'):",
    "    missing.append('作品结构类型')",
    "if not mod._section_has_selected(text, '## 分析重点'):",
    "    missing.append('分析重点')",
    "if not mod._has_nonempty_under_heading(text, '### 需要深度分析的主要角色'):",
    "    missing.append('目标角色清单')",
    "for label in ['是否生成 SillyTavern 世界书', '是否生成 SillyTavern 角色汇总']:",
    "    if not mod._value_after_label(text, label):",
    "        missing.append(label)",
    "print(json.dumps(missing, ensure_ascii=False))",
  ].join("\n");

  const result = spawnSync("python", ["-c", py, NEXT_STEP_PY], {
    input: markdown,
    encoding: "utf8",
    env: Object.assign({}, process.env, {
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    }),
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "python failed").trim());
  }
  return JSON.parse(result.stdout.trim());
}

test("最小有效草稿可以生成稳定 Markdown", () => {
  const markdown = core.renderProjectConfig(minDraft());
  assert.match(markdown, /^- 作品名：测试作品$/m);
  assert.match(markdown, /^- 作者：不详$/m);
  assert.match(markdown, /^- 已选择：单元故事型$/m);
  assert.match(markdown, /### 需要深度分析的主要角色\n- 林浅\n/);
  assert.match(markdown, /^- 是否生成 SillyTavern 世界书：是$/m);
  assert.equal(markdown.endsWith("\n"), true);
  assert.equal(markdown.includes("\r"), false);
  assert.equal(core.renderProjectConfig(minDraft()), markdown);
});

test("渲染函数不读取当前时间", () => {
  const draft = core.normalizeTaskDraft(minDraft({ analysisDate: "2020-01-02" }));
  const first = core.renderProjectConfig(draft);
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super("2099-12-31T00:00:00");
        return;
      }
      super(...args);
    }
    static now() {
      return Date.parse("2099-12-31T00:00:00");
    }
  };
  try {
    const second = core.renderProjectConfig(draft);
    assert.equal(second, first);
    assert.match(second, /^- 分析日期：2020-01-02$/m);
    assert.equal(second.includes("2099"), false);
  } finally {
    global.Date = RealDate;
  }
});

test("所有作品结构和所有分析重点按首次出现顺序去重输出", () => {
  const structureTypes = core.STRUCTURE_TYPE_OPTIONS.map((item) => item.label);
  const analysisFocus = core.ANALYSIS_FOCUS_OPTIONS.map((item) => item.label);
  const markdown = core.renderProjectConfig(
    minDraft({
      structureTypes: structureTypes.concat(structureTypes),
      analysisFocus: analysisFocus.concat(analysisFocus),
      otherStructure: "自定义混合体",
    })
  );
  assert.match(
    markdown,
    new RegExp("- 已选择：" + structureTypes.concat(["其他"]).join("、"))
  );
  assert.match(markdown, /^- 其他：自定义混合体$/m);
  assert.match(markdown, new RegExp("- 已选择：" + analysisFocus.join("、")));
});

test("只填写其他时也算有效作品结构类型", () => {
  const markdown = core.renderProjectConfig(
    minDraft({
      structureTypes: [],
      otherStructure: "日记体短篇集",
    })
  );
  const validation = core.validateTaskDraft(
    minDraft({
      structureTypes: [],
      otherStructure: "日记体短篇集",
    })
  );
  assert.equal(validation.ok, true);
  assert.match(markdown, /^- 已选择：其他$/m);
  assert.match(markdown, /^- 其他：日记体短篇集$/m);
  assert.deepEqual(nextStepMissing(markdown), []);
});

test("三类目标角色分别输出，组内重复去重", () => {
  const markdown = core.renderProjectConfig(
    minDraft({
      deepRoles: ["林浅", " 林浅 ", "顾衡"],
      briefRoles: ["店老板"],
      ignoredRoles: ["路人甲"],
    })
  );
  assert.match(
    markdown,
    /### 需要深度分析的主要角色\n- 林浅\n- 顾衡\n/
  );
  assert.match(markdown, /### 只需简要记录的角色\n- 店老板\n/);
  assert.match(markdown, /### 暂不分析\/忽略的角色\n- 路人甲\n/);
});

test("跨组角色冲突会失败并保留角色名", () => {
  const validation = core.validateTaskDraft(
    minDraft({
      deepRoles: ["林浅"],
      briefRoles: [" 林浅 "],
      ignoredRoles: ["顾衡"],
    })
  );
  assert.equal(validation.ok, false);
  const conflict = validation.errors.find((item) => item.field === "roleConflict");
  assert.ok(conflict);
  assert.equal(conflict.name, "林浅");
  assert.deepEqual(conflict.groups, ["deep", "brief"]);
});

test("输出目标为是时自动加入分析重点，为否时不删除用户选择", () => {
  const withYes = core.normalizeTaskDraft(
    minDraft({
      analysisFocus: ["主要角色人设"],
      outputs: {
        worldbook: "是",
        characterSummary: "否",
        outline: "是",
        timeline: "否",
        relations: "否",
        style: "否",
      },
    })
  );
  assert.deepEqual(withYes.analysisFocus, [
    "主要角色人设",
    "SillyTavern 世界书",
    "剧情大纲",
  ]);

  const withNo = core.normalizeTaskDraft(
    minDraft({
      analysisFocus: ["主要角色人设", "剧情大纲", "文风分析"],
      outputs: {
        worldbook: "否",
        characterSummary: "否",
        outline: "否",
        timeline: "否",
        relations: "否",
        style: "否",
      },
    })
  );
  assert.deepEqual(withNo.analysisFocus, ["主要角色人设", "剧情大纲", "文风分析"]);
});

test("单行字段中的换行、空白和特殊字符不会破坏下一字段", () => {
  const markdown = core.renderProjectConfig(
    minDraft({
      title: "  琅琊榜\n续  ",
      author: "海宴\\著",
      source: "本地 *备份* `_raw` [1]",
      deepRoles: ["梅长苏（**化名**）"],
      specialNotes: ["不要把 `代码` 当设定", "路径 C:\\novel\\a.txt"],
    })
  );
  assert.match(markdown, /^- 作品名：琅琊榜 续$/m);
  assert.match(markdown, /^- 作者：海宴\\著$/m);
  assert.match(markdown, /^- 文本来源：本地 \*备份\* `_raw` \[1\]$/m);
  assert.match(markdown, /^- 梅长苏（\*\*化名\*\*）$/m);
  assert.equal(markdown.includes("\n- 作者：海宴"), true);
  const titleLine = markdown.split("\n").find((line) => line.startsWith("- 作品名："));
  assert.equal(titleLine.includes("\n"), false);
});

test("特别注意输出多条列表并忽略空项，不写入模板示例句", () => {
  const markdown = core.renderProjectConfig(
    minDraft({
      specialNotes: ["重点关注梅长苏", "  ", "区分原文和推测", ""],
    })
  );
  assert.match(markdown, /## 特别注意\n- 重点关注梅长苏\n- 区分原文和推测\n/);
  assert.equal(markdown.includes("不要把单篇特例写成全局设定。"), false);
  assert.equal(markdown.includes("不要过度分析路人角色。"), false);
});

test("缺必填项时校验失败", () => {
  const validation = core.validateTaskDraft(
    minDraft({
      title: "  ",
      author: "",
      structureTypes: [],
      otherStructure: "",
      analysisFocus: [],
      deepRoles: ["  "],
      outputs: {
        worldbook: "否",
        characterSummary: "否",
        outline: "否",
        timeline: "否",
        relations: "否",
        style: "否",
      },
    })
  );
  assert.equal(validation.ok, false);
  const fields = validation.errors.map((item) => item.field);
  assert.ok(fields.includes("title"));
  assert.ok(fields.includes("author"));
  assert.ok(fields.includes("structureTypes"));
  assert.ok(fields.includes("analysisFocus"));
  assert.ok(fields.includes("deepRoles"));
});

test("完整配置可被 next_step.py 当前校验逻辑识别", () => {
  const markdown = core.renderProjectConfig(
    minDraft({
      structureTypes: ["连续长篇型", "奇幻世界观型"],
      analysisFocus: ["世界观设定", "角色关系网"],
      deepRoles: ["林浅", "顾衡"],
      briefRoles: ["店老板"],
      ignoredRoles: ["路人甲"],
      specialNotes: ["不要把单篇特例写成全局设定"],
    })
  );
  assert.deepEqual(nextStepMissing(markdown), []);
});

test("空白模板式配置会被 next_step.py 识别为缺口", () => {
  const empty = core.renderProjectConfig(
    core.createEmptyDraft(new Date("2026-08-29T00:00:00"))
  );
  const missing = nextStepMissing(empty);
  assert.ok(missing.includes("作品名"));
  assert.ok(missing.includes("作者"));
  assert.ok(missing.includes("作品结构类型"));
  assert.ok(missing.includes("目标角色清单"));
});

test("原文清单忽略非 txt/md，接受大小写扩展名，并发现重复路径", () => {
  const plan = core.buildImportPlan([
    { relativePath: "novel/ch1.TXT", size: 12 },
    { relativePath: "novel/ch2.md", size: 8 },
    { relativePath: "cover.png", size: 2048 },
    { relativePath: "notes.pdf", size: 10 },
    { relativePath: "novel/ch1.txt", size: 12 },
  ]);
  assert.equal(plan.ignoredCount, 2);
  assert.equal(plan.pending.length, 1);
  assert.equal(plan.pending[0].relativePath, "novel/ch2.md");
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].relativePath.toLowerCase(), "novel/ch1.txt");
});

test("路径穿越和绝对路径会进入冲突而不是待导入", () => {
  const plan = core.buildImportPlan([
    { relativePath: "../PROJECT_CONFIG.md", size: 1 },
    { relativePath: "C:\\secret\\a.txt", size: 1 },
    { relativePath: "/tmp/a.md", size: 1 },
    { relativePath: "ok/ch1.txt", size: 3 },
  ]);
  assert.equal(plan.pending.length, 1);
  assert.equal(plan.pending[0].relativePath, "ok/ch1.txt");
  assert.equal(plan.conflicts.length, 3);
});

test("与现有 source_raw 同名时列出冲突", () => {
  const pending = [{ relativePath: "Arc/ch1.txt", name: "ch1.txt", size: 4 }];
  const conflicts = core.findExistingSourceConflicts(pending, ["arc/ch1.TXT", "other.md"]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].relativePath, "Arc/ch1.txt");
});

test("空白配置与模板比较时视为可直接覆盖", () => {
  const template = "# PROJECT_CONFIG\n\n- 作品名：\n";
  assert.equal(core.isBlankProjectConfig("", template), true);
  assert.equal(core.isBlankProjectConfig("\uFEFF# PROJECT_CONFIG\n\n- 作品名：\n", template), true);
  assert.equal(core.isBlankProjectConfig("# PROJECT_CONFIG\n\n- 作品名：已填\n", template), false);
});
