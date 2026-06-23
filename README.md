# Novel Lore Digest

Novel Lore Digest 是一个面向长篇小说与故事集的结构化设定分析工作流。它通过项目级 Codex / Claude Code Skill，把原文逐步整理为：

- 角色人设与典型台词
- 关系网、时间线与剧情索引
- 地点、组织、物种、物品和世界规则
- SillyTavern 世界书
- 星辰工坊格式的主角色卡与配角 NPC 卡

## 使用条件

- Python 3.10 或更高版本
- Codex 或 Claude Code
- 小说原文由使用者自行合法获取

本项目不需要额外安装 Skill。仓库已经内置：

```text
.agents/skills/novel-lore-digest/
.claude/skills/novel-lore-digest/
```

只要用 Codex 或 Claude Code 打开项目根目录，项目级 Skill 即可被识别。

## 创建项目

推荐使用以下任一方式：

1. 在 GitHub 点击 **Use this template** 创建独立仓库。
2. 下载 Release ZIP，解压后用 Codex / Claude Code 打开文件夹。
3. 克隆仓库后直接在本地使用。

然后：

1. 填写 `PROJECT_CONFIG.md`。
2. 把小说 `.txt` 或 `.md` 放进 `source_raw/`。
3. 对 AI 说：`启动 Novel Lore Digest`。
4. 后续按提示说：`继续下一步`。

也可以由使用者在终端运行交互式配置向导：

```powershell
python scripts/new_project_wizard.py
```

## 支持的作品类型

- 单元故事、连续长篇、系列长篇
- 案件单元、冒险篇章、群像史诗
- 奇幻世界观、都市奇幻、民俗悬疑
- 灵异调查及其他混合结构

## 工作原则

- `source_raw/` 是原文备份，工作流不会修改它。
- 先生成局部笔记，再进行角色与世界观归并。
- 重要结论必须能追溯到来源篇目或章节。
- 不确定信息标注为 `【待核查】`。
- 单篇特例不能直接上升为全局规则。
- 世界书条目和角色卡 XML 使用世界内客观描述，不写元叙事分析语气。

详细流程见：

```text
.agents/skills/novel-lore-digest/references/workflow.md
prompts/
```

## 常用口令

```text
启动 Novel Lore Digest
继续下一步
按推荐三篇试跑
继续批量生成局部笔记
回填台词
开始归并角色
开始归并世界观
输出 SillyTavern 世界书
输出 SillyTavern 角色卡
同步到酒馆
```

## 常用脚本

| 脚本 | 用途 |
| --- | --- |
| `new_project_wizard.py` | 交互填写项目配置 |
| `prepare_sources.py` | 清洗、拆分原文并生成文本索引 |
| `next_step.py` | 判断当前阶段并给出下一步 |
| `check_progress.py` | 统计局部笔记完成情况 |
| `merge_character_cards.py` | 汇总所有角色卡 |
| `export_worldbook_for_starforge.py` | 导出星辰工坊世界书导入块 |
| `reset_to_template.py` | 清空当前分析内容并恢复模板状态 |

## 同步到 SillyTavern

世界书生成后运行：

```powershell
python scripts/export_worldbook_for_starforge.py
```

输出：

```text
exports/star-forge-import/世界书导入块.md
exports/star-forge-import/世界书导入检查.md
```

将导入块放进 SillyTavern 聊天，再由星辰工坊世界书管理器扫描导入。

## 隐私、版权与公开仓库

以下目录默认被 Git 忽略：

```text
source_raw/
source/
notes/
index/
outputs/
exports/
```

这些目录可能包含受版权保护的原文、原文摘录、分析笔记或私人创作资料。发布或提交前仍应执行 `git status` 和 `git ls-files` 复查，避免误传。

`references/星辰工坊规范/` 收录本项目作者创作的世界书与角色卡规范。

## 重置

完成一部作品并妥善备份后，可运行：

```powershell
python scripts/reset_to_template.py
```

此操作会清空原文、笔记和输出，不可恢复。

## License

本项目按 MIT License 发布，详见 `LICENSE`。
