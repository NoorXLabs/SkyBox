# Code Simplifier Review: Security Audit Branch

**Branch:** `NoorChasib/security-audit-src`
**Date:** 2026-02-05
**Scope:** 43 files changed, 1589 insertions, 113 deletions across 3 commits

---

## High Priority (Should Fix)

### 1. `escapeShellArg` vs `escapeRemotePath` inconsistency -- correctness issue

Remote paths containing `~/` are wrapped with `escapeShellArg` in several places, which **breaks tilde expansion** on the remote server. These should use `escapeRemotePath` (as `init.ts:304` correctly does).

- [ ] `src/commands/status.ts:258` -- change `escapeShellArg(remotePath)` to `escapeRemotePath(remotePath)`
- [ ] `src/commands/remote.ts:332` -- change `escapeShellArg(path)` to `escapeRemotePath(path)`
- [ ] `src/commands/remote.ts:350` -- change `escapeShellArg(path)` to `escapeRemotePath(path)`
- [ ] `src/commands/down.ts:111` -- change `escapeShellArg(remotePath)` to `escapeRemotePath(remotePath)`

### 2. `require("node:fs")` instead of static import

- [ ] `src/lib/ssh.ts:246` -- remove `const { mkdirSync } = require("node:fs")` and add `mkdirSync` to the existing static import at the top of the file (line 3)

### 3. Relative path import violates convention

- [ ] `src/commands/up.ts:418` -- replace `await import("../lib/encryption.ts")` with a static import. `deriveKey` from the same module is already imported at line 26; add `decryptFile` to that import.

### 4. Interface defined outside `src/types/index.ts`

- [ ] `src/commands/up.ts:62-66` -- move `ResolvedProject` interface to `src/types/index.ts` and import it

### 5. Zero test coverage for security-critical functions

- [ ] Add tests for `validateSSHField` in `tests/unit/lib/validation.test.ts` -- test empty input, newline rejection, character allowlist, valid inputs
- [ ] Add tests for `sshFieldValidator` in `tests/unit/lib/validation.test.ts` -- test inquirer adapter returns `true` or error string
- [ ] Add tests for `toInquirerValidator` in `tests/unit/lib/validation.test.ts` -- test generic adapter with a mock validator
- [ ] Add tests for `writeSSHConfigEntry` in `tests/unit/lib/ssh.test.ts` -- test field validation, duplicate detection, file writing

---

## Medium Priority (Consider Fixing)

### 6. Duplicated config boilerplate across 7 command files

The `configExists()` + `loadConfig()` check-and-exit pattern is copy-pasted ~70 lines. Extract a shared `requireConfig()` helper.

- [ ] Create `requireConfig()` in `src/lib/config.ts` that returns `SkyboxConfigV2` or calls `error()` + `process.exit(1)`
- [ ] Replace boilerplate in `src/commands/browse.ts:73-82`
- [ ] Replace boilerplate in `src/commands/clone.ts:202-211`
- [ ] Replace boilerplate in `src/commands/down.ts:194-203`
- [ ] Replace boilerplate in `src/commands/encrypt.ts:29-38` and `143-152`
- [ ] Replace boilerplate in `src/commands/new.ts:52-61`
- [ ] Replace boilerplate in `src/commands/status.ts:376-379`
- [ ] Replace boilerplate in `src/commands/up.ts:514-523`

### 7. Duplicated `validateSSHHost` guard in `ssh.ts`

Lines 126-128, 150-152, 169-171 repeat the exact same 3-line pattern in `testConnection`, `copyKey`, and `runRemoteCommand`.

- [ ] Extract a private helper (e.g., `assertValidHost(host)`) that returns the error response or `null`
- [ ] Replace the three copies

### 8. Case-sensitive `includes("authentication")` in `sanitizeSshError`

- [ ] `src/lib/ssh.ts:44` -- change `includes("authentication")` to a case-insensitive check (e.g., `.toLowerCase().includes("authentication")`) to match the case-insensitive regexes elsewhere in the function

### 9. `sshFieldValidator` duplicates `toInquirerValidator` logic

- [ ] `src/lib/validation.ts:139-156` -- simplify `sshFieldValidator` to: `return toInquirerValidator((input) => validateSSHField(input, fieldName))`

