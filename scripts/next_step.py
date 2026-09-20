from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "PROJECT_CONFIG.md"
SOURCE_RAW = ROOT / "source_raw"
WORKSPACE = ROOT / "workspace"
SOURCE = WORKSPACE / "source"
INDEX = WORKSPACE / "index"
NOTES = WORKSPACE / "notes"
ENTITIES = WORKSPACE / "entities"
OUTPUTS = ROOT / "outputs"
NEXT_STEP = INDEX / "下一步.md"
ANALYSIS_PLAN = INDEX / "分析计划.md"
ARC_NOTE_PLAN_HEADING = "## Arc-note 汇总清单"

REQUIRED_CONFIG_LABELS = [
    "作品名",
    "作者",
    "作品结构类型",
    "分析重点",
    "需要深度分析的主要角色",
    "是否生成 SillyTavern 世界书",
    "是否生成 SillyTavern 角色汇总",
]

OUTPUT_FLAG_LABELS = {
    "worldbook": "是否生成 SillyTavern 世界书",
    "characterSummary": "是否生成 SillyTavern 角色汇总",
    "outline": "是否生成剧情大纲",
    "timeline": "是否生成时间线",
    "style": "是否生成文风条目",
}

YES_VALUES = {"是", "要", "yes", "YES", "y", "Y", "true", "1"}

PLACEHOLDER_HINTS = ["尚未生成", "尚未归并", "暂无", "- 暂无"]
# 短于这个长度、且整篇只剩占位句，才当成空模板。长文里的「暂无已复核对照」不算未生成。
PLACEHOLDER_MAX_BODY_CHARS = 80


def read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def meaningful(path: Path) -> bool:
    """文件是否已有实质内容。只把空文件或短占位模板判为未完成。"""
    text = read(path)
    if not text:
        return False
    body_lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    if not body_lines:
        return False
    body = "\n".join(body_lines)
    if len(body) >= PLACEHOLDER_MAX_BODY_CHARS:
        return True
    return not any(hint in body for hint in PLACEHOLDER_HINTS)


def has_files(path: Path, suffixes: set[str] | None = None) -> bool:
    if not path.exists():
        return False
    for item in path.rglob("*"):
        if item.is_file() and item.name != ".gitkeep" and (suffixes is None or item.suffix.lower() in suffixes):
            return True
    return False


def config_missing() -> list[str]:
    text = read(CONFIG)
    if not text:
        return ["PROJECT_CONFIG.md"]
    missing: list[str] = []
    if "- 作品名：" in text and not _value_after_label(text, "作品名"):
        missing.append("作品名")
    if "- 作者：" in text and not _value_after_label(text, "作者"):
        missing.append("作者")
    if not _section_has_selected(text, "## 作品结构类型") and not _value_after_label(text, "其他"):
        missing.append("作品结构类型")
    if not _section_has_selected(text, "## 分析重点"):
        missing.append("分析重点")
    if not _has_nonempty_under_heading(text, "### 需要深度分析的主要角色"):
        missing.append("目标角色清单")
    missing.extend(_missing_output_labels(text))
    return missing


def _value_after_label(text: str, label: str) -> str:
    prefix = f"- {label}："
    for line in text.splitlines():
        if line.startswith(prefix):
            return line[len(prefix) :].strip()
    return ""


def _section_has_selected(text: str, heading: str) -> bool:
    lines = text.splitlines()
    try:
        start = lines.index(heading)
    except ValueError:
        return False
    for line in lines[start + 1 :]:
        if line.startswith("## "):
            break
        stripped = line.strip()
        if stripped.startswith("- 已选择：") and stripped.split("：", 1)[-1].strip():
            return True
        if stripped.lower().startswith(("- [x] ", "* [x] ")):
            return True
    return False


def _is_yes(value: str) -> bool:
    return value.strip() in YES_VALUES


def _missing_output_labels(text: str) -> list[str]:
    return [
        label
        for label in OUTPUT_FLAG_LABELS.values()
        if _value_after_label(text, label) not in {"是", "否"}
    ]


def read_output_flags(text: str) -> dict[str, bool]:
    return {key: _is_yes(_value_after_label(text, label)) for key, label in OUTPUT_FLAG_LABELS.items()}


def _selected_status(enabled: bool, present: bool, label: str, missing: str) -> str:
    if not enabled:
        return f"{label}：未选择"
    return f"{label}：{present and '已有内容' or missing}"


