# Novel-Lore-Digest

Novel-Lore-Digest 是一个可复用的长篇小说设定分析工作流框架，用于把小说原文逐步整理为角色人设、世界观设定、剧情大纲、时间线、关系网、SillyTavern 世界书和 SillyTavern 角色汇总。

## 三分钟开始

1. 填写 `PROJECT_CONFIG.md`：作品类型、分析重点、目标角色和输出目标。
2. 把小说 `.txt` 或 `.md` 放进 `source_raw/`；该目录是只读原文备份。
3. 在 Codex 或 Claude Code 中说：`启动 Novel Lore Digest`。
4. 此后按提示说：`继续下一步`。中断后也使用同一句，脚本会从 `workspace/index/下一步.md` 恢复导航。

最终可导入 SillyTavern 的作品卡位于：

```text
outputs/sillytavern-story-card/{作品名}.json
```

## 支持的作品类型

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
- 其他混合结构

## 工作流主要阶段

1. 第一步：填写 `PROJECT_CONFIG.md`，包括作品名、作品结构类型、分析重点、目标角色和输出目标。
2. 第二步：把小说原文放进 `source_raw/`。这个目录是原始备份，不要改写。
3. 第三步：运行 `python scripts/prepare_sources.py`，将原文清洗并拆分到 `workspace/source/`，同时生成 `workspace/index/文本索引.md`。
4. 第四步：使用 `prompts/02_判断结构与分类.md` 生成 `workspace/index/分析计划.md`。
5. 第五步：使用 `prompts/03_生成局部笔记.md`，逐篇、逐章或逐块生成局部笔记。
6. 第六步：使用 `prompts/04_角色出场统计.md` 到 `prompts/07_剧情大纲与时间线.md` 完成角色、世界观、剧情和时间线归并。
7. 第七步：使用 `prompts/08_输出SillyTavern世界书.md` 输出世界、势力、地点、剧情等世界书条目。
8. 第八步：使用 `prompts/09_输出SillyTavern角色汇总.md` 输出角色汇总。
9. 第九步：使用 `prompts/10_归并角色卡.md` 归并角色汇总，便于核查。
10. 第十步：使用 `prompts/11_导出SillyTavern作品角色卡.md` 导出一张以作品名命名的 SillyTavern 作品角色卡 JSON，所有内容写入内嵌 `character_book`。

详细阶段、输入输出和脚本职责以 [references/workflow.md](references/workflow.md) 为唯一事实来源。

## 目录怎么看

```text
source_raw/                 用户输入：原始小说，只读
workspace/
  source/                   处理后的文本
  index/                    索引、计划、进度和下一步
  notes/                    story/chapter/arc 局部笔记
  entities/                 全局角色与世界观归并
outputs/                    用户最终复查或导入的结果
prompts/                    各阶段具体任务
templates/                  固定输出结构
references/                 工作流真源与按需规范
scripts/                    确定性辅助工具
.agents/、.claude/          平台发现入口
```

生命周期只有一条主线：

```text
source_raw/ → workspace/ → outputs/
```

## 重要提醒

- 不要跳过局部笔记直接生成最终设定。
- 每条重要结论都应该能追溯到来源文件、篇目、章节或局部笔记。
- 不确定信息标注为【待核查】。
- 单篇特例不要直接写成全局世界观规则。
- 不要把 `source_raw/`、`workspace/`、`outputs/` 中的实际内容提交到公开仓库。这些目录可能包含小说原文、拆分文本、大量原文摘录或版权相关整理内容。

## 复用方式

分析不同作品时，通常只需要修改 `PROJECT_CONFIG.md`，再替换 `source_raw/` 中的原文，不需要重写整个工作流。

## Skill 位置

- Codex Skill：`.agents/skills/novel-lore-digest/`
- Claude Code Skill：`.claude/skills/novel-lore-digest/`

## 懒人模式

以后不需要复制长提示词。具体阶段任务在 `prompts/`，公共项目规则在 `AGENTS.md`，详细工作流在 `references/workflow.md`；`CLAUDE.md` 和两个 Skill 只负责平台发现。

常用短命令：

```txt
启动 Novel Lore Digest
继续下一步
按推荐三篇试跑
继续批量生成局部笔记
开始归并角色
开始归并世界观
输出 SillyTavern 世界书
输出 SillyTavern 角色汇总
归并角色卡
同步到酒馆
```

推荐新项目流程：

1. 填写 `PROJECT_CONFIG.md`。
2. 把小说 txt/md 放进 `source_raw/`。
3. 对 Codex/Claude 说：`启动 Novel Lore Digest`。
4. 之后按提示说：`继续下一步`。

也可以运行：

```powershell
python scripts/next_step.py
```

脚本会检查当前状态，并把下一步建议写到 `workspace/index/下一步.md`。

## SillyTavern 最终导出

默认最终产物是一张“作品大世界卡”，例如：

```txt
outputs/sillytavern-story-card/{作品名}.json
```

这张卡只把 `data.name` 写成作品名；`description`、`personality`、`scenario`、`first_mes`、`mes_example` 等角色定义字段保持为空。所有世界书与角色汇总内容都写入 `data.character_book.entries`，导入 SillyTavern 后作为一本内嵌世界书使用。

导出命令：

```powershell
python scripts/export_story_card_for_sillytavern.py
```

检查报告：

```txt
outputs/sillytavern-story-card/导出检查报告.md
```

## 世界书快捷导入（旧路径）

`outputs/SillyTavern世界书.md` 现在分为两部分：

- `## 可导入条目块`：只放星辰工坊世界书管理器可扫描的 XML 条目。
- `## 生成说明与检查`：放生成说明、激活链检查和待核查问题。

导出纯导入版：

```powershell
python scripts/export_worldbook_for_starforge.py
```

输出位置：

```txt
outputs/star-forge-import/世界书导入块.md
outputs/star-forge-import/世界书导入检查.md
```

此路径仅在需要继续走星辰工坊世界书管理器时使用。推荐流程：复制 `世界书导入块.md` 内容到 SillyTavern 聊天，打开星辰工坊世界书管理器，扫描最近消息并导入目标世界书。


