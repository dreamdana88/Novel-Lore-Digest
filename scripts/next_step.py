from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "PROJECT_CONFIG.md"
SOURCE_RAW = ROOT / "source_raw"
SOURCE = ROOT / "source"
INDEX = ROOT / "index"
NOTES = ROOT / "notes"
ENTITIES = ROOT / "entities"
OUTPUTS = ROOT / "outputs"
NEXT_STEP = INDEX / "下一步.md"

REQUIRED_CONFIG_LABELS = [
    "作品名",
    "作者",
    "作品结构类型",
    "分析重点",
    "需要深度分析的主要角色",
    "是否生成 SillyTavern 世界书",
    "是否生成 SillyTavern 角色汇总",
]

PLACEHOLDER_HINTS = ["尚未生成", "尚未归并", "暂无", "- 暂无"]


def read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def meaningful(path: Path) -> bool:
    text = read(path)
    if not text:
        return False
    return not any(hint in text for hint in PLACEHOLDER_HINTS)


def has_files(path: Path, suffixes: set[str] | None = None) -> bool:
    if not path.exists():
        return False
    for item in path.rglob("*"):
        if item.is_file() and (suffixes is None or item.suffix.lower() in suffixes):
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
    for label in ["是否生成 SillyTavern 世界书", "是否生成 SillyTavern 角色汇总"]:
        if not _value_after_label(text, label):
            missing.append(label)
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
        if stripped.startswith("- ") and not any(hint in stripped for hint in ["请在下列", "请勾选或填写"]):
            content = stripped[2:].strip()
            if content and not content.endswith("："):
                return True
        if stripped.startswith("* ") and not any(hint in stripped for hint in ["请在下列", "请勾选或填写"]):
            content = stripped[2:].strip()
            if content and not content.endswith("："):
                return True
    return False


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


def local_note_count() -> int:
    if not NOTES.exists():
        return 0
    dirs = [NOTES / "story-notes", NOTES / "chapter-notes", NOTES / "arc-notes"]
    return sum(1 for folder in dirs if folder.exists() for path in folder.rglob("*.md") if path.is_file())


def decide() -> tuple[str, str, list[str]]:
    missing = config_missing()
    note_count = local_note_count()
    status = [
        f"PROJECT_CONFIG.md：{'缺失/未填完整' if missing else '已填写基本项'}",
        f"source_raw/：{'有原文文件' if has_files(SOURCE_RAW, {'.txt', '.md'}) else '无 txt/md 原文'}",
        f"source/：{'已有 source 文件' if has_files(SOURCE) else '尚未准备'}",
        f"index/文本索引.md：{'存在' if meaningful(INDEX / '文本索引.md') else '不存在或为空'}",
        f"index/分析计划.md：{'存在' if meaningful(INDEX / '分析计划.md') else '不存在或为空'}",
        f"局部笔记：{note_count} 个",
        f"index/角色出场表.md：{'存在' if meaningful(INDEX / '角色出场表.md') else '不存在或为空'}",
        f"entities/characters.md：{'已有内容' if meaningful(ENTITIES / 'characters.md') else '未归并'}",
        f"entities/rules.md：{'已有内容' if meaningful(ENTITIES / 'rules.md') else '未归并'}",
        f"outputs/SillyTavern世界书.md：{'已有内容' if meaningful(OUTPUTS / 'SillyTavern世界书.md') else '未生成'}",
        f"outputs/SillyTavern角色汇总/：{'已有角色文件' if has_files(OUTPUTS / 'SillyTavern角色汇总', {'.md'}) else '未生成角色文件'}",
        f"outputs/SillyTavern角色汇总.md：{'已有核查汇总' if meaningful(OUTPUTS / 'SillyTavern角色汇总.md') else '未汇总'}",
        f"outputs/sillytavern-story-card/：{'已有作品角色卡 JSON' if has_files(OUTPUTS / 'sillytavern-story-card', {'.json'}) else '未导出'}",
    ]

    if missing:
        return "补全 PROJECT_CONFIG.md", "启动 Novel Lore Digest。", status + ["缺失项：" + "、".join(missing)]
    if not has_files(SOURCE_RAW, {".txt", ".md"}):
        return "把小说 txt/md 放进 source_raw/", "启动 Novel Lore Digest。", status
    if not has_files(SOURCE) or not meaningful(INDEX / "文本索引.md"):
        return "准备文本并生成文本索引", "启动 Novel Lore Digest。", status
    if not meaningful(INDEX / "分析计划.md"):
        return "生成分析计划", "继续下一步。", status
    if note_count == 0:
        return "按推荐三篇试跑局部笔记", "按推荐三篇试跑。", status
    if not meaningful(INDEX / "角色出场表.md"):
        return "继续批量生成局部笔记，完成后生成角色出场表", "继续批量生成局部笔记。", status
    if not meaningful(ENTITIES / "characters.md"):
        return "归并主要角色", "开始归并角色。", status
    if not meaningful(ENTITIES / "rules.md"):
        return "归并世界观", "开始归并世界观。", status
    if not meaningful(OUTPUTS / "SillyTavern世界书.md"):
        return "输出 SillyTavern 世界书", "输出 SillyTavern 世界书。", status
    if not has_files(OUTPUTS / "SillyTavern角色汇总", {".md"}):
        return "输出 SillyTavern 角色汇总", "输出 SillyTavern 角色汇总。", status
    if not meaningful(OUTPUTS / "SillyTavern角色汇总.md"):
        return "归并角色汇总用于核查", "归并角色卡。", status
    if not has_files(OUTPUTS / "sillytavern-story-card", {".json"}):
        return "导出 SillyTavern 作品角色卡 JSON", "同步到酒馆。", status
    return "生成待核查清单或复查最终导出", "继续下一步。", status


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

