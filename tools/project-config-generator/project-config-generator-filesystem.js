(function (global) {
  "use strict";

  var core = (global && global.NovelLoreDigestConfigGenerator) || {};
  if (typeof module === "object" && module.exports) {
    try {
      core = require("./project-config-generator-core.js");
    } catch (error) {
      core = global.NovelLoreDigestConfigGenerator || {};
    }
  }

  var ROOT_IDENTITY_MARKERS = [
    { path: "AGENTS.md", kind: "file" },
    { path: "scripts/next_step.py", kind: "file" },
    { path: "templates/project-config-template.md", kind: "file" },
    { path: "source_raw", kind: "directory" },
  ];

  var CONFIG_FILE_NAME = "PROJECT_CONFIG.md";
  var SOURCE_RAW_DIR = "source_raw";
  var TEMPLATE_PATH = "templates/project-config-template.md";
  var BACKUP_DIR_SEGMENTS = ["workspace", "index", "config-backups"];
  var PICKER_ID = "novel-lore-digest-project-root";

  function assignError(error, extra) {
    var keys = Object.keys(extra);
    for (var i = 0; i < keys.length; i += 1) {
      error[keys[i]] = extra[keys[i]];
    }
    return error;
  }

  function makeError(message, extra) {
    return assignError(new Error(message), extra || {});
  }

  var CONFIG_STATE = {
    UNCHANGED: "unchanged",
    WRITTEN_AND_VERIFIED: "written-and-verified",
    RESTORED: "restored",
    MISSING_RESTORED: "missing-restored",
    WRITTEN_UNVERIFIED: "written-unverified",
    RESTORE_FAILED: "restore-failed",
  };

  function createJournal() {
    return {
      copiedFiles: [],
      createdSourceFiles: [],
      originalConfigExisted: false,
      originalConfigBytes: null,
      configWriteStarted: false,
      configWritten: false,
      configVerified: false,
      backupPath: "",
      rolledBackFiles: [],
      remainingFiles: [],
      configRestored: false,
      rollbackErrors: [],
      configState: CONFIG_STATE.UNCHANGED,
    };
  }

  function isUserCancellation(error) {
    if (!error) {
      return false;
    }
    if (error.cancelled) {
      return true;
    }
    return error.name === "AbortError";
  }

  function mutationFields(journal, extra) {
    var source = journal || createJournal();
    var fields = {
      partial: false,
      copiedFiles: source.copiedFiles.slice(),
      backupPath: source.backupPath || "",
      configState: source.configState || CONFIG_STATE.UNCHANGED,
      rolledBackFiles: source.rolledBackFiles.slice(),
      remainingFiles: source.remainingFiles.slice(),
      rollbackErrors: source.rollbackErrors.slice(),
    };
    if (extra) {
      var keys = Object.keys(extra);
      for (var i = 0; i < keys.length; i += 1) {
        fields[keys[i]] = extra[keys[i]];
      }
    }
    return fields;
  }

  function failResult(options) {
    var settings = options || {};
    var error = settings.error || null;
    var journal = settings.journal || createJournal();
    var cancelled = !!settings.cancelled;
    var partial = settings.partial;
    if (partial == null) {
      partial =
        journal.remainingFiles.length > 0 || journal.configState === CONFIG_STATE.RESTORE_FAILED;
    }
    var fields = mutationFields(journal, {
      ok: false,
      completion: core.COMPLETION_STATUS.NOT_GENERATED,
      completionCode: core.COMPLETION_CODE.NOT_GENERATED,
      cancelled: cancelled,
      partial: !!partial,
      stage: settings.stage || "",
      message:
        settings.message ||
        (cancelled ? "已取消，未写入任何文件。" : partial ? "生成未完成，存在部分写入。" : "生成失败。"),
      files: settings.files || [],
      rootName: settings.rootName || "",
      errorMessage: error ? error.message || String(error) : "",
      errorName: error ? error.name || "" : "",
    });
    return fields;
  }

  function successResult(options) {
    var settings = options || {};
    var journal = settings.journal || createJournal();
    return mutationFields(journal, {
      ok: true,
      cancelled: false,
      partial: false,
      completion: settings.completion,
      completionCode: settings.completionCode,
      stage: "complete",
      message: settings.message || settings.completion,
      files: settings.files || [],
      copiedFiles: settings.copiedFiles || journal.copiedFiles.slice(),
      backupPath: settings.backupPath || journal.backupPath || "",
      configState: CONFIG_STATE.WRITTEN_AND_VERIFIED,
      rootName: settings.rootName || "",
      errorMessage: "",
      errorName: "",
    });
  }

  function splitPath(relativePath) {
    return String(relativePath)
      .replace(/\\/g, "/")
      .split("/")
      .filter(function (part) {
        return part && part !== ".";
      });
  }

  async function getDirectoryBySegments(rootHandle, segments, options) {
    var current = rootHandle;
    for (var i = 0; i < segments.length; i += 1) {
      current = await current.getDirectoryHandle(segments[i], options);
    }
    return current;
  }

  async function getFileByPath(rootHandle, relativePath, options) {
    var parts = splitPath(relativePath);
    var fileName = parts.pop();
    var dir = await getDirectoryBySegments(rootHandle, parts, options);
    return dir.getFileHandle(fileName, options);
  }

  async function markerExists(rootHandle, marker) {
    var parts = splitPath(marker.path);
    try {
      if (marker.kind === "directory") {
        await getDirectoryBySegments(rootHandle, parts, { create: false });
        return true;
      }
      await getFileByPath(rootHandle, marker.path, { create: false });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function identifyProjectRoot(rootHandle) {
    if (!rootHandle) {
      return {
        ok: false,
        message: "请选择 Novel Lore Digest 项目根目录。",
        missing: ROOT_IDENTITY_MARKERS.map(function (marker) {
          return marker.path;
        }),
      };
    }
    var missing = [];
    for (var i = 0; i < ROOT_IDENTITY_MARKERS.length; i += 1) {
      var marker = ROOT_IDENTITY_MARKERS[i];
      var exists = await markerExists(rootHandle, marker);
      if (!exists) {
        missing.push(marker.path);
      }
    }
    if (missing.length) {
      return {
        ok: false,
        message: "请选择 Novel Lore Digest 项目根目录。",
        missing: missing,
      };
    }
    return { ok: true, missing: [] };
  }

  async function ensurePermission(handle, mode) {
    var options = { mode: mode || "readwrite" };
    if (!handle) {
      return false;
    }
    try {
      if (typeof handle.queryPermission === "function") {
        var current = await handle.queryPermission(options);
        if (current === "granted") {
          return true;
        }
      }
      if (typeof handle.requestPermission === "function") {
        var requested = await handle.requestPermission(options);
        return requested === "granted";
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async function readFileText(rootHandle, relativePath) {
    try {
      var fileHandle = await getFileByPath(rootHandle, relativePath, { create: false });
      var file = await fileHandle.getFile();
      if (file && typeof file.text === "function") {
        return await file.text();
      }
      if (file && typeof file.arrayBuffer === "function") {
        var buffer = await file.arrayBuffer();
        return new TextDecoder("utf-8").decode(buffer);
      }
      return "";
    } catch (error) {
      if (error && (error.name === "NotFoundError" || error.name === "NotFound")) {
        return null;
      }
      throw error;
    }
  }

  async function readFileBytes(rootHandle, relativePath) {
    var fileHandle = await getFileByPath(rootHandle, relativePath, { create: false });
    var file = await fileHandle.getFile();
    if (file && typeof file.arrayBuffer === "function") {
      return new Uint8Array(await file.arrayBuffer());
    }
    var text = await file.text();
    return new TextEncoder().encode(text);
  }

  async function writeBytes(rootHandle, relativePath, bytes, options) {
    var fileHandle = await getFileByPath(rootHandle, relativePath, options || { create: true });
    if (typeof fileHandle.createWritable !== "function") {
      throw makeError("当前目录句柄不支持写入。", { stage: "write" });
    }
    var writable = await fileHandle.createWritable();
    try {
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      if (writable && typeof writable.abort === "function") {
        try {
          await writable.abort();
        } catch (abortError) {
          void abortError;
        }
      }
      throw error;
    }
  }

  async function writeText(rootHandle, relativePath, text, options) {
    await writeBytes(rootHandle, relativePath, new TextEncoder().encode(text), options);
  }

  function bytesEqual(left, right) {
    if (left == null && right == null) {
      return true;
    }
    if (left == null || right == null || left.length !== right.length) {
      return false;
    }
    for (var i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }
    return true;
  }

  function decodeUtf8(bytes) {
    if (!bytes) {
      return null;
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  function copyBytes(bytes) {
    if (!bytes) {
      return null;
    }
    return new Uint8Array(bytes);
  }

  async function readFileBytesOrNull(rootHandle, relativePath) {
    try {
      return await readFileBytes(rootHandle, relativePath);
    } catch (error) {
      if (error && (error.name === "NotFoundError" || error.name === "NotFound")) {
        return null;
      }
      throw error;
    }
  }

  function recordRollbackError(journal, target, error) {
    journal.rollbackErrors.push({
      target: target,
      name: error && error.name ? error.name : "",
      message: error && error.message ? error.message : String(error || "未知错误"),
    });
  }

  async function removeFileByPath(rootHandle, relativePath) {
    var parts = splitPath(relativePath);
    var fileName = parts.pop();
    if (!fileName) {
      throw makeError("无法删除空路径。", { stage: "rollback" });
    }
    var dir = await getDirectoryBySegments(rootHandle, parts, { create: false });
    if (typeof dir.removeEntry !== "function") {
      throw makeError("当前目录句柄不支持删除。", { stage: "rollback", files: [relativePath] });
    }
    await dir.removeEntry(fileName);
  }

  async function removeCreatedSourceFile(rootHandle, relativeInsideSourceRaw) {
    var safe = core.sanitizeRelativePath(relativeInsideSourceRaw);
    if (!safe.ok) {
      throw makeError("回滚路径不合法：" + safe.error, {
        stage: "rollback",
        files: [relativeInsideSourceRaw],
      });
    }
    var targetPath = SOURCE_RAW_DIR + "/" + safe.path;
    var parts = splitPath(targetPath);
    if (parts[0] !== SOURCE_RAW_DIR || parts.length < 2) {
      throw makeError("拒绝删除 source_raw/ 以外的路径。", {
        stage: "rollback",
        files: [targetPath],
      });
    }
    await removeFileByPath(rootHandle, targetPath);
    return safe.path;
  }

  async function writeConfigMarkdown(rootHandle, markdown, journal) {
    var fileHandle = await getFileByPath(rootHandle, CONFIG_FILE_NAME, { create: true });
    if (typeof fileHandle.createWritable !== "function") {
      throw makeError("当前目录句柄不支持写入。", { stage: "write-config" });
    }
    var writable;
    try {
      writable = await fileHandle.createWritable();
    } catch (error) {
      throw assignError(error, { stage: "write-config", writeStep: "createWritable" });
    }
    journal.configWriteStarted = true;
    journal.configState = CONFIG_STATE.WRITTEN_UNVERIFIED;
    try {
      await writable.write(new TextEncoder().encode(markdown));
      await writable.close();
      journal.configWritten = true;
    } catch (error) {
      if (writable && typeof writable.abort === "function") {
        try {
          await writable.abort();
        } catch (abortError) {
          void abortError;
        }
      }
      throw assignError(error, { stage: "write-config", writeStep: "write" });
    }
  }

  async function restoreOriginalConfig(rootHandle, journal) {
    if (!journal.configWriteStarted) {
      return;
    }
    if (journal.originalConfigExisted) {
      await writeBytes(rootHandle, CONFIG_FILE_NAME, journal.originalConfigBytes, { create: true });
      var restored = await readFileBytes(rootHandle, CONFIG_FILE_NAME);
      if (!bytesEqual(restored, journal.originalConfigBytes)) {
        throw makeError("配置恢复后与原始字节不一致。", {
          stage: "rollback",
          files: [CONFIG_FILE_NAME],
        });
      }
      journal.configRestored = true;
      journal.configState = CONFIG_STATE.RESTORED;
      return;
    }
    await removeFileByPath(rootHandle, CONFIG_FILE_NAME);
    journal.configRestored = true;
    journal.configState = CONFIG_STATE.MISSING_RESTORED;
  }

  async function rollbackMutations(rootHandle, journal) {
    for (var i = journal.createdSourceFiles.length - 1; i >= 0; i -= 1) {
      var relative = journal.createdSourceFiles[i];
      try {
        await removeCreatedSourceFile(rootHandle, relative);
        journal.rolledBackFiles.push(relative);
      } catch (error) {
        journal.remainingFiles.push(relative);
        recordRollbackError(journal, SOURCE_RAW_DIR + "/" + relative, error);
      }
    }

    if (!journal.configWriteStarted) {
      return;
    }

    try {
      await restoreOriginalConfig(rootHandle, journal);
    } catch (error) {
      journal.configRestored = false;
      journal.configState = CONFIG_STATE.RESTORE_FAILED;
      recordRollbackError(journal, CONFIG_FILE_NAME, error);
    }
  }

  async function failAndRollback(rootHandle, journal, options) {
    await rollbackMutations(rootHandle, journal);
    var partial =
      journal.remainingFiles.length > 0 || journal.configState === CONFIG_STATE.RESTORE_FAILED;
    var message = options.message || "生成失败。";
    if (partial) {
      message = "生成未完成，存在部分写入。 " + message;
    }
    return failResult({
      stage: options.stage,
      message: message,
      files: options.files || [],
      error: options.error || null,
      cancelled: false,
      journal: journal,
      partial: partial,
      rootName: rootHandle && rootHandle.name ? rootHandle.name : "",
    });
  }

  async function listFilesRecursive(dirHandle, prefix) {
    var files = [];
    if (!dirHandle || typeof dirHandle.values !== "function") {
      return files;
    }
    for await (var entry of dirHandle.values()) {
      var name = entry.name;
      var relative = prefix ? prefix + "/" + name : name;
      if (entry.kind === "directory") {
        var sub = entry;
        if (typeof dirHandle.getDirectoryHandle === "function" && typeof entry.values !== "function") {
          sub = await dirHandle.getDirectoryHandle(name);
        }
        var nested = await listFilesRecursive(sub, relative);
        for (var i = 0; i < nested.length; i += 1) {
          files.push(nested[i]);
        }
      } else {
        files.push(relative);
      }
    }
    return files;
  }

  async function listSourceRawPaths(rootHandle) {
    var sourceDir = await rootHandle.getDirectoryHandle(SOURCE_RAW_DIR, { create: false });
    return listFilesRecursive(sourceDir, "");
  }

  function isUsableSourcePath(relativePath) {
    var name = String(relativePath).split("/").pop() || "";
    if (name === ".gitkeep") {
      return false;
    }
    return core.hasSourceExtension(name);
  }

  async function hasUsableSources(rootHandle) {
    var paths = await listSourceRawPaths(rootHandle);
    for (var i = 0; i < paths.length; i += 1) {
      if (isUsableSourcePath(paths[i])) {
        return true;
      }
    }
    return false;
  }

  async function pickProjectRoot(showDirectoryPickerFn) {
    var picker = showDirectoryPickerFn;
    if (typeof picker !== "function" && typeof global.showDirectoryPicker === "function") {
      picker = global.showDirectoryPicker.bind(global);
    }
    if (typeof picker !== "function") {
      throw makeError("当前浏览器不支持目录授权。请使用最新版 Microsoft Edge 或 Google Chrome。", {
        stage: "pick-root",
        code: "unsupported",
      });
    }
    try {
      return await picker({ mode: "readwrite", id: PICKER_ID });
    } catch (error) {
      if (isUserCancellation(error)) {
        throw assignError(error, { cancelled: true, stage: "pick-root" });
      }
      throw assignError(error, { stage: "pick-root" });
    }
  }

  async function blobToBytes(blob) {
    if (!blob) {
      return new Uint8Array(0);
    }
    if (blob instanceof Uint8Array) {
      return blob;
    }
    if (blob instanceof ArrayBuffer) {
      return new Uint8Array(blob);
    }
    if (typeof blob.arrayBuffer === "function") {
      return new Uint8Array(await blob.arrayBuffer());
    }
    if (typeof blob === "string") {
      return new TextEncoder().encode(blob);
    }
    throw makeError("无法按二进制读取所选原文。", { stage: "copy-sources" });
  }

  async function copyImportItem(rootHandle, item) {
    var safe = core.sanitizeRelativePath(item.relativePath);
    if (!safe.ok) {
      throw makeError(safe.error, { stage: "copy-sources", files: [item.relativePath] });
    }
    var bytes = await blobToBytes(item.file);
    var targetPath = SOURCE_RAW_DIR + "/" + safe.path;
    await writeBytes(rootHandle, targetPath, bytes, { create: true });
    return safe.path;
  }

  async function backupExistingConfig(rootHandle, existingBytes, now) {
    var timestamp = core.formatBackupTimestamp(now instanceof Date ? now : new Date());
    var backupName = "PROJECT_CONFIG-" + timestamp + ".md";
    var backupRelative = BACKUP_DIR_SEGMENTS.join("/") + "/" + backupName;
    var bytes = existingBytes instanceof Uint8Array ? existingBytes : new TextEncoder().encode(existingBytes || "");
    await getDirectoryBySegments(rootHandle, BACKUP_DIR_SEGMENTS, { create: true });
    await writeBytes(rootHandle, backupRelative, bytes, { create: true });
    var written = await readFileBytes(rootHandle, backupRelative);
    if (!bytesEqual(written, bytes)) {
      throw makeError("配置备份内容与原文件不一致。", {
        stage: "backup",
        files: [backupRelative],
      });
    }
    return backupRelative;
  }

  async function runGenerateTask(options) {
    var settings = options || {};
    var markdown = settings.markdown;
    var importItems = Array.isArray(settings.importItems) ? settings.importItems : [];
    var now = settings.now instanceof Date ? settings.now : new Date();
    var journal = createJournal();

    if (!markdown) {
      return failResult({
        stage: "validate-form",
        message: "没有可写入的 PROJECT_CONFIG.md 预览。",
        journal: journal,
      });
    }

    var rootHandle;
    try {
      rootHandle = settings.rootHandle || (await pickProjectRoot(settings.showDirectoryPicker));
    } catch (error) {
      if (isUserCancellation(error)) {
        return failResult({
          stage: "pick-root",
          message: "已取消目录授权，未写入任何文件。",
          error: error,
          cancelled: true,
          journal: journal,
        });
      }
      return failResult({
        stage: error.stage || "pick-root",
        message: error.message || "无法打开项目根目录。",
        error: error,
        journal: journal,
      });
    }

    var identity = await identifyProjectRoot(rootHandle);
    if (!identity.ok) {
      return failResult({
        stage: "validate-root",
        message: "请选择 Novel Lore Digest 项目根目录。",
        files: identity.missing,
        journal: journal,
      });
    }

    var permitted = await ensurePermission(rootHandle, "readwrite");
    if (!permitted) {
      return failResult({
        stage: "permission",
        message: "浏览器未授予该目录的读写权限。",
        journal: journal,
      });
    }

    var originalBytes;
    try {
      originalBytes = await readFileBytesOrNull(rootHandle, CONFIG_FILE_NAME);
    } catch (error) {
      return failResult({
        stage: "check-config",
        message: "无法读取现有 PROJECT_CONFIG.md。",
        files: [CONFIG_FILE_NAME],
        error: error,
        journal: journal,
      });
    }

    journal.originalConfigExisted = originalBytes != null;
    journal.originalConfigBytes = copyBytes(originalBytes);
    var existingConfig = originalBytes != null ? decodeUtf8(originalBytes) : null;

    var templateText = "";
    try {
      templateText = (await readFileText(rootHandle, TEMPLATE_PATH)) || "";
    } catch (error) {
      return failResult({
        stage: "check-config",
        message: "无法读取 templates/project-config-template.md。",
        files: [TEMPLATE_PATH],
        error: error,
        journal: journal,
      });
    }

    var needsReplace = existingConfig != null && !core.isBlankProjectConfig(existingConfig, templateText);

    var pending = [];
    for (var i = 0; i < importItems.length; i += 1) {
      var item = importItems[i];
      var safe = core.sanitizeRelativePath(item.relativePath);
      if (!safe.ok) {
        return failResult({
          stage: "check-sources",
          message: "原文路径不合法：" + safe.error,
          files: [item.relativePath],
          journal: journal,
        });
      }
      pending.push({
        relativePath: safe.path,
        name: item.name || safe.path.split("/").pop(),
        size: item.size,
        file: item.file,
      });
    }

    var existingSourcePaths;
    try {
      existingSourcePaths = await listSourceRawPaths(rootHandle);
    } catch (error) {
      return failResult({
        stage: "check-sources",
        message: "无法枚举 source_raw/ 中的现有文件。",
        files: [SOURCE_RAW_DIR],
        error: error,
        journal: journal,
      });
    }

    var existingConflicts = core.findExistingSourceConflicts(pending, existingSourcePaths);
    var importPlan = core.buildImportPlan(pending);
    var allConflicts = existingConflicts.concat(importPlan.conflicts);
    if (allConflicts.length) {
      var conflictFiles = [];
      for (var c = 0; c < allConflicts.length; c += 1) {
        conflictFiles.push(allConflicts[c].relativePath);
      }
      return failResult({
        stage: "check-sources",
        message: "存在原文冲突，已停止且未写入任何文件。",
        files: conflictFiles,
        journal: journal,
      });
    }

    if (needsReplace) {
      var confirmReplace = settings.confirmReplace;
      var confirmed = false;
      if (typeof confirmReplace === "function") {
        confirmed = !!(await confirmReplace({ existingText: existingConfig }));
      }
      if (!confirmed) {
        return failResult({
          stage: "confirm-replace",
          message: "已取消替换现有配置，未写入任何文件。",
          files: [CONFIG_FILE_NAME],
          cancelled: true,
          journal: journal,
        });
      }
    }

    if (needsReplace) {
      try {
        journal.backupPath = await backupExistingConfig(rootHandle, journal.originalConfigBytes, now);
      } catch (error) {
        return failResult({
          stage: "backup",
          message: "配置备份失败，已停止且未覆盖旧配置。",
          files: [CONFIG_FILE_NAME],
          error: error,
          journal: journal,
        });
      }
    }

    try {
      for (var p = 0; p < importPlan.pending.length; p += 1) {
        var copied = await copyImportItem(rootHandle, importPlan.pending[p]);
        journal.copiedFiles.push(copied);
        journal.createdSourceFiles.push(copied);
      }
    } catch (error) {
      return failAndRollback(rootHandle, journal, {
        stage: "copy-sources",
        message: "复制原文失败，已停止且未写入新的 PROJECT_CONFIG.md。",
        files: journal.copiedFiles.concat(error.files || []),
        error: error,
      });
    }

    try {
      await writeConfigMarkdown(rootHandle, markdown, journal);
    } catch (error) {
      return failAndRollback(rootHandle, journal, {
        stage: "write-config",
        message: "写入 PROJECT_CONFIG.md 失败。",
        files: [CONFIG_FILE_NAME],
        error: error,
      });
    }

    var written;
    try {
      written = await readFileText(rootHandle, CONFIG_FILE_NAME);
    } catch (error) {
      return failAndRollback(rootHandle, journal, {
        stage: "verify-write",
        message: "无法回读刚写入的 PROJECT_CONFIG.md。",
        files: [CONFIG_FILE_NAME],
        error: error,
      });
    }

    if (written !== markdown) {
      return failAndRollback(rootHandle, journal, {
        stage: "verify-write",
        message: "回读的 PROJECT_CONFIG.md 与预览不一致。",
        files: [CONFIG_FILE_NAME],
      });
    }
    journal.configVerified = true;

    var hasSource = false;
    try {
      hasSource = await hasUsableSources(rootHandle);
    } catch (error) {
      return failAndRollback(rootHandle, journal, {
        stage: "verify-sources",
        message: "无法确认 source_raw/ 是否包含可用原文。",
        files: [SOURCE_RAW_DIR],
        error: error,
      });
    }

    if (hasSource) {
      return successResult({
        completion: core.COMPLETION_STATUS.READY,
        completionCode: core.COMPLETION_CODE.READY,
        message: core.COMPLETION_STATUS.READY,
        journal: journal,
        rootName: rootHandle.name || "",
      });
    }
    return successResult({
      completion: core.COMPLETION_STATUS.WAITING_SOURCE,
      completionCode: core.COMPLETION_CODE.WAITING_SOURCE,
      message: core.COMPLETION_STATUS.WAITING_SOURCE,
      journal: journal,
      rootName: rootHandle.name || "",
    });
  }

  var exported = {
    ROOT_IDENTITY_MARKERS: ROOT_IDENTITY_MARKERS,
    CONFIG_FILE_NAME: CONFIG_FILE_NAME,
    SOURCE_RAW_DIR: SOURCE_RAW_DIR,
    CONFIG_STATE: CONFIG_STATE,
    identifyProjectRoot: identifyProjectRoot,
    ensurePermission: ensurePermission,
    pickProjectRoot: pickProjectRoot,
    runGenerateTask: runGenerateTask,
    isUserCancellation: isUserCancellation,
    hasUsableSources: hasUsableSources,
    listSourceRawPaths: listSourceRawPaths,
    readFileText: readFileText,
    readFileBytes: readFileBytes,
    bytesEqual: bytesEqual,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
  global.NovelLoreDigestConfigGenerator = Object.assign(
    global.NovelLoreDigestConfigGenerator || {},
    exported
  );
})(typeof window !== "undefined" ? window : globalThis);