### 10. Types defined outside `src/types/index.ts`

- [ ] `src/lib/audit.ts:21-27` -- move `AuditEntry` interface to `src/types/index.ts`
- [ ] `src/lib/gpg.ts:12-16` -- move `GpgVerifyResult` interface to `src/types/index.ts`
- [ ] `src/lib/gpg.ts:108` -- extract inline return type of `verifyKeyFingerprint` into a named interface in `src/types/index.ts`
- [ ] `src/lib/container.ts:71-73` -- remove local `DevcontainerConfig` redefinition; use the canonical type from `@typedefs/index.ts` (or rename to `DevcontainerWorkspaceConfig` if the narrower shape is intentional)

### 11. Deeply nested GPG verification in `download.ts`

- [ ] `src/lib/download.ts:144-212` -- extract GPG verification into a separate `verifyGpgChecksums()` function
- [ ] Read `isGpgPreferred()` once into a `const gpgPreferred` at the top instead of calling it 5 times

### 12. `Bun.spawnSync` vs `execa` inconsistency

- [ ] `src/lib/download.ts:93` -- change `isMutagenInstalled` from `Bun.spawnSync` to `execa`
- [ ] `src/lib/download.ts:104` -- change `getInstalledMutagenVersion` from `Bun.spawnSync` to `execa`

### 13. Duplicated GPG keyring import pattern

- [ ] `src/lib/gpg.ts:67-75` and `122-130` -- extract shared helper like `importKeyToTempKeyring(publicKey)` returning `{ tempDir, keyringPath }`

### 14. `MUTAGEN_GPG_FINGERPRINT` is a placeholder

- [ ] `src/lib/constants.ts:136-144` -- add a `TODO` comment and consider emitting a runtime warning when GPG verification is attempted against this placeholder

### 15. Inline error extraction in `index.ts`

- [ ] `src/index.ts:199` -- replace `err instanceof Error ? err.message : String(err)` with `getErrorMessage(err)` from `@lib/errors.ts`

---

## Low Priority (Minor / Style)

### 16. Dynamic imports of already-imported Node built-ins

- [ ] `src/commands/down.ts:93-95` -- replace dynamic `import("node:os")`, `import("node:path")`, `import("node:fs")` with static imports (already available at top of file)
- [ ] `src/commands/encrypt.ts:209-211` -- same
- [ ] `src/commands/up.ts:415-418` -- same

### 17. Redundant validation in clone flow

- [ ] `src/commands/clone.ts:295-299` -- remove second `validateProjectName` call; names were already validated at line 266-272

### 18. Unnecessary `?? ""` on guaranteed `string` params

- [ ] `src/commands/down.ts:62-63` and ~12 other occurrences -- remove `project ?? ""` where `project` is typed as `string` (not `string | undefined`)

### 19. Repeated empty-check boilerplate in validation.ts

- [ ] `src/lib/validation.ts:12,30,64,93,111` -- extract a private `requireNonEmpty(value, label)` helper to consolidate the 5 identical empty-check guards

### 20. Redundant `@file` header comments

- [ ] `src/lib/shell.ts:1-5` -- simplify to single-line module doc comment (consistent with other files like `validation.ts`)
- [ ] `src/lib/remote.ts:1-4` -- same

### 21. `AUDIT_LOG_MAX_BYTES` misplaced in constants.ts

- [ ] `src/lib/constants.ts:271` -- move from "Templates" section to near other operational constants (e.g., "App & GitHub" section)

### 22. Ownership path traversal check duplicated

- [ ] `src/lib/ownership.ts:75-77` and `108-113` -- replace inline `.includes("..")` checks with shared `validateRemoteProjectPath` from `validation.ts`

### 23. `validateSSHHost` vs `validateSSHField` coverage gap

- [ ] Verify intent: hostnames written to SSH config via `writeSSHConfigEntry` are validated by `validateSSHField` but not `validateSSHHost` (missing leading-dash and whitespace checks). If `validateSSHHost` is stricter, consider calling it on `entry.hostname` too.

### 24. `validateSSHField` allowlist may be too restrictive

