# Codebase Guide

This guide helps contributors understand the SkyBox codebase structure, key files, and how to add new features.

## Directory Structure

```
skybox/
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── biome.json             # Linting/formatting config
├── bin/
│   └── skybox             # Shebang wrapper (#!/usr/bin/env bun)
├── src/
│   ├── index.ts           # CLI entry point, commander setup
│   ├── commands/          # One file per CLI command
│   │   ├── init.ts        # Interactive setup wizard
│   │   ├── clone.ts       # Clone remote project locally
│   │   ├── push.ts        # Push local project to remote
│   │   ├── up.ts          # Start container + create session
│   │   ├── down.ts        # Stop container + end session
│   │   ├── status.ts      # Show project status
│   │   ├── browse.ts      # List remote projects
│   │   ├── list.ts        # List local projects
│   │   ├── editor.ts      # Configure default editor
│   │   ├── rm.ts          # Remove local project
│   │   ├── shell.ts       # Enter container shell
│   │   ├── new.ts         # Create new project on remote
│   │   ├── config.ts      # View/edit configuration
│   │   ├── config-devcontainer.ts # Manage devcontainer.json from remote templates
│   │   ├── remote.ts      # Manage multiple remotes
│   │   ├── logs.ts        # View container and sync logs
│   │   ├── update.ts      # Update Mutagen binary
│   │   ├── open.ts        # Open project in editor
│   │   ├── doctor.ts      # Diagnose environment issues
│   │   └── __tests__/     # Command tests
│   ├── lib/               # Shared functionality
│   │   ├── config.ts      # Config file operations
│   │   ├── constants.ts   # Shared constants
│   │   ├── container.ts   # Docker/devcontainer ops
│   │   ├── mutagen.ts     # Sync management
│   │   ├── ssh.ts         # SSH operations
│   │   ├── session.ts     # Session file management (atomic)
│   │   ├── remote.ts      # Remote project operations
│   │   ├── project.ts     # Project resolution
│   │   ├── download.ts    # Binary downloads
│   │   ├── templates.ts   # Devcontainer templates
│   │   ├── projectTemplates.ts # Built-in + user-defined project templates
│   │   ├── paths.ts       # Path constants
│   │   ├── errors.ts      # Error utilities
│   │   ├── shell.ts       # Shell escaping utilities
│   │   ├── ui.ts          # Terminal UI helpers
│   │   ├── encryption.ts  # AES-256-GCM encryption for secrets
│   │   ├── validation.ts  # Input validation and path safety
│   │   ├── migration.ts   # Config format migration
│   │   ├── startup.ts     # Dependency checks at launch
│   │   └── __tests__/     # Library tests
│   └── types/
│       └── index.ts       # All TypeScript interfaces
├── docs/                  # VitePress documentation
├── plans/                 # Implementation plans and tracker
└── CHANGELOG.md           # Version history
```

## Key Files

### Entry Point: `src/index.ts`

The CLI entry point uses Commander.js to register all commands:

```typescript
import { program } from "commander";

program
  .name("skybox")
  .description("Local-first dev containers with remote sync")
  .version(pkg.version);

// Each command is registered here
program
  .command("up [project]")
  .description("Start a development container")
  .option("-e, --editor", "Open in editor after start")
  .action(upCommand);

program.parse();
```

### Configuration: `src/lib/config.ts`

Handles reading and writing `~/.skybox/config.yaml`:

```typescript
// Check if config exists
export function configExists(): boolean

// Load config (returns null if missing)
export function loadConfig(): SkyboxConfig | null

// Save config (creates directory if needed)
export function saveConfig(config: SkyboxConfig): void
```

### Path Constants: `src/lib/paths.ts`

Centralized path definitions:

```typescript
export const SKYBOX_HOME = process.env.SKYBOX_HOME || "~/.skybox"
export const CONFIG_PATH = join(SKYBOX_HOME, "config.yaml")
export const PROJECTS_DIR = join(SKYBOX_HOME, "projects")
export const BIN_DIR = join(SKYBOX_HOME, "bin")
export const MUTAGEN_PATH = join(BIN_DIR, "mutagen")
```

### Type Definitions: `src/types/index.ts`

All TypeScript interfaces in one place:

```typescript
// Configuration types
interface SkyboxConfigV2 { ... }  // Multi-remote config format
interface RemoteEntry { ... }     // Remote server definition
interface ProjectConfigV2 { ... } // Project with remote reference

// Runtime types
enum ContainerStatus { Running, Stopped, NotFound, Error, Unknown }
interface ContainerInfo { ... }
interface SyncStatus { exists, paused, status: SyncStatusValue }
type SyncStatusValue = "syncing" | "paused" | "none" | "error"

// Session types
interface SessionInfo { machine, user, timestamp, pid, expires }
interface SessionConflictResult { hasConflict, existingSession? }

// Template types
interface DevcontainerConfig { ... }  // devcontainer.json structure
interface Template { id, name, description, config }

// Command option types
interface UpOptions { editor?, attach?, rebuild?, noPrompt? }
interface DownOptions { cleanup?, force?, noPrompt? }
```

## Adding a New Command

### Step 1: Create Command File

Create `src/commands/mycommand.ts`:

```typescript
import { configExists, loadConfig } from "../lib/config.ts";
import { error, success, spinner } from "../lib/ui.ts";

export async function myCommand(arg: string, options: MyOptions): Promise<void> {
  // 1. Check config exists
  if (!configExists()) {
    error("skybox not configured. Run 'skybox init' first.");
    process.exit(1);
  }

  const config = loadConfig();

  // 2. Your command logic
  const spin = spinner("Doing something...");

  // ... do work ...

  spin.succeed("Done!");
}
```

