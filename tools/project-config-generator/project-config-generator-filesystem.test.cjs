"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const core = require("./project-config-generator-core.js");
const filesystem = require("./project-config-generator-filesystem.js");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TEMPLATE_TEXT = fs.readFileSync(
  path.join(REPO_ROOT, "templates", "project-config-template.md"),
  "utf8"
);
const AGENTS_TEXT = fs.readFileSync(path.join(REPO_ROOT, "AGENTS.md"), "utf8");
const NEXT_STEP_TEXT = fs.readFileSync(
  path.join(REPO_ROOT, "scripts", "next_step.py"),
  "utf8"
);

const FILLED_CONFIG = core.renderProjectConfig({
  title: "旧作品",
  author: "旧作者",
  language: "中文",
  source: "",
  analysisDate: "2024-01-01",
  structureTypes: ["连续长篇型"],
  analysisFocus: ["主要角色人设"],
  deepRoles: ["旧主角"],
  outputs: {
    worldbook: "是",
    characterSummary: "是",
    outline: "否",
    timeline: "否",
    style: "否",
  },
});

const NEW_CONFIG = core.renderProjectConfig({
  title: "新作品",
  author: "不详",
  language: "中文",
  source: "",
  analysisDate: "2026-08-29",
  structureTypes: ["单元故事型"],
  analysisFocus: ["主要角色人设"],
  deepRoles: ["林浅"],
  outputs: {
    worldbook: "是",
    characterSummary: "是",
    outline: "否",
    timeline: "否",
    style: "否",
  },
});

class MemoryFileHandle {
  constructor(name, content) {
    this.name = name;
    this.kind = "file";
    this.content =
      content instanceof Uint8Array ? content : new TextEncoder().encode(content || "");
    this.throwOnWrite = null;
    this.throwOnClose = null;
    this.throwOnCreateWritable = null;
    this.throwOnGetFile = null;
  }

