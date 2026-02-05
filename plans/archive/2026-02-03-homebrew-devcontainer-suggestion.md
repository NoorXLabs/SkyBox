# Smart devcontainer CLI Install Suggestion

**Date:** 2026-02-03
**Status:** Approved

## Summary

When `skybox doctor` detects that the devcontainer CLI is missing, suggest `brew install devcontainer` if Homebrew is available, otherwise fall back to `npm install -g @devcontainers/cli`.

## Implementation

### Code Change

In `src/commands/doctor.ts`, modify `checkDevcontainerCLI()`:

```typescript
function checkDevcontainerCLI(): DoctorCheckResult {
  const name = "Devcontainer CLI";

  try {
    const result = execSync("devcontainer --version", {
      encoding: "utf-8",
      timeout: 5000,
    });
    const version = result.trim() || "installed";

    return {
      name,
      status: "pass",
      message: `devcontainer ${version}`,
    };
  } catch {
    // Check if Homebrew is available for a better suggestion
    let fix = "npm install -g @devcontainers/cli";
    try {
      execSync("which brew", { encoding: "utf-8", timeout: 2000 });
      fix = "brew install devcontainer";
    } catch {
      // Homebrew not available, keep npm suggestion
    }

    return {
      name,
      status: "warn",
      message: "Devcontainer CLI not found",
      fix,
    };
  }
}
```

### Documentation Update

Update `docs/reference/doctor.md` to mention both install options in the "Devcontainer CLI not found" section.

## Testing

Manual testing:
1. Uninstall devcontainer CLI
2. Run `skybox doctor` on macOS with Homebrew - should suggest `brew install devcontainer`
3. Run `skybox doctor` on system without Homebrew - should suggest npm install
