---
name: novel-lore-digest
description: "Use for the Novel Lore Digest project — a pipeline for extracting structured lore from long novels and story collections. Triggers broadly: when users want lore artifacts (角色卡, 世界书, 关系网, 时间线) derived from analyzing existing fiction; when source files like source_raw/ or PROJECT_CONFIG.md are mentioned; when workflow commands appear (启动 Novel Lore Digest, 试跑三篇, 继续下一步, 同步到酒馆, 导出世界书导入块); or when a user asks how to begin turning a novel into SillyTavern content. Not for: writing new fiction, building SillyTavern web UIs, or file format conversion."
---

# Novel Lore Digest

This file is the Claude Code discovery entry for the project workflow. Keep detailed rules in shared project files so Codex and Claude Code use the same source of truth.

## Required navigation

1. Read the project-root `PROJECT_CONFIG.md`.
2. Read the project-root `AGENTS.md` for safety, evidence, and lifecycle rules.
3. Read the project-root `references/workflow.md` for the stage map, script duties, and output specifications.
4. Read only the current stage file under `prompts/` and the templates or references it names.

## Stage selection

For “启动 Novel Lore Digest”, “继续下一步”, “按流程推进”, “试跑三篇”, or similar commands:

1. Run `python scripts/next_step.py`.
2. Read `workspace/index/下一步.md`.
3. Read `prompts/一键启动.md` or `prompts/继续下一步.md`.
4. Execute exactly one major stage.
5. Return the next short command recorded in `workspace/index/下一步.md`.

For “回填台词/语料”, read `prompts/回填台词语料.md`. For SillyTavern export commands, read `prompts/同步到酒馆.md`.

## Hard boundaries

- Never modify `source_raw/`.
- Use only evidence from `source_raw/` and `workspace/source/`.
- Do not skip local notes before global merging or final output.
- Mark uncertainty as 【待核查】 and missing dialogue as 【待回填语料】.
- Keep important conclusions traceable to a source file, story, chapter, or local note.
- Write user-facing analysis in clear Chinese.

