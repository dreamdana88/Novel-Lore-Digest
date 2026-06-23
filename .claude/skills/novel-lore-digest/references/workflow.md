# Novel Lore Digest Claude Code Workflow

本说明用于 Claude Code Skill `novel-lore-digest`。执行任何分析、归并或输出前，必须先读取项目根目录的 `PROJECT_CONFIG.md`。

## 项目根目录资源

- `prompts/`：分阶段工作流提示词，从启动、准备文本到 SillyTavern 输出。
- `templates/`：局部笔记、角色分析、世界书条目、篇章、物种模板，以及星辰工坊角色卡模板（`starforge-主角色卡-template.md` 主角 `<Character_>`、`starforge-配角NPC卡-template.md` 配角 `<NPC_>`）。
- `scripts/`：辅助脚本，职责见下表。
- `index/`：文本索引、分析计划、角色出场表、分析进度、待核查清单、下一步。
- `entities/`：归并后的角色、世界观规则、物种、地点、组织、物品、关系、时间线。
- `outputs/`：剧情大纲、世界观设定集、关系网、SillyTavern 世界书和角色卡。

## 脚本职责（避免重复或误用）

| 脚本 | 职责 | 何时用 | 运行方式 |
| --- | --- | --- | --- |
| `init_project_config.py` | 仅当 `PROJECT_CONFIG.md` 不存在时生成空白模板，不覆盖 | 全新项目首次 | AI 或人类 |
| `new_project_wizard.py` | 交互问答逐项填写 `PROJECT_CONFIG.md` | 人类想用问答方式填配置 | **仅限人类在终端运行**（含 `input()`，agent 直接跑会卡住） |
| `prepare_sources.py` | 清洗 `source_raw/` 拆分到 `source/`，生成 `index/文本索引.md` | 准备文本阶段 | AI 或人类 |
| `check_progress.py` | 统计局部笔记完成/缺口，写 `index/分析进度.md` | 批量做局部笔记时查缺 | AI 或人类 |
| `next_step.py` | 判断全局阶段，写 `index/下一步.md`（建议动作+口令+状态） | 懒人模式"继续下一步"的第一步 | AI 或人类 |
| `export_worldbook_for_starforge.py` | 从世界书提取可导入块到 `exports/star-forge-import/` | "同步到酒馆" | AI 或人类 |
| `merge_character_cards.py` | 把 `outputs/SillyTavern角色卡/` 单卡汇总到 `outputs/SillyTavern角色卡汇总.md`（主角在前） | 角色卡全部生成后 | AI 或人类 |
| `reset_to_template.py` | 清空本项目所有分析内容、还原为空白模板 | 想把当前文件夹清干净复用 | 人类确认后运行（含确认提示） |

区分要点：`init_project_config.py` 只建空模板、不问问题，`new_project_wizard.py` 才做交互问答；`check_progress.py` 只看局部笔记完成度，`next_step.py` 看全局阶段并给下一条口令——懒人模式优先用 `next_step.py`。

## 建议流程（单一真源；AGENTS.md / CLAUDE.md / SKILL.md 只给概览，细节以本节为准）

1. 读取 `PROJECT_CONFIG.md`，确认作品类型、目标角色、分析重点、输出目标和特别注意。
2. 根据 `prompts/00_启动项目.md` 确认本轮只做计划还是进入某个阶段。
3. 原文放入 `source_raw/` 后，使用 `prompts/01_准备文本.md` 或运行 `python scripts/prepare_sources.py`。
4. 读取 `PROJECT_CONFIG.md` 与 `index/文本索引.md`，使用 `prompts/02_判断结构与分类.md` 生成 `index/分析计划.md`。
5. 使用 `prompts/03_生成局部笔记.md` 和 `templates/local-note-template.md`，逐个 source 文件生成局部笔记。
   - 每个「角色信息增量」必须填「经典/典型对话台词」（目标角色 3-8 条、配角 1-5 条，含场景/特征/来源）；本篇无台词则写"本篇无直接台词"。
   - 旧笔记缺台词时，用 `prompts/回填台词语料.md`（口令"回填台词"）重读原文补全，缺口标【待回填语料】。
6. 使用 `prompts/04_角色出场统计.md` 生成 `index/角色出场表.md`。
7. 使用 `prompts/05_主要角色归并.md` 生成 `entities/characters.md`（含台词语料、social_mask 公我/私我/极限反应等可推断字段）。
8. 使用 `prompts/06_世界观归并.md` 生成世界观实体文件。
9. 使用 `prompts/07_剧情大纲与时间线.md` 生成剧情大纲、时间线和剧情索引。
10. 使用 `prompts/08_输出SillyTavern世界书.md` 生成世界书；使用 `prompts/09_输出SillyTavern角色卡.md` 生成角色卡。
    - 角色卡按层级分流：主要角色→`templates/starforge-主角色卡-template.md`（`<Character_>` XML），次要配角→`templates/starforge-配角NPC卡-template.md`（`<NPC_>` XML）。
    - 每张卡含世界书条目头（条目名称/关键词/插入位置/插入顺序/激活策略），语料优先用原文台词，缺口标【待回填语料】。
    - 小说不写的纯设定字段（生日/体香/贞操/about_user/charm_reframing/safety_valve）保留【需自行补充】，不编造；来源放卡末「来源附录」。
11. 使用 `prompts/10_归并角色卡.md` 或运行 `python scripts/merge_character_cards.py`，把单卡汇总到 `outputs/SillyTavern角色卡汇总.md`（主角在前）。

## 星辰工坊规范依据

角色卡 / 世界书模板的格式依据存放在 `references/星辰工坊规范/`（项目内存档，无需外部预设）：什么是世界书、创世-世界书规范、捏人-主角色规范、捏人-配角NPC规范。

## 质量要求

- 每条重要结论必须有来源（来源只放在分析层 notes/entities 和输出文件的来源对照/来源附录，**不进可导入的世界书条目内容与角色卡 XML 正文**）。
- 【世界内视角铁律·仅限输出层】世界书条目内容、角色卡 XML 正文必须客观、世界内书写：不出现"原著/小说/作者/本篇/被写作"等元叙事，不用篇目/章节标题当事件名（如"泉先儿事件"应改为描述事件本身）。分析层（notes/entities）不受此限，可照常标来源。
- 不确定信息标注【待核查】；小说未提供的纯设定字段标【需自行补充】；缺语料标【待回填语料】。
- 不要修改 `source_raw/`。
- 不要跳过局部笔记。
- 单篇特例不能直接变成全局规则。
- 输出应适合后续整理为 SillyTavern 世界书和角色卡。