# Novel Lore Digest 配置生成器 DOM 契约

本文件冻结页面与控制器之间的接口。阶段 B（Gemini）可以改布局和视觉 class，但不得改名、删除或复用下列 `id`、`name`、`data-*`、状态容器、按钮和脚本加载顺序。

控制器只依赖稳定的 `id` 与 `data-*`，不依赖视觉 class、DOM 层级或 `nth-child`。

## 1. 脚本加载顺序

根目录 `启动-novel-lore-digest.html` 必须按此顺序加载，且使用经典 `<script>` / `<link>`，禁止 ES Module：

1. `tools/project-config-generator/project-config-generator.css`
2. `tools/project-config-generator/project-config-generator-core.js`
3. `tools/project-config-generator/project-config-generator-filesystem.js`
4. `tools/project-config-generator/project-config-generator-controller.js`

全局命名空间：`window.NovelLoreDigestConfigGenerator`。

## 2. 根节点与分区

| id | 说明 |
| --- | --- |
| `nld-config-app` | 页面根容器。控制器会写 `data-busy`。 |
| `nld-compat-banner` | 浏览器兼容提示容器。不支持目录授权时移除 `hidden`。 |
| `nld-compat-message` | 兼容提示文本，只用 `textContent` 写入。 |
| `nld-step-guide` | 三步说明。 |
| `nld-section-nav` | 配置 / 原文 / 预览 导航。 |
| `nld-config-form` | 主表单。`submit` 触发生成。 |
| `section-config` | 配置区。 |
| `section-source` | 原文选择区。 |
| `section-preview` | 预览区。 |
| `section-generate` | 生成动作区。 |

## 3. 作品基本信息

| id | name | data-field | 类型 | 必填 |
| --- | --- | --- | --- | --- |
| `field-title` | `title` | `title` | text | 是 |
| `field-author` | `author` | `author` | text | 是 |
| `field-language` | `language` | `language` | text | 否，默认中文 |
| `field-source` | `source` | `source` | text | 否 |
| `field-analysis-date` | `analysisDate` | `analysisDate` | date | 否，初始化为当天 |

对应错误容器：

- `error-title` / `data-error-for="title"`
- `error-author` / `data-error-for="author"`
- `error-language` / `data-error-for="language"`
- `error-source` / `data-error-for="source"`
- `error-analysis-date` / `data-error-for="analysisDate"`

## 4. 作品结构类型

容器：`fieldset-structure-types`。

预置复选框：`name="structureTypes"`，`data-field="structureTypes"`。

| id | value |
| --- | --- |
| `structure-type-unit-stories` | 单元故事型 |
| `structure-type-serial-novel` | 连续长篇型 |
| `structure-type-series-novel` | 系列长篇型 |
| `structure-type-case-unit` | 案件单元型 |
| `structure-type-adventure-arc` | 冒险篇章型 |
| `structure-type-ensemble-epic` | 群像史诗型 |
| `structure-type-fantasy-world` | 奇幻世界观型 |
| `structure-type-urban-fantasy` | 都市奇幻型 |
| `structure-type-folk-mystery` | 民俗悬疑型 |
| `structure-type-spirit-investigation` | 灵异调查型 |

其他：

| id | name | data-field | 说明 |
| --- | --- | --- | --- |
| `structure-type-other` | `structureOtherFlag` | `structureOtherFlag` | 仅标记，不进入预置类型数组 |
| `field-other-structure` | `otherStructure` | `otherStructure` | 自由文本 |

错误容器：`error-structure-types`（`data-error-for="structureTypes"`）、`error-other-structure`（`data-error-for="otherStructure"`）。

## 5. 分析重点

容器：`fieldset-analysis-focus`。

复选框：`name="analysisFocus"`，`data-field="analysisFocus"`。

