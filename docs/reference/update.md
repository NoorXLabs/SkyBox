# skybox update

Check for and install SkyBox updates.

## Usage

```bash
skybox update
```

## Description

The `update` command checks GitHub Releases for a newer version of SkyBox and either performs the update automatically or tells you the right command for your install method.

### Behavior by Install Method

| Install Method | Behavior |
|---------------|----------|
| **Direct download** (GitHub Release binary) | Downloads the new binary and replaces the current one in place |
| **Homebrew** | Shows the `brew upgrade skybox` command to run |
| **Source** | Shows the `git pull && bun install` command to run |

For direct download users, `skybox update` is the primary way to stay up to date. You'll also see a passive notification after any command when a new version is available:

```
Update available: 0.7.7 → 0.8.0.
Run: skybox update
```

### Self-Update Process (Direct Download)

When installed via GitHub Release binary, the command:

1. **Verifies permissions** — checks write access to the binary directory before downloading
2. **Downloads checksum** — fetches `checksums.txt` from the release for integrity verification
3. **Downloads** the correct platform binary (e.g., `skybox-darwin-arm64`) to a temp file
4. **Verifies integrity** — computes SHA-256 of the download and compares against the expected checksum
5. **Prepares binary** — sets executable permissions and removes macOS quarantine attributes
6. **Backs up** the current binary before replacing it
7. **Replaces** the current binary atomically (rename temp over current)
8. **Verifies** the new binary runs correctly (`--version` check)
9. **Rolls back** automatically if verification fails, restoring the previous version

If `checksums.txt` is not available for a release (e.g., older releases), the update proceeds with a warning but skips integrity verification.

## Examples

```bash
# Check and update
skybox update

# Output when up to date:
#   Checking for updates...
#   ✔ No update available. You are on the latest version (0.8.0).

# Output when updating (direct download):
#   Checking for updates...
#   ✔ SkyBox updated to v0.8.1 (verified).

# Output when update available (Homebrew):
#   Checking for updates...
#   Update available: 0.7.7 → 0.8.0
#   Run: brew upgrade skybox

# Output when permission denied:
#   ✗ Cannot update: permission denied for /usr/local/bin. Try running with sudo.

# Output when checksum fails:
#   ✗ Checksum verification failed.
#   ✗ The downloaded binary does not match the expected checksum. The download may be corrupted.

# Output when post-update verification fails:
#   ✗ Update verification failed.
#   ✗ The new binary did not report version 0.8.1. Restored previous version.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (up to date or updated) |
| 1 | Error (permission denied, network failure, checksum mismatch, or verification failed) |

## See Also

- [skybox doctor](/reference/doctor) - Diagnose common issues
- [Installation Guide](/guide/installation) - Install methods
