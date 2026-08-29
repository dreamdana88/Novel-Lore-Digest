# Novel Lore Digest 配置生成器执行计划

## 1. 目标

为 Novel Lore Digest 增加一个根目录可见、双击即可使用的本地配置生成器，让非技术用户不再手动编辑 `PROJECT_CONFIG.md`。

完整用户流程：

1. 双击根目录的 `启动-novel-lore-digest.html`。
2. 填写作品信息、作品类型、分析重点和目标角色。
3. 页面实时提示必填缺口。
4. 可选：选择小说文件或小说文件夹；用户也可以自行把原文放入 `source_raw/`。
5. 预览即将生成的 `PROJECT_CONFIG.md` 和待导入原文清单。
6. 点击“生成任务”。
7. 浏览器弹出目录授权窗口；用户选择当前 Novel Lore Digest 项目根目录。
8. 页面自动把 `PROJECT_CONFIG.md` 写入项目根目录，并把本次选择的小说复制到 `source_raw/`。
9. 页面给出明确的成功、警告或失败结果。
10. 用户对 Agent 说：`启动 Novel Lore Digest`。

这里不引入第二份 `to-do.md`、需求文件或配置格式。`PROJECT_CONFIG.md` 继续作为项目配置的唯一事实来源，Agent 和现有工作流不增加翻译步骤。

## 2. 实施顺序与责任边界

本功能必须串行施工，不允许 Grok 和 Gemini 同时编辑同一批文件。

### 阶段 A：Grok 完成核心逻辑和朴素可用版

Grok 负责：

- 配置数据模型、Markdown 生成和校验。
- 文件与文件夹选择后的原文清单整理。
- 项目根目录识别和浏览器目录授权。
- `PROJECT_CONFIG.md` 写入。
- 原文复制到 `source_raw/`。
- 冲突检测、备份、错误报告和安全边界。
- DOM 控制器与冻结的 DOM 接口契约。
- 自动化测试。
- 一个结构完整、功能可操作但不追求视觉效果的 HTML/CSS 骨架。

阶段 A 的目标是“功能完整并通过验收”，不是“页面漂亮”。在核心验收通过前，不得交给 Gemini。

### 阶段 B：Gemini 只完成视觉页面

Gemini 只负责：

- 根目录 HTML 的视觉结构、信息层级和无障碍标记。
- CSS 视觉设计、响应式布局、状态样式和动效。
- 在不改变功能契约的前提下改善表单可用性。

Gemini 禁止：

- 修改任何 JavaScript 文件。
- 修改测试、README、工作流、Prompt 或 Python 脚本。
- 改名、删除或复用 DOM 契约规定的 `id`、`name`、`data-*`、状态容器和按钮。
- 加入 React、Vue、Tailwind、jQuery、在线字体、CDN 或构建系统。
- 把用户输入通过 `innerHTML` 注入页面。
- 改变配置字段、默认值、校验规则、写入顺序或冲突策略。

### 阶段 C：Grok 回归验收和收尾

Gemini 完成页面后，Grok 再负责：

- 重跑全部自动化测试。
- 在 Edge/Chrome 做真实本地文件写入验收。
- 检查 Gemini 是否破坏 DOM 契约、键盘操作或错误状态。
- 更新 README、`references/workflow.md` 和重置/初始化提示。
- 最终验收通过后删除旧的 `scripts/new_project_wizard.py` 及其文档引用。

不得为了保留旧行为增加兼容层。网页生成器通过最终验收后，终端交互向导即视为过时入口并删除；`scripts/init_project_config.py` 职责不同，继续保留。

## 3. 技术约束

### 3.1 运行形态

- 这是离线静态页面，不启动后端服务器。
- 所谓“核心/后端”是运行在浏览器内、与视觉层分离的 JavaScript 逻辑。
- 根目录入口必须能通过 `file://` 双击打开。
- 使用经典 `<script>` 和普通 `<link>`，不要依赖本地 HTTP 服务、ES Module 跨文件加载或远程资源。
- 支持最新版 Microsoft Edge 和 Google Chrome。
- 页面启动时检测 `window.showDirectoryPicker` 和安全上下文；不支持时明确提示改用 Edge/Chrome，不实现“下载后手动搬运”的备用流程。
- 浏览器必须在用户点击“生成任务”后弹出目录选择器。不得声称能够静默推断或自动获得 HTML 所在目录的写权限。

