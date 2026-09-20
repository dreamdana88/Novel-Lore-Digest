from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "PROJECT_CONFIG.md"
WORLDBOOK = ROOT / "outputs" / "SillyTavern世界书.md"
CHARACTER_SUMMARY_CANDIDATES = [
    ROOT / "outputs" / "SillyTavern角色汇总.md",
]
CHARACTER_DIR_CANDIDATES = [
    ROOT / "outputs" / "SillyTavern角色汇总",
]
EXPORT_DIR = ROOT / "outputs" / "sillytavern-story-card"
REPORT = EXPORT_DIR / "导出检查报告.md"

REQUIRED_HEADER_FIELDS = ["条目名称", "关键词", "插入位置", "插入顺序", "激活策略"]
RECURSION_FIELDS = {"不可递归": "exclude_recursion", "防止进一步递归": "prevent_recursion"}
PLACEHOLDER_PATTERNS = ["【需自行补充】", "【待核查】", "【待回填语料】"]


@dataclass
class XmlBlock:
    tag: str
    full_text: str
    inner_text: str
    source: str


@dataclass
class EntryResult:
    entry: dict
    warnings: list[str]


def read_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"找不到文件：{path}")
    return path.read_text(encoding="utf-8", errors="ignore")


def project_title() -> str:
    text = read_text(CONFIG)
    for line in text.splitlines():
        if line.startswith("- 作品名："):
            value = line.split("：", 1)[1].strip()
            if value:
                return value
    return "未命名作品"


def section_between(text: str, start_heading: str, next_heading_level: str = "## ") -> str:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    start = None
    for index, line in enumerate(lines):
        if line.strip() == start_heading:
            start = index + 1
            break
    if start is None:
        return text

    end = len(lines)
    for index in range(start, len(lines)):
        line = lines[index]
        if line.startswith(next_heading_level) and line.strip() != start_heading:
            end = index
            break
    return "\n".join(lines[start:end]).strip()


def extract_outer_xml_blocks(text: str, source: str) -> list[XmlBlock]:
    token_re = re.compile(r"</?([^\s>/\r\n]+)(?:\s[^<>]*)?>")
    blocks: list[XmlBlock] = []
    stack: list[str] = []
    root_start = -1
    root_tag = ""

    for match in token_re.finditer(text):
        token = match.group(0)
        tag = match.group(1)
        is_closing = token.startswith("</")
        is_self_closing = token.endswith("/>")

        if not is_closing and not is_self_closing:
            if not stack:
                root_start = match.start()
                root_tag = tag
            stack.append(tag)
            continue

        if is_self_closing:
            continue

        if not stack:
            continue

        if stack[-1] == tag:
            stack.pop()
        elif tag in stack:
            stack = stack[: stack.index(tag)]
        else:
            continue

        if not stack and root_start >= 0:
            full_text = text[root_start : match.end()].strip()
            inner_text = re.sub(rf"^<{re.escape(root_tag)}(?:\s[^<>]*)?>", "", full_text)
            inner_text = re.sub(rf"</{re.escape(root_tag)}>$", "", inner_text).strip()
            blocks.append(XmlBlock(root_tag, full_text, inner_text, source))
            root_start = -1
            root_tag = ""

    return blocks


def line_value(inner: str, label: str) -> str:
    pattern = re.compile(rf"(?:^|\n)\s*#?\s*{re.escape(label)}\s*[:：]\s*(.+)", re.I)
    match = pattern.search(inner)
    return match.group(1).strip() if match else ""


def split_keywords(raw: str) -> list[str]:
    return [item.strip() for item in re.split(r"[,，、\n]", raw) if item.strip()]


def content_after_label(inner: str) -> str:
    match = re.search(r"(?:^|\n)\s*条目内容\s*[:：]\s*([\s\S]*)$", inner, re.I)
    return match.group(1).strip() if match else ""


def content_without_header(inner: str) -> str:
    lines = []
    for line in inner.splitlines():
        stripped = line.strip()
        is_header = any(re.match(rf"^#?\s*{re.escape(field)}\s*[:：]", stripped) for field in [*REQUIRED_HEADER_FIELDS, *RECURSION_FIELDS])
        if not is_header:
            lines.append(line)
    return "\n".join(lines).strip()


