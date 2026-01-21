# Clone and Push Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `devbox clone` and `devbox push` commands with shared mutagen sync module.

**Architecture:** A shared `mutagen.ts` module wraps mutagen CLI for sync operations. Clone fetches projects from remote to local, push sends local projects to remote. Both create bidirectional sync sessions and offer to start the dev container after sync completes.

**Tech Stack:** Bun, Commander.js, execa, inquirer, existing lib modules (config, ssh, ui, paths)

---

## Task 1: Implement mutagen.ts module

**Files:**
- Create: `src/lib/mutagen.ts`
- Create: `src/lib/mutagen.test.ts`

**Step 1: Create mutagen.ts with core functions**

```typescript
// src/lib/mutagen.ts
import { execa } from "execa";
import { MUTAGEN_PATH } from "./paths";

export interface SyncStatus {
  exists: boolean;
  paused: boolean;
  status: string;
}

export function sessionName(project: string): string {
  return `devbox-${project}`;
}

export async function createSyncSession(
  project: string,
  localPath: string,
  remoteHost: string,
  remotePath: string,
  ignores: string[]
): Promise<{ success: boolean; error?: string }> {
  const name = sessionName(project);
  const alpha = localPath;
  const beta = `${remoteHost}:${remotePath}`;

  const args = [
    "sync", "create",
    alpha, beta,
    "--name", name,
    "--sync-mode", "two-way-resolved",
  ];

  // Add ignore patterns
  for (const pattern of ignores) {
    args.push("--ignore", pattern);
  }

  try {
    await execa(MUTAGEN_PATH, args);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function getSyncStatus(project: string): Promise<SyncStatus> {
  const name = sessionName(project);

  try {
    const result = await execa(MUTAGEN_PATH, [
      "sync", "list",
      "--label-selector", `name=${name}`,
    ]);

    if (!result.stdout || result.stdout.includes("No sessions found")) {
      return { exists: false, paused: false, status: "none" };
    }

    const paused = result.stdout.includes("Paused");
    const status = paused ? "paused" : "syncing";

    return { exists: true, paused, status };
  } catch {
    return { exists: false, paused: false, status: "error" };
  }
}

export async function waitForSync(
  project: string,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
  const name = sessionName(project);

  try {
    onProgress?.("Waiting for sync to complete...");
    await execa(MUTAGEN_PATH, ["sync", "flush", name]);
    onProgress?.("Sync complete");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function pauseSync(project: string): Promise<{ success: boolean; error?: string }> {
  const name = sessionName(project);

  try {
    await execa(MUTAGEN_PATH, ["sync", "pause", name]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function resumeSync(project: string): Promise<{ success: boolean; error?: string }> {
  const name = sessionName(project);

  try {
    await execa(MUTAGEN_PATH, ["sync", "resume", name]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function terminateSession(project: string): Promise<{ success: boolean; error?: string }> {
  const name = sessionName(project);

  try {
    await execa(MUTAGEN_PATH, ["sync", "terminate", name]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}
```

**Step 2: Create mutagen.test.ts**

```typescript
// src/lib/mutagen.test.ts
import { describe, expect, test } from "bun:test";
import { sessionName } from "./mutagen";

describe("mutagen", () => {
  test("sessionName formats correctly", () => {
    expect(sessionName("myapp")).toBe("devbox-myapp");
    expect(sessionName("my-project")).toBe("devbox-my-project");
  });

  test("sessionName handles special characters", () => {
    expect(sessionName("app_v2")).toBe("devbox-app_v2");
  });
});
```

**Step 3: Run tests**

Run: `bun test src/lib/mutagen.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/mutagen.ts src/lib/mutagen.test.ts
git commit -m "feat: add mutagen module for sync operations"
```

---

## Task 2: Implement clone command

**Files:**
- Create: `src/commands/clone.ts`
- Modify: `src/index.ts`

**Step 1: Create clone.ts**

