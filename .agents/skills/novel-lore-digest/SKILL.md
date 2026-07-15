---
name: novel-lore-digest
description: "Use for the Novel Lore Digest project — a pipeline for extracting structured lore from long novels and story collections. Triggers broadly: when users want lore artifacts (角色卡, 世界书, 关系网, 时间线) derived from analyzing existing fiction; when source files like source_raw/ or PROJECT_CONFIG.md are mentioned; when workflow commands appear (启动 Novel Lore Digest, 试跑三篇, 继续下一步, 同步到酒馆, 导出世界书导入块); or when a user asks how to begin turning a novel into SillyTavern content. Not for: writing new fiction, building SillyTavern web UIs, or file format conversion."
---

# Novel Lore Digest

This file is the Codex discovery entry for the project workflow. Keep detailed rules in shared project files so Codex and Claude Code use the same source of truth.

## Repository root resolution

Do not assume the current working directory is the repository root.

1. Prefer `git rev-parse --show-toplevel` to determine the repository root from the current location.
2. If the current location is outside the worktree, use the discovered directory containing this `SKILL.md` and run `git -C "<skill-directory>" rev-parse --show-toplevel`.
3. Store the canonical result as `<repo-root>` and verify that `<repo-root>/AGENTS.md` and `<repo-root>/PROJECT_CONFIG.md` exist.
4. Resolve every project resource named below against `<repo-root>`. Before running any project script, set its working directory to `<repo-root>`.

## Required navigation

1. Read `<repo-root>/PROJECT_CONFIG.md`.
2. Read `<repo-root>/AGENTS.md` for safety, evidence, and lifecycle rules.
3. Read `<repo-root>/references/workflow.md` for the stage map, script duties, and output specifications.
4. Read only the current stage file under `<repo-root>/prompts/` and the templates or references it names.

## Stage selection

For “启动 Novel Lore Digest”, “继续下一步”, “按流程推进”, “试跑三篇”, or similar commands:

1. With the working directory set to `<repo-root>`, run `python scripts/next_step.py`.
2. Read `<repo-root>/workspace/index/下一步.md`.
3. Read `<repo-root>/prompts/一键启动.md` or `<repo-root>/prompts/继续下一步.md`.
4. Execute exactly one major stage.
5. Return the next short command recorded in `<repo-root>/workspace/index/下一步.md`.

For “回填台词/语料”, read `<repo-root>/prompts/回填台词语料.md`. For SillyTavern export commands, read `<repo-root>/prompts/同步到酒馆.md`.

## Hard boundaries

- Never modify `<repo-root>/source_raw/`.
- Use only evidence from `<repo-root>/source_raw/` and `<repo-root>/workspace/source/`.
- Do not skip local notes before global merging or final output.
- Mark uncertainty as 【待核查】 and missing dialogue as 【待回填语料】.
- Keep important conclusions traceable to a source file, story, chapter, or local note.
- Write user-facing analysis in clear Chinese.
