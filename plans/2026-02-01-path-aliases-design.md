# Path Aliases Design

## Summary

Replace all relative imports with granular path aliases (`@commands/`, `@lib/`, `@types/`) mapping to `src/` subdirectories.

## Configuration

**tsconfig.json** — Add `baseUrl` and `paths`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@commands/*": ["src/commands/*"],
      "@lib/*": ["src/lib/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

Bun respects `tsconfig.json` paths with `moduleResolution: "bundler"`, so no `bunfig.toml` changes needed.

## Import Rewrite Rules

- All relative imports (`./`, `../`) become aliased imports
- `.ts` extension kept on all imports per project convention
- External packages and `node:` built-ins unchanged

### Examples

| Before | After |
|--------|-------|
| `import { foo } from "../../lib/config.ts"` | `import { foo } from "@lib/config.ts"` |
| `import { bar } from "./ui.ts"` | `import { bar } from "@lib/ui.ts"` |
| `import { Baz } from "../../types/index.ts"` | `import { Baz } from "@types/index.ts"` |

## Scope

- All `.ts` files in `src/commands/`, `src/lib/`, `src/types/`, and their `__tests__/` subdirectories
- `src/index.ts` entry point
