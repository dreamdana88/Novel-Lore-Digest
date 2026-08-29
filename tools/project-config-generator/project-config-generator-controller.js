(function (global) {
  "use strict";

  var api = global.NovelLoreDigestConfigGenerator || {};

  function text(el, value) {
    if (el) {
      el.textContent = value == null ? "" : String(value);
    }
  }

  function setHidden(el, hidden) {
    if (!el) {
      return;
    }
    if (hidden) {
      el.setAttribute("hidden", "hidden");
    } else {
      el.removeAttribute("hidden");
    }
  }

  function setInvalid(el, invalid) {
    if (!el) {
      return;
    }
    if (invalid) {
      el.setAttribute("data-invalid", "true");
      el.setAttribute("aria-invalid", "true");
    } else {
      el.removeAttribute("data-invalid");
      el.removeAttribute("aria-invalid");
    }
  }

  function emit(app, name, detail) {
    if (!app || typeof app.dispatchEvent !== "function") {
      return;
    }
    var event;
    try {
      event = new CustomEvent(name, { detail: detail || {} });
    } catch (error) {
      event = app.ownerDocument.createEvent("Event");
      event.initEvent(name, false, false);
      event.detail = detail || {};
    }
    app.dispatchEvent(event);
  }

  function checkedValues(form, field) {
    var nodes = form.querySelectorAll('[data-field="' + field + '"]');
    var values = [];
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].checked) {
        values.push(nodes[i].value);
      }
    }
    return values;
  }

  function setCheckedValues(form, field, selected) {
    var lookup = Object.create(null);
    for (var i = 0; i < selected.length; i += 1) {
      lookup[selected[i]] = true;
    }
    var nodes = form.querySelectorAll('[data-field="' + field + '"]');
    for (var j = 0; j < nodes.length; j += 1) {
      nodes[j].checked = !!lookup[nodes[j].value];
    }
  }

  function listValues(container, selector) {
    if (!container) {
      return [];
    }
    var nodes = container.querySelectorAll(selector);
    var values = [];
    for (var i = 0; i < nodes.length; i += 1) {
      values.push(nodes[i].value);
    }
    return values;
  }

  function extensionOf(name) {
    var parts = String(name || "").split(".");
    if (parts.length < 2) {
      return "";
    }
    return "." + parts.pop();
  }

  function formatSize(size) {
    var n = Number(size) || 0;
    if (n < 1024) {
      return n + " 字节";
    }
    return (n / 1024).toFixed(1) + " KB";
  }

  var CONFIG_STATE_LABELS = {
    unchanged: "配置未改动",
    "written-and-verified": "配置已写入并验证",
    restored: "配置已恢复为操作前内容",
    "missing-restored": "已删除本次新建的配置",
    "written-unverified": "配置已写入但未通过验证",
    "restore-failed": "配置恢复失败",
  };

  function joinList(values) {
    if (!values || !values.length) {
      return "";
    }
    return values.join("、");
  }

  function pushDetail(details, label, value) {
    if (value == null || value === "") {
      return;
    }
    if (Array.isArray(value) && !value.length) {
      return;
    }
    details.push(label + "：" + (Array.isArray(value) ? joinList(value) : value));
  }

  function hadWriteAttempt(result) {
    if (!result) {
      return false;
    }
    if (result.copiedFiles && result.copiedFiles.length) {
      return true;
    }
    if (result.rolledBackFiles && result.rolledBackFiles.length) {
      return true;
    }
    return (
      result.configState === "restored" ||
      result.configState === "missing-restored" ||
      result.configState === "restore-failed" ||
      result.configState === "written-unverified"
    );
  }

  function formatRollbackErrors(errors) {
    var lines = [];
    var list = errors || [];
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i] || {};
      lines.push(
        "回滚错误：" +
          [item.target, item.name, item.message].filter(Boolean).join(" ")
      );
    }
    return lines;
  }

  function mapGenerateResult(result) {
    var data = result || {};
    var details = [];

    if (data.ok && data.completionCode === "ready") {
      pushDetail(details, "已复制原文", data.copiedFiles);
      pushDetail(details, "备份", data.backupPath);
      return {
        status: "success",
        completionCode: "ready",
        title: "完成，可以启动",
        message: "配置已写入并验证成功。接下来可以对 Agent 说：启动 Novel Lore Digest。",
        details: details,
        partial: false,
      };
    }

    if (data.ok && data.completionCode === "waiting-source") {
      pushDetail(details, "备份", data.backupPath);
      return {
        status: "warning",
        completionCode: "waiting-source",
        title: "配置已生成，等待原文",
        message: "配置已写入并验证成功，但 source_raw/ 中还没有 txt/md 原文。",
        details: details,
        partial: false,
      };
    }

    if (data.cancelled && !data.partial) {
      return {
        status: "warning",
        completionCode: "not-generated",
        title: "未生成",
        message: data.message || "已取消，未写入任何文件。",
        details: ["没有写入文件。"],
        partial: false,
      };
    }

    if (data.partial) {
      pushDetail(details, "阶段", data.stage);
      pushDetail(details, "已复制文件", data.copiedFiles);
      pushDetail(details, "已回滚文件", data.rolledBackFiles);
      pushDetail(details, "仍保留文件", data.remainingFiles);
      pushDetail(details, "当前配置状态", CONFIG_STATE_LABELS[data.configState] || data.configState);
      pushDetail(details, "备份路径", data.backupPath);
      details.push.apply(details, formatRollbackErrors(data.rollbackErrors));
      if (data.errorName || data.errorMessage) {
        details.push("浏览器错误：" + [data.errorName, data.errorMessage].filter(Boolean).join(" "));
      }
      return {
        status: "failure",
        completionCode: "not-generated",
        title: "生成未完成，存在部分写入",
        message: data.message || "生成未完成，存在部分写入。",
        details: details,
        partial: true,
      };
    }

    if (hadWriteAttempt(data)) {
      pushDetail(details, "阶段", data.stage);
      pushDetail(details, "已回滚文件", data.rolledBackFiles);
      pushDetail(details, "保留的备份", data.backupPath);
      pushDetail(details, "当前配置状态", CONFIG_STATE_LABELS[data.configState] || data.configState);
      if (data.errorName || data.errorMessage) {
        details.push("浏览器错误：" + [data.errorName, data.errorMessage].filter(Boolean).join(" "));
      }
      return {
        status: "failure",
        completionCode: "not-generated",
        title: "未生成，已回滚",
        message: "配置和本次新建原文已恢复到操作前状态。",
        details: details,
        partial: false,
      };
    }

    pushDetail(details, "阶段", data.stage);
    if (data.files && data.files.length) {
      pushDetail(details, "相关文件", data.files);
    }
    if (data.errorName || data.errorMessage) {
      details.push("浏览器错误：" + [data.errorName, data.errorMessage].filter(Boolean).join(" "));
    }
    return {
      status: "failure",
      completionCode: "not-generated",
      title: "未生成",
      message: data.message || "未写入任何文件。",
      details: details,
      partial: false,
    };
  }

  function bindPage(documentRef) {
    var doc = documentRef || document;
    function $(id) {
      return doc.getElementById(id);
    }
    var app = $("nld-config-app");
    var form = $("nld-config-form");
    if (!app || !form || !api.normalizeTaskDraft) {
      return;
    }

    var importEntries = [];
    var generating = false;
    var confirmResolver = null;

    function cloneTemplate(id) {
      var tpl = $(id);
      if (!tpl || !tpl.content || !tpl.content.firstElementChild) {
        return null;
      }
      return tpl.content.firstElementChild.cloneNode(true);
    }

    function addRoleRow(group, value) {
      var list = form.querySelector('[data-role-group="' + group + '"]');
      var row = cloneTemplate("tpl-role-item");
      if (!list || !row) {
        return;
      }
      var input = row.querySelector("[data-role-name]");
      if (input) {
        input.value = value || "";
      }
      list.appendChild(row);
    }

    function addNoteRow(value) {
      var list = $("list-special-notes");
      var row = cloneTemplate("tpl-note-item");
      if (!list || !row) {
        return;
      }
      var input = row.querySelector("[data-note-text]");
      if (input) {
        input.value = value || "";
      }
      list.appendChild(row);
    }

    function fillList(list, names, addRow) {
      while (list && list.firstChild) {
        list.removeChild(list.firstChild);
      }
      if (names && names.length) {
        for (var i = 0; i < names.length; i += 1) {
          addRow(names[i]);
        }
      } else {
        addRow("");
      }
    }

    function collectDraft() {
      return {
        title: $("field-title") ? $("field-title").value : "",
        author: $("field-author") ? $("field-author").value : "",
        language: $("field-language") ? $("field-language").value : "",
        source: $("field-source") ? $("field-source").value : "",
        analysisDate: $("field-analysis-date") ? $("field-analysis-date").value : "",
        structureTypes: checkedValues(form, "structureTypes"),
        otherStructure: $("field-other-structure") ? $("field-other-structure").value : "",
        analysisFocus: checkedValues(form, "analysisFocus"),
        deepRoles: listValues($("list-deep-roles"), "[data-role-name]"),
        briefRoles: listValues($("list-brief-roles"), "[data-role-name]"),
        ignoredRoles: listValues($("list-ignored-roles"), "[data-role-name]"),
        outputs: {
          worldbook: $("output-worldbook") ? $("output-worldbook").value : "是",
          characterSummary: $("output-character-summary") ? $("output-character-summary").value : "是",
          outline: $("output-outline") ? $("output-outline").value : "否",
          timeline: $("output-timeline") ? $("output-timeline").value : "否",
          relations: $("output-relations") ? $("output-relations").value : "否",
          style: $("output-style") ? $("output-style").value : "否",
        },
        specialNotes: listValues($("list-special-notes"), "[data-note-text]"),
      };
    }

    function applyDraft(draft) {
      var normalized = api.normalizeTaskDraft(draft);
      if ($("field-title")) $("field-title").value = normalized.title;
      if ($("field-author")) $("field-author").value = normalized.author;
      if ($("field-language")) $("field-language").value = normalized.language;
      if ($("field-source")) $("field-source").value = normalized.source;
      if ($("field-analysis-date")) $("field-analysis-date").value = normalized.analysisDate;
      setCheckedValues(form, "structureTypes", normalized.structureTypes);
      if ($("structure-type-other")) {
        $("structure-type-other").checked = !!normalized.otherStructure;
      }
      if ($("field-other-structure")) {
        $("field-other-structure").value = normalized.otherStructure;
      }
      if ($("output-worldbook")) $("output-worldbook").value = normalized.outputs.worldbook;
      if ($("output-character-summary")) $("output-character-summary").value = normalized.outputs.characterSummary;
      if ($("output-outline")) $("output-outline").value = normalized.outputs.outline;
      if ($("output-timeline")) $("output-timeline").value = normalized.outputs.timeline;
      if ($("output-relations")) $("output-relations").value = normalized.outputs.relations;
      if ($("output-style")) $("output-style").value = normalized.outputs.style;
      setCheckedValues(form, "analysisFocus", normalized.analysisFocus);
      fillList($("list-deep-roles"), normalized.deepRoles, function (value) {
        addRoleRow("deep", value);
      });
      fillList($("list-brief-roles"), normalized.briefRoles, function (value) {
        addRoleRow("brief", value);
      });
      fillList($("list-ignored-roles"), normalized.ignoredRoles, function (value) {
        addRoleRow("ignored", value);
      });
      fillList($("list-special-notes"), normalized.specialNotes, addNoteRow);
      text($("granularity-chunk-size"), api.GRANULARITY_DEFAULTS.chunkSize);
      text($("granularity-split-large"), api.GRANULARITY_DEFAULTS.splitLargeChapters);
      text($("granularity-keep-overlap"), api.GRANULARITY_DEFAULTS.keepOverlap);
      text($("granularity-overlap-chars"), api.GRANULARITY_DEFAULTS.overlapChars);
    }

    function currentImportPlan() {
      return api.buildImportPlan(importEntries);
    }

    function renderImportCollection(container, items, withReason) {
      while (container && container.firstChild) {
        container.removeChild(container.firstChild);
      }
      if (!container) {
        return;
      }
      for (var i = 0; i < items.length; i += 1) {
        var row = cloneTemplate("tpl-import-item");
        if (!row) {
          continue;
        }
        text(row.querySelector("[data-import-path]"), items[i].relativePath || items[i].name || "");
        text(row.querySelector("[data-import-type]"), extensionOf(items[i].name || items[i].relativePath));
        text(row.querySelector("[data-import-size]"), formatSize(items[i].size));
        text(row.querySelector("[data-import-reason]"), withReason ? items[i].reason || "" : "");
        container.appendChild(row);
      }
    }

    function renderImportState() {
      var plan = currentImportPlan();
      text(
        $("import-summary"),
        "待导入 " + plan.pending.length + " 个，忽略 " + plan.ignoredCount + " 个，冲突 " + plan.conflicts.length + " 个。"
      );
      text($("import-ignored-count"), String(plan.ignoredCount));
      renderImportCollection($("list-import-pending"), plan.pending, false);
      renderImportCollection($("list-import-ignored"), plan.ignored, true);
      renderImportCollection($("list-import-conflicts"), plan.conflicts, true);

      var previewLines = [];
      if (plan.pending.length) {
        for (var i = 0; i < plan.pending.length; i += 1) {
          previewLines.push(
            plan.pending[i].relativePath + "\t" + formatSize(plan.pending[i].size)
          );
        }
      } else {
        previewLines.push("（本次不导入原文）");
      }
      if (plan.ignoredCount) {
        previewLines.push("忽略 " + plan.ignoredCount + " 个非 txt/md 文件。");
      }
      if (plan.conflicts.length) {
        previewLines.push("冲突 " + plan.conflicts.length + " 项，生成前必须处理。");
      }
      text($("preview-import-list"), previewLines.join("\n"));
      emit(app, "nld:import-change", plan);
      return plan;
    }

    function clearFieldErrors() {
      var nodes = form.querySelectorAll("[data-error-for]");
      for (var i = 0; i < nodes.length; i += 1) {
        text(nodes[i], "");
      }
      var fields = form.querySelectorAll("[data-field], [data-role-name]");
      for (var j = 0; j < fields.length; j += 1) {
        setInvalid(fields[j], false);
        fields[j].removeAttribute("data-conflict");
      }
      var roleErrors = form.querySelectorAll("[data-role-error]");
      for (var k = 0; k < roleErrors.length; k += 1) {
        text(roleErrors[k], "");
        setHidden(roleErrors[k], true);
        if (roleErrors[k].parentNode) {
          roleErrors[k].parentNode.removeAttribute("data-conflict");
        }
      }
    }

    function showRoleConflicts(errors) {
      var items = form.querySelectorAll("[data-role-item]");
      for (var i = 0; i < errors.length; i += 1) {
        var error = errors[i];
        if (error.field !== "roleConflict") {
          continue;
        }
        for (var j = 0; j < items.length; j += 1) {
          var input = items[j].querySelector("[data-role-name]");
          if (!input || String(input.value).trim() !== error.name) {
            continue;
          }
          items[j].setAttribute("data-conflict", "true");
          setInvalid(input, true);
          var box = items[j].querySelector("[data-role-error]");
          text(box, error.message);
          setHidden(box, false);
        }
      }
    }

    function showValidation(validation, importPlan) {
      clearFieldErrors();
      var messages = [];
      for (var i = 0; i < validation.errors.length; i += 1) {
        var error = validation.errors[i];
        messages.push(error.message);
        var box = form.querySelector('[data-error-for="' + error.field + '"]');
        if (box) {
          text(box, error.message);
        }
        var field = form.querySelector('[data-field="' + error.field + '"]');
        setInvalid(field, true);
      }
      showRoleConflicts(validation.errors);
      if (importPlan && importPlan.conflicts.length) {
        messages.push("待导入原文存在冲突，生成前必须处理。");
      }
      var summary = $("validation-summary");
      if (messages.length) {
        text(summary, messages.join(" "));
        setHidden(summary, false);
      } else {
        text(summary, "");
        setHidden(summary, true);
      }
      emit(app, "nld:validation-change", validation);
    }

    function refreshPreview() {
      var draft = api.normalizeTaskDraft(collectDraft());
      var markdown = api.renderProjectConfig(draft);
      text($("preview-config"), markdown);
      var plan = renderImportState();
      emit(app, "nld:draft-change", { draft: draft, markdown: markdown });
      return { draft: draft, markdown: markdown, plan: plan };
    }

    function setBusy(busy) {
      generating = busy;
      app.setAttribute("data-busy", busy ? "true" : "false");
      if ($("btn-generate")) {
        $("btn-generate").disabled = !!busy;
      }
    }

    function setStatus(options) {
      var panel = $("status-panel");
      var details = $("status-details");
      if (panel) {
        panel.setAttribute("data-status", options.status || "idle");
        panel.setAttribute("data-completion", options.completionCode || "");
        panel.setAttribute("data-partial", options.partial ? "true" : "false");
      }
      text($("status-title"), options.title || "");
      text($("status-message"), options.message || "");
      while (details && details.firstChild) {
        details.removeChild(details.firstChild);
      }
      var lines = options.details || [];
      for (var i = 0; i < lines.length; i += 1) {
        if (!details) {
          break;
        }
        var li = doc.createElement("li");
        li.textContent = lines[i];
        details.appendChild(li);
      }
      emit(app, "nld:status-change", options);
    }

    function waitForReplaceConfirm() {
      setHidden($("confirm-replace-panel"), false);
      text(
        $("confirm-replace-message"),
        "当前项目已有非空 PROJECT_CONFIG.md。确认后会先备份到 workspace/index/config-backups/，再写入新配置。"
      );
      return new Promise(function (resolve) {
        confirmResolver = resolve;
      });
    }

    function finishReplaceConfirm(confirmed) {
      setHidden($("confirm-replace-panel"), true);
      if (confirmResolver) {
        var resolve = confirmResolver;
        confirmResolver = null;
        resolve(!!confirmed);
      }
    }

    function appendFiles(fileList, fromFolder) {
      var files = fileList ? Array.prototype.slice.call(fileList) : [];
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        var relativePath = fromFolder ? file.webkitRelativePath || file.name : file.name;
        importEntries.push({
          relativePath: relativePath,
          name: file.name,
          size: file.size,
          file: file,
        });
      }
    }

    function resetPage() {
      importEntries = [];
      finishReplaceConfirm(false);
      applyDraft(api.createEmptyDraft(new Date()));
      showValidation({ ok: true, errors: [] }, { conflicts: [] });
      refreshPreview();
      setStatus({
        status: "idle",
        completionCode: "",
        title: "尚未生成",
        message: "填写配置后点击“生成任务”。浏览器会要求你选择本项目根目录。",
        details: [],
      });
    }

    function syncOutputFocus(selectEl) {
      if (!selectEl || selectEl.value !== "是") {
        return;
      }
      var focusValue = selectEl.getAttribute("data-sync-focus");
      if (!focusValue) {
        return;
      }
      var box = form.querySelector('[data-field="analysisFocus"][value="' + focusValue + '"]');
      if (box) {
        box.checked = true;
      }
    }

    async function handleGenerate(event) {
      if (event) {
        event.preventDefault();
      }
      if (generating) {
        return;
      }
      var snapshot = refreshPreview();
      var validation = api.validateTaskDraft(snapshot.draft);
      showValidation(validation, snapshot.plan);
      if (!validation.ok || snapshot.plan.conflicts.length) {
        setStatus({
          status: "failure",
          completionCode: api.COMPLETION_CODE.NOT_GENERATED,
          title: api.COMPLETION_STATUS.NOT_GENERATED,
          message: "请先处理必填缺口或原文冲突。",
          details: validation.errors.map(function (item) {
            return item.message;
          }).concat(
            snapshot.plan.conflicts.map(function (item) {
              return (item.relativePath || "") + "：" + (item.reason || "冲突");
            })
          ),
        });
        return;
      }

      setBusy(true);
      emit(app, "nld:generate-start", snapshot);
      setStatus({
        status: "generating",
        completionCode: "",
        title: "正在生成",
        message: "请在弹出窗口中选择 Novel Lore Digest 项目根目录。",
        details: [],
      });

      var result;
      try {
        result = await api.runGenerateTask({
          markdown: snapshot.markdown,
          importItems: snapshot.plan.pending,
          confirmReplace: waitForReplaceConfirm,
        });
      } catch (error) {
        result = {
          ok: false,
          cancelled: false,
          partial: false,
          completion: api.COMPLETION_STATUS.NOT_GENERATED,
          completionCode: api.COMPLETION_CODE.NOT_GENERATED,
          stage: "generate",
          message: error && error.message ? error.message : "生成失败。",
          files: [],
          copiedFiles: [],
          backupPath: "",
          configState: "unchanged",
          rolledBackFiles: [],
          remainingFiles: [],
          rollbackErrors: [],
          errorMessage: error && error.message ? error.message : String(error),
          errorName: error && error.name ? error.name : "",
        };
      } finally {
        setBusy(false);
        setHidden($("confirm-replace-panel"), true);
      }

      setStatus(mapGenerateResult(result));
      emit(app, "nld:generate-complete", result);
    }

    function onRoleClick(event) {
      var actionBtn = event.target.closest("[data-role-action]");
      var addBtn = event.target.closest("[data-role-add]");
      if (addBtn) {
        addRoleRow(addBtn.getAttribute("data-role-add"), "");
        refreshPreview();
        return;
      }
      if (!actionBtn) {
        return;
      }
      var row = actionBtn.closest("[data-role-item]");
      if (!row) {
        return;
      }
      var action = actionBtn.getAttribute("data-role-action");
      if (action === "remove") {
        var group = row.parentNode;
        row.parentNode.removeChild(row);
        if (group && !group.querySelector("[data-role-item]")) {
          addRoleRow(group.getAttribute("data-role-group"), "");
        }
      } else if (action === "up" && row.previousElementSibling) {
        row.parentNode.insertBefore(row, row.previousElementSibling);
      } else if (action === "down" && row.nextElementSibling) {
        row.parentNode.insertBefore(row.nextElementSibling, row);
      }
      refreshPreview();
    }

    var capabilities = api.detectBrowserCapabilities(global);
    text($("nld-compat-message"), capabilities.message);
    setHidden($("nld-compat-banner"), capabilities.supported);

    var folderInput = $("input-select-folder");
    if (folderInput) {
      folderInput.setAttribute("webkitdirectory", "webkitdirectory");
      folderInput.setAttribute("multiple", "multiple");
    }

    form.addEventListener("input", function () {
      refreshPreview();
    });
    form.addEventListener("change", function (event) {
      if (event.target && event.target.getAttribute("data-sync-focus")) {
        syncOutputFocus(event.target);
      }
      refreshPreview();
    });
    form.addEventListener("submit", handleGenerate);
    form.addEventListener("click", onRoleClick);

    $("btn-add-special-note") &&
      $("btn-add-special-note").addEventListener("click", function () {
        addNoteRow("");
        refreshPreview();
      });
    form.addEventListener("click", function (event) {
      var noteBtn = event.target.closest("[data-note-action]");
      if (!noteBtn) {
        return;
      }
      var row = noteBtn.closest("[data-note-item]");
      if (row && row.parentNode) {
        row.parentNode.removeChild(row);
        if (!$("list-special-notes").querySelector("[data-note-item]")) {
          addNoteRow("");
        }
        refreshPreview();
      }
    });

    $("btn-select-files") &&
      $("btn-select-files").addEventListener("click", function () {
        $("input-select-files") && $("input-select-files").click();
      });
    $("btn-select-folder") &&
      $("btn-select-folder").addEventListener("click", function () {
        $("input-select-folder") && $("input-select-folder").click();
      });
    $("input-select-files") &&
      $("input-select-files").addEventListener("change", function (event) {
        appendFiles(event.target.files, false);
        event.target.value = "";
        refreshPreview();
      });
    $("input-select-folder") &&
      $("input-select-folder").addEventListener("change", function (event) {
        appendFiles(event.target.files, true);
        event.target.value = "";
        refreshPreview();
      });
    $("btn-clear-imports") &&
      $("btn-clear-imports").addEventListener("click", function () {
        importEntries = [];
        refreshPreview();
      });
    $("btn-reset") && $("btn-reset").addEventListener("click", resetPage);
    $("btn-confirm-replace") &&
      $("btn-confirm-replace").addEventListener("click", function () {
        finishReplaceConfirm(true);
      });
    $("btn-cancel-replace") &&
      $("btn-cancel-replace").addEventListener("click", function () {
        finishReplaceConfirm(false);
      });
    $("btn-copy-preview") &&
      $("btn-copy-preview").addEventListener("click", function () {
        var markdown = $("preview-config") ? $("preview-config").textContent : "";
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(markdown);
        }
      });

    resetPage();
  }

  api.bindPage = bindPage;
  api.mapGenerateResult = mapGenerateResult;
  global.NovelLoreDigestConfigGenerator = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        bindPage(document);
      });
    } else {
      bindPage(document);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
