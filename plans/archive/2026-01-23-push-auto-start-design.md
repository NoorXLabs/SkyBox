# Push Auto-Start Feature Design

**Date:** 2026-01-23
**Status:** Approved

## Overview

The `push` command currently shows a stub message when users choose to start the dev container after pushing. This design completes the feature by calling `upCommand` directly.

## Behavior

- **User says "yes" to "Start dev container now?"** → Calls `upCommand(projectName, {})` for the full up experience (lock acquisition, devcontainer setup, container start, editor/shell prompts)
- **User says "no"** → Shows project location and hint message

## Implementation

### Files Changed

- `src/commands/push.ts`

### Changes

1. **Add import** at the top of `push.ts`:

```typescript
import { upCommand } from "./up.ts";
```

2. **Replace the stub logic** (lines 215-223):

**Before:**
```typescript
if (startContainer) {
    info(
        "Container startup not yet implemented. Run 'devbox up " +
            projectName +
            "' when ready.",
    );
} else {
    info(`Run 'devbox up ${projectName}' when ready to start working.`);
}
```

**After:**
```typescript
if (startContainer) {
    await upCommand(projectName, {});
} else {
    info(`Project saved to ${localPath}`);
    info(`Run 'devbox up ${projectName}' when ready to start working.`);
}
```

## Edge Cases

All edge cases are handled automatically by `upCommand`:

- No devcontainer.json → prompts for template selection
- Lock conflict → prompts for takeover
- Container already running → prompts for restart/rebuild
- Editor preference → prompts and saves to config
- Sync already running from push → `up` confirms it's active

## UX Flow

After push completes and user chooses to start the container:

```
✔ Initial sync complete

? Start dev container now? Yes

─── Starting 'DevBox'... ───────────────────────
ℹ Lock acquired
✔ Sync is active
...
```

The `up` command's header provides a natural visual break between the push and container startup phases.
