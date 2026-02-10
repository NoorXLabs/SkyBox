---
title: skybox dashboard
description: Full-screen status dashboard for all SkyBox projects. Monitor containers, sync status, and resources in real time.
---

# skybox dashboard

Full-screen status dashboard for all projects.

<!-- COMMAND-SPEC:START -->
## Usage

```bash
skybox dashboard [options]
```

## Arguments

None.

## Options

| Option | Description |
|--------|-------------|
| `-d, --detailed` | Show detailed view with extra info |

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | display help for command |
| `-v, --version` | output the version number |
| `--dry-run` | Preview commands without executing them |
<!-- COMMAND-SPEC:END -->

## Description

The `dashboard` command opens a full-screen terminal UI showing all local projects with live-updating status. It uses a responsive card grid layout that adjusts to terminal width.

### Card View

Each project is shown as a card with:

| Field | Description |
|-------|-------------|
| Name | Project name |
| Container | Running or stopped (color-coded) |
| Sync | Syncing, paused, or none |
| Session | Session status: "active here" (green), "active on \<machine\>" (yellow), or "none" (gray) |
| Branch | Current git branch |

### Detailed View

Press `d` to toggle detailed view, which adds:

| Field | Description |
|-------|-------------|
| Git Status | Clean or dirty working tree, with ahead/behind counts |
| Disk Usage | Local disk space used |
| Last Active | Time since last activity |
| Remote | Configured remote name |
| Container Name | Docker container name |
| Uptime | Container uptime or exit status |
| Encrypted | Whether project encryption is enabled |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `q`, `Ctrl+C`, `Escape` | Quit |
| `r` | Refresh project data |
| `d` | Toggle detailed/simple view |
| `↑↓←→` | Navigate between project cards |

### Auto-Refresh

The dashboard automatically refreshes project data every 10 seconds.

## Examples

```bash
# Open the dashboard
skybox dashboard

# Use the alias
skybox dash

# Start in detailed view
skybox dash --detailed
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Normal exit |

## See Also

- [skybox status](/reference/status) - Non-interactive project status
- [skybox list](/reference/list) - Simple list of local projects
