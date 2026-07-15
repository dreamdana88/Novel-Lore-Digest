---
name: novel-lore-digest
description: "Use for the Novel Lore Digest project — a pipeline for extracting structured lore from long novels and story collections. Triggers broadly: when users want lore artifacts (角色卡, 世界书, 关系网, 时间线) derived from analyzing existing fiction; when source files like source_raw/ or PROJECT_CONFIG.md are mentioned; when workflow commands appear (启动 Novel Lore Digest, 试跑三篇, 继续下一步, 同步到酒馆, 导出世界书导入块); or when a user asks how to begin turning a novel into SillyTavern content. Not for: writing new fiction, building SillyTavern web UIs, or file format conversion."
---

# Novel Lore Digest

This file is the Claude Code discovery entry for the project workflow. Keep detailed rules in shared project files so Codex and Claude Code use the same source of truth.

## Repository root resolution

Do not assume the current working directory is the repository root.

1. Use the Skill location supplied by Claude Code to resolve the repository root: `git -C "${CLAUDE_SKILL_DIR}" rev-parse --show-toplevel`.
2. Store the canonical result as `$REPO_ROOT` and verify that `$REPO_ROOT/AGENTS.md` and `$REPO_ROOT/PROJECT_CONFIG.md` exist.
3. Resolve every project resource named below against `$REPO_ROOT`. Run project scripts with `$REPO_ROOT` as their working directory.
4. Keep root discovery and script execution in the same shell context when needed, for example: `REPO_ROOT="$(git -C "${CLAUDE_SKILL_DIR}" rev-parse --show-toplevel)" && cd "$REPO_ROOT" && python scripts/next_step.py`.

## Required navigation

1. Read `$REPO_ROOT/PROJECT_CONFIG.md`.
2. Read `$REPO_ROOT/AGENTS.md` for safety, evidence, and lifecycle rules.
3. Read `$REPO_ROOT/references/workflow.md` for the stage map, script duties, and output specifications.
4. Read only the current stage file under `$REPO_ROOT/prompts/` and the templates or references it names.

## Stage selection

For “启动 Novel Lore Digest”, “继续下一步”, “按流程推进”, “试跑三篇”, or similar commands:

1. With the working directory set to `$REPO_ROOT`, run `python scripts/next_step.py`.
2. Read `$REPO_ROOT/workspace/index/下一步.md`.
3. Read `$REPO_ROOT/prompts/一键启动.md` or `$REPO_ROOT/prompts/继续下一步.md`.
4. Execute exactly one major stage.
5. Return the next short command recorded in `$REPO_ROOT/workspace/index/下一步.md`.

For “回填台词/语料”, read `$REPO_ROOT/prompts/回填台词语料.md`. For SillyTavern export commands, read `$REPO_ROOT/prompts/同步到酒馆.md`.

## Hard boundaries

- Never modify `$REPO_ROOT/source_raw/`.
- Use only evidence from `$REPO_ROOT/source_raw/` and `$REPO_ROOT/workspace/source/`.
- Do not skip local notes before global merging or final output.
- Mark uncertainty as 【待核查】 and missing dialogue as 【待回填语料】.
- Keep important conclusions traceable to a source file, story, chapter, or local note.
- Write user-facing analysis in clear Chinese.

