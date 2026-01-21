# Design: devbox init Command

> Core setup flow for the devbox CLI

## Overview

The `devbox init` command is an interactive wizard that configures devbox for first use. It handles dependency checking, mutagen binary download, SSH configuration, and creates the initial config file.

## Project Structure

```
devbox/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI entry, commander setup
│   ├── commands/
│   │   └── init.ts           # Setup wizard
│   ├── lib/
│   │   ├── config.ts         # Read/write ~/.devbox/config.yaml
│   │   ├── ssh.ts            # SSH key detection, connection testing
│   │   ├── download.ts       # Mutagen binary download
│   │   └── paths.ts          # ~/.devbox/*, path constants
│   └── types/
│       └── index.ts          # TypeScript interfaces
└── bin/
    └── devbox                # Shebang wrapper: #!/usr/bin/env bun
```

## Technology Choices

- **Runtime**: Bun (native TypeScript, fast execution)
- **CLI Framework**: Commander.js
- **Interactive Prompts**: Inquirer
- **Output**: Chalk (colors), Ora (spinners)
- **Config Format**: YAML

## Init Command Flow

### Step 1: Check Dependencies

- Docker installed? Exit with install instructions if missing
- Node available? Exit if missing (needed for devcontainer-cli later)

### Step 2: Check Existing Config

- If `~/.devbox/config.yaml` exists, offer to reconfigure or exit

### Step 3: Download Mutagen

- Detect OS (darwin/linux) and arch (arm64/amd64)
- Download from GitHub releases
- Verify SHA256 checksum
- Extract to `~/.devbox/bin/mutagen`
- Skip if already installed and working

### Step 4: Configure Remote Server

- Scan `~/.ssh/config` for existing hosts
- Offer: "Use existing host?" or "Add new server?"
- If new: collect hostname, username, friendly name
- Test SSH connection

### Step 5: Handle SSH Authentication

- Find existing keys (`~/.ssh/id_ed25519`, `id_rsa`, etc.)
- Test if passwordless auth works
- If not: offer to run `ssh-copy-id`
- Fall back to manual instructions if ssh-copy-id fails
- Re-test connection

### Step 6: Configure Remote Paths

- Ask: "Where do you keep code on the remote?" (default: `~/code`)
- Verify directory exists via SSH (or offer to create)
- List existing projects if any

### Step 7: Configure Editor

- Prompt: cursor / code / vim / zed / other

### Step 8: Write Config & Create Directories

- Write `~/.devbox/config.yaml`
- Create `~/.devbox/projects/`
- Create `~/.devbox/bin/`
- Show success message with next steps

## Module Interfaces

### paths.ts

```typescript
export const DEVBOX_HOME = process.env.DEVBOX_HOME || `${homedir()}/.devbox`
export const CONFIG_PATH = `${DEVBOX_HOME}/config.yaml`
export const PROJECTS_DIR = `${DEVBOX_HOME}/projects`
export const BIN_DIR = `${DEVBOX_HOME}/bin`
export const MUTAGEN_PATH = `${BIN_DIR}/mutagen`
```

### config.ts

```typescript
interface DevboxConfig {
  remote: { host: string; base_path: string }
  editor: string
  defaults: { sync_mode: string; ignore: string[] }
  projects: Record<string, ProjectConfig>
}

export function loadConfig(): DevboxConfig | null
export function saveConfig(config: DevboxConfig): void
export function configExists(): boolean
```

### ssh.ts

```typescript
export function parseSSHConfig(): SSHHost[]
export function testConnection(host: string): Promise<boolean>
export function findSSHKeys(): string[]
export function copyKey(host: string, keyPath: string): Promise<boolean>
```

### download.ts

```typescript
export function isMutagenInstalled(): boolean
export function downloadMutagen(): Promise<void>
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Docker not installed | Show platform-specific install command, exit |
| SSH connection fails | Show actual error, suggest checking hostname/firewall |
| ssh-copy-id fails | Fall back to manual key copy instructions |
| Mutagen download fails | Retry once, then show manual download URL |
| Remote directory missing | Offer to create it via SSH |

## UX Details

- Use spinners for operations >1 second
- Show checkmarks for completed steps
- Clean up partial state on Ctrl+C
- Re-running init should be safe (idempotent)
- Don't overwrite existing SSH config entries

## Example Output

```
$ devbox init

Checking dependencies...
  ✓ Docker installed
  ✓ Node.js available

Downloading mutagen...
  ✓ Downloaded mutagen v0.17.5 (darwin-arm64)

Configure remote server
  ? Select SSH host: (Use arrows)
  ❯ hetzner-dev (existing)
    digitalocean (existing)
    + Add new server
```

## Next Steps

After this design is approved:

1. Initialize Bun project with dependencies
2. Implement `paths.ts` and `types/index.ts`
3. Implement `config.ts`
4. Implement `ssh.ts`
5. Implement `download.ts`
6. Implement `commands/init.ts`
7. Wire up CLI entry point
8. Test against real server
