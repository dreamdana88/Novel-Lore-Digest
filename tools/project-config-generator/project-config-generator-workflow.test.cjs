"use strict";

const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const NEXT_STEP_PY = path.resolve(__dirname, "..", "..", "scripts", "next_step.py");

function decideSelected(flags, artifacts) {
  const py = [
    "import importlib.util, json, sys",
    "spec = importlib.util.spec_from_file_location('next_step', sys.argv[1])",
    "mod = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(mod)",
    "payload = json.loads(sys.stdin.read())",
    "step, command = mod.decide_selected_outputs(payload['flags'], payload['artifacts'])",
    "print(json.dumps({'step': step, 'command': command}, ensure_ascii=False))",
  ].join("\n");
  const result = spawnSync("python", ["-c", py, NEXT_STEP_PY], {
    input: JSON.stringify({ flags, artifacts }),
    encoding: "utf8",
    env: Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }),
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "python failed").trim());
  }
  return JSON.parse(result.stdout.trim());
}

function decideLocalNoteStage(progress) {
  const py = [
    "import importlib.util, json, sys",
    "spec = importlib.util.spec_from_file_location('next_step', sys.argv[1])",
    "mod = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(mod)",
    "payload = json.loads(sys.stdin.read())",
    "result = mod.decide_local_note_stage(payload['progress'])",
    "print(json.dumps(result, ensure_ascii=False))",
  ].join("\n");
  const result = spawnSync("python", ["-c", py, NEXT_STEP_PY], {
    input: JSON.stringify({ progress }),
    encoding: "utf8",
    env: Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }),
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "python failed").trim());
  }
  return JSON.parse(result.stdout.trim());
}

function readLocalNoteProgress(sources, notes) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nld-next-step-"));
  const sourceDir = path.join(fixtureRoot, "source");
  const notesDir = path.join(fixtureRoot, "notes");
  fs.mkdirSync(sourceDir, { recursive: true });
  for (const source of sources) {
    fs.writeFileSync(path.join(sourceDir, source), "source", "utf8");
  }
  for (const note of notes) {
    const folder = path.join(notesDir, note.folder || "chapter-notes");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, note.name), note.content, "utf8");
  }

  const py = [
    "import importlib.util, json, pathlib, sys",
    "spec = importlib.util.spec_from_file_location('next_step', sys.argv[1])",
    "mod = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(mod)",
    "mod.SOURCE = pathlib.Path(sys.argv[2])",
    "mod.NOTES = pathlib.Path(sys.argv[3])",
    "print(json.dumps(mod.local_note_progress(), ensure_ascii=False))",
  ].join("\n");
  try {
    const result = spawnSync("python", ["-c", py, NEXT_STEP_PY, sourceDir, notesDir], {
      encoding: "utf8",
      env: Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }),
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "python failed").trim());
    }
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

const emptyArtifacts = {
  outline: false,
  timeline: false,
  style: false,
  worldbook: false,
  character_files: false,
  character_merge: false,
  story_card: false,
};

function flags(overrides) {
  return Object.assign(
    {
      worldbook: false,
      characterSummary: false,
      outline: false,
      timeline: false,
      style: false,
    },
    overrides
  );
}

test("世界书和角色汇总都开启时保持完整流程", () => {
  const first = decideSelected(flags({ worldbook: true, characterSummary: true }), emptyArtifacts);
  assert.equal(first.step, "输出 SillyTavern 世界书");
  const afterBook = decideSelected(
    flags({ worldbook: true, characterSummary: true }),
    Object.assign({}, emptyArtifacts, { worldbook: true })
  );
  assert.equal(afterBook.step, "输出 SillyTavern 角色汇总");
  const afterCards = decideSelected(
    flags({ worldbook: true, characterSummary: true }),
    Object.assign({}, emptyArtifacts, { worldbook: true, character_files: true })
  );
  assert.equal(afterCards.step, "归并角色汇总用于核查");
  const afterMerge = decideSelected(
    flags({ worldbook: true, characterSummary: true }),
    Object.assign({}, emptyArtifacts, {
      worldbook: true,
      character_files: true,
      character_merge: true,
    })
  );
  assert.equal(afterMerge.step, "导出 SillyTavern 作品角色卡 JSON");
});

test("只开世界书时跳过角色汇总和最终 JSON", () => {
  const afterBook = decideSelected(
    flags({ worldbook: true, characterSummary: false }),
    Object.assign({}, emptyArtifacts, { worldbook: true })
  );
  assert.equal(afterBook.step, "生成待核查清单或复查最终导出");
  assert.notEqual(afterBook.step, "导出 SillyTavern 作品角色卡 JSON");
});

