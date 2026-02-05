# Design Decisions

This document explains the key architectural decisions in SkyBox and the reasoning behind them.

## Why Local-First?

**Decision:** Run containers locally and sync code bidirectionally with a remote server, rather than running containers on the remote.

**Rationale:**

1. **Zero latency for tools** - Claude Code, language servers, and other dev tools run at full speed without network round-trips.

2. **Works offline** - Continue working when disconnected. Changes sync when back online.

3. **Better editor integration** - VS Code/Cursor attach to local containers seamlessly.

4. **Familiar debugging** - Local containers behave identically to standard Docker development.

**Trade-offs:**

- Requires local disk space for project files (mitigated by sync only active projects)
- Local machine needs enough RAM/CPU for containers
- Sync can have brief delays (typically sub-second with Mutagen)

**Alternatives Considered:**

| Approach | Why Not |
|----------|---------|
| Remote-first (SSH/mosh) | Latency affects tool responsiveness |
| SSHFS mount | High latency for file operations |
| VS Code Remote | Still has latency, complex setup |
| Cloud workspaces (Gitpod, Coder) | Vendor lock-in, ongoing costs |

## Why Mutagen for Sync?

**Decision:** Bundle Mutagen binary and use it for bidirectional file synchronization.

**Rationale:**

1. **Battle-tested** - Handles edge cases (conflicts, partial writes, permissions) that are hard to get right.

2. **Bidirectional** - Changes flow both ways automatically.

3. **Efficient** - Delta transfer, compression, file watching built-in.

4. **SSH transport** - Uses existing SSH authentication, no extra ports/services.

5. **No installation needed** - Binary auto-downloads during `skybox init`.

**Configuration:**

```yaml
# Sync mode: two-way-resolved means remote wins on conflict
sync_mode: two-way-resolved

# Ignore patterns to reduce sync overhead
ignore:
  - ".git/index.lock"
  - ".git/*.lock"
  - "node_modules"
  - ".venv"
  - "dist"
  - "build"
```

**Alternatives Considered:**

| Tool | Why Not |
|------|---------|
| rsync | One-way only, no file watching |
| Syncthing | Requires daemon on both ends |
| Unison | Complex configuration |
| Custom implementation | Too much effort, many edge cases |
| Git-based sync | Doesn't handle uncommitted changes well |

## Why Devcontainers?

**Decision:** Use the devcontainer specification and CLI for container management.

**Rationale:**

1. **Standard format** - `.devcontainer/devcontainer.json` is widely supported.

2. **Editor integration** - VS Code, Cursor, and others can attach directly.

3. **Rich features** - Extensions, features, lifecycle hooks, mounts already defined.

4. **Microsoft maintenance** - Well-maintained, regular updates.

5. **Portable** - Same config works locally and in cloud IDEs.

**Example devcontainer.json:**

```json
{
  "name": "Node.js",
  "image": "mcr.microsoft.com/devcontainers/base:debian",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {}
  },
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  }
}
```

**Alternatives Considered:**

| Approach | Why Not |
|----------|---------|
| Raw Docker | No standard config format, manual extension setup |
| Docker Compose | More complex, less editor integration |
| Nix | Steeper learning curve |
| Vagrant | Heavy, VM-based |

## Why YAML Configuration?

**Decision:** Use YAML for `~/.skybox/config.yaml`.

**Rationale:**

1. **Human-readable** - Easy to edit manually.

2. **Comments** - Users can annotate their config.

3. **Familiar** - Common in dev tools (Docker Compose, GitHub Actions).

4. **Flexible** - Supports complex nested structures.

**Config Structure:**

```yaml
remote:
  host: my-server          # SSH host from ~/.ssh/config
  base_path: ~/code        # Where projects live on remote

editor: cursor             # Default editor

defaults:
  sync_mode: two-way-resolved
  ignore:
    - node_modules
    - .venv

projects: {}               # Per-project overrides
```

**Alternatives Considered:**

