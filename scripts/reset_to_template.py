"""重置项目为空白模板状态。

用法：
    python scripts/reset_to_template.py

效果：
    - 清空 source_raw/ 中的用户输入
    - 清空 workspace/ 中的全部处理中间产物
    - 清空 outputs/ 中的全部用户输出
    - 重置 PROJECT_CONFIG.md

注意：此操作不可恢复，请确认已备份或另存当前项目。
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "workspace"
CONFIG = ROOT / "PROJECT_CONFIG.md"
CONFIG_TEMPLATE = ROOT / "templates" / "project-config-template.md"

CLEAR_DIRS = [
    ROOT / "source_raw",
    WORKSPACE / "source",
    WORKSPACE / "index",
    WORKSPACE / "notes" / "story-notes",
    WORKSPACE / "notes" / "chapter-notes",
    WORKSPACE / "notes" / "arc-notes",
    WORKSPACE / "entities",
    ROOT / "outputs",
]


def confirm() -> bool:
    print("此操作将清空当前项目所有原文、分析内容和输出，不可恢复。")
    print(f"目标目录：{ROOT}")
    answer = input("确认清空？(输入 yes 继续): ").strip().lower()
    return answer == "yes"


def clear_generated_files(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for path in directory.rglob("*"):
        if path.is_file() and path.name != ".gitkeep":
            path.unlink()


def main() -> None:
    if "--force" not in sys.argv and not confirm():
        print("已取消。")
        return

    for directory in CLEAR_DIRS:
        clear_generated_files(directory)
        print(f"已清空：{directory.relative_to(ROOT)}")

    CONFIG.write_text(CONFIG_TEMPLATE.read_text(encoding="utf-8"), encoding="utf-8")
    print("已重置：PROJECT_CONFIG.md")
    print("\n模板已还原为空白状态。")
    print("下次开始：填写 PROJECT_CONFIG.md，把小说 txt/md 放进 source_raw/。")


if __name__ == "__main__":
    main()
