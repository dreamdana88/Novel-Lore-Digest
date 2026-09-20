from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import next_step


class MeaningfulTest(TestCase):
    def test_long_file_with_zanwu_in_table_is_still_done(self) -> None:
        with TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "timeline.md"
            path.write_text(
                "# 时间线\n\n"
                "| 庆国 | 戴国 | 说明 |\n"
                "| 赤乐二年 | 暂无已复核的弘始对应 | 旁证不足 |\n"
                + ("事件记录。\n" * 20),
                encoding="utf-8",
            )
            self.assertTrue(next_step.meaningful(path))

    def test_short_placeholder_is_not_done(self) -> None:
        with TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "rules.md"
            path.write_text("# 规则\n\n尚未归并\n", encoding="utf-8")
            self.assertFalse(next_step.meaningful(path))

    def test_empty_file_is_not_done(self) -> None:
        with TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "empty.md"
            path.write_text("", encoding="utf-8")
            self.assertFalse(next_step.meaningful(path))


class ArcNoteProgressTest(TestCase):
    def test_no_manifest_means_no_arc_note_gate(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            plan = root / "分析计划.md"
            plan.write_text("# 分析计划\n", encoding="utf-8")
            with patch.object(next_step, "ROOT", root), patch.object(next_step, "ANALYSIS_PLAN", plan):
                self.assertEqual(
                    next_step.arc_note_progress(),
                    {"expected": 0, "completed": 0, "all_complete": True},
                )

    def test_manifest_counts_only_nonempty_planned_files(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            plan = root / "分析计划.md"
            first = root / "workspace/notes/arc-notes/第一卷.md"
            first.parent.mkdir(parents=True)
            first.write_text("# 第一卷\n", encoding="utf-8")
            plan.write_text(
                "# 分析计划\n\n"
                "## Arc-note 汇总清单\n\n"
                "- `workspace/notes/arc-notes/第一卷.md`\n"
                "- `workspace/notes/arc-notes/第二卷.md`\n",
                encoding="utf-8",
            )
            with patch.object(next_step, "ROOT", root), patch.object(next_step, "ANALYSIS_PLAN", plan):
                self.assertEqual(
                    next_step.arc_note_progress(),
                    {"expected": 2, "completed": 1, "all_complete": False},
                )
