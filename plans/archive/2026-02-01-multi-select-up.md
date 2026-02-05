# Design: Multi-select `skybox up`

**Date:** 2026-02-01
**Status:** Approved

## Summary

When `skybox up` is run without an argument (and can't resolve from cwd), show a checkbox prompt allowing the user to select one or more local projects to start. Multiple projects start sequentially. Post-start behavior adapts based on how many projects were selected.

## Behavior

### Project Selection

- No argument + can't resolve from cwd → checkbox prompt listing all local projects
- User selects one or more projects with spacebar, confirms with Enter
- If exactly one selected → existing single-project flow (unchanged)
- If multiple selected → sequential start with multi-project post-start flow

### Sequential Start (multi-project)

Each project goes through the full existing pipeline in order:
1. Load config
2. Acquire lock
3. Handle decryption
4. Check/resume sync
5. Handle container status
6. Ensure devcontainer config
7. Start container with retry

Track which projects succeeded vs failed. Report summary at end.

### Post-Start: Single Project (unchanged)

Existing flow: editor/shell/both/none prompt.

### Post-Start: Multi-Project

- `--editor` flag → open all in editor, no prompt
- `--attach` flag → ignored for multi-project, open all in editor
- `--no-prompt` → skip post-start entirely
- **Interactive mode:**
  1. Resolve editor once (use config default or prompt for selection)
  2. Show prompt with three choices:
     - "Open all in editor"
     - "Choose which to open" → checkbox list of successfully started projects
     - "Skip"
  3. Open selected projects in editor

## Implementation

All changes in `src/commands/up.ts`:

1. **`resolveProject` → `resolveProjects`**: Return `ResolvedProject[]`. Use `checkbox` from `@inquirer/prompts` when no argument given. Single argument returns one-element array.

2. **`upCommand`**: Loop over resolved projects sequentially. Track successes. After loop, call `handleMultiPostStart` if >1 project started.

3. **New `handleMultiPostStart`**: Editor selection (once), three-choice prompt, open selected projects via `openInEditor`.

4. **Single-project path**: If one project resolved, existing `handlePostStart` runs unchanged.

No new files. No changes outside `up.ts`.

## Documentation Updates Required

- `docs/reference/up.md` — document multi-select behavior