  async getFile() {
    if (this.throwOnGetFile) {
      throw this.throwOnGetFile;
    }
    const bytes = this.content;
    return {
      name: this.name,
      size: bytes.byteLength,
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  }

  async createWritable() {
    if (this.throwOnCreateWritable) {
      throw this.throwOnCreateWritable;
    }
    this.content = new Uint8Array(0);
    const file = this;
    const chunks = [];
    return {
      async write(data) {
        if (file.throwOnWrite) {
          throw file.throwOnWrite;
        }
        let bytes;
        if (typeof data === "string") {
          bytes = new TextEncoder().encode(data);
        } else if (data instanceof Uint8Array) {
          bytes = data;
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else if (data && typeof data.arrayBuffer === "function") {
          bytes = new Uint8Array(await data.arrayBuffer());
        } else {
          bytes = new Uint8Array(data);
        }
        chunks.push(bytes);
      },
      async close() {
        if (file.throwOnClose) {
          throw file.throwOnClose;
        }
        const total = chunks.reduce((sum, item) => sum + item.byteLength, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const item of chunks) {
          out.set(item, offset);
          offset += item.byteLength;
        }
        file.content = out;
      },
      async abort() {},
    };
  }
}

class MemoryDirectoryHandle {
  constructor(name, children) {
    this.name = name;
    this.kind = "directory";
    this.entries = new Map();
    this.permission = "granted";
    this.blockCreates = false;
    this.removeFailFor = new Set();
    this.valuesCallCount = 0;
    this.throwOnValuesAfter = null;
    const source = children || {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const value = source[key];
      if (value instanceof MemoryDirectoryHandle || value instanceof MemoryFileHandle) {
        this.entries.set(key, value);
      } else if (value instanceof Uint8Array || typeof value === "string") {
        this.entries.set(key, new MemoryFileHandle(key, value));
      } else if (value && typeof value === "object") {
        this.entries.set(key, new MemoryDirectoryHandle(key, value));
      }
    }
  }

  async queryPermission() {
    return this.permission;
  }

  async requestPermission() {
    return this.permission;
  }

  async getDirectoryHandle(name, options) {
    const create = !!(options && options.create);
    const existing = this.entries.get(name);
    if (existing) {
      if (existing.kind !== "directory") {
        const error = new Error("TypeMismatchError");
        error.name = "TypeMismatchError";
        throw error;
      }
      return existing;
    }
    if (!create) {
      const error = new Error("NotFoundError");
      error.name = "NotFoundError";
      throw error;
    }
    if (this.blockCreates) {
      const error = new Error("无法创建目录");
      error.name = "UnknownError";
      throw error;
    }
    const dir = new MemoryDirectoryHandle(name);
    this.entries.set(name, dir);
    return dir;
  }

  async getFileHandle(name, options) {
    const create = !!(options && options.create);
    const existing = this.entries.get(name);
    if (existing) {
      if (existing.kind !== "file") {
        const error = new Error("TypeMismatchError");
        error.name = "TypeMismatchError";
        throw error;
      }
      return existing;
    }
    if (!create) {
      const error = new Error("NotFoundError");
      error.name = "NotFoundError";
      throw error;
    }
    if (this.blockCreates) {
      const error = new Error("无法创建文件");
      error.name = "UnknownError";
      throw error;
    }
    const file = new MemoryFileHandle(name, new Uint8Array(0));
    this.entries.set(name, file);
    return file;
  }

  async removeEntry(name) {
    if (this.removeFailFor && this.removeFailFor.has(name)) {
      const error = new Error("remove failed");
      error.name = "NoModificationAllowedError";
      throw error;
    }
    if (!this.entries.has(name)) {
      const error = new Error("NotFoundError");
      error.name = "NotFoundError";
      throw error;
    }
    this.entries.delete(name);
  }

  async *values() {
    this.valuesCallCount += 1;
    if (this.throwOnValuesAfter != null && this.valuesCallCount > this.throwOnValuesAfter) {
      const error = new Error("list failed");
      error.name = "UnknownError";
      throw error;
    }
    for (const entry of this.entries.values()) {
      yield entry;
    }
  }
}

function withCorruptedConfigRead(root, corruptFn) {
  const configFile = root.entries.get("PROJECT_CONFIG.md");
  const origCreateWritable = configFile.createWritable.bind(configFile);
  const origGetFile = configFile.getFile.bind(configFile);
  let writeCount = 0;
  let corruptReadsLeft = 0;
  configFile.createWritable = async function createWritableForCorruptRead() {
    writeCount += 1;
    const writable = await origCreateWritable();
    if (writeCount !== 1) {
      return writable;
    }
    const origClose = writable.close.bind(writable);
    writable.close = async function closeThenCorrupt() {
      await origClose();
      corruptReadsLeft = 1;
    };
    return writable;
  };
  configFile.getFile = async function getFileMaybeCorrupt() {
    if (corruptReadsLeft > 0) {
      corruptReadsLeft -= 1;
      return corruptFn();
    }
    return origGetFile();
  };
  return configFile;
}

function createValidProject(overrides) {
  const settings = overrides || {};
  const tree = {
    "AGENTS.md": AGENTS_TEXT,
    scripts: {
      "next_step.py": NEXT_STEP_TEXT,
    },
    templates: {
      "project-config-template.md": TEMPLATE_TEXT,
    },
    source_raw: settings.sourceRaw || {},
    workspace: {
      index: {},
    },
  };
  if (settings.config !== false) {
    tree["PROJECT_CONFIG.md"] =
      settings.config === undefined ? TEMPLATE_TEXT : settings.config;
  }
  return new MemoryDirectoryHandle(settings.name || "project", tree);
}

function memoryText(root, relativePath) {
  const parts = relativePath.split("/");
  let node = root;
  for (let i = 0; i < parts.length; i += 1) {
    if (!node || !node.entries) {
      return null;
    }
    node = node.entries.get(parts[i]);
  }
  if (!node || node.kind !== "file") {
    return null;
  }
  return new TextDecoder().decode(node.content);
}

function memoryBytes(root, relativePath) {
  const parts = relativePath.split("/");
  let node = root;
  for (let i = 0; i < parts.length; i += 1) {
    node = node.entries.get(parts[i]);
  }
  return node.content;
}

function memoryHas(root, relativePath) {
  const parts = relativePath.split("/");
  let node = root;
  for (let i = 0; i < parts.length; i += 1) {
    if (!node || !node.entries) {
      return false;
    }
    node = node.entries.get(parts[i]);
  }
  return !!node;
}

function abortError(message) {
  const error = new Error(message || "The user aborted a request.");
  error.name = "AbortError";
  return error;
}

test("正确项目根目录通过身份检查", async () => {
  const root = createValidProject();
  const result = await filesystem.identifyProjectRoot(root);
  assert.equal(result.ok, true);
});

test("误选父目录、子目录和普通文件夹都会失败", async () => {
  const project = createValidProject({ name: "Novel-Lore-Digest模版" });
  const parent = new MemoryDirectoryHandle("parent", {
    "Novel-Lore-Digest模版": project,
  });
  const sourceRaw = project.entries.get("source_raw");
  const random = new MemoryDirectoryHandle("downloads", { a: "1" });

  const parentResult = await filesystem.identifyProjectRoot(parent);
  const childResult = await filesystem.identifyProjectRoot(sourceRaw);
  const randomResult = await filesystem.identifyProjectRoot(random);

  assert.equal(parentResult.ok, false);
  assert.equal(childResult.ok, false);
  assert.equal(randomResult.ok, false);
  assert.equal(parentResult.message, "请选择 Novel Lore Digest 项目根目录。");
});

test("空白配置可以直接覆盖且不调用替换确认", async () => {
  const root = createValidProject({ config: TEMPLATE_TEXT });
  let confirmCalled = false;
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [],
    confirmReplace: async () => {
      confirmCalled = true;
      return false;
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.completion, "配置已生成，等待原文");
  assert.equal(confirmCalled, false);
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), NEW_CONFIG);
});