### 3.2 建议文件结构

```text
启动-novel-lore-digest.html
tools/
└── project-config-generator/
    ├── project-config-generator-core.js
    ├── project-config-generator-core.test.cjs
    ├── project-config-generator-filesystem.js
    ├── project-config-generator-filesystem.test.cjs
    ├── project-config-generator-controller.js
    ├── project-config-generator.css
    └── project-config-generator-contract.md
```

职责说明：

- `启动-novel-lore-digest.html`：唯一人类入口，根目录可直接发现。
- `project-config-generator-core.js`：纯数据逻辑；不得访问 DOM 或文件系统。
- `project-config-generator-filesystem.js`：File System Access API、根目录校验、备份和复制。
- `project-config-generator-controller.js`：把 DOM 事件、核心函数和文件系统函数连接起来。
- `project-config-generator.css`：视觉层；阶段 B 由 Gemini 重点编辑。
- `project-config-generator-contract.md`：Grok 写入并冻结的 DOM 与状态契约，Gemini 必须遵守。

各文件通过一个明确的全局命名空间公开所需 API，例如 `window.NovelLoreDigestConfigGenerator`。同时可用 `module.exports` 暴露纯函数供 Node 内置测试运行。禁止使用第三方依赖。

## 4. 配置模型

网页必须覆盖当前 `PROJECT_CONFIG.md` 的有效字段。

### 4.1 作品基本信息

- 作品名：必填。
- 作者：必填；不知道时由用户明确填写“不详”，不得自动猜测。
- 语言：默认“中文”，允许修改。
- 文本来源：选填。
- 分析日期：默认当前本地日期，允许修改。

### 4.2 作品结构类型

支持多选：

- 单元故事型
- 连续长篇型
- 系列长篇型
- 案件单元型
- 冒险篇章型
- 群像史诗型
- 奇幻世界观型
- 都市奇幻型
- 民俗悬疑型
- 灵异调查型
- 其他，附带自由文本

至少选择一项预置类型或填写“其他”。

### 4.3 分析重点

支持多选当前模板中的全部项目：

- 主要角色人设
- 角色关系网
- 世界观设定
- 剧情大纲
- 时间线
- 组织/势力
- 地点地图
- 物种/妖怪/异类规则
- 能力系统
- 民俗/宗教/禁忌
- 悬疑伏笔
- 文风分析
- SillyTavern 世界书
- SillyTavern 角色汇总

至少选择一项。

### 4.4 目标角色

提供三个可动态增加、删除和排序的列表：

- 需要深度分析的主要角色。
- 只需简要记录的角色。
- 暂不分析/忽略的角色。

“需要深度分析的主要角色”至少一项。角色名去除首尾空白；同一角色不能同时出现在多个分组，冲突必须显示在对应输入附近。

### 4.5 分析粒度

第一版只显示并生成当前有效默认值：

- 默认分块大小：`12000-15000 中文字`
- 超大章节是否拆分：`是`
- 是否保留上下文 overlap：`是`
- overlap 字数：`500`

这些值当前由 `scripts/prepare_sources.py` 硬编码，第一版页面不得把它们伪装成已经生效的可编辑高级设置。把脚本改成读取这些配置属于后续独立需求，不在本计划扩展范围内。

### 4.6 输出目标

- 是否生成 SillyTavern 世界书
- 是否生成 SillyTavern 角色汇总
- 是否生成剧情大纲
- 是否生成时间线
- 是否生成关系网
- 是否生成文风条目

输出目标与分析重点使用一套确定性规则：

- 输出目标选择“是”时，对应项目自动加入“分析重点”。
- 输出目标选择“否”时，不擅自删除用户因为分析需要而单独选择的重点。
- 最终预览必须同时展示两个区域，让用户能发现不符合预期的组合。

### 4.7 特别注意

- 支持多条动态输入。
- 一条要求生成一个 Markdown 列表项。
- 空项不输出。
- 不把模板中的示例句误当成用户已经选择的要求。

## 5. Markdown 生成契约

`project-config-generator-core.js` 至少公开以下纯函数：

```js
normalizeTaskDraft(rawDraft)
validateTaskDraft(draft)
renderProjectConfig(draft)
```

要求：

