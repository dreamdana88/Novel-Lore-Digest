---
name: novel-lore-digest
description: "Use for the Novel Lore Digest project — a pipeline for extracting structured lore from long novels and story collections. Triggers broadly: when users want lore artifacts (角色卡, 世界书, 关系网, 时间线) derived from analyzing existing fiction; when source files like source_raw/ or PROJECT_CONFIG.md are mentioned; when workflow commands appear (启动 Novel Lore Digest, 试跑三篇, 继续下一步, 同步到酒馆, 导出世界书导入块); or when a user asks how to begin turning a novel into SillyTavern content. Not for: writing new fiction, building SillyTavern web UIs, or file format conversion."
---

# Novel Lore Digest

This skill helps analyze long novels, story collections, series fiction, case-based fiction, adventure arcs, fantasy worldbuilding, folklore horror, urban fantasy, and supernatural investigation stories.

Use this skill when the user wants to turn source fiction into reusable lore documents, including:
- character profiles
- relationship maps
- worldbuilding rules
- timelines
- plot outlines
- species or monster rules
- organization or faction records
- SillyTavern worldbook entries
- SillyTavern character cards

## Required first step

Always read PROJECT_CONFIG.md before doing anything else.

Confirm:
- work title
- author
- structure type
- analysis goals
- target characters
- output targets
- special cautions

## Never do these

- Never modify source_raw/.
- Never invent information not supported by the source text.
- Never skip local notes and jump directly to final character cards or worldbook entries.
- Never turn a one-off story rule into a global setting rule without evidence.
- Never deeply analyze one-time background characters unless PROJECT_CONFIG.md asks for it.

## Workflow

The single source of truth for detailed stages, script duties, and StarForge/SillyTavern output specs is `references/workflow.md` + `prompts/` (00→11, plus 一键启动 / 继续下一步 / 试跑三篇 / 回填台词 / 同步到酒馆). Read workflow.md and follow its order. Do not restate stage detail here — keep it as overview only to avoid drift.

Skeleton: read PROJECT_CONFIG → prepare text → analysis plan → local notes (with character dialogue lines) → 角色出场表 → merge entities → plot/worldbuilding/timeline summaries → SillyTavern worldbook + 角色汇总（主角 `<Character_>` / 配角 `<NPC_>`） → merge role summary for review → export one work-title SillyTavern character JSON with all content embedded in `character_book` → consistency check + pending list.

## Evidence rule

Important conclusions must include source file, story title, chapter title, or local-note reference.

Uncertain information must be marked as 【待核查】.

## Style

Use clear Chinese output.
Prefer structured markdown.
Keep outputs practical for SillyTavern and immersive roleplay use.

## Lazy Mode

If the user says “启动 Novel Lore Digest”, “继续下一步”, “按流程推进”, “试跑三篇”, or similar short commands, do not ask them to paste long prompts.

Instead:
1. Run `python scripts/next_step.py`. It deterministically inspects project state and writes `index/下一步.md` with the suggested action, the exact short command to give next, and a status snapshot. Trust this over guessing the stage yourself.
2. Read PROJECT_CONFIG.md if you have not already this session.
3. Read prompts/一键启动.md or prompts/继续下一步.md for the detailed instructions of the suggested stage.
4. Execute only that one stage — never chain several big stages at once.
5. At the end, tell the user the next short command (copy it from `index/下一步.md`).

If the user says “回填台词” / “回填语料”, read `prompts/回填台词语料.md` and backfill the dialogue field of existing local notes (re-read the source text, do not invent).

## Export To SillyTavern

If the user says “同步到酒馆”, “导出世界书导入块”, or “准备星辰工坊导入”:
1. Read `prompts/同步到酒馆.md`.
2. Default to `python scripts/export_story_card_for_sillytavern.py` for a one-card SillyTavern import unless the user explicitly asks for the legacy StarForge worldbook block.
3. Use `outputs/sillytavern-story-card/{作品名}.json` as the final SillyTavern import artifact.
4. Do not directly modify SillyTavern storage files.