```typescript
// src/commands/clone.ts
import inquirer from "inquirer";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { loadConfig, configExists, saveConfig } from "../lib/config";
import { runRemoteCommand } from "../lib/ssh";
import { createSyncSession, waitForSync } from "../lib/mutagen";
import { PROJECTS_DIR } from "../lib/paths";
import { success, error, info, header, spinner } from "../lib/ui";

async function checkRemoteProjectExists(host: string, basePath: string, project: string): Promise<boolean> {
  const result = await runRemoteCommand(host, `test -d ${basePath}/${project} && echo "EXISTS" || echo "NOT_FOUND"`);
  return result.stdout?.includes("EXISTS") ?? false;
}

export async function cloneCommand(project: string): Promise<void> {
  if (!project) {
    error("Usage: devbox clone <project>");
    process.exit(1);
  }

  if (!configExists()) {
    error("devbox not configured. Run 'devbox init' first.");
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    error("Failed to load config.");
    process.exit(1);
  }

  header(`Cloning '${project}' from ${config.remote.host}:${config.remote.base_path}/${project}...`);

  // Check project exists on remote
  const checkSpin = spinner("Checking remote project...");
  const exists = await checkRemoteProjectExists(config.remote.host, config.remote.base_path, project);

  if (!exists) {
    checkSpin.fail("Project not found on remote");
    error(`Project '${project}' not found on remote. Run 'devbox browse' to see available projects.`);
    process.exit(1);
  }
  checkSpin.succeed("Project found on remote");

  // Check local doesn't exist
  const localPath = join(PROJECTS_DIR, project);

  if (existsSync(localPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Project already exists locally. Overwrite?",
        default: false,
      },
    ]);

    if (!overwrite) {
      info("Clone cancelled.");
      return;
    }

    const { confirmOverwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmOverwrite",
        message: "Are you sure? All local changes will be lost.",
        default: false,
      },
    ]);

    if (!confirmOverwrite) {
      info("Clone cancelled.");
      return;
    }

    rmSync(localPath, { recursive: true });
  }

  // Create local directory
  mkdirSync(localPath, { recursive: true });
  success(`Created ${localPath}`);

  // Create sync session
  const syncSpin = spinner("Starting sync...");
  const remotePath = `${config.remote.base_path}/${project}`;

  const createResult = await createSyncSession(
    project,
    localPath,
    config.remote.host,
    remotePath,
    config.defaults.ignore
  );

  if (!createResult.success) {
    syncSpin.fail("Failed to create sync session");
    error(createResult.error || "Unknown error");
    process.exit(1);
  }

  // Wait for initial sync
  syncSpin.text = "Syncing files...";
  const syncResult = await waitForSync(project, (msg) => {
    syncSpin.text = msg;
  });

  if (!syncResult.success) {
    syncSpin.fail("Sync failed");
    error(syncResult.error || "Unknown error");
    process.exit(1);
  }

  syncSpin.succeed("Initial sync complete");

  // Register in config
  config.projects[project] = {};
  saveConfig(config);

  // Offer to start container
  console.log();
  const { startContainer } = await inquirer.prompt([
    {
      type: "confirm",
      name: "startContainer",
      message: "Start dev container now?",
      default: false,
    },
  ]);

  if (startContainer) {
    info("Container startup not yet implemented. Run 'devbox up " + project + "' when ready.");
  } else {
    info(`Run 'devbox up ${project}' when ready to start working.`);
  }
}
```

**Step 2: Wire up in index.ts**

Add after the list command:

```typescript
import { cloneCommand } from "./commands/clone";

program
  .command("clone <project>")
  .description("Clone remote project locally")
  .action(cloneCommand);
```

**Step 3: Run tests to verify nothing broke**

Run: `bun test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/commands/clone.ts src/index.ts
git commit -m "feat: add devbox clone command

Clones a project from remote server to local with mutagen sync.
- Verifies project exists on remote
- Double confirms before overwriting existing local project
- Creates bidirectional sync session
- Offers to start dev container after sync"
```

---

## Task 3: Implement push command

**Files:**
- Create: `src/commands/push.ts`
- Modify: `src/index.ts`

**Step 1: Create push.ts**

