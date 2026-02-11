**Runtime Configuration**

| Variable | Default | Description |
|----------|---------|-------------|
| `SKYBOX_HOME` | `~/.skybox` | Override the default SkyBox home directory |
| `SKYBOX_AUDIT` | `0` | Set to `1` to enable audit logging to `~/.skybox/audit.log` |
| `SKYBOX_HOOK_WARNINGS` | `1` | Set to `0` to suppress one-time hook security warnings |
| `SKYBOX_TELEMETRY` | `1` | Set to `0` to disable anonymous first-run install tracking |
| `HOME` | - | Used for `~` expansion in paths (e.g., remote `path` and `key` fields) |
| `DEBUG` | unset | Set to any value to enable debug output in list command |
| `EDITOR` | - | Fallback editor command if not configured in SkyBox config |

**Build-Time Metadata** (not user-configurable — set during compilation)

| Variable | Default | Description |
|----------|---------|-------------|
| `SKYBOX_INSTALL_METHOD` | unset | Install source metadata (`homebrew` or `github-release` for direct download) |
| `RYBBIT_URL` | unset | Telemetry endpoint for first-run install tracking; telemetry is disabled when unset |
| `RYBBIT_SITE_ID` | unset | Telemetry site identifier; telemetry is disabled when unset |
| `RYBBIT_API_KEY` | unset | Telemetry API key; telemetry is disabled when unset |