- 输出 UTF-8 文本，换行统一为 `\n`，文件末尾保留一个换行。
- 标题和字段标签必须与现有 `PROJECT_CONFIG.md` 及 `scripts/next_step.py` 的解析约定一致。
- 所有列表顺序稳定，重复项去重但保持首次出现顺序。
- 单行字段中的换行被规范为空格；不得让用户输入破坏下一字段。
- 角色和特别注意内容按独立列表项输出。
- 预览使用 `textContent` 或等价安全方式，不把输入当 HTML。
- 相同数据重复生成必须得到字节一致的 Markdown；日期除外，日期应在草稿初始化时确定，渲染函数内不得读取当前时间。
- 不生成 `to-do.md`、JSON、YAML 或另一份中间配置。

## 6. 原文选择与导入

### 6.1 选择方式

页面提供两个入口：

- “选择小说文件”：支持多选 `.txt`、`.md`。
- “选择小说文件夹”：支持递归选择，保留所选文件夹名和内部相对目录。

选择后只建立待导入清单，不立即写入项目：

- 显示相对路径、类型和大小。
- 忽略非 `.txt`/`.md` 文件，并单独显示忽略数量。
- 大小统计不得读取或解码全部文件内容。
- 文件复制必须按二进制 Blob/File 写入，不能先按文本解码再编码，避免改变原文字节。
- 多次选择产生相同目标路径时必须在生成前报冲突。

原文选择是可选项。用户已经手动把原文放入 `source_raw/` 时，只生成配置也算合法操作。

### 6.2 项目根目录确认

点击“生成任务”后调用：

```js
window.showDirectoryPicker({ mode: "readwrite", id: "novel-lore-digest-project-root" })
```

所选目录必须通过身份检查，至少确认这些项目结构存在：

- `AGENTS.md`
- `scripts/next_step.py`
- `templates/project-config-template.md`
- `source_raw/`

任一缺失时停止，不创建相似目录，不尝试猜测父目录或子目录，并提示“请选择 Novel Lore Digest 项目根目录”。

### 6.3 写入顺序

“生成任务”必须执行完整预检后再写入：

1. 再次执行表单校验。
2. 获取并验证项目根目录句柄。
3. 检查 `PROJECT_CONFIG.md` 当前内容。
4. 枚举全部待写入原文目标，检查路径合法性和同名冲突。
5. 检查浏览器读写权限。
6. 如已有非空配置，进入明确的备份确认流程。
7. 复制本次选择的原文。
8. 最后写入新的 `PROJECT_CONFIG.md`。
9. 重新读取写入结果，检查内容与预览一致。
10. 检查 `source_raw/` 最终是否至少包含一个 `.txt` 或 `.md`。

把配置放在最后写入，避免原文复制中途失败时留下一个看似已经可以启动的新配置。

### 6.4 冲突与备份

- 不覆盖 `source_raw/` 中任何既有同名文件。
- 只要有一个原文目标冲突，整次生成在写入前停止并列出全部冲突。
- 不提供“全部覆盖原文”按钮。
- 如果现有 `PROJECT_CONFIG.md` 与空白模板不同，必须显示替换确认。
- 用户确认替换后，把旧配置备份到 `workspace/index/config-backups/PROJECT_CONFIG-YYYYMMDD-HHMMSS.md`。
- 备份失败则停止，不覆盖旧配置。
- 用户取消目录授权、替换确认或任意文件选择，不应被当作程序错误。

### 6.5 完成状态

页面只能显示以下明确状态之一：

- `完成，可以启动`：配置写入并验证成功，且 `source_raw/` 最终存在可用原文。
- `配置已生成，等待原文`：配置写入并验证成功，但用户未上传且 `source_raw/` 没有可用原文。
- `未生成`：校验失败、用户取消、目录错误、冲突或写入失败。

失败时必须列出具体阶段、文件和浏览器错误信息。不得只显示“出错了”。

## 7. DOM 契约与 Gemini 交接

Grok 必须在 `project-config-generator-contract.md` 中记录并冻结：

- 每个字段的 `id`/`name`/`data-field`。
- 三类角色列表的容器和项目结构。
- 文件、文件夹选择按钮。
- Markdown 预览容器。
- 校验摘要与逐字段错误容器。
- 待导入、已忽略和冲突文件清单容器。
- “生成任务”和“重置”按钮。
- 浏览器兼容提示。
- 生成中、成功、警告、失败状态容器。
- JavaScript 文件加载顺序。
- 控制器会监听或修改的 class、属性和自定义事件。