test("非空配置确认后先备份再替换", async () => {
  const now = new Date(2026, 7, 29, 15, 30, 45);
  const root = createValidProject({ config: FILLED_CONFIG });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [],
    now,
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, true);
  assert.equal(
    memoryText(root, "workspace/index/config-backups/PROJECT_CONFIG-20260829-153045.md"),
    FILLED_CONFIG
  );
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), NEW_CONFIG);
});

test("备份失败时停止且不覆盖旧配置", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const workspace = root.entries.get("workspace");
  const index = workspace.entries.get("index");
  index.blockCreates = true;

  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [],
    now: new Date(2026, 7, 29, 15, 30, 45),
    confirmReplace: async () => true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.stage, "backup");
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), FILLED_CONFIG);
  assert.equal(memoryHas(root, "workspace/index/config-backups"), false);
});

test("原文无冲突时按二进制复制并保留相对目录", async () => {
  const root = createValidProject({ config: TEMPLATE_TEXT });
  const payload = Uint8Array.from([0xff, 0xfe, 0x00, 0x61]);
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [
      {
        relativePath: "book/ch1.TXT",
        name: "ch1.TXT",
        size: payload.byteLength,
        file: new Blob([payload]),
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.completion, "完成，可以启动");
  const copied = memoryBytes(root, "source_raw/book/ch1.TXT");
  assert.deepEqual(Array.from(copied), [255, 254, 0, 97]);
});

test("路径穿越输入被拒绝且零写入", async () => {
  const root = createValidProject({ config: TEMPLATE_TEXT });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [
      {
        relativePath: "../AGENTS.md",
        name: "AGENTS.md",
        size: 4,
        file: new Blob([new Uint8Array([1, 2, 3, 4])]),
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "check-sources");
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), TEMPLATE_TEXT);
  assert.equal(memoryHas(root, "AGENTS.md"), true);
});

