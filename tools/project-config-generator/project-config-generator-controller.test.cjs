"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

require("./project-config-generator-core.js");
require("./project-config-generator-filesystem.js");
const controller = require("./project-config-generator-controller.js");

test("普通成功映射为可以启动", () => {
  const view = controller.mapGenerateResult({
    ok: true,
    cancelled: false,
    partial: false,
    completionCode: "ready",
    copiedFiles: ["book/ch1.txt"],
    backupPath: "",
    configState: "written-and-verified",
  });
  assert.equal(view.status, "success");
  assert.equal(view.completionCode, "ready");
  assert.equal(view.title, "完成，可以启动");
  assert.equal(view.partial, false);
  assert.ok(view.details.some((line) => line.includes("book/ch1.txt")));
});

test("等待原文映射为警告状态", () => {
  const view = controller.mapGenerateResult({
    ok: true,
    cancelled: false,
    partial: false,
    completionCode: "waiting-source",
    copiedFiles: [],
    backupPath: "workspace/index/config-backups/PROJECT_CONFIG-20260829-153045.md",
    configState: "written-and-verified",
  });
  assert.equal(view.status, "warning");
  assert.equal(view.completionCode, "waiting-source");
  assert.equal(view.title, "配置已生成，等待原文");
  assert.ok(view.details.some((line) => line.includes("备份")));
});

test("用户取消且零写入映射为未生成", () => {
  const view = controller.mapGenerateResult({
    ok: false,
    cancelled: true,
    partial: false,
    completionCode: "not-generated",
    stage: "pick-root",
    message: "已取消目录授权，未写入任何文件。",
    copiedFiles: [],
    rolledBackFiles: [],
    remainingFiles: [],
    configState: "unchanged",
  });
  assert.equal(view.status, "warning");
  assert.equal(view.title, "未生成");
  assert.equal(view.partial, false);
  assert.ok(view.message.includes("未写入任何文件"));
  assert.deepEqual(view.details, ["没有写入文件。"]);
});

test("失败且完全回滚映射为未生成已回滚", () => {
  const view = controller.mapGenerateResult({
    ok: false,
    cancelled: false,
    partial: false,
    completionCode: "not-generated",
    stage: "copy-sources",
    copiedFiles: ["ok.txt"],
    rolledBackFiles: ["ok.txt"],
    remainingFiles: [],
    backupPath: "workspace/index/config-backups/PROJECT_CONFIG-20260829-153045.md",
    configState: "unchanged",
    errorName: "NotReadableError",
    errorMessage: "read failed",
  });
  assert.equal(view.status, "failure");
  assert.equal(view.title, "未生成，已回滚");
  assert.equal(view.partial, false);
  assert.equal(view.message, "配置和本次新建原文已恢复到操作前状态。");
  assert.ok(view.details.some((line) => line.includes("已回滚文件")));
  assert.ok(view.details.some((line) => line.includes("保留的备份")));
});

test("失败且存在原文残留映射为部分写入", () => {
  const view = controller.mapGenerateResult({
    ok: false,
    cancelled: false,
    partial: true,
    completionCode: "not-generated",
    stage: "copy-sources",
    copiedFiles: ["ok.txt"],
    rolledBackFiles: [],
    remainingFiles: ["ok.txt"],
    configState: "unchanged",
    backupPath: "",
    rollbackErrors: [{ target: "source_raw/ok.txt", name: "NoModificationAllowedError", message: "remove failed" }],
  });
  assert.equal(view.status, "failure");
  assert.equal(view.title, "生成未完成，存在部分写入");
  assert.equal(view.partial, true);
  assert.ok(view.details.some((line) => line.startsWith("已复制文件：")));
  assert.ok(view.details.some((line) => line.startsWith("仍保留文件：")));
  assert.ok(view.details.some((line) => line.startsWith("当前配置状态：")));
  assert.ok(view.details.some((line) => line.startsWith("回滚错误：")));
});

test("失败且配置恢复失败映射为部分写入", () => {
  const view = controller.mapGenerateResult({
    ok: false,
    cancelled: false,
    partial: true,
    completionCode: "not-generated",
    stage: "verify-write",
    copiedFiles: ["ok.txt"],
    rolledBackFiles: ["ok.txt"],
    remainingFiles: [],
    configState: "restore-failed",
    backupPath: "workspace/index/config-backups/PROJECT_CONFIG-20260829-153045.md",
    rollbackErrors: [{ target: "PROJECT_CONFIG.md", name: "QuotaExceededError", message: "restore failed" }],
  });
  assert.equal(view.status, "failure");
  assert.equal(view.title, "生成未完成，存在部分写入");
  assert.ok(view.details.some((line) => line.includes("配置恢复失败")));
  assert.ok(view.details.some((line) => line.includes("备份路径")));
  assert.ok(view.details.some((line) => line.includes("PROJECT_CONFIG.md")));
});
