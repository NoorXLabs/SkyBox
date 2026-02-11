# SSH Passphrase-Protected Key Support

## Problem

SkyBox only works cleanly with passwordless SSH keys. When a user selects a passphrase-protected key during `skybox init`:

1. `testConnection()` uses `BatchMode=yes`, which disables all interactive prompts — including passphrase entry. The connection fails immediately.
2. SkyBox misinterprets this as "key not on server" and offers `ssh-copy-id`.
3. `ssh-copy-id` discovers the key is already installed (because the user can already SSH in — they just need to enter their passphrase).
4. The retest after `ssh-copy-id` also uses `BatchMode=yes` and fails again.
5. The user hits a dead end: "Connection still failing after key setup."

Additionally, every ongoing SSH operation (`runRemoteCommand`, `secureScp`) has no mechanism to handle passphrase prompts, meaning even if init succeeded, runtime commands would fail or hang.

## Solution

Integrate with `ssh-agent` to load passphrase-protected keys once, then all subsequent SSH operations work transparently.

### Core Mechanism: `ensureKeyInAgent()`

A new reusable function in `src/lib/ssh.ts` that:

1. Gets the fingerprint of the specified key file (`ssh-keygen -lf <keyfile>`)
2. Checks if that fingerprint is already in the agent (`ssh-add -l`)
3. If already loaded → return immediately (no prompt)
4. If not loaded → run `ssh-add <keyfile>` with `stdio: "inherit"` so user types passphrase
5. On macOS, if user has opted into Keychain persistence → use `ssh-add --apple-use-keychain <keyfile>`
6. Verify the key was actually added (re-check `ssh-add -l`)

### Platform Behavior

| Platform | Behavior | Persistence |
|----------|----------|-------------|
| **macOS + Keychain** | `ssh-add --apple-use-keychain <key>` | Survives reboots (stored in macOS Keychain) |
| **macOS no Keychain** | `ssh-add <key>` | Current agent session only |
| **Linux** | `ssh-add <key>` | Current agent session only |

### Keychain Preference

- On macOS, during `skybox init`, after detecting a passphrase-protected key, ask: "Save passphrase to macOS Keychain? (won't need to enter it again after reboot)"
- Store preference as `useKeychain: true` on the remote entry in `~/.skybox/config.yaml`
- On Linux, skip the question — inform the user the passphrase lasts for the current session

### Config Schema Change

```typescript
export interface RemoteEntry {
  host: string;
  user?: string;
  path: string;
  key?: string;
  useKeychain?: boolean; // macOS only: persist passphrase in Keychain
}
```

---

## Implementation Plan

### Phase 1: Core SSH Agent Functions

#### Task 1.1: Add new functions to `src/lib/ssh.ts`

**`isKeyPassphraseProtected(keyPath: string): Promise<boolean>`**
- Run `ssh-keygen -y -P "" -f <keyPath>` — exits with non-zero if passphrase-protected
- Returns `true` if the key requires a passphrase
- Returns `false` for passwordless keys (no change to existing behavior)
- Handle missing file gracefully (return `false`, let downstream catch it)

**`getKeyFingerprint(keyPath: string): Promise<string | null>`**
- Run `ssh-keygen -lf <keyPath>` — returns the fingerprint string
- Parse the output to extract the fingerprint hash (second field)
- Returns `null` on error (missing file, invalid key format)

**`isKeyInAgent(keyPath: string): Promise<boolean>`**
- Get fingerprint of the key file via `getKeyFingerprint()`
- Run `ssh-add -l` — lists loaded key fingerprints
- Return `true` if the key's fingerprint appears in the agent's list
- Return `false` if agent not running (exit code 2) or key not found

**`addKeyToAgent(keyPath: string, useKeychain?: boolean): Promise<{ success: boolean; error?: string }>`**
- Detect platform: `process.platform === "darwin"`
- On macOS with `useKeychain=true`: use `["--apple-use-keychain", keyPath]`
- Otherwise: use `[keyPath]`
- Run `ssh-add` with `stdio: "inherit"` so user can type passphrase interactively
- Return `{ success: true }` or `{ success: false, error: sanitized message }`
- Handle user cancellation (Ctrl+C) gracefully

**`ensureKeyInAgent(keyPath: string, useKeychain?: boolean): Promise<boolean>`**
- The main reusable gate function called by all commands
- If key is not passphrase-protected → return `true` immediately (nothing to do)
- If key is already in agent → return `true` immediately (nothing to do)
- Otherwise → call `addKeyToAgent()`, return whether it succeeded
- Uses `info()` from ui.ts to inform user what's happening ("SSH key requires passphrase...")

#### Task 1.2: Add `ensureRemoteKeyReady()` guard to `src/lib/ssh.ts`

A higher-level function that commands call:

