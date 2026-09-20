from __future__ import annotations

from pathlib import Path

from next_step import planned_arc_note_paths


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "workspace"
SOURCE = WORKSPACE / "source"
NOTE_DIRS = [
    WORKSPACE / "notes" / "story-notes",
    WORKSPACE / "notes" / "chapter-notes",
    WORKSPACE / "notes" / "arc-notes",
]
OUTPUT = WORKSPACE / "index" / "分析进度.md"
ANALYSIS_PLAN = WORKSPACE / "index" / "分析计划.md"


def note_candidates(source_file: Path) -> set[str]:
    stem = source_file.stem
    return {
        f"{stem}.md",
        f"{stem}-note.md",
        f"{stem}_note.md",
    }


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)
    for note_dir in NOTE_DIRS:
        note_dir.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    source_files = sorted(
        [p for p in SOURCE.iterdir() if p.is_file() and p.name != ".gitkeep"],
        key=lambda p: p.name,
    )
    note_files = []
    for note_dir in NOTE_DIRS:
        note_files.extend(p for p in note_dir.iterdir() if p.is_file() and p.suffix.lower() == ".md")

    note_name_map = {p.name: p for p in note_files}
    completed: list[tuple[Path, Path]] = []
    missing: list[Path] = []
    review: list[str] = []

    plan_text = ANALYSIS_PLAN.read_text(encoding="utf-8", errors="ignore") if ANALYSIS_PLAN.exists() else ""
    planned_arc_notes = planned_arc_note_paths(plan_text)
    completed_arc_notes = [
        path
        for path in planned_arc_notes
        if path.exists() and path.read_text(encoding="utf-8", errors="ignore").strip()
    ]
    missing_arc_notes = [path for path in planned_arc_notes if path not in completed_arc_notes]

    for source_file in source_files:
        candidates = note_candidates(source_file)
        matched = [note_name_map[name] for name in candidates if name in note_name_map]
        if matched:
            completed.append((source_file, matched[0]))
        else:
            same_prefix = [p for p in note_files if p.stem.startswith(source_file.stem) or source_file.stem.startswith(p.stem)]
            if same_prefix:
                review.append(f"- {source_file.name}：可能对应 {', '.join(p.name for p in same_prefix)}")
            else:
                missing.append(source_file)

    lines = [
        "# 分析进度",
        "",
        f"- source 文件数：{len(source_files)}",
        f"- 已完成局部笔记：{len(completed)}",
        f"- 未完成：{len(missing)}",
        f"- 可能需要复查：{len(review)}",
        f"- 计划内 arc-note：{len(completed_arc_notes)}/{len(planned_arc_notes)}",
        "",
        "## 已完成",
    ]

    if completed:
        lines.extend(f"- {src.name} -> {note.relative_to(ROOT)}" for src, note in completed)
    else:
        lines.append("- 暂无")

    lines.extend(["", "## 未完成"])
    if missing:
        lines.extend(f"- {src.name}" for src in missing)
    else:
        lines.append("- 暂无")

    lines.extend(["", "## 可能需要复查"])
    if review:
        lines.extend(review)
    else:
        lines.append("- 暂无")

    lines.extend(["", "## 未完成的 arc-note 汇总"])
    if missing_arc_notes:
        lines.extend(f"- {path.relative_to(ROOT)}" for path in missing_arc_notes)
    else:
        lines.append("- 暂无")

    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"分析进度已写入：{OUTPUT}")


if __name__ == "__main__":
    main()
