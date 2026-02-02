---
name: devbox-list-tasks
description: Use when needing to see remaining tasks from IMPLEMENTATION.md, selecting tasks to work on, or preparing task context for a planning skill.
---

# List and Select Remaining Tasks

## Overview

Parse `plans/IMPLEMENTATION.md` for all unchecked tasks, present them grouped by section, let the user select which to work on, and write the selection to `.context/selected-tasks.md` for handoff to a planning skill.

## Process

1. **Read** `plans/IMPLEMENTATION.md`
2. **Parse** all unchecked items (`- [ ]`) grouped by section header
3. **Present** a numbered summary list grouped by priority:
   - Future Features — High Priority
   - Future Features — Medium Priority
   - Future Features — Lower Priority
   - Future Features — Exploratory
   - Pre-Production Checklist
   - Release Preparation
4. **Ask** the user which tasks to select using `AskUserQuestion` with `multiSelect: true`
   - Each option is formatted as: `[Section] Task Name`
   - Present ALL unchecked tasks as options
5. **Write** the selected tasks to `.context/selected-tasks.md` with full details (description, files, notes, config, dependencies — everything under the task heading in IMPLEMENTATION.md)
6. **Output** a summary of what was written and where

## Parsing Rules

- A task starts with `- [ ] ###` or `- [ ] **` (feature entries vs checklist items)
- A task's body includes all indented lines until the next `- [ ]` or section header (`## `)
- Section headers are `## ` lines — use these to group tasks
- Skip any checked items (`- [x]`)

## Output Format for `.context/selected-tasks.md`

```markdown
# Selected Tasks

> Generated from plans/IMPLEMENTATION.md on YYYY-MM-DD

## High Priority

### Task Name

Full description and metadata copied from IMPLEMENTATION.md

## Medium Priority

### Task Name

...
```

Only include sections that have selected tasks.

## Key Rules

- **Read the file fresh every time** — do not cache or assume contents
- **Preserve full task details** — the planning skill needs all context (files, config, dependencies, notes)
- **Create `.context/` directory** if it doesn't exist
- **Overwrite** `.context/selected-tasks.md` each time — this is ephemeral working state
- **Do not modify** `IMPLEMENTATION.md` — this skill is read-only