| Format | Why Not |
|--------|---------|
| JSON | No comments, less readable |
| TOML | Less familiar, complex nested structures awkward |
| JavaScript/TypeScript | Overkill for config, security concerns |

## Why Session-Based Multi-Computer?

**Decision:** Use local session files (synced by Mutagen) to coordinate multi-computer access.

**Rationale:**

1. **Prevents conflicts** - Warns when a project is active on another machine.

2. **Clear ownership** - Always know which machine has an active session.

3. **Explicit handoff** - `skybox down` removes the session and syncs cleanly.

4. **No SSH round-trip** - Session files live inside the project directory and sync via Mutagen, so checking session status is a local file read.

5. **Automatic expiry** - Sessions expire after 24 hours, handling crash scenarios without manual intervention.

**Session Flow:**

```
skybox up myproject
  └─> Read session file (.skybox/session.lock)
      ├─> No file → Write session, proceed
      ├─> File exists, same machine → Update timestamp, proceed
      └─> File exists, different machine → Warn, prompt to continue

skybox down myproject
  └─> Flush sync → Stop container → Delete session file
```

**Atomic Writes:**

Session file writes use atomic write-then-rename to prevent corruption if two processes write simultaneously.

**Session File Format:**

```json
{
  "machine": "macbook-pro",
  "user": "noor",
  "timestamp": "2026-02-03T10:30:00Z",
  "pid": 12345,
  "expires": "2026-02-04T10:30:00Z"
}
```

**Alternatives Considered:**

| Approach | Why Not |
|----------|---------|
| Remote lock files via SSH | Requires SSH round-trip on every `up`, adds latency |
| No coordination | Risk of conflicts, lost work |
| Git-based locking | Adds commits, clutters history |
| Database/service | Extra infrastructure |

## Why Sync .git Directory?

**Decision:** Sync the `.git` directory (with some exclusions) rather than treating git separately.

**Rationale:**

1. **Full history everywhere** - All branches, all commits on every machine.

2. **Simple mental model** - Project is project, no special git handling.

3. **Branch switching works** - `git checkout feature` just works.

4. **No extra clone step** - One `skybox clone` gets everything.

**Excluded from sync:**

```yaml
ignore:
  - ".git/index.lock"    # Prevents corruption during operations
  - ".git/*.lock"        # Other lock files
  - ".git/hooks/*"       # Hooks may be machine-specific
```

**Workflow:**

```bash
# On laptop
skybox up myproject
git checkout -b feature-x
# work, commit
skybox down myproject    # syncs .git too

# On desktop
skybox up myproject
git checkout feature-x   # branch is already there!
```

**Alternatives Considered:**

| Approach | Why Not |
|----------|---------|
| Ignore .git, separate clone | Extra step, branch mismatch risk |
| Git worktrees | Complex, fragile with sync |
| Git bundle transfer | Manual, no continuous sync |

## Why TypeScript?

**Decision:** Build the CLI in TypeScript, running on Bun.

**Rationale:**

1. **Familiar language** - Most web developers know it.

2. **Excellent libraries** - Commander, Inquirer, Chalk, Ora are mature.

3. **Async-friendly** - Async/await maps well to SSH and file operations.

4. **Type safety** - Catches bugs at compile time.

5. **Bun performance** - Fast startup, native TypeScript support.

**Alternatives Considered:**

| Language | Why Not |
|----------|---------|
| Bash | Hard to maintain, limited type safety |
| Go | Good, but team familiarity with TS |
| Rust | Slower iteration, overkill for CLI |
| Python | Slower startup, dependency management |

## Error Handling Philosophy

**Decision:** Return result objects instead of throwing exceptions for expected failures.

**Rationale:**

1. **Explicit handling** - Caller must handle both success and failure.

2. **Type-safe errors** - TypeScript knows about error cases.

3. **Composable** - Easy to chain operations and aggregate errors.

**Pattern:**