def export_content_with_xml_tag(block: XmlBlock) -> str:
    content = content_after_label(block.inner_text)
    if not content:
        content = content_without_header(block.inner_text)
    if not content:
        return ""
    return f"<{block.tag}>\n{content}\n</{block.tag}>"


def parse_order(raw: str) -> int:
    match = re.search(r"-?\d+", raw)
    return int(match.group(0)) if match else 100


def parse_position(raw: str) -> str:
    if "之前" in raw or "before" in raw.lower():
        return "before_char"
    return "after_char"


def block_to_entry(block: XmlBlock, entry_id: int) -> EntryResult:
    warnings: list[str] = []
    name = line_value(block.inner_text, "条目名称") or block.tag
    keywords = split_keywords(line_value(block.inner_text, "关键词"))
    position_raw = line_value(block.inner_text, "插入位置")
    order_raw = line_value(block.inner_text, "插入顺序")
    strategy = line_value(block.inner_text, "激活策略")
    extensions = {}
    for label, key in RECURSION_FIELDS.items():
        value = line_value(block.inner_text, label) or "是"
        if value not in ("是", "否"):
            raise ValueError(f"`{name}` 的 `{label}` 必须为“是”或“否”：{value}")
        extensions[key] = value == "是"

    content = export_content_with_xml_tag(block)

    for field in REQUIRED_HEADER_FIELDS:
        if not line_value(block.inner_text, field):
            warnings.append(f"`{name}` 缺少字段：{field}")
    if not keywords:
        warnings.append(f"`{name}` 关键词为空")
    if not content:
        warnings.append(f"`{name}` 内容为空")

    entry = {
        "id": entry_id,
        "keys": keywords,
        "secondary_keys": [],
        "comment": name,
        "content": content,
        "constant": "常驻" in strategy,
        "selective": False,
        "insertion_order": parse_order(order_raw),
        "enabled": True,
        "position": parse_position(position_raw),
        "extensions": extensions,
    }
    return EntryResult(entry, warnings)


def read_character_blocks() -> tuple[list[XmlBlock], str]:
    for path in CHARACTER_SUMMARY_CANDIDATES:
        if path.exists():
            text = read_text(path)
            blocks = extract_outer_xml_blocks(text, path.relative_to(ROOT).as_posix())
            if blocks:
                return blocks, path.relative_to(ROOT).as_posix()

    blocks: list[XmlBlock] = []
    for character_dir in CHARACTER_DIR_CANDIDATES:
        if not character_dir.exists():
            continue
        for path in sorted(character_dir.glob("*.md")):
            if path.name.startswith("_"):
                continue
            text = read_text(path)
            blocks.extend(extract_outer_xml_blocks(text, path.relative_to(ROOT).as_posix()))
        if blocks:
            return blocks, character_dir.relative_to(ROOT).as_posix()
    return blocks, CHARACTER_DIR_CANDIDATES[0].relative_to(ROOT).as_posix()


def check_keyword_chains(blocks: list[XmlBlock]) -> list[str]:
    """检查正文关键词链能否追溯到蓝灯，不模拟运行时递归开关。"""
    reachable_contents: list[str] = []
    pending: list[tuple[str, list[str], str]] = []
    for block in blocks:
        strategy = line_value(block.inner_text, "激活策略")
        content = content_after_label(block.inner_text) or content_without_header(block.inner_text)
        if "常驻" in strategy:
            reachable_contents.append(content)
        elif "关键词" in strategy:
            pending.append((
                line_value(block.inner_text, "条目名称") or block.tag,
                split_keywords(line_value(block.inner_text, "关键词")),
                content,
            ))

    while pending:
        linked = [entry for entry in pending if any(
            keyword in parent_content
            for keyword in entry[1]
            for parent_content in reachable_contents
        )]
        if not linked:
            break
        reachable_contents.extend(content for _, _, content in linked)
        pending = [entry for entry in pending if entry not in linked]

    return [
        f"绿灯条目 `{name}` 无法通过母条目正文关键词链追溯到常驻蓝灯，可能悬空：{', '.join(keywords) or '无关键词'}"
        for name, keywords, _ in pending
    ]