test("一个或多个同名冲突时零写入", async () => {
  const existing = new TextEncoder().encode("keep-me");
  const root = createValidProject({
    config: TEMPLATE_TEXT,
    sourceRaw: {
      "ch1.txt": existing,
    },
  });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [
      {
        relativePath: "ch1.txt",
        name: "ch1.txt",
        size: 3,
        file: new Blob(["new"]),
      },
      {
        relativePath: "ch2.md",
        name: "ch2.md",
        size: 3,
        file: new Blob(["two"]),
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "check-sources");
  assert.ok(result.files.includes("ch1.txt"));
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), TEMPLATE_TEXT);
  assert.equal(memoryText(root, "source_raw/ch1.txt"), "keep-me");
  assert.equal(memoryHas(root, "source_raw/ch2.md"), false);
});

test("复制失败时回滚已复制原文且不写新配置", async () => {
  const root = createValidProject({ config: TEMPLATE_TEXT });
  const originalConfig = memoryBytes(root, "PROJECT_CONFIG.md");
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [
      {
        relativePath: "ok.txt",
        name: "ok.txt",
        size: 2,
        file: new Blob(["ok"]),
      },
      {
        relativePath: "bad.md",
        name: "bad.md",
        size: 2,
        file: {
          async arrayBuffer() {
            throw Object.assign(new Error("read failed"), { name: "NotReadableError" });
          },
        },
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.partial, false);
  assert.equal(result.stage, "copy-sources");
  assert.deepEqual(result.rolledBackFiles, ["ok.txt"]);
  assert.deepEqual(result.remainingFiles, []);
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), TEMPLATE_TEXT);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(originalConfig));
});

test("用户取消授权不算程序错误且零写入", async () => {
  const root = createValidProject({ config: TEMPLATE_TEXT });
  const result = await filesystem.runGenerateTask({
    markdown: NEW_CONFIG,
    importItems: [],
    showDirectoryPicker: async () => {
      throw abortError();
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.cancelled, true);
  assert.equal(result.completion, "未生成");
  assert.equal(result.stage, "pick-root");
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), TEMPLATE_TEXT);
});

test("选错目录不会写入任何文件", async () => {
  const wrong = new MemoryDirectoryHandle("downloads", { notes: "x" });
  const result = await filesystem.runGenerateTask({
    rootHandle: wrong,
    markdown: NEW_CONFIG,
    importItems: [
      {
        relativePath: "ch1.txt",
        name: "ch1.txt",
        size: 3,
        file: new Blob(["abc"]),
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "validate-root");
  assert.equal(result.message, "请选择 Novel Lore Digest 项目根目录。");
  assert.equal(memoryHas(wrong, "PROJECT_CONFIG.md"), false);
  assert.equal(memoryHas(wrong, "source_raw"), false);
});

test("未选择原文但 source_raw 已有 txt 时显示可以启动", async () => {
  const root = createValidProject({
    config: TEMPLATE_TEXT,
    sourceRaw: {
      "manual.md": "# already there\n",
    },
  });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [],
  });
  assert.equal(result.ok, true);
  assert.equal(result.completion, "完成，可以启动");
});

test("取消替换确认时不备份不覆盖", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [],
    confirmReplace: async () => false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.cancelled, true);
  assert.equal(result.partial, false);
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), FILLED_CONFIG);
  assert.equal(memoryHas(root, "workspace/index/config-backups"), false);
});

function sourceItem(relativePath, content) {
  return {
    relativePath,
    name: relativePath.split("/").pop(),
    size: content.length,
    file: new Blob([content]),
  };
}

function bytesOf(text) {
  return new TextEncoder().encode(text);
}

test("第二个原文读取失败时回滚第一个新建文件", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const original = memoryBytes(root, "PROJECT_CONFIG.md");
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [
      sourceItem("ok.txt", "ok"),
      {
        relativePath: "bad.md",
        name: "bad.md",
        size: 2,
        file: {
          async arrayBuffer() {
            throw Object.assign(new Error("read failed"), { name: "NotReadableError" });
          },
        },
      },
    ],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.partial, false);
  assert.equal(result.configState, "unchanged");
  assert.deepEqual(result.rolledBackFiles, ["ok.txt"]);
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
});

