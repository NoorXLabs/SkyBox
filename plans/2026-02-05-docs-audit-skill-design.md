# Documentation Audit Skill Design

> Brainstormed 2026-02-05

## Purpose

Create a Claude Code skill (`skybox-audit-docs`) that comprehensively audits SkyBox documentation for completeness against the codebase and reviews UX quality, producing an interactive review followed by a curated report with actionable tasks.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Output format | Interactive review → markdown report | Filters noise interactively; final report only contains what user cares about |
| Completeness sources | Source code + CHANGELOG + CLAUDE.md | Full triangulation catches drift anywhere |
| UX review scope | Structure, formatting, and discoverability | Holistic review since we're already investing the audit time |
| Trigger | Manual + release-gated | Docs never slip through unaudited before a tag |
| Report location | `.context/docs-audit-YYYY-MM-DD.md` | Gitignored ephemeral working state |

## Architecture

### 4 Phases

1. **Completeness Audit** (parallel subagent) — cross-references `src/commands/`, `src/types/index.ts`, `src/lib/constants.ts`, `CHANGELOG.md`, and `CLAUDE.md` against docs pages
2. **UX & Readability Review** (parallel subagent) — analyzes structure/flow, scannability/formatting, cross-linking/discoverability
3. **Interactive Review** — presents findings category-by-category for user triage (accept/reject/modify)
4. **Report Generation** — writes curated markdown report + creates Claude Code tasks

### Severity/Impact Classification

- Completeness: **missing**, **stale**, **drift**
- UX: **high**, **medium**, **low**

### Integration Points

- `skybox-prep-release` invokes the full audit; **missing** findings warn before tagging
- `skybox-update-docs` suggests the audit when >3 pages need updates

## Files Created/Modified

| File | Action |
|------|--------|
| `.claude/skills/skybox-audit-docs/SKILL.md` | Created |
| `.claude/skills/skybox-prep-release/SKILL.md` | Updated docs audit step |
| `.claude/skills/skybox-update-docs/SKILL.md` | Added audit suggestion rule |

## Documentation Updates Required

None — this is an internal tooling skill, not a user-facing feature.