| id | value |
| --- | --- |
| `focus-main-characters` | 主要角色人设 |
| `focus-relations` | 角色关系网 |
| `focus-worldview` | 世界观设定 |
| `focus-outline` | 剧情大纲 |
| `focus-timeline` | 时间线 |
| `focus-factions` | 组织/势力 |
| `focus-locations` | 地点地图 |
| `focus-species` | 物种/妖怪/异类规则 |
| `focus-abilities` | 能力系统 |
| `focus-folk-religion` | 民俗/宗教/禁忌 |
| `focus-mystery` | 悬疑伏笔 |
| `focus-style` | 文风分析 |

分析重点不再包含 SillyTavern 世界书 / 角色汇总。这两个只出现在输出目标。

错误容器：`error-analysis-focus`（`data-error-for="analysisFocus"`）。

## 6. 输出目标

均为 `<select>`，选项只能是 `是` / `否`。输出目标与分析重点相互独立，不得通过 `data-sync-focus` 或脚本勾选分析重点。

| id | name | data-field | 默认 |
| --- | --- | --- | --- |
| `output-worldbook` | `outputs.worldbook` | `outputs.worldbook` | 是 |
| `output-character-summary` | `outputs.characterSummary` | `outputs.characterSummary` | 是 |
| `output-outline` | `outputs.outline` | `outputs.outline` | 否 |
| `output-timeline` | `outputs.timeline` | `outputs.timeline` | 否 |
| `output-style` | `outputs.style` | `outputs.style` | 否 |

错误容器：`error-output-worldbook` 等，`data-error-for` 与对应 `data-field` 相同。

非阻塞提醒：`output-empty-hint`。全部输出为「否」时移除 `hidden`，文案为「未选择最终输出，Agent 将只完成基础整理。」不得把它当成校验错误。

## 7. 目标角色批量输入

三类角色各一个 `<textarea>`，不再使用逐行增删排序组件。

| 分组 | id | name | data-field | 错误容器 |
| --- | --- | --- | --- | --- |
| 需要深度分析的主要角色 | `field-deep-roles` | `deepRoles` | `deepRoles` | `error-deep-roles` |
| 只需简要记录的角色 | `field-brief-roles` | `briefRoles` | `briefRoles` | `error-brief-roles` |
| 暂不分析/忽略的角色 | `field-ignored-roles` | `ignoredRoles` | `ignoredRoles` | `error-ignored-roles` |

跨组冲突时给涉及的 textarea 设置 `data-conflict="true"` 和 `aria-invalid="true"`，并写入对应 `data-error-for` 容器。

已删除且不得恢复：`list-*-roles`、`btn-add-*-role`、`tpl-role-item`、`data-role-item`、`data-role-name`、`data-role-group`、`data-role-add`、`data-role-action`。

## 8. 特别注意

| id | 说明 |
| --- | --- |
| `list-special-notes` | 动态列表 |
| `btn-add-special-note` | 增加一项 |
| `tpl-note-item` | 列表项模板 |

模板结构：

```html
<li data-note-item>
  <input type="text" data-note-text autocomplete="off">
  <button type="button" data-note-action="remove">删除</button>
</li>
```

## 9. 分析粒度（只读展示）

| id | 展示内容 |
| --- | --- |
| `granularity-chunk-size` | 12000-15000 中文字 |
| `granularity-split-large` | 是 |
| `granularity-keep-overlap` | 是 |
| `granularity-overlap-chars` | 500 |

这些元素只用于展示，不得改成可编辑并声称已接入 `prepare_sources.py`。

## 10. 原文选择

| id | 说明 |
| --- | --- |
| `btn-select-files` | 选择小说文件 |
| `input-select-files` | 隐藏的多选 file input，`accept=".txt,.md,text/plain"` |
| `btn-select-folder` | 选择小说文件夹 |
| `input-select-folder` | 隐藏的 `webkitdirectory` input |
| `btn-clear-imports` | 清空待导入清单 |
| `import-summary` | 汇总文本 |
| `import-ignored-count` | 忽略数量 |
| `list-import-pending` | 待导入 |
| `list-import-ignored` | 已忽略 |
| `list-import-conflicts` | 冲突 |
| `tpl-import-item` | 清单项模板 |