test("删除已复制原文失败时标记部分写入", async () => {
  const root = createValidProject({ config: TEMPLATE_TEXT });
  root.entries.get("source_raw").removeFailFor.add("ok.txt");
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [
      sourceItem("ok.txt", "ok"),
      {
        relativePath: "bad.md",
        name: "bad.md",
        size: 2,
        file: {
          async arrayBuffer() {
            throw Object.assign(new Error("read failed"), { name: "NotReadableError" });
          },
        },
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.partial, true);
  assert.deepEqual(result.remainingFiles, ["ok.txt"]);
  assert.ok(result.rollbackErrors.length > 0);
  assert.equal(memoryHas(root, "source_raw/ok.txt"), true);
  assert.equal(result.message.includes("部分写入"), true);
  assert.equal(result.message.includes("未写入任何文件"), false);
});

test("原文冲突预检失败不触发回滚", async () => {
  const root = createValidProject({
    config: TEMPLATE_TEXT,
    sourceRaw: { "ch1.txt": "keep-me" },
  });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ch1.txt", "new")],
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "check-sources");
  assert.equal(result.partial, false);
  assert.deepEqual(result.rolledBackFiles, []);
  assert.equal(memoryText(root, "source_raw/ch1.txt"), "keep-me");
  assert.equal(memoryText(root, "PROJECT_CONFIG.md"), TEMPLATE_TEXT);
});

test("配置 createWritable 失败时回滚新建原文且原配置不变", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const original = memoryBytes(root, "PROJECT_CONFIG.md");
  root.entries.get("PROJECT_CONFIG.md").throwOnCreateWritable = Object.assign(new Error("createWritable failed"), {
    name: "UnknownError",
  });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "write-config");
  assert.equal(result.partial, false);
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
  assert.deepEqual(result.rolledBackFiles, ["ok.txt"]);
});

test("配置 write 失败时恢复原始字节并回滚原文", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const original = memoryBytes(root, "PROJECT_CONFIG.md");
  const configFile = root.entries.get("PROJECT_CONFIG.md");
  const origCreateWritable = configFile.createWritable.bind(configFile);
  let firstWrite = true;
  configFile.createWritable = async function createWritableFailFirstWrite() {
    const writable = await origCreateWritable();
    if (!firstWrite) {
      return writable;
    }
    firstWrite = false;
    writable.write = async function writeOnceAndFail() {
      throw Object.assign(new Error("write failed"), { name: "UnknownError" });
    };
    return writable;
  };
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "write-config");
  assert.equal(result.configState, "restored");
  assert.equal(result.partial, false);
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
});

test("配置 close 失败时恢复原始字节并回滚原文", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const original = memoryBytes(root, "PROJECT_CONFIG.md");
  const configFile = root.entries.get("PROJECT_CONFIG.md");
  const origCreateWritable = configFile.createWritable.bind(configFile);
  let firstWrite = true;
  configFile.createWritable = async function createWritableFailFirstClose() {
    const writable = await origCreateWritable();
    if (!firstWrite) {
      return writable;
    }
    firstWrite = false;
    writable.close = async function closeOnceAndFail() {
      throw Object.assign(new Error("close failed"), { name: "UnknownError" });
    };
    return writable;
  };
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("nested/a.md", "a")],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "write-config");
  assert.equal(result.configState, "restored");
  assert.equal(memoryHas(root, "source_raw/nested/a.md"), false);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
});

test("配置写入成功但回读抛错时恢复并回滚", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const original = memoryBytes(root, "PROJECT_CONFIG.md");
  withCorruptedConfigRead(root, () => {
    throw Object.assign(new Error("read failed"), { name: "NotReadableError" });
  });
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "verify-write");
  assert.equal(result.configState, "restored");
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
});

test("配置回读内容不一致时恢复并回滚", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const original = memoryBytes(root, "PROJECT_CONFIG.md");
  withCorruptedConfigRead(root, () => ({
    name: "PROJECT_CONFIG.md",
    size: 9,
    text: async () => "corrupted",
    arrayBuffer: async () => bytesOf("corrupted"),
  }));
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "verify-write");
  assert.equal(result.configState, "restored");
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
});

