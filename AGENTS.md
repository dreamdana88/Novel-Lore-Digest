# Novel Lore Digest - Agent Project Rules

本项目是通用长篇小说设定分析工作流，用于分析长篇小说、系列小说、单元故事型小说、案件型小说、冒险型小说、奇幻/民俗/灵异题材小说，并把原文整理为角色人设、世界观设定、剧情大纲、时间线、关系网、SillyTavern 世界书和角色汇总。

## 数据生命周期

- `source_raw/`：用户放入的原始小说，只读备份，始终保留在根目录便于发现。
- `workspace/source/`：清洗、拆分后的处理文本。
- `workspace/index/`：文本索引、分析计划、进度、角色出场表、下一步。
- `workspace/notes/`：按 story/chapter/arc 生成的局部笔记。
- `workspace/entities/`：全局归并后的角色、地点、组织、物种、物品、规则、关系和时间线。
- `outputs/`：用户最终复查、导入或带走的结果；旧版星辰工坊导入块位于 `outputs/star-forge-import/`。

## 核心原则

1. 执行任何分析前，必须先读取 PROJECT_CONFIG.md。
2. 必须确认当前作品类型、分析目标、目标角色和特别注意事项。
3. 只基于 source_raw/ 和 workspace/source/ 中的原文，不凭印象脑补。
4. source_raw/ 是原文备份，禁止改写、覆盖、删除。
5. 每条重要人设、世界观、关系、剧情结论都必须标注来源文件或篇目。
6. 不确定的信息标注为【待核查】。
7. 先做局部笔记，再做全局归并；禁止一开始直接生成最终角色卡或世界书。
8. 单元故事型作品：先生成 workspace/notes/story-notes/。
9. 连续长篇型作品：先生成 workspace/notes/chapter-notes/。
10. 系列/卷/案件/探险篇章型作品：先生成 workspace/notes/arc-notes/。
11. 单篇特例不能直接上升为全局世界观规则。
12. 重点服务 PROJECT_CONFIG.md 中的目标角色，不要过度深挖只出现一次的配角。
13. 输出语言使用中文，清晰、可操作，适合后续转为 SillyTavern 资料。

## 工作流程

完整阶段流程、脚本职责表、星辰工坊角色卡/世界书输出规范，以**单一真源**维护在：
- `references/workflow.md`（详细阶段 + 数据生命周期 + 脚本职责 + 输出格式）
- `prompts/`（每个阶段的具体提示词：00→11，以及 一键启动 / 继续下一步 / 试跑三篇 / 回填台词 / 同步到酒馆）

执行前先读 workflow.md，按其顺序推进。**不要在本文件重复维护阶段细节，避免漂移。**

阶段骨架（概览）：读配置 → 准备文本 → 分析计划 → 局部笔记（含对话台词） → 角色出场表 → 实体归并 → 剧情/世界观汇总 → SillyTavern 世界书 + 角色汇总（主角 `<Character_>` / 配角 `<NPC_>`） → 角色汇总归并核查 → 导出一张作品名 SillyTavern 作品角色卡 JSON（内容全部内嵌在 `character_book`） → 一致性检查。

## 懒人模式

当用户说：
- “启动 Novel Lore Digest”
- “开始分析这个项目”
- “继续下一步”
- “按流程推进”
- “试跑三篇”
- “生成下一阶段”

你必须自动读取 prompts/一键启动.md 或 prompts/继续下一步.md，并根据当前项目状态决定执行哪一步。

不要要求用户重复粘贴长提示词。
不要让用户手动判断该执行哪个阶段。
如果缺少必要信息，直接列出缺失项并询问。

当用户说“回填台词”或“回填语料”时，读取 prompts/回填台词语料.md，为已有局部笔记重读原文补全对话台词，缺口标【待回填语料】，不要编造。

当用户说：
- “同步到酒馆”
- “导出世界书导入块”
- “准备星辰工坊导入”

你必须读取 prompts/同步到酒馆.md。默认优先运行 `python scripts/export_story_card_for_sillytavern.py`，生成 `outputs/sillytavern-story-card/{作品名}.json`；只有用户明确要求“导出世界书导入块”或“准备星辰工坊导入”时，才运行 `python scripts/export_worldbook_for_starforge.py`。不要直接修改 SillyTavern 存档或世界书数据库。


