# Novel Lore Digest Workflow Reference

本说明是 Codex 与 Claude Code 共用的 `novel-lore-digest` 工作流单一真源。执行任何任务前，先读取项目根目录的 `PROJECT_CONFIG.md`，再根据配置选择工作流。

## 数据生命周期

| 类别 | 路径 | 谁写入 | 用途 |
| --- | --- | --- | --- |
| Project Entry | `README.md`、`AGENTS.md`、`PROJECT_CONFIG.md` | 用户 / 维护者 | 项目入口、公共规则和作品配置 |
| Agent Compatibility | `.agents/`、`.claude/`、`CLAUDE.md` | 维护者 | 平台发现入口；不保存工作流核心副本 |
| Workflow Definition | `prompts/`、`templates/`、`references/` | 维护者 | 阶段行为、固定结构和按需规范 |
| Runtime Input | `source_raw/` | 用户 | 原始小说备份，只读 |
| Intermediate Workspace | `workspace/source/`、`workspace/index/`、`workspace/notes/`、`workspace/entities/` | 脚本 / Agent | 处理文本、导航状态、局部笔记和全局归并 |
| Final Output | `outputs/` | Agent / 导出脚本 | 复查文档、SillyTavern 作品卡 |
| Tooling | `scripts/` | 维护者 | 确定性预处理、检查、归并、导出和重置 |
| Evaluation | `evals/` | 维护者 | Skill 触发质量样例 |

## 项目根目录资源

- `prompts/`：分阶段提示词，按 `00` 到 `11` 顺序使用。
- `templates/`：项目配置、局部笔记、角色分析、世界书、篇章、物种模板，以及星辰工坊角色卡模板（`starforge-主角色卡-template.md` 主角 `<Character_>`、`starforge-配角NPC卡-template.md` 配角 `<NPC_>`）。
- `scripts/`：辅助脚本，职责见下表。
- `workspace/index/`：文本索引、分析计划、角色出场表、进度、待核查清单、下一步。
- `workspace/entities/`：全局归并后的角色、地点、组织、物种、物品、规则、关系、时间线。
- `outputs/`：剧情大纲、文风条目、世界观设定集、SillyTavern 世界书和角色汇总。

## Prompt 阶段矩阵

| Prompt | 阶段 | 主要读取 | 主要写入 | 模板 / 参考 / 脚本 | 下一阶段 |
| --- | --- | --- | --- | --- | --- |
| `00_启动项目.md` | 配置确认 | `PROJECT_CONFIG.md` | 无 | `AGENTS.md` | 准备文本 |
| `01_准备文本.md` | 文本预处理 | `source_raw/` | `workspace/source/`、`workspace/index/文本索引.md` | `prepare_sources.py` | 分析计划 |
| `02_判断结构与分类.md` | 结构分类 | 配置、文本索引 | `workspace/index/分析计划.md` | 无 | 局部笔记 |
| `03_生成局部笔记.md` | 局部分析 | 指定处理文本、配置 | `workspace/notes/` | `local-note-template.md` | 出场统计 |
| `04_角色出场统计.md` | 导航索引 | 全部局部笔记 | `workspace/index/角色出场表.md` | 无 | 角色归并 |
| `05_主要角色归并.md` | 角色归并 | 局部笔记、出场表、配置 | `workspace/entities/characters.md` | `character-template.md` | 世界观归并 |
| `06_世界观归并.md` | 实体归并 | 全部局部笔记 | `workspace/entities/` | `species-template.md`（物种需要时） | 配置选择的条件输出 |
| `07_剧情大纲与时间线.md` | 条件全局剧情 | 配置、局部笔记、实体 | 被选择的剧情大纲、时间线与剧情索引 | 无 | 文风或 SillyTavern 输出 |
| `07_生成文风条目.md` | 条件文风蒸馏 | 配置、局部笔记、实体、代表性原文 | `outputs/文风条目.md` | 蜃灵文风条目结构 | SillyTavern 输出 |
| `08_输出SillyTavern世界书.md` | 世界书输出 | 实体、局部笔记 | `outputs/SillyTavern世界书.md` | 世界书模板、星辰工坊世界书规范 | 角色汇总 |
| `09_输出SillyTavern角色汇总.md` | 角色输出 | 角色实体、配置 | `outputs/SillyTavern角色汇总/` | 主角色卡 / NPC 卡模板及规范 | 汇总核查 |
| `10_归并角色卡.md` | 核查汇总 | 单角色文件 | `outputs/SillyTavern角色汇总.md` | `merge_character_cards.py` | 最终导出 |
| `11_导出SillyTavern作品角色卡.md` | 最终导出 | 世界书、角色汇总、配置 | `outputs/sillytavern-story-card/` | `export_story_card_for_sillytavern.py` | 一致性检查 |
| `一键启动.md` / `继续下一步.md` | 状态导航 | 配置与当前工作区 | `workspace/index/下一步.md` 等当前阶段产物 | `next_step.py`、当前阶段 Prompt | 由状态决定 |
| `试跑三篇.md` | 局部验证 | 分析计划、三个样本 | 三份局部笔记 | 局部笔记模板 | 批量局部笔记 |
| `回填台词语料.md` | 语料补全 | 原文与既有局部笔记 | 更新指定局部笔记、分析进度 | `check_progress.py` | 原阶段 |
| `同步到酒馆.md` | 导出导航 | 配置、世界书、角色汇总 | 作品角色卡及检查报告 | `export_story_card_for_sillytavern.py` | 完成 |

