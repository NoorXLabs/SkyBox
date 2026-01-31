# devbox update

Update the Mutagen binary to the latest bundled version.

## Usage

```bash
devbox update
```

## Description

The `update` command checks whether the locally installed Mutagen binary matches the version bundled with DevBox and updates it if needed.

The command performs the following steps:

1. **Version Check** - Reads the currently installed Mutagen version
2. **Comparison** - Compares it against the target version bundled with DevBox
3. **Extraction** - If a bundled Mutagen asset is available (compiled builds), extracts it directly
4. **Download Fallback** - If no bundled asset is found (dev mode), downloads from GitHub with a progress indicator

If Mutagen is already up to date, the command reports success and exits without downloading.

### When to Use

- After upgrading DevBox to a new version that bundles a newer Mutagen release
- If Mutagen was not installed during initial setup
- To repair a corrupted or missing Mutagen binary

## Examples

```bash
# Check and update Mutagen
devbox update

# Output when already up to date:
#   Checking for updates...
#   ✔ Mutagen is up to date (v0.18.1).

# Output when updating:
#   Checking for updates...
#   Mutagen: v0.17.5 → v0.18.1
#   ✔ Mutagen updated to v0.18.1.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (download failed) |

## See Also

- [devbox init](/reference/init) - Initial setup (also installs Mutagen)