def decide_selected_outputs(flags: dict[str, bool], artifacts: dict[str, bool]) -> tuple[str, str]:
    """Foundation complete: config, source, notes, appearance table, characters, rules."""
    need_outline = flags.get("outline") and not artifacts.get("outline")
    need_timeline = flags.get("timeline") and not artifacts.get("timeline")
    if need_outline and need_timeline:
        return "生成剧情大纲与时间线", "生成剧情大纲与时间线。"
    if need_outline:
        return "生成剧情大纲", "生成剧情大纲。"
    if need_timeline:
        return "生成时间线", "生成时间线。"
    if flags.get("style") and not artifacts.get("style"):
        return "生成文风条目", "生成文风条目。"
    if flags.get("worldbook") and not artifacts.get("worldbook"):
        return "输出 SillyTavern 世界书", "输出 SillyTavern 世界书。"
    if flags.get("characterSummary"):
        if not artifacts.get("character_files"):
            return "输出 SillyTavern 角色汇总", "输出 SillyTavern 角色汇总。"
        if not artifacts.get("character_merge"):
            return "归并角色汇总用于核查", "归并角色卡。"
    if flags.get("worldbook") and flags.get("characterSummary") and not artifacts.get("story_card"):
        return "导出 SillyTavern 作品角色卡 JSON", "同步到酒馆。"
    if not any(flags.values()):
        return "基础整理已完成，未选择最终输出", "继续下一步。"
    return "生成待核查清单或复查最终导出", "继续下一步。"


def _has_nonempty_under_heading(text: str, heading: str) -> bool:
    lines = text.splitlines()
    try:
        start = lines.index(heading)
    except ValueError:
        return False
    for line in lines[start + 1 :]:
        if line.startswith("## ") or line.startswith("### "):
            break
        stripped = line.strip()
        if stripped.startswith("- ") and stripped not in {"-", "- "} and not stripped.endswith("："):
            content = stripped[2:].strip()
            if content and not content.endswith("："):
                return True
    return False


def note_candidates(source_file: Path) -> set[str]:
    stem = source_file.stem
    return {
        f"{stem}.md",
        f"{stem}-note.md",
        f"{stem}_note.md",
    }


def planned_arc_note_paths(text: str) -> list[Path]:
    paths: list[Path] = []
    in_section = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == ARC_NOTE_PLAN_HEADING:
            in_section = True
            continue
        if in_section and stripped.startswith("## "):
            break
        if in_section and stripped.startswith("- `") and "`" in stripped[3:]:
            relative_path = stripped.split("`", 2)[1]
            paths.append(ROOT / relative_path)
    return paths


def arc_note_progress() -> dict[str, int | bool]:
    planned = planned_arc_note_paths(read(ANALYSIS_PLAN))
    completed = sum(1 for path in planned if bool(read(path)))
    return {
        "expected": len(planned),
        "completed": completed,
        "all_complete": completed == len(planned),
    }


def local_note_progress() -> dict[str, int | bool]:
    source_files = sorted(
        [path for path in SOURCE.iterdir() if path.is_file() and path.name != ".gitkeep"] if SOURCE.exists() else [],
        key=lambda path: path.name,
    )
    note_dirs = [NOTES / "story-notes", NOTES / "chapter-notes", NOTES / "arc-notes"]
    note_files = [
        path
        for folder in note_dirs
        if folder.exists()
        for path in folder.rglob("*.md")
        if path.is_file() and bool(read(path))
    ]
    note_name_map: dict[str, list[Path]] = {}
    for note_file in note_files:
        note_name_map.setdefault(note_file.name, []).append(note_file)

    completed = 0
    missing = 0
    review = 0
    for source_file in source_files:
        matched = [
            note_file
            for candidate in note_candidates(source_file)
            for note_file in note_name_map.get(candidate, [])
        ]
        if len(matched) == 1:
            completed += 1
            continue
        if len(matched) > 1:
            review += 1
            continue
        same_prefix = [
            note_file
            for note_file in note_files
            if note_file.stem.startswith(source_file.stem) or source_file.stem.startswith(note_file.stem)
        ]
        if same_prefix:
            review += 1
        else:
            missing += 1

    source_count = len(source_files)
    return {
        "source_count": source_count,
        "note_count": len(note_files),
        "completed": completed,
        "missing": missing,
        "review": review,
        "all_complete": source_count > 0 and completed == source_count and review == 0,
    }


def decide_local_note_stage(progress: dict[str, int | bool]) -> tuple[str, str] | None:
    if progress["note_count"] == 0:
        return "按推荐三篇试跑局部笔记", "按推荐三篇试跑。"
    if not progress["all_complete"]:
        return "继续批量生成局部笔记，完成后生成角色出场表", "继续批量生成局部笔记。"
    return None


