# Robust Self-Update for `skybox update`

**Date:** 2026-02-07
**Status:** Planned
**Goal:** Harden the `skybox update` self-update flow for direct download (github-release) users with integrity verification, rollback on failure, permission pre-checks, and post-update confirmation.

## Current State

The self-update in `src/commands/update.ts` downloads the new binary from GitHub Releases, writes to a temp file, and renames it over the current binary. It works but has gaps:

1. **No integrity verification** — the downloaded binary is not checked against a known hash
2. **No post-update verification** — we don't confirm the new binary actually runs
3. **No permission pre-check** — if the binary is in a protected directory, we fail late with a confusing error
4. **No rollback** — if the new binary is corrupt, the old one is already gone
5. **No macOS Gatekeeper handling** — downloaded binaries may be quarantined

## Implementation Plan

### Step 1: Permission Pre-Check

**File:** `src/commands/update.ts`

Before downloading anything, verify we can write to the binary's directory:

- Check `accessSync(binaryDir, constants.W_OK)` to confirm write permission
- Check `accessSync(currentBinary, constants.W_OK)` to confirm we can replace the binary
- If either fails, print a clear error: `Cannot update: permission denied for <path>. Try running with sudo.`
- Do this check right after the user confirms "yes" but before starting the download

### Step 2: SHA-256 Checksum Verification

**File:** `src/commands/update.ts`

The release workflow already generates `checksums.txt` with SHA-256 hashes for all binaries. It's uploaded as a release asset alongside the binaries.

Format of `checksums.txt`:
```
a1b2c3...  skybox-darwin-arm64
d4e5f6...  skybox-darwin-x64
g7h8i9...  skybox-linux-x64
j0k1l2...  skybox-linux-arm64
a1b2c3...  skybox-darwin-arm64.tar.gz
...
```

Flow:
1. Download `checksums.txt` from `https://github.com/{OWNER}/{REPO}/releases/download/v{version}/checksums.txt`
2. Parse it to find the expected hash for the current platform's binary (e.g., `skybox-darwin-arm64`)
3. After downloading the binary to temp, compute its SHA-256 using `crypto.createHash("sha256")`
4. Compare computed hash against expected hash
5. If mismatch: delete temp file, fail with error `Checksum verification failed. The download may be corrupted.`
6. If `checksums.txt` download fails: warn but continue (don't block updates if the checksums file is missing from an older release)

### Step 3: Backup and Rollback

**File:** `src/commands/update.ts`

Before replacing the binary, create a backup so we can restore on failure:

1. Before `renameSync(tempPath, currentBinary)`, copy the current binary to a backup: `backupPath = join(binaryDir, ".skybox-backup")`
2. Use `copyFileSync(currentBinary, backupPath)` to create the backup
3. Then do the rename (replace current with new)
4. If post-update verification (Step 4) fails:
   - Restore from backup: `renameSync(backupPath, currentBinary)`
   - Print error: `Update verification failed. Restored previous version.`
5. If everything succeeds: delete the backup file
6. Clean up backup in the `catch` block too (restore if it exists)

### Step 4: Post-Update Version Verification

**File:** `src/commands/update.ts`

After replacing the binary, verify the new binary actually works:

1. After the rename, run `execFileSync(currentBinary, ["--version"], { encoding: "utf-8", timeout: 5000 })`
2. Parse the version from output (it prints the version string)
3. Compare against `targetVersion`
4. If it matches: report success `SkyBox updated to v{version} (verified).`
5. If it doesn't match or the binary crashes: trigger rollback from Step 3
6. Use `execFileSync` (not `execSync`) to avoid shell injection — the binary path comes from `process.execPath` which is safe, but it's good practice

### Step 5: macOS Gatekeeper / Quarantine Handling

**File:** `src/commands/update.ts`

When macOS downloads a binary via `fetch()`, it doesn't get quarantine attributes (only browsers/Finder add those). However, to be safe:

1. After writing the temp file and before rename, remove any quarantine attribute on macOS:
   ```
   if (process.platform === "darwin") {
       try {
           execFileSync("xattr", ["-d", "com.apple.quarantine", tempPath], { stdio: "pipe" });
       } catch {
           // Attribute may not exist, that's fine
       }
   }
   ```
2. This is a defensive measure — `fetch()` likely doesn't add it, but a proxy or security tool might

## Updated `selfUpdate` Flow

```
1. Permission pre-check (write access to binary dir and binary itself)
2. Download checksums.txt (warn on failure, don't block)
3. Download new binary to temp file
4. Verify SHA-256 checksum (if checksums.txt was available)
5. chmod 0o755
6. Remove macOS quarantine attribute (if darwin)
7. Backup current binary
8. Rename temp over current binary (atomic replace)
9. Run new binary with --version to verify it works
10. If verification passes: delete backup, print success
11. If verification fails: restore backup, print error
```

## Files to Modify

| File | Change |
|------|--------|
| `src/commands/update.ts` | All changes — permission check, checksum download/verify, backup/rollback, post-verify, quarantine removal |

No new files needed. No changes to other commands, types, or constants.

## Testing Considerations

- Unit test: `getBinaryAssetName()` returns correct platform string
- Unit test: checksum parsing from `checksums.txt` format
- Manual test: run `skybox update` when already on latest (no-op path)
- Manual test: run `skybox update` in a read-only directory (permission error path)
- The actual self-update flow requires a real GitHub release and can only be tested manually or in E2E

## Documentation Updates Required

- `docs/reference/update.md` — add note about checksum verification and rollback behavior
