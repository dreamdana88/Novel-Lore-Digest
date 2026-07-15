from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "PROJECT_CONFIG.md"
CONFIG_TEMPLATE = ROOT / "templates" / "project-config-template.md"


def main() -> None:
    if CONFIG.exists():
        print(f"PROJECT_CONFIG.md 已存在，不覆盖：{CONFIG}")
    else:
        CONFIG.write_text(CONFIG_TEMPLATE.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"已创建 PROJECT_CONFIG.md：{CONFIG}")

    print("请先填写：作品名、作品结构类型、目标角色、输出目标。")


if __name__ == "__main__":
    main()