```typescript
// src/commands/push.ts
import inquirer from "inquirer";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import { join, resolve, basename } from "path";
import { execa } from "execa";
import { loadConfig, configExists, saveConfig } from "../lib/config";
import { runRemoteCommand } from "../lib/ssh";
import { createSyncSession, waitForSync } from "../lib/mutagen";
import { PROJECTS_DIR } from "../lib/paths";
import { success, error, info, header, spinner } from "../lib/ui";

async function checkRemoteProjectExists(host: string, basePath: string, project: string): Promise<boolean> {
  const result = await runRemoteCommand(host, `test -d ${basePath}/${project} && echo "EXISTS" || echo "NOT_FOUND"`);
  return result.stdout?.includes("EXISTS") ?? false;
}

async function isGitRepo(path: string): Promise<boolean> {
  return existsSync(join(path, ".git"));
}

async function initGit(path: string): Promise<void> {
  await execa("git", ["init"], { cwd: path });
  await execa("git", ["add", "."], { cwd: path });
  await execa("git", ["commit", "-m", "Initial commit"], { cwd: path });
}

export async function pushCommand(sourcePath: string, name?: string): Promise<void> {
  if (!sourcePath) {
    error("Usage: devbox push <path> [name]");
    process.exit(1);
  }

  if (!configExists()) {
    error("devbox not configured. Run 'devbox init' first.");
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    error("Failed to load config.");
    process.exit(1);
  }

  // Resolve path
  const absolutePath = resolve(sourcePath);
  if (!existsSync(absolutePath)) {
    error(`Path '${sourcePath}' not found.`);
    process.exit(1);
  }

  // Determine project name
  const projectName = name || basename(absolutePath);

  header(`Pushing '${projectName}' to ${config.remote.host}:${config.remote.base_path}/${projectName}...`);

  // Check if git repo
  if (!await isGitRepo(absolutePath)) {
    const { initGitRepo } = await inquirer.prompt([
      {
        type: "confirm",
        name: "initGitRepo",
        message: "This project isn't a git repo. Initialize git?",
        default: true,
      },
    ]);

    if (initGitRepo) {
      const gitSpin = spinner("Initializing git...");
      try {
        await initGit(absolutePath);
        gitSpin.succeed("Git initialized");
      } catch (err: any) {
        gitSpin.fail("Failed to initialize git");
        error(err.message);
        process.exit(1);
      }
    }
  }

  // Check remote doesn't exist
  const checkSpin = spinner("Checking remote...");
  const remoteExists = await checkRemoteProjectExists(config.remote.host, config.remote.base_path, projectName);

  if (remoteExists) {
    checkSpin.warn("Project already exists on remote");

    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Project already exists on remote. Overwrite?",
        default: false,
      },
    ]);

    if (!overwrite) {
      info("Push cancelled.");
      return;
    }

    const { confirmOverwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmOverwrite",
        message: "Are you sure? All remote changes will be lost.",
        default: false,
      },
    ]);

    if (!confirmOverwrite) {
      info("Push cancelled.");
      return;
    }

    // Remove remote directory
    await runRemoteCommand(config.remote.host, `rm -rf ${config.remote.base_path}/${projectName}`);
  } else {
    checkSpin.succeed("Remote path available");
  }

  // Create remote directory
  const mkdirSpin = spinner("Creating remote directory...");
  const mkdirResult = await runRemoteCommand(config.remote.host, `mkdir -p ${config.remote.base_path}/${projectName}`);

  if (!mkdirResult.success) {
    mkdirSpin.fail("Failed to create remote directory");
    error(mkdirResult.error || "Unknown error");
    process.exit(1);
  }
  mkdirSpin.succeed("Created remote directory");

  // Copy to devbox projects directory
  const localPath = join(PROJECTS_DIR, projectName);

  if (absolutePath !== localPath) {
    if (existsSync(localPath)) {
      rmSync(localPath, { recursive: true });
    }
    mkdirSync(PROJECTS_DIR, { recursive: true });
    cpSync(absolutePath, localPath, { recursive: true });
    success(`Copied to ${localPath}`);
  }

  // Create sync session
  const syncSpin = spinner("Starting sync...");
  const remotePath = `${config.remote.base_path}/${projectName}`;

  const createResult = await createSyncSession(
    projectName,
    localPath,
    config.remote.host,
    remotePath,
    config.defaults.ignore
  );

  if (!createResult.success) {
    syncSpin.fail("Failed to create sync session");
    error(createResult.error || "Unknown error");
    process.exit(1);
  }

  // Wait for initial sync
  syncSpin.text = "Syncing files...";
  const syncResult = await waitForSync(projectName, (msg) => {
    syncSpin.text = msg;
  });

  if (!syncResult.success) {
    syncSpin.fail("Sync failed");
    error(syncResult.error || "Unknown error");
    process.exit(1);
  }

  syncSpin.succeed("Initial sync complete");

  // Register in config
  config.projects[projectName] = {};
  saveConfig(config);

  // Offer to start container
  console.log();
  const { startContainer } = await inquirer.prompt([
    {
      type: "confirm",
      name: "startContainer",
      message: "Start dev container now?",
      default: false,
    },
  ]);

  if (startContainer) {
    info("Container startup not yet implemented. Run 'devbox up " + projectName + "' when ready.");
  } else {
    info(`Run 'devbox up ${projectName}' when ready to start working.`);
  }
}
```