- [ ] `src/lib/validation.ts:99` -- the regex `^[a-zA-Z0-9@._~:\-/]+$` excludes spaces (valid in file paths) and `+` (valid in key filenames). Document the intentional restriction with an inline comment.

### 25. Port range not validated in `writeSSHConfigEntry`

- [ ] `src/lib/ssh.ts:239` -- consider adding range validation (1-65535) for `entry.port` before writing to SSH config

### 26. `escapeRemotePath` does not handle `~user/...`

- [ ] `src/lib/shell.ts:30` -- add inline comment documenting that `~user/path` is intentionally single-quoted (no tilde expansion for other users)

### 27. Inconsistent `process.exit(1)` vs early `return`

- [ ] Across commands: `encrypt.ts`, `remote.ts`, `down.ts` mix `process.exit(1)` and `return` for error paths. Consider standardizing (especially if `requireConfig()` helper is adopted).

### 28. Redundant `existsSync` before `statSync` in audit.ts

- [ ] `src/lib/audit.ts:117-125` -- remove `existsSync(logPath)` guard; the `statSync` inside the try block handles missing files via the catch

### 29. Audit log rotation filename format mismatch

- [ ] `src/lib/audit.ts:121` -- uses full ISO timestamp `audit.log.2026-02-05T12-00-00-000Z` but CLAUDE.md documents `audit.log.YYYY-MM-DD`. Align them.

### 30. `getInstalledMutagenVersion` is `async` with no `await`

- [ ] `src/lib/download.ts:100` -- remove unnecessary `async` keyword (only uses synchronous operations)

---

## Test Quality Fixes

### Fragile Tests

- [ ] `tests/unit/lib/ssh.test.ts:64-68` -- `findSSHKeys` runs against real `~/.ssh`; mock `HOME` to a temp directory with fake key files
- [ ] `tests/unit/lib/ssh.test.ts:117-128` -- regex-based source code inspection breaks on reformatting; replace with a function-level test or structural check
- [ ] `tests/unit/lib/gpg.test.ts:68-81` -- temp dir enumeration unsafe under parallel execution; use a controlled temp directory with unique prefix
- [ ] `tests/unit/lib/config.test.ts:265-279` -- double `SKYBOX_HOME` restoration (manual + `createTestContext`) is confusing; remove the manual tracking

### Shared Patterns Not Used

- [ ] `tests/unit/lib/gpg.test.ts` -- extract `globalThis.fetch` mock/restore into a shared `withMockFetch(mockFn, testFn)` helper or use `beforeEach`/`afterEach` (duplicated 6 times)
- [ ] `tests/unit/lib/templates.test.ts:29-44` -- replace manual temp dir management with `createTestContext`
- [ ] `tests/unit/lib/config.test.ts` -- use `createTestConfig()` from `test-utils.ts` instead of recreating config objects 6 times

### Missing Edge Cases

- [ ] `tests/unit/lib/validation.test.ts` -- add test for whitespace-only input to `validatePath`
- [ ] `tests/unit/lib/ssh.test.ts` -- add test for `parseSSHConfig` skipping `Host *` entries
- [ ] `tests/unit/lib/ssh.test.ts` -- add test for `sanitizeSshError` with overlapping patterns (both "Permission denied" and identity file path)
- [ ] `tests/unit/lib/gpg.test.ts` -- use `test.skipIf()` instead of runtime `if (gpgAvailable) return` for conditional skipping
- [ ] `tests/unit/commands/clone.test.ts:35-37` -- tighten assertion from `expect(path).toContain("myapp")` to `expect(path).toEndWith("/Projects/myapp")`

---

## Pre-Existing Issues (Out of Scope, For Reference)

These were not introduced by the security audit but were surfaced during review:

- `src/types/index.ts` -- inline string literal unions for container/sync status are inconsistent with `ContainerStatus` enum
- `src/types/index.ts:99` -- `SyncStatusValue` type alias is not used by `ProjectSummary` or `SyncDetails`
- `src/lib/container.ts:245-264` -- `listSkyboxContainers` does not validate container IDs (unlike `getContainerInfo`)
- `src/lib/container.ts:31-36` -- imports placed after function definitions instead of at top of file
- `src/lib/container.ts:132-133,157-159,256-258` -- container status parsing repeated 3 times; extract `parseContainerStatus()` helper