```typescript
export const ensureRemoteKeyReady = async (
  remote: RemoteEntry,
): Promise<boolean> => {
  if (!remote.key) return true; // using SSH config defaults
  return ensureKeyInAgent(remote.key, remote.useKeychain);
};
```

- Takes a `RemoteEntry` from config
- If `remote.key` is set → calls `ensureKeyInAgent(remote.key, remote.useKeychain)`
- If no key set (using SSH config defaults) → returns `true` (SSH config handles it)
- Returns `false` if agent add fails — caller decides how to handle

### Phase 2: Type and Schema Updates

#### Task 2.1: Update `RemoteEntry` in `src/types/index.ts`

Add `useKeychain?: boolean` to the existing `RemoteEntry` interface (line ~56-61):

```typescript
export interface RemoteEntry {
  host: string;
  user?: string;
  path: string;
  key?: string;
  useKeychain?: boolean; // macOS only: persist passphrase in Keychain
}
```

#### Task 2.2: Update config schema validation in `src/lib/config-schema.ts`

In the `validateConfig()` function's remote entry validation section, add `useKeychain` as an accepted optional boolean field. Currently the schema only validates `host` (lines 56-73). Add:

- If `useKeychain` is present, validate it is a boolean
- No error if absent (optional field)

### Phase 3: Update `skybox init` Flow

#### Task 3.1: Update `configureRemote()` in `src/commands/init.ts`

**Current flow** (lines 210-260):
1. Select key → `testConnection(BatchMode=yes)` → fail → offer `ssh-copy-id` → fail again

**New flow:**
1. Select key
2. Call `ensureKeyInAgent(keyPath)` — if passphrase-protected, user enters passphrase once
3. On macOS (`process.platform === "darwin"`), if the key was passphrase-protected, ask: "Save passphrase to macOS Keychain? (won't need to enter it again after reboot)"
4. If yes and key was passphrase-protected, call `addKeyToAgent(keyPath, true)` to re-add with Keychain flag (or store preference for later)
5. On Linux, if the key was passphrase-protected, print: `info("Passphrase loaded for this session. You'll need to enter it again after reboot.")`
6. `testConnection(BatchMode=yes)` — now succeeds because key is in agent
7. If connection still fails → **now** it's actually a "key not on server" situation → offer `ssh-copy-id`
8. After `ssh-copy-id` → retest (should succeed since key is in agent)
9. Store `useKeychain` preference on the remote entry in config

**No changes to `testConnection()` itself** — keep `BatchMode=yes`. The fix is ensuring the key is in the agent *before* testing.

#### Task 3.2: Handle no ssh-agent scenario in init

If `ssh-add -l` returns exit code 2 (no agent):
- Print: `warning("No ssh-agent detected. Start one with: eval $(ssh-agent)")`
- Print: `info("Add this to your shell profile (~/.bashrc or ~/.zshrc) to start it automatically.")`
- Return gracefully — don't block init, but inform the user

### Phase 4: Update All SSH-Dependent Commands

#### Task 4.1: Add `ensureRemoteKeyReady()` guard to each command

Each command below needs the guard added before its first SSH operation. The pattern:

```typescript
import { ensureRemoteKeyReady } from "@lib/ssh.ts";

// After resolving the remote config entry:
const remote = config.remotes[remoteName];
const keyReady = await ensureRemoteKeyReady(remote);
if (!keyReady) {
  error("Could not authenticate SSH key.");
  info("Run 'ssh-add <keypath>' manually or check your key.");
  process.exit(1);
}
// ... proceed with SSH operations as normal
```

**Commands to update:**

| Command | File | Where to add guard |
|---------|------|-------------------|
| `up` | `src/commands/up.ts` | Before sync session creation, after remote config resolution |
| `down` | `src/commands/down.ts` | Before remote operations, after remote config resolution |
| `clone` | `src/commands/clone.ts` | Before remote project check, after remote config resolution |
| `browse` | `src/commands/browse.ts` | Before listing remote projects, after remote config resolution |
| `push` | `src/commands/push.ts` | Before remote operations, after remote config resolution |
| `status` | `src/commands/status.ts` | Before remote queries, after remote config resolution |
| `rm` | `src/commands/rm.ts` | Before remote deletion (only when `--remote` flag used), after remote config resolution |
| `doctor` | `src/commands/doctor.ts` | Before connection tests, iterate each remote |

After the guard succeeds, the rest of the command runs exactly as before — no re-prompting, no restarts. The user enters their passphrase once (if needed), and all SSH operations for the rest of that command execution work transparently.

### Phase 5: Unit Tests

#### Task 5.1: Add tests for new SSH agent functions in `tests/unit/lib/ssh.test.ts`

Following the existing test patterns in the file (356 lines, uses temp dirs, mocks HOME):