def build_card(title: str, entries: list[dict]) -> dict:
    # Intentionally keep every prompt-facing character field empty. This card is
    # only a named SillyTavern container for the embedded world book.
    return {
        "spec": "chara_card_v2",
        "spec_version": "2.0",
        "data": {
            "name": title,
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
                "name": f"{title}世界书",
                "description": "",
                "recursive_scanning": True,
                "extensions": {},
                "entries": entries,
            },
        },
    }


def write_report(
    title: str,
    output: Path,
    world_count: int,
    character_count: int,
    character_source: str,
    entries: list[dict],
    warnings: list[str],
) -> None:
    names = [entry.get("comment", "") for entry in entries]
    duplicate_names = sorted({name for name in names if name and names.count(name) > 1})
    placeholder_hits = {
        pattern: sum(1 for entry in entries if pattern in entry.get("content", ""))
        for pattern in PLACEHOLDER_PATTERNS
    }

    lines = [
        "# SillyTavern 作品角色卡导出检查",
        "",
        f"- 作品名：{title}",
        f"- 导出文件：{output.relative_to(ROOT).as_posix()}",
        f"- 世界书来源：{WORLDBOOK.relative_to(ROOT).as_posix()}",
        f"- 角色设定来源：{character_source}",
        f"- 世界/剧情/势力等条目：{world_count}",
        f"- 角色汇总条目：{character_count}",
        f"- 总条目数：{len(entries)}",
        "",
        "## 角色卡壳字段检查",
        "",
        "- `data.name`：作品名",
        "- `description/personality/scenario/first_mes/mes_example`：按工作流要求保持空字符串",
        "- 所有可用内容仅写入 `data.character_book.entries`",
        "- 条目 `content` 保留外层 XML 标签（如 `<world_*>`、`<Character_*>`、`<NPC_*>`），管理头字段不写入正文",
        "",
        "## 警告",
    ]
    if duplicate_names:
        warnings.extend(f"重复条目名称：{name}" for name in duplicate_names)
    lines.extend([f"- {item}" for item in warnings] or ["- 无"])

    lines.extend(["", "## 占位符统计"])
    for pattern, count in placeholder_hits.items():
        lines.append(f"- {pattern}：{count} 条")

    lines.extend(["", "## 条目列表"])
    for entry in entries:
        strategy = "常驻" if entry.get("constant") else "关键词"
        position = entry.get("position", "")
        order = entry.get("insertion_order", "")
        lines.append(f"- {entry.get('comment', '未命名')} | {strategy} | {position} | Order {order}")

    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    title = project_title()
    world_text = read_text(WORLDBOOK)
    world_section = section_between(world_text, "## 可导入条目块")
    world_blocks = extract_outer_xml_blocks(world_section, WORLDBOOK.relative_to(ROOT).as_posix())
    character_blocks, character_source = read_character_blocks()

    if not world_blocks:
        raise SystemExit("未找到世界书 XML 条目块。")
    if not character_blocks:
        raise SystemExit("未找到角色设定 XML 条目块。")

    warnings = check_keyword_chains([*world_blocks, *character_blocks])
    entries: list[dict] = []
    for entry_id, block in enumerate([*world_blocks, *character_blocks], start=1):
        result = block_to_entry(block, entry_id)
        entries.append(result.entry)
        warnings.extend(result.warnings)

    card = build_card(title, entries)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    output = EXPORT_DIR / f"{title}.json"
    output.write_text(json.dumps(card, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    write_report(
        title=title,
        output=output,
        world_count=len(world_blocks),
        character_count=len(character_blocks),
        character_source=character_source,
        entries=entries,
        warnings=warnings,
    )

    print(f"已导出：{output}")
    print(f"已生成检查报告：{REPORT}")
    print(f"总条目数：{len(entries)}（世界书 {len(world_blocks)}，角色设定 {len(character_blocks)}）")
    print("角色卡壳字段已保持为空，仅 data.name 与 data.character_book 有内容。")


if __name__ == "__main__":
    main()
