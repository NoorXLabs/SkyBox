# Code Review Findings Remediation Plan

**Branch:** `NoorChasib/fix-review-plan`  
**Created:** 2026-02-06  
**Status:** Pending  
**Scope:** Resolve all findings from the `src` code review report (15 total).

## Findings Map

| ID | Severity | Finding | Primary Files |
|---|---|---|---|
| F01 | High | Interactive clone path traversal and unsafe overwrite target | `src/commands/clone.ts` |
| F02 | High | SSH host option injection (`-o...` style host input) | `src/lib/ssh.ts` |
| F03 | High | Commander action signature mismatch for `remote` / `config` | `src/index.ts` |
| F04 | Medium | Remote command injection via unescaped `basePath` in browse flow | `src/commands/browse.ts` |
| F05 | Medium | Remote disk-usage command uses unescaped remote path | `src/commands/status.ts` |
| F06 | Medium | Decryption retry fails after first bad passphrase (temp dir lifecycle bug) | `src/commands/up.ts` |
| F07 | Medium | `~/code` default remote path not expanding due to quoting | `src/commands/init.ts`, `src/commands/new.ts` |
| F08 | Medium | GPG trust-on-first-use (no pinned key/fingerprint) | `src/lib/gpg.ts`, `src/lib/download.ts` |
| F09 | Medium | Remote path traversal outside intended base path | `src/lib/remote.ts`, `src/lib/ownership.ts` |
| F10 | Medium | Missing top-level `parseAsync` error boundary | `src/index.ts` |
| F11 | Medium | Startup checks can crash help/version flows | `src/index.ts` |
| F12 | Medium | Sync status type mismatch (`none` vs `no session`) | `src/types/index.ts` |
| F13 | Medium | `ContainerInfo.status` typed as `string` instead of enum | `src/types/index.ts` |
| F14 | Low | Template scaffold sink does not validate template name | `src/lib/templates.ts` |
| F15 | Low | `sync_mode` defaults typed too loosely (`string`) | `src/types/index.ts` |

## Implementation Order

1. Batch A: High-severity security and correctness fixes (`F01`, `F02`, `F03`).
2. Batch B: Shell/remote execution hardening (`F04`, `F05`, `F09`).
3. Batch C: Reliability and UX correctness (`F06`, `F07`, `F10`, `F11`).
4. Batch D: Supply-chain trust hardening (`F08`).
5. Batch E: Type-safety cleanup (`F12`, `F13`, `F15`) and remaining low-risk sink hardening (`F14`).
6. Batch F: Full regression suite and cleanup.

## Batch A: High-Severity Fixes

### A1. Fix clone traversal and unsafe local target handling (`F01`)

**Work**
- Validate every remote-sourced project name before selection/clone (same validator used for direct name input).
- Reject absolute paths, traversal segments, and invalid characters before constructing a local target.
- Add a second guard after path resolution: verify clone target remains under `getProjectsDir()` using normalized absolute paths.
- Fail closed with explicit error output when any candidate is invalid.

**Files**
- `src/commands/clone.ts`
- `tests/unit/commands/clone.test.ts`

**Acceptance**
- Interactive clone never writes/deletes outside the projects directory.
- Invalid remote entries are skipped or rejected with clear messaging.

### A2. Prevent SSH host option injection (`F02`)

**Work**
- Add strict host validation helper (reject leading `-`, whitespace, and newline/control chars).
- Apply validation in all SSH entry points (`testConnection`, `copyKey`, `runRemoteCommand`).
- Pass host after `--` where supported to stop option parsing ambiguity.
- Keep sanitized error paths for invalid input.

**Files**
- `src/lib/ssh.ts`
- `tests/unit/lib/ssh.test.ts`

**Acceptance**
- Host strings like `-oProxyCommand=...` are rejected before execution.
- Normal hosts (`host`, `user@host`, FQDN/IP) continue working.

### A3. Fix Commander wiring for `remote` and `config` (`F03`)

**Work**
- Align action callback signatures with Commander v14 behavior.
- Ensure option objects reach `remoteCommand` and `configCommand` unchanged.
- Add direct command parsing tests for options/subcommands.

**Files**
- `src/index.ts`
- `tests/unit/commands/remote.test.ts`
- `tests/unit/commands/config-cmd.test.ts`

**Acceptance**
- CLI flags/subcommands route correctly for both commands.
- No behavioral regression in existing command parsing.

## Batch B: Remote Execution Hardening

### B1. Harden browse and status remote shell command construction (`F04`, `F05`)

**Work**
- Validate remote base path with existing `validateRemotePath` before command interpolation.
- Ensure all remote path values are shell-escaped uniformly.
- Remove string interpolation patterns that permit command substitution.

**Files**
- `src/commands/browse.ts`
- `src/commands/status.ts`
- `src/lib/validation.ts` (if helper expansion is needed)
- `tests/unit/commands/browse.test.ts`
- `tests/unit/commands/status.test.ts`