**`isKeyPassphraseProtected()` tests:**
- Returns `false` for a passwordless key (mock `ssh-keygen -y -P ""` succeeding)
- Returns `true` for a passphrase-protected key (mock `ssh-keygen -y -P ""` failing)
- Returns `false` when key file doesn't exist (graceful fallback)

**`getKeyFingerprint()` tests:**
- Returns fingerprint string for valid key
- Returns `null` for missing/invalid key file
- Parses fingerprint correctly from `ssh-keygen -lf` output format

**`isKeyInAgent()` tests:**
- Returns `true` when key fingerprint is in `ssh-add -l` output
- Returns `false` when key fingerprint is not in output
- Returns `false` when no agent is running (exit code 2)
- Returns `false` when agent has no keys (exit code 1)

**`ensureKeyInAgent()` tests:**
- Returns `true` immediately for passwordless key (no agent interaction)
- Returns `true` immediately when key already in agent
- Calls `addKeyToAgent()` when key needs loading
- Returns `false` when add fails
- On macOS, passes `--apple-use-keychain` when `useKeychain=true`

**`ensureRemoteKeyReady()` tests:**
- Returns `true` when no key configured on remote
- Calls `ensureKeyInAgent()` when key is configured
- Passes `useKeychain` from remote entry

**Note on mocking:** Since `execa` mocking at module level contaminates other test files (known gotcha from CLAUDE.md), these tests should use `node:child_process` for any subprocess execution. Alternatively, isolate the new tests in a separate file: `tests/unit/lib/ssh-agent.test.ts` to avoid contamination.

#### Task 5.2: Add config schema validation tests

