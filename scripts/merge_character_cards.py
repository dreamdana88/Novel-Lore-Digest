"""把 outputs/SillyTavern角色卡/ 下所有单个角色卡 MD 汇总到一个文件。

用法：
    python scripts/merge_character_cards.py

输出：
    outputs/SillyTavern角色卡汇总.md

说明：
    - 按文件名排序拼接，每张卡之间用分隔线。
    - 主角卡（含 <Character_）排在配角卡（含 <NPC_）之前。
    - 不改写卡内容，纯拼接，方便一次性复制或导入星辰工坊。
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARD_DIR = ROOT / "outputs" / "SillyTavern角色卡"
OUTPUT = ROOT / "outputs" / "SillyTavern角色卡汇总.md"


def card_kind(text: str) -> int:
    """主角卡=0 排前，配角卡=1 排后，其它=2。"""
    if "<Character_" in text:
        return 0
    if "<NPC_" in text:
        return 1
    return 2


def main() -> None:
    if not CARD_DIR.exists():
        print(f"未找到角色卡目录：{CARD_DIR}")
        print("请先用 prompts/09_输出SillyTavern角色卡.md 生成单个角色卡。")
        return

    cards = [p for p in CARD_DIR.glob("*.md") if p.is_file() and p.name != OUTPUT.name]
    if not cards:
        print(f"{CARD_DIR} 下没有角色卡 .md 文件。")
        return

    items = []
    for path in cards:
        text = path.read_text(encoding="utf-8", errors="ignore").strip()
        items.append((card_kind(text), path.name, text))

    # 主角在前、配角在后，组内按文件名排序
    items.sort(key=lambda x: (x[0], x[1]))

    main_count = sum(1 for k, _, _ in items if k == 0)
    npc_count = sum(1 for k, _, _ in items if k == 1)

    lines = [
        "# SillyTavern 角色卡汇总",
        "",
        f"共 {len(items)} 张：主角 {main_count}、配角 {npc_count}。",
        "由 `scripts/merge_character_cards.py` 自动拼接，单卡仍在 `outputs/SillyTavern角色卡/`。",
        "",
    ]
    for _, name, text in items:
        lines.append(f"## {Path(name).stem}")
        lines.append("")
        lines.append(text)
        lines.append("")
        lines.append("---")
        lines.append("")

    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"已汇总 {len(items)} 张角色卡 -> {OUTPUT}")
    print(f"主角 {main_count} 张，配角 {npc_count} 张。")


if __name__ == "__main__":
    main()