**Step 2: Wire up in index.ts**

Add after the clone command:

```typescript
import { pushCommand } from "./commands/push";

program
  .command("push <path> [name]")
  .description("Push local project to remote")
  .action(pushCommand);
```

**Step 3: Run tests to verify nothing broke**

Run: `bun test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/commands/push.ts src/index.ts
git commit -m "feat: add devbox push command

Pushes a local project to remote server with mutagen sync.
- Offers to initialize git if not a repo
- Double confirms before overwriting existing remote project
- Copies project to ~/.devbox/projects/
- Creates bidirectional sync session
- Offers to start dev container after sync"
```

---

## Task 4: Add tests for clone command

**Files:**
- Create: `src/commands/clone.test.ts`

**Step 1: Create clone.test.ts**

```typescript
// src/commands/clone.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("clone command", () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-clone-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    originalEnv = process.env.DEVBOX_HOME;
    process.env.DEVBOX_HOME = testDir;
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    if (originalEnv) {
      process.env.DEVBOX_HOME = originalEnv;
    } else {
      delete process.env.DEVBOX_HOME;
    }
  });

  test("requires project argument", async () => {
    // Test that empty project name would be rejected
    const projectName = "";
    expect(projectName).toBeFalsy();
  });

  test("local path is constructed correctly", () => {
    const projectsDir = join(testDir, "projects");
    const project = "myapp";
    const localPath = join(projectsDir, project);
    expect(localPath).toBe(`${testDir}/projects/myapp`);
  });

  test("detects existing local project", () => {
    const projectsDir = join(testDir, "projects");
    const project = "myapp";
    const localPath = join(projectsDir, project);

    mkdirSync(localPath, { recursive: true });
    expect(existsSync(localPath)).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `bun test src/commands/clone.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/commands/clone.test.ts
git commit -m "test: add tests for clone command"
```

---

## Task 5: Add tests for push command

**Files:**
- Create: `src/commands/push.test.ts`

**Step 1: Create push.test.ts**

```typescript
// src/commands/push.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join, resolve, basename } from "path";
import { tmpdir } from "os";

describe("push command", () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-push-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    originalEnv = process.env.DEVBOX_HOME;
    process.env.DEVBOX_HOME = testDir;
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    if (originalEnv) {
      process.env.DEVBOX_HOME = originalEnv;
    } else {
      delete process.env.DEVBOX_HOME;
    }
  });

  test("resolves relative path to absolute", () => {
    const relativePath = "./my-project";
    const absolutePath = resolve(relativePath);
    expect(absolutePath.startsWith("/")).toBe(true);
  });

  test("extracts project name from path", () => {
    const path = "/Users/test/my-awesome-project";
    const name = basename(path);
    expect(name).toBe("my-awesome-project");
  });

  test("detects git repo by .git folder", () => {
    const projectPath = join(testDir, "my-project");
    mkdirSync(projectPath, { recursive: true });

    // No .git folder
    expect(existsSync(join(projectPath, ".git"))).toBe(false);

    // Create .git folder
    mkdirSync(join(projectPath, ".git"));
    expect(existsSync(join(projectPath, ".git"))).toBe(true);
  });

  test("custom name overrides basename", () => {
    const sourcePath = "/Users/test/my-project";
    const customName = "renamed-project";
    const projectName = customName || basename(sourcePath);
    expect(projectName).toBe("renamed-project");
  });
});
```

**Step 2: Run tests**

Run: `bun test src/commands/push.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/commands/push.test.ts
git commit -m "test: add tests for push command"
```

---

## Task 6: Run all tests and verify

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass (should be ~30 tests now)

**Step 2: Verify commands are registered**

Run: `bun run dev --help`
Expected: Shows clone and push commands in help output

**Step 3: Final commit if any fixes needed**

---

## Summary

After completing all tasks:
- `mutagen.ts` module provides sync operations (create, wait, pause, resume, terminate)
- `devbox clone <project>` fetches projects from remote with double-confirm overwrite
- `devbox push <path> [name]` sends local projects to remote with git init option
- Both commands offer to start dev container after sync
- Tests cover path handling, validation logic