In `tests/unit/lib/config-schema.test.ts` (or create if doesn't exist):

- Valid config with `useKeychain: true` passes validation
- Valid config with `useKeychain: false` passes validation
- Valid config without `useKeychain` passes validation (backward compatible)
- Config with `useKeychain: "string"` fails validation (wrong type)

### Phase 6: Documentation Updates

#### Task 6.1: Update `docs/reference/init.md`

Add a new section **"SSH Key Authentication"** covering:

- SkyBox supports both passwordless and passphrase-protected SSH keys
- When a passphrase-protected key is selected, SkyBox loads it into `ssh-agent` (user enters passphrase once)
- On macOS, option to save passphrase to Keychain for persistence across reboots
- On Linux, passphrase lasts for the current login session
- If no `ssh-agent` is running, SkyBox will inform the user how to start one

Update the existing SSH section to remove any implication that passwordless keys are required.

#### Task 6.2: Update `docs/reference/configuration.md`

In the remotes configuration section, document the new `useKeychain` field:

```yaml
remotes:
  work:
    host: work-server
    user: deploy
    path: ~/code
    key: ~/.ssh/work_key
    useKeychain: true  # macOS only: persist passphrase in Keychain
```

- Explain that `useKeychain` is optional, defaults to `false`
- Only has effect on macOS — ignored on Linux
- Only relevant for passphrase-protected keys — no effect on passwordless keys

#### Task 6.3: Update `docs/guide/installation.md`

In the prerequisites/verification section, update the SSH guidance:

- Change the `ssh-add -l` check to be informational rather than a requirement
- Add note: "SkyBox supports both passwordless and passphrase-protected SSH keys. If your key has a passphrase, SkyBox will prompt you to load it into ssh-agent during setup."
- Keep existing troubleshooting tips but add: "If you see 'Could not open a connection to your authentication agent', run `eval $(ssh-agent)` first"

#### Task 6.4: Update `docs/guide/troubleshooting.md`

Update the "SSH Connection Failed" section:

- Add new subsection: **"Passphrase-Protected Keys"**
  - If SkyBox prompts for a passphrase during commands, the key isn't loaded in ssh-agent
  - On macOS: enable `useKeychain: true` in config to persist across reboots
  - On Linux: run `ssh-add ~/.ssh/your_key` before starting SkyBox, or add to shell profile
  - If `ssh-add` fails with "Could not open a connection to your authentication agent": start the agent with `eval $(ssh-agent)`

Update the "Permission Denied" section:
- Mention that passphrase-protected keys are now supported
- Remove any language suggesting passwordless keys are required

#### Task 6.5: Update `docs/guide/concepts.md`

In the "Remote Server" section, add a brief note:

- SkyBox supports passphrase-protected SSH keys via `ssh-agent` integration
- On macOS, passphrases can be persisted in Keychain

#### Task 6.6: Update `docs/reference/remote.md`

In the "Adding a Remote" section:

- Note that both passwordless and passphrase-protected keys work
- If using a passphrase-protected key, SkyBox will prompt to load it into the agent
- Mention the `useKeychain` option for macOS users

---

## Edge Cases

### No ssh-agent running
- `ssh-add -l` returns exit code 2 when no agent is available
- Detect this case and print: "No ssh-agent detected. Start one with `eval $(ssh-agent)` or add to your shell profile."
- Do not attempt to start an agent — that's the user's shell config responsibility
- During init: warn but don't block (user can still set up config, just can't test connection)
- During commands: error and exit (can't proceed without agent for passphrase keys)

### Key added but connection still fails
- After `ensureKeyInAgent` succeeds but `testConnection` fails → genuinely "key not on server"
- Proceed to `ssh-copy-id` flow as normal (this path now actually makes sense)

### User cancels passphrase prompt
- `ssh-add` with `stdio: "inherit"` — user can Ctrl+C
- Catch the error, return `false`, command exits gracefully

### Key file doesn't exist
- `ssh-keygen -lf` will fail — handle gracefully with error message

### Agent already has the key (from previous session or macOS Keychain)
- `isKeyInAgent()` returns `true` immediately — no prompt, zero friction

### Passwordless keys (regression protection)
- `isKeyPassphraseProtected()` returns `false` → skip all agent logic
- Entire flow is unchanged for passwordless keys — no regression risk

### Existing configs without `useKeychain` field
- Field is optional, defaults to `undefined` (treated as `false`)
- No migration needed — backward compatible

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/ssh.ts` | Modified | Add 6 new functions: `isKeyPassphraseProtected`, `getKeyFingerprint`, `isKeyInAgent`, `addKeyToAgent`, `ensureKeyInAgent`, `ensureRemoteKeyReady` |
| `src/types/index.ts` | Modified | Add `useKeychain?: boolean` to `RemoteEntry` interface |
| `src/lib/config-schema.ts` | Modified | Add `useKeychain` boolean validation to remote entry schema |
| `src/commands/init.ts` | Modified | Add agent loading before connection test, Keychain prompt on macOS |
| `src/commands/up.ts` | Modified | Add `ensureRemoteKeyReady()` guard |
| `src/commands/down.ts` | Modified | Add `ensureRemoteKeyReady()` guard |
| `src/commands/clone.ts` | Modified | Add `ensureRemoteKeyReady()` guard |
| `src/commands/browse.ts` | Modified | Add `ensureRemoteKeyReady()` guard |
| `src/commands/push.ts` | Modified | Add `ensureRemoteKeyReady()` guard |
| `src/commands/status.ts` | Modified | Add `ensureRemoteKeyReady()` guard |
| `src/commands/rm.ts` | Modified | Add `ensureRemoteKeyReady()` guard (remote deletion path only) |
| `src/commands/doctor.ts` | Modified | Add `ensureRemoteKeyReady()` guard per remote |
| `tests/unit/lib/ssh-agent.test.ts` | New | Unit tests for all new SSH agent functions |
| `docs/reference/init.md` | Modified | Add SSH key authentication section |
| `docs/reference/configuration.md` | Modified | Document `useKeychain` field |
| `docs/guide/installation.md` | Modified | Update SSH prerequisites guidance |
| `docs/guide/troubleshooting.md` | Modified | Add passphrase-protected key troubleshooting |
| `docs/guide/concepts.md` | Modified | Brief note on ssh-agent support |
| `docs/reference/remote.md` | Modified | Note passphrase key support in add remote flow |

**Total: 13 source files modified, 1 test file created, 5 doc files modified**

---

## Manual Testing Checklist

After implementation, verify these scenarios:

- [ ] Passwordless key: `skybox init` works exactly as before (no regression)
- [ ] Passphrase key (not in agent): `skybox init` prompts for passphrase, loads key, connection succeeds
- [ ] Passphrase key (already in agent): `skybox init` skips prompt, connection succeeds immediately
- [ ] Passphrase key (not on server): after loading into agent, correctly offers `ssh-copy-id`
- [ ] macOS Keychain prompt: appears only on macOS, only for passphrase keys
- [ ] macOS Keychain persistence: after reboot, key is auto-loaded (no prompt)
- [ ] Linux session: after `skybox init`, `skybox up` works without re-prompting in same session
- [ ] Linux reboot: after reboot, `skybox up` prompts for passphrase, then continues
- [ ] No ssh-agent: clear error message with instructions to start agent
- [ ] User cancels passphrase: graceful exit, no crash
- [ ] `skybox up` with passphrase key: guard prompts if key not in agent, then command proceeds
- [ ] `skybox down` with passphrase key: same guard behavior
- [ ] `skybox clone` with passphrase key: same guard behavior
- [ ] `skybox browse` with passphrase key: same guard behavior
- [ ] `skybox push` with passphrase key: same guard behavior
- [ ] `skybox status` with passphrase key: same guard behavior
- [ ] `skybox rm --remote` with passphrase key: same guard behavior
- [ ] `skybox doctor` with passphrase key: tests each remote with guard