### Step 2: Register Command

In `src/index.ts`:

```typescript
import { myCommand } from "./commands/mycommand.ts";

program
  .command("mycommand <arg>")
  .description("Description of what it does")
  .option("-f, --flag", "Some flag")
  .action(myCommand);
```

### Step 3: Add Types (if needed)

In `src/types/index.ts`:

```typescript
export interface MyOptions {
  flag?: boolean;
}
```

### Step 4: Write Tests

Create `src/commands/__tests__/mycommand.test.ts`:

```typescript
import { describe, expect, it, mock } from "bun:test";

describe("myCommand", () => {
  it("should do something", async () => {
    // Test implementation
  });
});
```

## Modifying Existing Behavior

### Adding a Flag to a Command

1. **Update types** in `src/types/index.ts`:
   ```typescript
   export interface UpOptions {
     editor?: boolean;
     attach?: boolean;
     newFlag?: boolean;  // Add here
   }
   ```

2. **Register the flag** in `src/index.ts`:
   ```typescript
   program
     .command("up [project]")
     .option("--new-flag", "Description")  // Add here
     .action(upCommand);
   ```

3. **Handle the flag** in the command file:
   ```typescript
   if (options.newFlag) {
     // Do something
   }
   ```

### Adding a Library Function

1. **Add to appropriate lib file** (or create new one):
   ```typescript
   // src/lib/mylib.ts
   export async function myFunction(): Promise<Result> {
     // Implementation
   }
   ```

2. **Write tests**:
   ```typescript
   // src/lib/__tests__/mylib.test.ts
   describe("myFunction", () => {
     it("should work", async () => {
       const result = await myFunction();
       expect(result.success).toBe(true);
     });
   });
   ```

3. **Use in commands**:
   ```typescript
   import { myFunction } from "../lib/mylib.ts";
   ```

## UI Conventions

### Terminal Output (`src/lib/ui.ts`)

Use these functions for consistent output:

```typescript
import { error, warn, info, success, header, spinner } from "../lib/ui.ts";

// For errors (red, exits by default)
error("Something went wrong");

// For warnings (yellow)
warn("Heads up about something");

// For info (dim)
info("FYI message");

// For success (green)
success("Task completed!");

// For section headers (bold)
header("Starting operation...");

// For long-running operations
const spin = spinner("Loading...");
spin.succeed("Loaded!");  // or spin.fail("Failed")
```

### Interactive Prompts

Use Inquirer for user input:

```typescript
import inquirer from "inquirer";

// List selection
const { choice } = await inquirer.prompt([{
  type: "rawlist",
  name: "choice",
  message: "Select an option:",
  choices: ["Option 1", "Option 2"],
}]);

// Confirmation
const { confirmed } = await inquirer.prompt([{
  type: "confirm",
  name: "confirmed",
  message: "Are you sure?",
  default: false,
}]);
```

## Error Handling

### Using Error Utilities (`src/lib/errors.ts`)

```typescript
import { getErrorMessage, getExecaErrorMessage, hasExitCode } from "../lib/errors.ts";

try {
  await execa("command", ["args"]);
} catch (error) {
  // For execa errors (prefers stderr)
  const message = getExecaErrorMessage(error);

  // For general errors
  const message = getErrorMessage(error);

  // Check specific exit codes
  if (hasExitCode(error, 130)) {
    // User pressed Ctrl+C
  }
}
```

### Return Types for Operations

Library functions return result objects instead of throwing:

```typescript
// Good pattern
async function doOperation(): Promise<{ success: boolean; error?: string }> {
  try {
    await execa("command", ["args"]);
    return { success: true };
  } catch (error) {
    return { success: false, error: getExecaErrorMessage(error) };
  }
}

// Usage
const result = await doOperation();
if (!result.success) {
  error(result.error || "Unknown error");
  process.exit(1);
}
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/lib/__tests__/config.test.ts

# Run tests matching pattern
bun test --filter "config"
```

### Mocking External Commands

Tests mock `execa` to avoid running real commands:

```typescript
import { mock } from "bun:test";
import * as execa from "execa";

mock.module("execa", () => ({
  execa: mock(async () => ({ stdout: "mocked output" })),
}));
```

## Common Patterns

### Project Resolution

Multiple ways a project can be specified:

```typescript
import {
  resolveProjectFromCwd,
  getLocalProjects,
  projectExists,
  getProjectPath
} from "../lib/project.ts";

// 1. From argument
let project = projectArg;

// 2. From current directory
if (!project) {
  project = resolveProjectFromCwd();
}

// 3. From interactive selection
if (!project) {
  const projects = getLocalProjects();
  // prompt user to select
}

// Verify and get path
if (!projectExists(project)) {
  error("Project not found");
}
const projectPath = getProjectPath(project);
```

### Config-First Operations

Most commands follow this pattern:

```typescript
export async function myCommand(): Promise<void> {
  // 1. Check config
  if (!configExists()) {
    error("Run 'skybox init' first.");
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    error("Failed to load config.");
    process.exit(1);
  }

  // 2. Do operation
  // ...

  // 3. Save config changes (if any)
  saveConfig(config);
}
```

### Non-Interactive Mode

Commands with `--no-prompt` flag should work in scripts:

```typescript
if (options.noPrompt) {
  // Use defaults, fail if required input is missing
  error("Cannot proceed without X in non-interactive mode.");
  process.exit(1);
} else {
  // Prompt user
  const { answer } = await inquirer.prompt([...]);
}
```