test("最终 source_raw 检查失败时恢复配置并回滚新建原文", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const original = memoryBytes(root, "PROJECT_CONFIG.md");
  root.entries.get("source_raw").throwOnValuesAfter = 1;
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "verify-sources");
  assert.equal(result.configState, "restored");
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
});

test("原配置不存在时校验失败会删除本次新建配置", async () => {
  const root = createValidProject({ config: false });
  const created = new MemoryFileHandle("PROJECT_CONFIG.md", new Uint8Array(0));
  const origCreateWritable = MemoryFileHandle.prototype.createWritable;
  created.createWritable = async function createThenCorrupt() {
    const writable = await origCreateWritable.call(this);
    const origClose = writable.close.bind(writable);
    writable.close = async function closeThenCorrupt() {
      await origClose();
      created.getFile = async function corruptedGetFile() {
        return {
          name: "PROJECT_CONFIG.md",
          size: 9,
          text: async () => "corrupted",
          arrayBuffer: async () => bytesOf("corrupted"),
        };
      };
    };
    return writable;
  };
  const origGetFileHandle = root.getFileHandle.bind(root);
  root.getFileHandle = async function getFileHandleMaybeCreate(name, options) {
    if (name === "PROJECT_CONFIG.md" && options && options.create) {
      root.entries.set("PROJECT_CONFIG.md", created);
      return created;
    }
    return origGetFileHandle(name, options);
  };

  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
  });
  assert.equal(result.ok, false);
  assert.equal(result.configState, "missing-restored");
  assert.equal(result.partial, false);
  assert.equal(memoryHas(root, "PROJECT_CONFIG.md"), false);
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
});

test("含 BOM 与 CRLF 的原配置故障回滚后逐字节相等", async () => {
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf]);
  const body = bytesOf(FILLED_CONFIG.replace(/\n/g, "\r\n"));
  const original = new Uint8Array(bom.length + body.length);
  original.set(bom, 0);
  original.set(body, bom.length);
  const root = createValidProject({ config: original });
  withCorruptedConfigRead(root, () => ({
    name: "PROJECT_CONFIG.md",
    size: 9,
    text: async () => "corrupted",
    arrayBuffer: async () => bytesOf("corrupted"),
  }));
  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.configState, "restored");
  assert.deepEqual(Array.from(memoryBytes(root, "PROJECT_CONFIG.md")), Array.from(original));
});

test("配置恢复失败时返回部分写入、备份路径和恢复错误", async () => {
  const root = createValidProject({ config: FILLED_CONFIG });
  const configFile = root.entries.get("PROJECT_CONFIG.md");
  const origCreateWritable = configFile.createWritable.bind(configFile);
  let writes = 0;
  let failNextRead = false;
  configFile.createWritable = async function createWritableLimited() {
    writes += 1;
    if (writes === 1) {
      const writable = await origCreateWritable();
      const origClose = writable.close.bind(writable);
      writable.close = async function closeThenCorrupt() {
        await origClose();
        failNextRead = true;
      };
      return writable;
    }
    throw Object.assign(new Error("restore failed"), { name: "QuotaExceededError" });
  };
  const origGetFile = configFile.getFile.bind(configFile);
  configFile.getFile = async function getFileMaybeCorrupt() {
    if (failNextRead) {
      failNextRead = false;
      return {
        name: "PROJECT_CONFIG.md",
        size: 9,
        text: async () => "corrupted",
        arrayBuffer: async () => bytesOf("corrupted"),
      };
    }
    return origGetFile();
  };

  const result = await filesystem.runGenerateTask({
    rootHandle: root,
    markdown: NEW_CONFIG,
    importItems: [sourceItem("ok.txt", "ok")],
    now: new Date(2026, 7, 29, 15, 30, 45),
    confirmReplace: async () => true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.partial, true);
  assert.equal(result.configState, "restore-failed");
  assert.equal(result.backupPath, "workspace/index/config-backups/PROJECT_CONFIG-20260829-153045.md");
  assert.ok(result.rollbackErrors.length > 0);
  assert.equal(memoryHas(root, "source_raw/ok.txt"), false);
});