## 脚本职责（避免重复或误用）

| Script | 用途 | 输入 | 输出 | 默认路径 | 被谁调用 |
| --- | --- | --- | --- | --- | --- |
| `init_project_config.py` | 缺失时创建配置，不覆盖 | 配置模板 | `PROJECT_CONFIG.md` | `templates/project-config-template.md` → 根目录 | 新项目用户 / Agent |
| `prepare_sources.py` | 编码识别、清洗、拆分、索引 | `source_raw/` 的 txt/md | 处理文本、文本索引 | `workspace/source/`、`workspace/index/文本索引.md` | Prompt 01 / 用户 |
| `check_progress.py` | 比对处理文本和局部笔记 | 处理文本、三类局部笔记 | 分析进度 | `workspace/index/分析进度.md` | 回填 Prompt / 批量分析 / 用户 |
| `next_step.py` | 判断当前全局阶段 | 配置及各生命周期目录状态 | 建议动作、口令、状态快照 | `workspace/index/下一步.md` | Skill 懒人模式 / 启动与继续 Prompt |
| `merge_character_cards.py` | 纯拼接单角色文件供核查 | `outputs/SillyTavern角色汇总/` | 核查汇总 | `outputs/SillyTavern角色汇总.md` | Prompt 10 / 用户 |
| `export_story_card_for_sillytavern.py` | 打包内嵌世界书作品卡 | 配置、世界书、角色汇总 | Character Card V2 JSON、检查报告 | `outputs/sillytavern-story-card/` | Prompt 11 / 同步 Prompt / 用户 |
| `reset_to_template.py` | 清空输入、工作区和输出并还原空白配置 | 配置模板、人工确认 | 空白可复用项目 | `source_raw/`、`workspace/`、`outputs/` | **仅限人类确认后运行** |

区分要点：`init_project_config.py` 只在缺失时建立空模板；根目录 HTML 配置生成器负责交互填写；`check_progress.py` 只看局部笔记完成度，`next_step.py` 看全局阶段并给下一条口令——懒人模式优先用 `next_step.py`。

## 建议执行顺序（单一真源；AGENTS.md / CLAUDE.md / SKILL.md 只给概览，细节以本节为准）

1. 读取 `PROJECT_CONFIG.md`，确认作品类型、目标角色、输出目标和特别注意。
2. 使用 `prompts/00_启动项目.md` 确认本轮工作不直接分析正文。
3. 把原文放入 `source_raw/` 后，使用 `prompts/01_准备文本.md` 或运行 `python scripts/prepare_sources.py`。
4. 基于 `PROJECT_CONFIG.md` 与 `workspace/index/文本索引.md`，使用 `prompts/02_判断结构与分类.md` 生成分析计划。
5. 使用 `prompts/03_生成局部笔记.md` 和 `templates/local-note-template.md`，逐个 `workspace/source/` 文件生成局部笔记。
   - 每个「角色信息增量」必须填「经典/典型对话台词」（目标角色优先 2-5 条、重要配角 1-3 条，含场景/特征/来源）；本篇无台词则写"本篇无直接台词"。
   - 旧笔记缺台词时，用 `prompts/回填台词语料.md`（口令"回填台词"）重读原文补全，缺口标【待回填语料】。
