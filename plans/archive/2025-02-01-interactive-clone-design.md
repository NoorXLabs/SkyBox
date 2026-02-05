# Interactive `skybox clone` Design

## Summary

When `skybox clone` is run without arguments, it fetches remote projects, presents a multi-select checkbox, clones selected projects sequentially, then offers to start one via the full `skybox up` flow.

## Detailed Flow

### Argument-less `skybox clone`

1. Select remote (`selectRemote()`)
2. Fetch remote projects (reuse `getRemoteProjects()` from browse.ts)
3. Filter out projects already cloned locally (`getLocalProjects()`)
4. Show checkbox (multi-select): "Select projects to clone:"
5. Clone each selected project sequentially with per-project progress
6. If only 1 project selected → existing single-clone behavior (offer container start)

### Multi-clone post-completion

1. Summary: "Cloned N projects: foo, bar, baz"
2. Single-select prompt: "Which project would you like to start working on?" (lists cloned projects + "None")
3. If project selected → call `upCommand(project, {})` for full startup flow
4. After completion (or "None"), print reminder:
   ```
   Run 'skybox up <name>' to start your other cloned projects:
     - bar
     - baz
   ```

## Implementation Changes

### `src/commands/browse.ts`
- Export `getRemoteProjects()` (currently private)

### `src/commands/clone.ts`
- Handle `project` being `undefined` → trigger interactive flow
- Import `getRemoteProjects` from browse.ts
- Import `checkbox` from `@inquirer/prompts` for multi-select
- Import `getLocalProjects` from project.ts to filter already-cloned
- Add `interactiveClone()` function:
  - Fetches remote projects
  - Filters out local duplicates
  - Shows checkbox prompt
  - Loops through selections, calling existing `cloneCommand()` logic per project
  - Shows post-clone summary and "which to start" prompt
- Existing single-argument behavior unchanged

### No new files or dependencies
- `checkbox` already available via `@inquirer/prompts` (transitive from inquirer)
- `getLocalProjects()` already exists in `src/lib/project.ts`