**Acceptance**
- Paths with shell metacharacters are rejected safely.
- Paths with spaces are handled correctly without execution ambiguity.

### B2. Enforce remote path containment under configured base path (`F09`)

**Work**
- Validate `project`/`projectPath` before building remote paths in ownership and existence checks.
- Normalize and reject traversal (`..`) that escapes configured remote root.
- Centralize path containment logic to avoid repeated mistakes.

**Files**
- `src/lib/remote.ts`
- `src/lib/ownership.ts`
- `tests/unit/lib/remote.test.ts`
- `tests/unit/lib/ownership.test.ts`

**Acceptance**
- Traversal attempts fail before any remote operation.
- Valid project paths continue to pass with unchanged behavior.

## Batch C: Reliability and UX Correctness

### C1. Fix decryption retry temp directory lifecycle (`F06`)

**Work**
- Rework retry loop so each attempt has a valid temp directory lifecycle.
- Ensure cleanup happens once per created directory and does not break subsequent retries.

**Files**
- `src/commands/up.ts`
- `tests/unit/commands/up.test.ts`

**Acceptance**
- First failed passphrase followed by correct passphrase succeeds.
- No temp directory leak after success/failure.

### C2. Normalize remote base path and support `~` correctly (`F07`)

**Work**
- Resolve `~` to `$HOME` (or explicit absolute path) before shell escaping for remote operations.
- Apply consistently in initialization and all commands that consume stored remote paths.
- Add migration behavior if legacy configs already contain `~` values.

**Files**
- `src/commands/init.ts`
- `src/commands/new.ts`
- `src/lib/config.ts` (if normalization on load/save is chosen)
- related remote command files consuming `remote.path`
- tests under `tests/unit/commands/*.test.ts` and `tests/unit/lib/config.test.ts`

**Acceptance**
- Default configured path works out-of-the-box on fresh setup.
- Existing absolute paths remain unchanged.

### C3. Add top-level error boundaries and resilient startup checks (`F10`, `F11`)

**Work**
- Wrap `program.parseAsync()` in a top-level `try/catch` and emit consistent exit codes/messages.
- Guard startup checks so help/version flows do not fail unexpectedly.
- Keep existing diagnostics quality for real runtime failures.

**Files**
- `src/index.ts`
- `tests/unit/commands/dry-run-global.test.ts` (CLI parse behavior coverage)
- add targeted CLI bootstrap tests if needed

**Acceptance**
- Unhandled rejections are converted into controlled CLI errors.
- `--help` / `--version` remain reliable even when startup checks fail.

## Batch D: Supply-Chain Verification Hardening

### D1. Pin trusted GPG identity for Mutagen verification (`F08`)

**Work**
- Add pinned expected fingerprint (or vendored armored key).
- Verify fetched key identity matches pinned trust anchor before accepting signature validation.
- Fail closed on key mismatch.

**Files**
- `src/lib/gpg.ts`
- `src/lib/download.ts`
- `tests/unit/lib/gpg.test.ts`
- `tests/unit/lib/download.test.ts` (if verification flow is exercised there)

**Acceptance**
- Signature verification depends on pinned trust, not network-delivered key alone.
- Failure messaging is actionable and does not silently downgrade security.

## Batch E: Type-Safety and Remaining Sink Hardening

### E1. Normalize status and enum usage (`F12`, `F13`, `F15`)

**Work**
- Unify sync status vocabulary across all type definitions (`none` vs `no session`).
- Type `ContainerInfo.status` as `ContainerStatus`.
- Replace loose `sync_mode: string` with explicit union/enum.
- Update all call sites to compile cleanly.

**Files**
- `src/types/index.ts`
- any dependent files under `src/lib/**` and `src/commands/**`
- relevant unit tests that assert status strings

**Acceptance**
- `bun run typecheck` passes with stricter types.
- Runtime output remains backward-compatible or intentionally migrated.

### E2. Validate template name at write sink (`F14`)

**Work**
- Enforce safe template name validation inside `scaffoldTemplate` regardless of caller validation.
- Reject path separators/traversal at sink.

**Files**
- `src/lib/templates.ts`
- `tests/unit/lib/templates.test.ts`

**Acceptance**
- Unsafe template names cannot produce out-of-directory writes.
- Existing valid names continue to work.

## Batch F: Verification and Exit Criteria

### Required test runs

1. `bun run typecheck`
2. `bun run check:ci`
3. `bun test --preload ./tests/helpers/test-utils.ts tests/unit`
4. Targeted command tests:
   - `bun test tests/unit/commands/clone.test.ts`
   - `bun test tests/unit/lib/ssh.test.ts`
   - `bun test tests/unit/lib/gpg.test.ts`
   - `bun test tests/unit/commands/up.test.ts`

### Final completion checklist

- [ ] All findings `F01` through `F15` are implemented.
- [ ] New regression tests added for each fixed bug class.
- [ ] No security fix introduces silent fallback that weakens protection.
- [ ] Typecheck, lint/check, and unit suite pass.
- [ ] Plan moved to `plans/archive/` once implementation is complete.
