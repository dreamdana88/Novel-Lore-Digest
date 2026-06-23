from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_RAW = ROOT / "source_raw"
SOURCE = ROOT / "source"
INDEX = ROOT / "index" / "文本索引.md"

ENCODINGS = ("utf-8-sig", "utf-8", "gb18030", "gbk", "big5")
SPLIT_THRESHOLD_BYTES = 120 * 1024
TARGET_MIN = 12_000
TARGET_MAX = 15_000
OVERLAP = 500


def read_text_with_fallback(path: Path) -> tuple[str, str]:
    last_error: Exception | None = None
    for encoding in ENCODINGS:
        try:
            return path.read_text(encoding=encoding), encoding
        except UnicodeDecodeError as exc:
            last_error = exc
    raise UnicodeDecodeError(
        "unknown",
        b"",
        0,
        1,
        f"无法用常见编码读取 {path}: {last_error}",
    )


def normalize_blank_lines(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def safe_stem(path: Path) -> str:
    return path.stem.strip().replace("/", "_").replace("\\", "_")


def split_by_paragraphs(text: str) -> list[str]:
    paragraphs = re.split(r"(\n\s*\n)", text)
    units: list[str] = []
    for i in range(0, len(paragraphs), 2):
        body = paragraphs[i]
        sep = paragraphs[i + 1] if i + 1 < len(paragraphs) else "\n\n"
        if body.strip():
            units.append(body.strip() + sep)

    parts: list[str] = []
    current = ""
    for unit in units:
        if len(current) >= TARGET_MIN and len(current) + len(unit) > TARGET_MAX:
            parts.append(current.strip() + "\n")
            overlap = current[-OVERLAP:] if len(current) > OVERLAP else current
            current = overlap + "\n\n" + unit
        else:
            current += unit

    if current.strip():
        parts.append(current.strip() + "\n")

    if not parts:
        return [text]
    return parts


def suggest_analysis_type(path: Path, split_count: int) -> str:
    name = path.stem
    if split_count > 1:
        return "chunk-note"
    if re.search(r"(卷|部|案|案件|篇章|arc)", name, re.IGNORECASE):
        return "arc-note"
    if re.search(r"(章|chapter|ch\d+|第.+章)", name, re.IGNORECASE):
        return "chapter-note"
    return "story-note / chapter-note（请结合 PROJECT_CONFIG.md 判断）"


def main() -> None:
    SOURCE_RAW.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    INDEX.parent.mkdir(parents=True, exist_ok=True)

    raw_files = sorted(
        [p for p in SOURCE_RAW.rglob("*") if p.is_file() and p.suffix.lower() in {".txt", ".md"}],
        key=lambda p: str(p.relative_to(SOURCE_RAW)),
    )

    rows: list[dict[str, object]] = []
    output_counter = 0

    for idx, raw_path in enumerate(raw_files, start=1):
        text, encoding = read_text_with_fallback(raw_path)
        text = normalize_blank_lines(text)
        raw_size = raw_path.stat().st_size
        should_split = raw_size > SPLIT_THRESHOLD_BYTES
        parts = split_by_paragraphs(text) if should_split else [text]
        relative_stem = "__".join(part.strip() for part in raw_path.relative_to(SOURCE_RAW).with_suffix("").parts)
        stem = safe_stem(Path(relative_stem))
        output_names: list[str] = []

        for part_index, part_text in enumerate(parts, start=1):
            if len(parts) == 1:
                output_name = f"{stem}.txt"
            else:
                output_name = f"{stem}_part{part_index}.txt"
            output_path = SOURCE / output_name
            output_path.write_text(part_text, encoding="utf-8")
            output_names.append(output_name)
            output_counter += 1

        rows.append(
            {
                "编号": idx,
                "原文件名": raw_path.name,
                "输出文件名": "<br>".join(output_names),
                "文件大小": raw_size,
                "原编码": encoding,
                "是否拆分": "是" if should_split else "否",
                "part 数量": len(parts),
                "建议分析类型": suggest_analysis_type(raw_path, len(parts)),
            }
        )

    lines = [
        "# 文本索引",
        "",
        f"- 原始文件数：{len(raw_files)}",
        f"- 生成 source 文件数：{output_counter}",
        "",
        "| 编号 | 原文件名 | 输出文件名 | 文件大小(bytes) | 原编码 | 是否拆分 | part 数量 | 建议分析类型 |",
        "|---:|---|---|---:|---|---|---:|---|",
    ]

    for row in rows:
        lines.append(
            "| {编号} | {原文件名} | {输出文件名} | {文件大小} | {原编码} | {是否拆分} | {part 数量} | {建议分析类型} |".format(
                **row
            )
        )

    if not rows:
        lines.extend(["", "source_raw/ 中尚未发现 .txt 或 .md 文件。"])

    INDEX.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"识别原始文件：{len(raw_files)}")
    print(f"生成 source 文件：{output_counter}")
    print(f"索引已写入：{INDEX}")


if __name__ == "__main__":
    main()
