from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "SillyTavern世界书.md"
EXPORT_DIR = ROOT / "exports" / "star-forge-import"
EXPORT_FILE = EXPORT_DIR / "世界书导入块.md"
REPORT_FILE = EXPORT_DIR / "世界书导入检查.md"

REQUIRED_FIELDS = ["条目名称", "关键词", "插入位置", "插入顺序", "激活策略", "条目内容"]


@dataclass
class XmlBlock:
    tag: str
    full_text: str
    inner_text: str


def read_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"找不到世界书输出文件：{path}")
    return path.read_text(encoding="utf-8", errors="ignore")


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


def extract_outer_xml_blocks(text: str) -> list[XmlBlock]:
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
            blocks.append(XmlBlock(root_tag, full_text, inner_text))
            root_start = -1
            root_tag = ""

    return blocks


def line_value(inner: str, label: str) -> str:
    pattern = re.compile(rf"(?:^|\n)\s*#?\s*{re.escape(label)}\s*[:：]\s*(.+)", re.I)
    match = pattern.search(inner)
    return match.group(1).strip() if match else ""


def content_after_label(inner: str) -> str:
    match = re.search(r"(?:^|\n)\s*条目内容\s*[:：]\s*([\s\S]*)$", inner, re.I)
    return match.group(1).strip() if match else ""


def split_keywords(raw: str) -> list[str]:
    return [item.strip() for item in re.split(r"[,，、\n]", raw) if item.strip()]


def validate_blocks(blocks: list[XmlBlock]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    constant_contents: list[str] = []
    selective_entries: list[tuple[str, list[str]]] = []

    for index, block in enumerate(blocks, start=1):
        name = line_value(block.inner_text, "条目名称") or block.tag
        missing = [field for field in REQUIRED_FIELDS if not line_value(block.inner_text, field)]
        if "条目内容" in missing and content_after_label(block.inner_text):
            missing.remove("条目内容")
        if missing:
            errors.append(f"第 {index} 条 `{name}` 缺少字段：{', '.join(missing)}")

        strategy = line_value(block.inner_text, "激活策略")
        keywords = split_keywords(line_value(block.inner_text, "关键词"))
        content = content_after_label(block.inner_text)
        if "关键词" in strategy or "绿" in strategy:
            selective_entries.append((name, keywords))
            if not keywords:
                errors.append(f"第 {index} 条 `{name}` 是关键词策略，但关键词为空。")
        else:
            constant_contents.append(content)

        if not content:
            errors.append(f"第 {index} 条 `{name}` 条目内容为空。")

    constant_blob = "\n".join(constant_contents)
    if constant_blob:
        for name, keywords in selective_entries:
            if not any(keyword in constant_blob for keyword in keywords):
                warnings.append(f"绿灯条目 `{name}` 的关键词未在常驻蓝灯内容中命中，可能悬空：{', '.join(keywords) or '无关键词'}")
    elif selective_entries:
        warnings.append("存在关键词条目，但没有检测到常驻蓝灯内容，可能全部悬空。")

    return errors, warnings


def main() -> None:
    text = read_text(SOURCE)
    import_section = section_between(text, "## 可导入条目块")
    blocks = extract_outer_xml_blocks(import_section)

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    if not blocks:
        REPORT_FILE.write_text(
            "# 世界书导入检查\n\n未找到可导入 XML 条目块。请确认 outputs/SillyTavern世界书.md 中存在 `## 可导入条目块`。\n",
            encoding="utf-8",
        )
        raise SystemExit("未找到可导入 XML 条目块。")

    export_text = "\n\n".join(block.full_text for block in blocks).strip() + "\n"
    EXPORT_FILE.write_text(export_text, encoding="utf-8")

    errors, warnings = validate_blocks(blocks)
    report_lines = [
        "# 世界书导入检查",
        "",
        f"- 来源文件：{SOURCE}",
        f"- 导入块文件：{EXPORT_FILE}",
        f"- 条目数量：{len(blocks)}",
        "",
        "## 错误",
    ]
    report_lines.extend([f"- {item}" for item in errors] or ["- 无"])
    report_lines.extend(["", "## 警告"])
    report_lines.extend([f"- {item}" for item in warnings] or ["- 无"])
    report_lines.extend(["", "## 条目列表"])
    for block in blocks:
        name = line_value(block.inner_text, "条目名称") or block.tag
        strategy = line_value(block.inner_text, "激活策略") or "未填写"
        position = line_value(block.inner_text, "插入位置") or "未填写"
        order = line_value(block.inner_text, "插入顺序") or "未填写"
        report_lines.append(f"- {name} | {strategy} | {position} | Order {order}")

    REPORT_FILE.write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    print(f"已导出：{EXPORT_FILE}")
    print(f"已生成检查报告：{REPORT_FILE}")
    print(f"条目数量：{len(blocks)}")
    if errors:
        print(f"错误：{len(errors)} 项，请先修正。")
    if warnings:
        print(f"警告：{len(warnings)} 项，请复查。")


if __name__ == "__main__":
    main()