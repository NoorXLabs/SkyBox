# Post-Review Follow-Up Tasks

**Branch:** `NoorChasib/security-audit-src`
**Created:** 2026-02-06
**Status:** Pending
**Context:** Items identified during code review of the security audit fixes (F01-F15).

## 1. Add unit tests for new validation and security functions

**Priority:** High
**Rationale:** The plan's acceptance criteria calls for "new regression tests added for each fixed bug class." The new security-critical functions are pure functions well-suited for unit testing.

**Functions needing test coverage:**

- `validateSSHHost()` in `src/lib/validation.ts`
  - Reject `-oProxyCommand=...`, whitespace, control chars
  - Accept normal hosts (`host`, `user@host`, FQDN, IP)

- `validateRemoteProjectPath()` in `src/lib/validation.ts`
  - Reject `..`, `/`, `\`, leading `-`, empty
  - Accept valid project names

- `escapeRemotePath()` in `src/lib/shell.ts`
  - Tilde preservation: `~/code` -> `~/'code'`
  - Normal path: `/opt/code` -> `'/opt/code'`

- `verifyKeyFingerprint()` in `src/lib/gpg.ts`
  - Fingerprint match and mismatch scenarios

- `scaffoldTemplate()` sink validation in `src/lib/templates.ts`
  - Reject path traversal names at sink level

- `secureScp()` in `src/lib/ssh.ts`
  - Verify `--` separator is in args

**Files:**
- `tests/unit/lib/validation.test.ts`
- `tests/unit/lib/shell.test.ts`
- `tests/unit/lib/ssh.test.ts`
- `tests/unit/lib/gpg.test.ts`
- `tests/unit/lib/templates.test.ts`

## 2. Verify GPG fingerprint constant

**Priority:** High
**Rationale:** If `MUTAGEN_GPG_FINGERPRINT` is incorrect, all GPG-preferred Mutagen downloads will fail with a fingerprint mismatch error.

**Work:**
- Fetch the actual key: `curl https://github.com/mutagen-io.gpg | gpg --with-colons --import-options show-only --import`
- Compare the `fpr:` line output against the constant `B850CA0C3E8B0D5B6029AD3C5B72E3F42C271B2A`
- Update the constant if it does not match
- Add verification command as a comment in `src/lib/constants.ts`

**File:** `src/lib/constants.ts` (line 142)

## 3. Audit log rotation same-day overwrite

**Priority:** Low
**Rationale:** If the audit log reaches 10 MB and rotates, then reaches 10 MB again on the same day, `renameSync` overwrites the first rotated file.

**Work:**
- Append a timestamp or sequence number to the rotated filename instead of just `YYYY-MM-DD`
- E.g., `audit.log.2026-02-06T12-00-00` or `audit.log.2026-02-06.1`

**File:** `src/lib/audit.ts` (rotation logic around line 117-125)

## 4. Handle bare `~` in `escapeRemotePath`

**Priority:** Low
**Rationale:** A bare `~` (without trailing `/`) would be single-quoted as `'~'`, preventing shell expansion. Unlikely in practice since remote paths always have structure like `~/code`.

**Work:**
- Add `path === "~"` check that returns `~` unquoted
- Or document that bare `~` is not a supported remote path value

**File:** `src/lib/shell.ts` (line 31)

## 5. Clean up redundant regex in `validateSSHHost`

**Priority:** Low
**Rationale:** The whitespace check `[\s\n\r]` is redundant since `\s` already matches `\n` and `\r`. The control character check `[\x00-\x1f\x7f]` also overlaps. Harmless but could be simplified.

**Work:**
- Simplify to two checks: leading `-` and control/whitespace characters
- Keep separate error messages for clarity

**File:** `src/lib/validation.ts` (lines 120-132)
