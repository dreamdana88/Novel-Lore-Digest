"""重置项目为空白模板状态。

用法：
    python scripts/reset_to_template.py

效果：
    - 清空 source_raw/、source/、notes/、outputs/、exports/ 下所有文件
    - 删除 index/ 下生成的分析文件
    - 清空 entities/ 下所有 .md 文件内容（保留文件）
    - 重置 PROJECT_CONFIG.md 为空白模板

注意：此操作不可恢复，请确认已备份或另存当前项目。
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CLEAR_DIRS = [
    ROOT / "source_raw",
    ROOT / "source",
    ROOT / "notes" / "story-notes",
    ROOT / "notes" / "chapter-notes",
    ROOT / "notes" / "arc-notes",
    ROOT / "outputs",
    ROOT / "exports",
]

INDEX_FILES = [
    "文本索引.md",
    "分析计划.md",
    "分析进度.md",
    "角色出场表.md",
    "下一步.md",
    "待核查清单.md",
]

BLANK_CONFIG = """# PROJECT_CONFIG

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


def confirm() -> bool:
    print("此操作将清空当前项目所有分析内容，不可恢复。")
    print(f"目标目录：{ROOT}")
    ans = input("确认清空？(输入 yes 继续): ").strip().lower()
    return ans == "yes"


def main() -> None:
    if "--force" not in sys.argv and not confirm():
        print("已取消。")
        return

    # 清空工作目录
    for d in CLEAR_DIRS:
        d.mkdir(parents=True, exist_ok=True)
        for f in d.rglob("*"):
            if f.is_file() and f.name != ".gitkeep":
                f.unlink()
        print(f"已清空: {d.relative_to(ROOT)}")

    # 删除 index 生成文件
    index_dir = ROOT / "index"
    index_dir.mkdir(exist_ok=True)
    for name in INDEX_FILES:
        p = index_dir / name
        if p.exists():
            p.unlink()
            print(f"已删除: index/{name}")

    # 清空 entities .md 文件内容
    entities_dir = ROOT / "entities"
    if entities_dir.exists():
        for f in entities_dir.glob("*.md"):
            f.write_text("", encoding="utf-8")
            print(f"已清空: entities/{f.name}")

    # 重置 PROJECT_CONFIG.md
    config = ROOT / "PROJECT_CONFIG.md"
    config.write_text(BLANK_CONFIG, encoding="utf-8")
    print("已重置: PROJECT_CONFIG.md")

    print("\n模板已还原为干净状态。")
    print("下次新建项目：复制整个文件夹，改名，然后填写 PROJECT_CONFIG.md 开始分析。")


if __name__ == "__main__":
    main()