清单项模板：

```html
<li data-import-item>
  <span data-import-path></span>
  <span data-import-type></span>
  <span data-import-size></span>
  <span data-import-reason></span>
</li>
```

## 11. 预览

| id | 说明 |
| --- | --- |
| `preview-config` | `PROJECT_CONFIG.md` 预览。必须用 `textContent` 写入，禁止 `innerHTML`。 |
| `preview-import-list` | 待导入原文清单预览，同样只用 `textContent` 或 DOM 文本节点。 |
| `btn-copy-preview` | 复制 Markdown 预览。 |

## 12. 校验摘要与动作

| id | 说明 |
| --- | --- |
| `validation-summary` | 校验摘要。控制器用 `textContent` 写入。 |
| `btn-generate` | 唯一主要动作“生成任务”，`type="submit"`。生成中设置 `disabled`。 |
| `btn-reset` | 重置，`type="button"`。 |

## 13. 状态与确认

| id | 说明 |
| --- | --- |
| `status-panel` | 状态容器。控制器写 `data-status`、`data-completion` 和 `data-partial`。 |
| `status-title` | 状态标题 |
| `status-message` | 状态说明 |
| `status-details` | 失败细节列表，控制器清空后追加元素 |
| `confirm-replace-panel` | 非空配置替换确认 |
| `confirm-replace-message` | 确认说明 |
| `btn-confirm-replace` | 确认替换并备份 |
| `btn-cancel-replace` | 取消替换 |

`status-panel` 的 `data-status` 只能是：

- `idle`
- `generating`
- `success`
- `warning`
- `failure`

`data-completion` 只能是：

- 空字符串
- `ready` → 完成，可以启动
- `waiting-source` → 配置已生成，等待原文
- `not-generated` → 未生成 / 未生成，已回滚 / 生成未完成，存在部分写入

`data-partial` 只能是 `true` 或 `false`。部分写入失败为 `true`，成功、取消、完全回滚和零写入失败为 `false`。

失败标题由 `mapGenerateResult()` 决定，不得只根据 `ok` 显示笼统的“未生成”：

- 零写入失败或用户取消：`未生成`
- 失败且回滚成功：`未生成，已回滚`
- 失败且仍有残留：`生成未完成，存在部分写入`

写入阶段的 `NotAllowedError` 不是用户取消，必须走失败与回滚报告。

`nld-config-app` 的 `data-busy` 只能是 `true` 或 `false`。

无效字段使用 `data-invalid="true"` 和 `aria-invalid="true"`。角色冲突项使用 `data-conflict="true"`。显示/隐藏只使用 `hidden` 属性，不依赖视觉 class。

## 14. 控制器监听的事件

原生事件：

- 表单 `input` / `change`：更新预览和校验提示
- 表单 `submit`：生成任务
- `btn-reset` `click`：重置
- `btn-select-files` / `btn-select-folder` `click`：打开对应隐藏 input
- `input-select-files` / `input-select-folder` `change`：累积待导入清单
- `btn-clear-imports` `click`
- 特别注意的 `click`（`data-note-action`）
- `btn-confirm-replace` / `btn-cancel-replace` `click`
- `btn-copy-preview` `click`

自定义事件（发到 `#nld-config-app`）：

- `nld:draft-change`
- `nld:validation-change`
- `nld:import-change`
- `nld:generate-start`
- `nld:generate-complete`
- `nld:status-change`

## 15. 禁止事项

- 不得把用户输入赋给 `innerHTML`。
- 不得改脚本顺序或改成 ES Module。
- 不得删除本契约中的 id / name / data-*。
- 不得把分析粒度改成可编辑高级设置。
- 不得新增第二套配置格式。