test("只开角色汇总时跳过世界书和最终 JSON", () => {
  const first = decideSelected(flags({ worldbook: false, characterSummary: true }), emptyArtifacts);
  assert.equal(first.step, "输出 SillyTavern 角色汇总");
  const afterMerge = decideSelected(
    flags({ worldbook: false, characterSummary: true }),
    Object.assign({}, emptyArtifacts, { character_files: true, character_merge: true })
  );
  assert.equal(afterMerge.step, "生成待核查清单或复查最终导出");
  assert.notEqual(afterMerge.step, "导出 SillyTavern 作品角色卡 JSON");
});

test("两个 SillyTavern 输出都关闭时不进入作品角色卡 JSON", () => {
  const result = decideSelected(flags({ outline: true }), emptyArtifacts);
  assert.equal(result.step, "生成剧情大纲");
  const afterOutline = decideSelected(
    flags({ outline: true }),
    Object.assign({}, emptyArtifacts, { outline: true })
  );
  assert.equal(afterOutline.step, "生成待核查清单或复查最终导出");
});

test("被关闭的输出不成为完成门槛", () => {
  const result = decideSelected(
    flags({ worldbook: true, characterSummary: false, outline: false }),
    Object.assign({}, emptyArtifacts, { worldbook: true })
  );
  assert.equal(result.step, "生成待核查清单或复查最终导出");
});

test("全部输出关闭时得到基础整理完成状态", () => {
  const result = decideSelected(flags(), emptyArtifacts);
  assert.equal(result.step, "基础整理已完成，未选择最终输出");
});

test("时间线和文风条目按各自开关依次调度", () => {
  const selected = flags({ timeline: true, style: true });
  const first = decideSelected(selected, emptyArtifacts);
  assert.equal(first.step, "生成时间线");
  const second = decideSelected(selected, Object.assign({}, emptyArtifacts, { timeline: true }));
  assert.equal(second.step, "生成文风条目");
});

test("局部笔记未覆盖全部 source 时继续批量生成", () => {
  const result = decideLocalNoteStage(
    {
      source_count: 130,
      note_count: 129,
      completed: 129,
      missing: 1,
      review: 0,
      all_complete: false,
    }
  );
  assert.deepEqual(result, ["继续批量生成局部笔记，完成后生成角色出场表", "继续批量生成局部笔记。"]);
});

test("局部笔记一一覆盖后交给后续阶段判断", () => {
  const result = decideLocalNoteStage(
    {
      source_count: 130,
      note_count: 130,
      completed: 130,
      missing: 0,
      review: 0,
      all_complete: true,
    }
  );
  assert.equal(result, null);
});

test("尚无局部笔记时进入推荐三篇试跑", () => {
  const result = decideLocalNoteStage({
    source_count: 130, note_count: 0, completed: 0,
    missing: 130, review: 0, all_complete: false,
  });
  assert.deepEqual(result, ["按推荐三篇试跑局部笔记", "按推荐三篇试跑。"]);
});

test("局部笔记含暂无字段仍算非空完成，零字节笔记不算", () => {
  const progress = readLocalNoteProgress(
    ["a.txt", "b.txt"],
    [
      { name: "a.md", content: "# A\n\n## 待核查\n- 暂无\n" },
      { name: "b.md", content: "" },
    ]
  );
  assert.equal(progress.source_count, 2);
  assert.equal(progress.note_count, 1);
  assert.equal(progress.completed, 1);
  assert.equal(progress.missing, 1);
  assert.equal(progress.all_complete, false);
});

test("阶段 Prompt 明确禁止生成未选择的大纲或时间线", () => {
  const prompt = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "prompts", "07_剧情大纲与时间线.md"),
    "utf8"
  );
  assert.match(prompt, /是否生成剧情大纲：是/);
  assert.match(prompt, /是否生成时间线：是/);
  assert.match(prompt, /不得新建或更新对应文件/);
});

test("蜃灵文风 Prompt 有固定结构、原文证据和禁止联网约束", () => {
  const prompt = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "prompts", "07_生成文风条目.md"),
    "utf8"
  );
  for (const heading of ["语感腔调", "叙事偏好", "对话规则", "禁用项", "示例", "来源附录"]) {
    assert.match(prompt, new RegExp(heading));
  }
  assert.match(prompt, /禁止联网补充作者评论/);
  assert.match(prompt, /逐字来自项目原文/);
});

test("旧终端向导已删除", () => {
  assert.equal(fs.existsSync(path.resolve(__dirname, "..", "..", "scripts", "new_project_wizard.py")), false);
});
