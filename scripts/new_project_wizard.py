from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "PROJECT_CONFIG.md"

DEFAULT_CONFIG = """# PROJECT_CONFIG

## 作品基本信息
- 作品名：
- 作者：
- 语言：
- 文本来源：
- 分析日期：

## 作品结构类型
请在下列类型中选择或组合：
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
- 其他：

## 分析重点
请勾选或填写：
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
- SillyTavern 角色卡

## 目标角色清单

### 需要深度分析的主要角色
-

### 只需简要记录的角色
-

### 暂不分析/忽略的角色
-

## 分析粒度
- 默认分块大小：12000-15000 中文字
- 超大章节是否拆分：是
- 是否保留上下文 overlap：是
- overlap 字数：500

## 输出目标
- 是否生成 SillyTavern 世界书：
- 是否生成 SillyTavern 角色卡：
- 是否生成剧情大纲：
- 是否生成时间线：
- 是否生成关系网：
- 是否生成文风条目：

## 特别注意
在这里填写本作品的特殊要求，例如：
- 不要把单篇特例写成全局设定。
- 不要过度分析路人角色。
- 重点关注某几个主要角色。
- 重点整理世界观规则。
- 需要区分原文确定信息和推测信息。
"""

STRUCTURE_TYPES = [
    "单元故事型",
    "连续长篇型",
    "系列长篇型",
    "案件单元型",
    "冒险篇章型",
    "群像史诗型",
    "奇幻世界观型",
    "都市奇幻型",
    "民俗悬疑型",
    "灵异调查型",
]

ANALYSIS_GOALS = [
    "主要角色人设",
    "角色关系网",
    "世界观设定",
    "剧情大纲",
    "时间线",
    "组织/势力",
    "地点地图",
    "物种/妖怪/异类规则",
    "能力系统",
    "民俗/宗教/禁忌",
    "悬疑伏笔",
    "文风分析",
    "SillyTavern 世界书",
    "SillyTavern 角色卡",
]


def ensure_config() -> None:
    if not CONFIG.exists():
        CONFIG.write_text(DEFAULT_CONFIG, encoding="utf-8")


def prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}：").strip()
    return value or default


def prompt_multi(label: str, options: list[str]) -> str:
    print(f"\n{label}（可输入编号，多个用逗号分隔，也可直接输入文字）")
    for index, item in enumerate(options, start=1):
        print(f"  {index}. {item}")
    raw = input("请输入：").strip()
    if not raw:
        return ""
    selected: list[str] = []
    for part in raw.replace("，", ",").split(","):
        part = part.strip()
        if not part:
            continue
        if part.isdigit() and 1 <= int(part) <= len(options):
            selected.append(options[int(part) - 1])
        else:
            selected.append(part)
    return "、".join(dict.fromkeys(selected))


def prompt_yes_no(label: str) -> str:
    raw = input(f"{label}（是/否）：").strip().lower()
    if raw in {"y", "yes", "是", "要", "true", "1"}:
        return "是"
    if raw in {"n", "no", "否", "不要", "false", "0"}:
        return "否"
    return raw or ""


def line_value(text: str, label: str) -> str:
    prefix = f"- {label}："
    for line in text.splitlines():
        if line.startswith(prefix):
            return line[len(prefix) :].strip()
    return ""


def replace_line(text: str, label: str, value: str, overwrite: bool) -> str:
    if not value:
        return text
    prefix = f"- {label}："
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.startswith(prefix):
            old = line[len(prefix) :].strip()
            if old and not overwrite:
                return text
            lines[i] = prefix + value
            return "\n".join(lines) + "\n"
    return text.rstrip() + f"\n{prefix}{value}\n"


def replace_section_list(text: str, heading: str, values: list[str], overwrite: bool) -> str:
    values = [value.strip() for value in values if value.strip()]
    if not values:
        return text
    lines = text.splitlines()
    try:
        start = lines.index(heading)
    except ValueError:
        return text.rstrip() + "\n\n" + heading + "\n" + "\n".join(f"- {v}" for v in values) + "\n"

    end = len(lines)
    for i in range(start + 1, len(lines)):
        if lines[i].startswith("### ") or lines[i].startswith("## "):
            end = i
            break

    existing = [line for line in lines[start + 1 : end] if line.strip() and line.strip() != "-"]
    if existing and not overwrite:
        return text

    new_lines = lines[: start + 1] + [f"- {value}" for value in values] + lines[end:]
    return "\n".join(new_lines) + "\n"


def main() -> None:
    ensure_config()
    text = CONFIG.read_text(encoding="utf-8")

    print("Novel Lore Digest 新项目配置向导")
    print("已存在的非空字段默认不覆盖。需要覆盖时请确认。\n")

    overwrite = input("是否允许覆盖已填写的非空内容？（是/否，默认否）：").strip() in {"是", "y", "Y", "yes", "YES"}

    title = prompt("作品名", line_value(text, "作品名"))
    author = prompt("作者", line_value(text, "作者"))
    structure = prompt_multi("作品结构类型", STRUCTURE_TYPES)
    goals = prompt_multi("分析重点", ANALYSIS_GOALS)
    deep_roles = prompt("需要深度分析的主要角色（多个用逗号分隔）")
    brief_roles = prompt("只需简要记录的角色（可留空，多个用逗号分隔）")
    worldbook = prompt_yes_no("是否生成 SillyTavern 世界书")
    charcards = prompt_yes_no("是否生成 SillyTavern 角色卡")
    outline = prompt_yes_no("是否生成剧情大纲")
    timeline = prompt_yes_no("是否生成时间线")
    relation = prompt_yes_no("是否生成关系网")
    cautions = prompt("特别注意事项（可留空）")

    text = replace_line(text, "作品名", title, overwrite)
    text = replace_line(text, "作者", author, overwrite)
    if structure:
        marker = "## 作品结构类型"
        addition = f"\n- 已选择：{structure}"
        if addition not in text:
            text = text.replace(marker, marker + addition, 1)
    text = replace_section_list(text, "### 需要深度分析的主要角色", [v.strip() for v in deep_roles.replace("，", ",").split(",")], overwrite)
    text = replace_section_list(text, "### 只需简要记录的角色", [v.strip() for v in brief_roles.replace("，", ",").split(",")], overwrite)
    text = replace_line(text, "是否生成 SillyTavern 世界书", worldbook, overwrite)
    text = replace_line(text, "是否生成 SillyTavern 角色卡", charcards, overwrite)
    text = replace_line(text, "是否生成剧情大纲", outline, overwrite)
    text = replace_line(text, "是否生成时间线", timeline, overwrite)
    text = replace_line(text, "是否生成关系网", relation, overwrite)

    if goals:
        marker = "## 分析重点"
        addition = f"\n- 已选择：{goals}"
        if addition not in text:
            text = text.replace(marker, marker + addition, 1)

    if cautions:
        text = text.rstrip() + f"\n- {cautions}\n"

    CONFIG.write_text(text, encoding="utf-8")
    print(f"\n已更新：{CONFIG}")
    print("下一步：把小说 txt/md 放进 source_raw/，然后对 AI 说：启动 Novel Lore Digest。")


if __name__ == "__main__":
    main()
