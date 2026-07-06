请把本项目已生成的世界书条目与角色汇总打包为一张可直接导入 SillyTavern 的作品角色卡 JSON。

## 定位

本阶段生成的是可直接导入sillytavern的“作品大世界卡”。

- 角色卡名称使用 PROJECT_CONFIG.md 中的作品名，例如：`琅琊榜`。
- 角色卡本体只作为 SillyTavern 导入容器。
- `data.description`、`data.personality`、`data.scenario`、`data.first_mes`、`data.mes_example` 必须保持空字符串。
- 不写开场白、不写主持人规则、不写玩法引导、不写示例互动。
- 所有可用设定都进入 `data.character_book.entries`。
- 每个 entry 的 `content` 必须保留原始外层 XML 标签，如 `<world_*>...</world_*>`、`<Character_*>...</Character_*>`、`<NPC_*>...</NPC_*>`；只去掉条目名称、关键词、插入位置、插入顺序、激活策略等管理头字段。

## 输入

优先读取：

1. `PROJECT_CONFIG.md`
2. `outputs/SillyTavern世界书.md`
3. `outputs/SillyTavern角色汇总.md`

如果汇总文件不存在，再从 `outputs/SillyTavern角色汇总/` 读取各角色文件，忽略 `_` 开头的辅助文件。

## 执行

运行：

```bash
python scripts/export_story_card_for_sillytavern.py
```

## 输出

生成：

- `outputs/sillytavern-story-card/{作品名}.json`
- `outputs/sillytavern-story-card/导出检查报告.md`

JSON 必须采用 Character Card V2 结构：

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "作品名",
    "description": "",
    "personality": "",
    "scenario": "",
    "first_mes": "",
    "mes_example": "",
    "creator_notes": "",
    "system_prompt": "",
    "post_history_instructions": "",
    "alternate_greetings": [],
    "tags": [],
    "creator": "",
    "character_version": "",
    "extensions": {},
    "character_book": {
      "name": "作品名世界书",
      "description": "",
      "recursive_scanning": true,
      "extensions": {},
      "entries": []
    }
  }
}
```

## 检查

导出后必须检查报告：

- 世界书条目数量是否正常。
- 角色汇总条目数量是否正常。
- 是否仍有 `【需自行补充】`、`【待核查】`、`【待回填语料】`。
- 是否有缺少关键词、插入位置、插入顺序、激活策略或内容为空的条目。
- 角色卡壳字段是否保持为空。
- 抽查世界书、主角、NPC 条目的 `content` 是否仍以 XML 开标签开始、以对应闭标签结束。

## 禁止

- 不要把 `outputs/SillyTavern角色汇总/` 的角色文件导出成多张单角色 JSON。
- 不要给作品卡编写开场白、旁白身份、主持人规则或玩法说明。
- 不要直接修改 SillyTavern 存档、数据库或世界书文件。
- 不要改写 `source_raw/`。