控制器应优先依赖稳定的 `id` 和 `data-*`，不要依赖视觉 class、DOM 层级或 `nth-child`。Gemini 可以改变布局和视觉 class，但不能改变契约字段。

## 8. 自动化测试

不新增 npm 包。使用 Node 内置测试运行器：

```powershell
node --test tools/project-config-generator/*.test.cjs
```

### 8.1 核心测试

至少覆盖：

- 最小有效草稿。
- 所有作品结构和所有分析重点。
- 三类目标角色。
- 重复角色和跨组冲突。
- 输出目标与分析重点同步。
- 空格、换行、中文标点、反斜杠和 Markdown 特殊字符。
- 特别注意多条列表。
- 稳定输出和文件末尾换行。
- 完整配置可被 `scripts/next_step.py` 当前校验逻辑识别。

### 8.2 文件系统测试

使用内存 fake handles 测试，不在真实 `source_raw/` 中写测试文件：

- 正确项目根目录。
- 误选父目录、子目录和普通文件夹。
- 空白配置覆盖。
- 非空配置备份成功和备份失败。
- 原文无冲突复制。
- 大小写扩展名。
- 递归相对路径。
- 路径穿越输入被拒绝。
- 一个或多个同名冲突时零写入。
- 复制失败时不写新配置。
- 用户取消授权。

### 8.3 Python 静态验证

Grok 应使用临时目录或测试夹具验证生成文本，不覆盖实际根目录配置。至少确认现有 `next_step.py` 对生成配置不再报告配置缺口。

## 9. 阶段 A 验收门：交给 Gemini 前

只有同时满足以下条件才允许交给 Gemini：

- 全部 Node 测试通过。
- HTML 可在断网状态通过 `file://` 打开。
- Edge 或 Chrome 中能够选择正确项目根目录。
- 能把测试小说复制到测试项目的 `source_raw/`。
- 能生成并回读字节一致的 `PROJECT_CONFIG.md`。
- 没有选择原文时仍能生成配置，并显示“等待原文”。
- 手动已有原文时能识别并显示“可以启动”。
- 选错目录不会写入任何文件。
- 原文冲突不会覆盖。
- 非空配置替换前完成备份。
- `project-config-generator-contract.md` 已完整记录且冻结。
- Git diff 中没有修改 `source_raw/`、现有工作区产物或无关文件。

阶段 A 验收报告使用 `PASS / FAIL / BLOCKED`，必须区分自动化测试、浏览器实测和未执行项。

## 10. Gemini 视觉任务要求

视觉方向：温和、清晰、有“整理长篇小说档案”的工作台感，不做泛用 SaaS 仪表盘，也不要堆积渐变、玻璃拟态和无意义图标。

页面至少包含：

- 根目录入口打开后的醒目标题和三步说明。
- 清晰的配置、原文、预览三个主要区域。
- 桌面端舒适阅读宽度和移动端单栏布局。
- 长表单的阶段导航或进度提示。
- 明确区分必填、选填、默认值和高级只读项。
- 角色动态列表易于增加、删除和辨认分组。
- 原文拖放/选择区域具有待导入、忽略和冲突状态。
- Markdown 预览可滚动、可复制，但不与表单争夺主视觉。
- “生成任务”是唯一主要动作。
- 生成中禁用重复提交。
- 成功、等待原文、冲突、取消和失败都有不同的文字与视觉反馈。
- 完整键盘焦点样式、label 关联、合理对比度和 `prefers-reduced-motion` 支持。

Gemini 交付后不得自行宣称功能验收通过；必须回到阶段 C 由 Grok 重跑功能验收。

## 11. 阶段 C 最终验收

### 11.1 自动化

- `node --test tools/project-config-generator/*.test.cjs`：PASS。
- 与配置相关的现有 Python 静态检查：PASS。
- `git diff --check`：PASS。

### 11.2 真实浏览器

在最新版 Edge 或 Chrome 依次验证：