6. 使用 `prompts/04_角色出场统计.md` 生成 `workspace/index/角色出场表.md`。
7. 使用 `prompts/05_主要角色归并.md` 与 `prompts/06_世界观归并.md` 生成 `workspace/entities/` 文件（角色含台词语料、social_mask 公我/私我/极限反应等可推断字段）。
8. 读取 `PROJECT_CONFIG.md` 的输出目标。`分析重点`只表示优先深挖什么；`输出目标`才决定生成哪些可带走成品。两者独立，互不改写。
9. 按输出目标生成用户成品；选「否」的项不是完成门槛，也不得继续提示去生成。
   - 剧情大纲=是：使用 `prompts/07_剧情大纲与时间线.md` 生成 `outputs/剧情大纲.md`。
   - 时间线=是：同一 Prompt 生成 `workspace/entities/timeline.md`（时间线成品；若世界书还需要时间线作中间资料，可在 `workspace/` 保留，但不得把未选择的成品当成最终输出）。
   - 文风条目=是：使用 `prompts/07_生成文风条目.md` 生成 `outputs/文风条目.md`；条目正文可直接供蜃灵使用，证据写在来源附录。
   - 若上述均为否，跳过本步对应成品。
10. SillyTavern 阶段按世界书/角色汇总组合执行：
    - 是/是：08 世界书 → 09 角色汇总 → 10 归并核查 → 11 导出作品角色卡 JSON。
    - 是/否：只执行世界书；跳过角色汇总、归并和最终 JSON。
    - 否/是：跳过世界书；执行角色汇总和归并；跳过依赖两类材料的最终 JSON。
    - 否/否：跳过 08–11。
    - 最终作品角色卡 JSON 仅在世界书和角色汇总都为「是」时生成。不要发明半成品 JSON。
    - 角色汇总按层级分流：主要角色→`templates/starforge-主角色卡-template.md`（`<Character_>` XML），次要配角→`templates/starforge-配角NPC卡-template.md`（`<NPC_>` XML）。
    - 每个角色文件含世界书条目头（条目名称/关键词/插入位置/插入顺序/激活策略），语料优先用原文台词，缺口标【待回填语料】。
    - 小说不写的纯设定字段保留【需自行补充】，不编造；来源放卡末「来源附录」。
    - `outputs/SillyTavern角色汇总.md` 只是复查和第 11 步输入之一，不是最终导入物。
    - 最终 JSON 以作品名命名，所有内容写入内嵌 `character_book.entries`；角色卡本体字段保持空字符串。
11. 全部输出均为「否」时，实体归并完成后即为基础整理完成，不再要求任何 `outputs/` 成品。
12. 一致性检查或待核查清单只覆盖本轮实际选择的成品。

## 输出规范依据

- 角色生成规则：`prompts/09_输出SillyTavern角色汇总.md`。
- 角色字段结构与分档要求：`templates/starforge-主角色卡-template.md`、`templates/starforge-配角NPC卡-template.md`、`templates/starforge-角色清单-template.md`；不另维护重复的原始角色规范。
- 世界书机制与构建依据：`references/星辰工坊规范/什么是世界书.yaml`、`references/星辰工坊规范/创世-世界书规范.txt`（项目内存档，无需外部预设）。

## 证据与范围

- 所有重要结论必须有来源文件、篇目、章节或局部笔记依据（来源只放 `workspace/notes/`、`workspace/entities/` 与输出文件的来源对照/来源附录，**不进可导入的世界书条目内容与角色卡 XML 正文**）。
- 【世界内视角铁律·仅限输出层】世界书条目内容、角色卡 XML 正文必须客观、世界内书写：不出现"原著/小说/作者/本篇/被写作"等元叙事，不用篇目/章节标题当事件名（如"泉先儿事件"应改为描述事件本身）。分析层（`workspace/notes/`、`workspace/entities/`）不受此限。
- 不确定信息标注为【待核查】；小说未提供的纯设定字段标【需自行补充】；缺语料标【待回填语料】。
- 不要修改 `source_raw/`。
- 不要跳过局部笔记直接生成最终设定。
- 单篇特例只能作为特例记录，不能直接归并为全局规则。

## Agent 兼容维护

- `AGENTS.md` 是公共 Agent 项目规则的唯一事实来源。
- `CLAUDE.md` 只通过 `@AGENTS.md` 引入公共规则。
- `.agents/` 与 `.claude/` 各保留一个平台发现所需的薄 `SKILL.md`；两者不复制详细工作流。
- 本文件是详细阶段、路径生命周期和脚本职责的唯一事实来源；Prompt 只维护本阶段的具体执行要求。