```typescript
// Library function
async function doOperation(): Promise<{ success: boolean; error?: string }> {
  try {
    await someWork();
    return { success: true };
  } catch (error) {
    return { success: false, error: getExecaErrorMessage(error) };
  }
}

// Command usage
const result = await doOperation();
if (!result.success) {
  error(result.error || "Unknown error");
  process.exit(1);
}
```

**Exceptions used for:**

- Programming errors (bugs)
- Truly unexpected failures
- Not for expected failure cases (network down, file missing)

## Non-Interactive Mode Support

**Decision:** All commands support `--no-prompt` flag for scripting.

**Rationale:**

1. **CI/CD friendly** - Use skybox in automation.

2. **Scripting** - Compose commands in shell scripts.

3. **Predictable** - Same behavior every time.

**Behavior with `--no-prompt`:**

- Uses configured defaults where available
- Fails with clear error if required input is missing
- No interactive prompts that would hang

**Example:**

```bash
# In a script
skybox up myproject --no-prompt --editor

# Fails clearly if no default editor
# Error: No default editor configured. Use 'skybox editor' to set one.
```

## Why AES-256-GCM for Encryption?

**Decision:** Use AES-256-GCM with Argon2id key derivation for encrypting project data at rest on the remote.

**Rationale:**

1. **Industry standard** - AES-256-GCM is widely recommended for symmetric encryption.

2. **Authenticated encryption** - GCM mode provides both confidentiality and integrity verification, detecting tampering.

3. **Node.js native** - Uses `node:crypto` built-ins for AES-256-GCM, with the `argon2` package for key derivation.

4. **Argon2id key derivation** - Memory-hard KDF (64 MiB memory, 2 passes) resists both brute-force and GPU-based attacks, superior to PBKDF2.

**Alternatives Considered:**

| Approach | Why Not |
|----------|---------|
| AES-CBC | No built-in authentication, vulnerable to padding oracle attacks |
| ChaCha20-Poly1305 | Less widely supported in tooling |
| External encryption tool (age, gpg) | Extra dependency, harder to integrate |
| No encryption (plaintext secrets) | Unacceptable security posture |

## Why Per-Path Sessions for Selective Sync?

**Decision:** Create one Mutagen sync session per path when using selective sync, rather than a single session with filters.

**Rationale:**

1. **Mutagen limitation** - Mutagen does not support syncing arbitrary subsets of paths within a single session. Each session maps one local path to one remote path.

2. **Independent lifecycle** - Each path can be paused, resumed, or removed independently.

3. **Clear status** - Per-session status makes it obvious which paths are synced and which have issues.

4. **Predictable naming** - Session names follow a convention (`<project>--<subpath>`) making them easy to manage programmatically.

**Trade-offs:**

- More sessions to manage (mitigated by CLI automation)
- Slightly higher resource usage with many sessions

**Alternatives Considered:**

| Approach | Why Not |
|----------|---------|
| Single session with include filters | Mutagen does not support this granularity |
| Multiple full-project sessions | Wasteful, duplicates data |
| Rsync for selective paths | One-way only, no continuous sync |

## Why Built-in Templates + Custom Local Templates?

**Decision:** Ship a set of built-in project templates while also allowing users to create custom local templates stored in `~/.skybox/templates/`.

**Rationale:**

1. **Quick start** - Built-in templates (Node.js, Python, Go, etc.) let users create projects immediately without setup.

2. **Extensibility** - Users can create custom `devcontainer.json` templates stored as local files in `~/.skybox/templates/`, or provide a git URL during project creation.

3. **No lock-in** - Templates are standard `devcontainer.json` files. Nothing proprietary.

4. **Composable** - Users can create templates through the CLI selector ("Create new template") or by manually placing JSON files in the templates directory.

**Alternatives Considered:**

| Approach | Why Not |
|----------|---------|
| Built-in only | Too rigid for teams with specific needs |
| Custom only | Poor onboarding experience for new users |
| Template registry/marketplace | Overengineered for current scale |
| Cookiecutter/Yeoman integration | Extra dependency, different mental model |