1. 双击根目录 HTML，页面和样式完整加载。
2. 必填项为空时不能生成，并能定位缺口。
3. 填入最小有效配置并选择单个 `.txt`。
4. 选择正确项目根目录，生成配置并复制原文。
5. 运行 `python scripts/next_step.py`，确认配置通过且识别到原文。
6. 选择一个包含子目录的小说文件夹，确认结构保留。
7. 制造同名原文冲突，确认零覆盖。
8. 使用已有非空配置，确认先备份再替换。
9. 不选择原文、空 `source_raw/` 时，确认显示“配置已生成，等待原文”。
10. 不选择原文、已有手动原文时，确认显示“完成，可以启动”。
11. 选择错误目录，确认未写入。
12. 取消目录选择，确认保持表单和待导入清单，不显示程序异常。

### 11.3 文档和旧入口收尾

- README 的快速开始改为网页生成器流程，同时说明也可手动放原文。
- `references/workflow.md` 的脚本职责和建议顺序更新为新入口。
- `scripts/init_project_config.py`、`scripts/reset_to_template.py` 的提示语指向根目录 HTML。
- 最终验收通过后删除 `scripts/new_project_wizard.py` 以及全部相关说明。
- 不在 `AGENTS.md`、Skill 和多个 Prompt 中复制网页细节；详细规则只放在 workflow/生成器契约中，避免漂移。

## 12. 明确不做

- 不启动 Flask、FastAPI、Node 服务或本地守护进程。
- 不自动运行 `prepare_sources.py`，更不自动开始分析正文。
- 不修改、覆盖或删除既有 `source_raw/` 原文。
- 不支持 `.pdf`、`.docx`、`.epub` 或压缩包；当前工作流只接收 `.txt`/`.md`。
- 不读取小说内容来猜作者、作品类型、角色或分析重点。
- 不把用户选择的原文上传到网络。
- 不保存文件内容到 localStorage/IndexedDB。
- 不在第一版开放尚未接入脚本的分块参数编辑。
- 不增加第二份配置文件或兼容旧向导。
- 不让 Gemini 改功能逻辑。

## 13. 推荐交接话术

### 交给 Grok：阶段 A

```text
请先完整阅读项目根目录的 project-config-generator-execution-plan.md、AGENTS.md、PROJECT_CONFIG.md 和 references/workflow.md。严格执行计划中的阶段 A，只完成核心逻辑、文件系统写入、自动化测试、DOM 契约和朴素可用页面。不要追求最终视觉效果，不要修改 source_raw/ 中的现有内容，不要删除旧向导，也不要提前执行阶段 C。完成后按 PASS / FAIL / BLOCKED 报告自动化测试与真实 Edge/Chrome 验收，并明确是否已经达到“可交给 Gemini”的验收门。
```

### 交给 Gemini：阶段 B

```text
核心功能已经由 Grok 完成。请先阅读 project-config-generator-execution-plan.md 的阶段 B、DOM 契约与视觉要求，以及 tools/project-config-generator/project-config-generator-contract.md。你只能修改根目录的 启动-novel-lore-digest.html 和 tools/project-config-generator/project-config-generator.css。不得修改任何 JavaScript、测试、Python、README、工作流或 Prompt 文件，不得改变契约规定的 id、name、data-*、状态容器、按钮和脚本加载顺序。目标是把现有功能页面设计成清晰、温和、适合整理长篇小说资料的本地工作台。完成后列出你修改的两个文件和视觉变化，不要宣称文件写入功能已经通过验收。
```

### 交回 Grok：阶段 C

```text
Gemini 已完成 HTML/CSS 视觉层。请按 project-config-generator-execution-plan.md 的阶段 C 和最终验收逐项回归，不要默认视觉修改没有破坏功能。重跑全部测试，完成真实 Edge/Chrome 文件写入验收，检查 DOM 契约与无障碍状态；通过后再更新文档、删除旧 new_project_wizard.py 入口，并提交 PASS / FAIL / BLOCKED 验收报告。保留所有无关和既有未跟踪文件。
```

## 14. 完成定义

只有满足以下结果，功能才算真正完成：

- 用户从根目录能直接发现并打开配置生成器。
- 页面可以生成工作流可识别的唯一 `PROJECT_CONFIG.md`。
- 页面可以安全地把用户选择的 `.txt`/`.md` 复制到 `source_raw/`。
- 用户也可以完全跳过网页原文选择，继续手动放置原文。
- 页面不能静默覆盖既有原文或已填写配置。
- 自动化测试和真实 Chromium 文件写入验收均通过。
- Gemini 的视觉修改没有触碰或破坏核心逻辑。
- 文档只宣传已经验证通过的行为。
- 旧终端向导被删除，不留下并行配置入口。