def decide() -> tuple[str, str, list[str]]:
    missing = config_missing()
    note_progress = local_note_progress()
    arc_progress = arc_note_progress()
    config_text = read(CONFIG)
    flags = read_output_flags(config_text) if config_text else {key: False for key in OUTPUT_FLAG_LABELS}
    artifacts = {
        "outline": meaningful(OUTPUTS / "剧情大纲.md"),
        "timeline": meaningful(ENTITIES / "timeline.md"),
        "style": meaningful(OUTPUTS / "文风条目.md"),
        "worldbook": meaningful(OUTPUTS / "SillyTavern世界书.md"),
        "character_files": has_files(OUTPUTS / "SillyTavern角色汇总", {".md"}),
        "character_merge": meaningful(OUTPUTS / "SillyTavern角色汇总.md"),
        "story_card": has_files(OUTPUTS / "sillytavern-story-card", {".json"}),
    }
    status = [
        f"PROJECT_CONFIG.md：{'缺失/未填完整' if missing else '已填写基本项'}",
        f"source_raw/：{'有原文文件' if has_files(SOURCE_RAW, {'.txt', '.md'}) else '无 txt/md 原文'}",
        f"workspace/source/：{'已有处理文本' if has_files(SOURCE) else '尚未准备'}",
        f"workspace/index/文本索引.md：{'存在' if meaningful(INDEX / '文本索引.md') else '不存在或为空'}",
        f"workspace/index/分析计划.md：{'存在' if meaningful(INDEX / '分析计划.md') else '不存在或为空'}",
        (
            "局部笔记："
            f"{note_progress['completed']}/{note_progress['source_count']} 个 source 已完成，"
            f"{note_progress['note_count']} 个非空笔记，"
            f"{note_progress['review']} 个需复查"
        ),
        (
            f"arc-note 汇总：{arc_progress['completed']}/{arc_progress['expected']}"
            if arc_progress["expected"]
            else "arc-note 汇总：未计划"
        ),
        f"workspace/index/角色出场表.md：{'存在' if meaningful(INDEX / '角色出场表.md') else '不存在或为空'}",
        f"workspace/entities/characters.md：{'已有内容' if meaningful(ENTITIES / 'characters.md') else '未归并'}",
        f"workspace/entities/rules.md：{'已有内容' if meaningful(ENTITIES / 'rules.md') else '未归并'}",
        _selected_status(flags["outline"], artifacts["outline"], "outputs/剧情大纲.md", "未生成"),
        _selected_status(flags["timeline"], artifacts["timeline"], "workspace/entities/timeline.md", "未生成"),
        _selected_status(flags["style"], artifacts["style"], "outputs/文风条目.md", "未生成"),
        _selected_status(flags["worldbook"], artifacts["worldbook"], "outputs/SillyTavern世界书.md", "未生成"),
        _selected_status(
            flags["characterSummary"],
            artifacts["character_files"],
            "outputs/SillyTavern角色汇总/",
            "未生成角色文件",
        ),
        _selected_status(
            flags["characterSummary"],
            artifacts["character_merge"],
            "outputs/SillyTavern角色汇总.md",
            "未汇总",
        ),
        (
            f"outputs/sillytavern-story-card/：{'已有作品角色卡 JSON' if artifacts['story_card'] else '未导出'}"
            if flags["worldbook"] and flags["characterSummary"]
            else "outputs/sillytavern-story-card/：未选择（需同时开启世界书和角色汇总）"
        ),
    ]

    if missing:
        return "补全 PROJECT_CONFIG.md", "启动 Novel Lore Digest。", status + ["缺失项：" + "、".join(missing)]
    if not has_files(SOURCE_RAW, {".txt", ".md"}):
        return "把小说 txt/md 放进 source_raw/", "启动 Novel Lore Digest。", status
    if not has_files(SOURCE) or not meaningful(INDEX / "文本索引.md"):
        return "准备文本并生成文本索引", "启动 Novel Lore Digest。", status
    if not meaningful(INDEX / "分析计划.md"):
        return "生成分析计划", "继续下一步。", status
    local_note_step = decide_local_note_stage(note_progress)
    if local_note_step:
        step, command = local_note_step
        return step, command, status
    if not arc_progress["all_complete"]:
        return (
            f"生成逐卷 arc-note（{arc_progress['completed']}/{arc_progress['expected']}）",
            "继续生成逐卷汇总。",
            status,
        )
    if not meaningful(INDEX / "角色出场表.md"):
        return "生成角色出场表", "生成角色出场表。", status
    if not meaningful(ENTITIES / "characters.md"):
        return "归并主要角色", "开始归并角色。", status
    if not meaningful(ENTITIES / "rules.md"):
        return "归并世界观", "开始归并世界观。", status
    step, command = decide_selected_outputs(flags, artifacts)
    return step, command, status


def main() -> None:
    INDEX.mkdir(parents=True, exist_ok=True)
    step, command, status = decide()
    lines = [
        "# 下一步",
        "",
        f"## 建议动作",
        step,
        "",
        "## 你可以直接对 AI 说",
        f"```txt\n{command}\n```",
        "",
        "## 当前状态",
    ]
    lines.extend(f"- {item}" for item in status)
    NEXT_STEP.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"下一步建议：{step}")
    print(f"建议口令：{command}")
    print(f"已写入：{NEXT_STEP}")


if __name__ == "__main__":
    main()

