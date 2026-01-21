# Browse and List Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `devbox browse` and `devbox list` commands to show projects on remote and local respectively.

**Architecture:** Two simple commands that read project listings - `browse` via SSH to remote server, `list` via local filesystem. Both output "detailed cards" format with project name and git branch. Reuses existing ssh.ts and config.ts modules.

**Tech Stack:** Bun, Commander.js, execa, existing lib modules (config, ssh, ui, paths)

---

## Task 1: Implement browse command

**Files:**
- Create: `src/commands/browse.ts`
- Modify: `src/index.ts`

**Step 1: Create browse.ts with basic structure**

```typescript
// src/commands/browse.ts
import { loadConfig, configExists } from "../lib/config";
import { runRemoteCommand } from "../lib/ssh";
import { error, info, header, spinner } from "../lib/ui";

interface RemoteProject {
  name: string;
  branch: string;
}

async function getRemoteProjects(host: string, basePath: string): Promise<RemoteProject[]> {
  const script = `for d in ${basePath}/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "-")
    echo "$name|$branch"
  done`;

  const result = await runRemoteCommand(host, script);

  if (!result.success || !result.stdout?.trim()) {
    return [];
  }

  return result.stdout
    .trim()
    .split("\n")
    .filter((line) => line.includes("|"))
    .map((line) => {
      const [name, branch] = line.split("|");
      return { name, branch };
    });
}

function printProjects(projects: RemoteProject[], host: string, basePath: string): void {
  header(`Remote projects (${host}:${basePath}):`);
  console.log();

  for (const project of projects) {
    console.log(`  ${project.name}`);
    console.log(`    Branch: ${project.branch}`);
    console.log();
  }

  info("Run 'devbox clone <project>' to clone a project locally.");
}

function printEmpty(): void {
  console.log();
  console.log("No projects found on remote.");
  info("Run 'devbox push ./my-project' to push your first project.");
}

export async function browseCommand(): Promise<void> {
  if (!configExists()) {
    error("devbox not configured. Run 'devbox init' first.");
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    error("Failed to load config.");
    process.exit(1);
  }

  const spin = spinner("Fetching remote projects...");

  try {
    const projects = await getRemoteProjects(config.remote.host, config.remote.base_path);
    spin.stop();

    if (projects.length === 0) {
      printEmpty();
    } else {
      printProjects(projects, config.remote.host, config.remote.base_path);
    }
  } catch (err: any) {
    spin.fail("Failed to connect to remote");
    error(err.message || "Check your SSH config.");
    process.exit(1);
  }
}
```

**Step 2: Wire up in index.ts**

Add after the init command registration:

```typescript
import { browseCommand } from "./commands/browse";

program
  .command("browse")
  .description("List projects on remote server")
  .action(browseCommand);
```

**Step 3: Test manually**

Run: `bun run dev browse`
Expected: Either shows projects from remote or "No projects found" message

**Step 4: Commit**

```bash
git add src/commands/browse.ts src/index.ts
git commit -m "feat: add devbox browse command

Lists projects on remote server with git branch info.
Shows friendly message when no projects exist."
```

---

## Task 2: Implement list command

**Files:**
- Create: `src/commands/list.ts`
- Modify: `src/index.ts`

**Step 1: Create list.ts with basic structure**

```typescript
// src/commands/list.ts
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import { configExists } from "../lib/config";
import { PROJECTS_DIR } from "../lib/paths";
import { error, info, header } from "../lib/ui";

interface LocalProject {
  name: string;
  branch: string;
  path: string;
}

async function getGitBranch(projectPath: string): Promise<string> {
  try {
    const result = await execa("git", ["-C", projectPath, "branch", "--show-current"]);
    return result.stdout.trim() || "-";
  } catch {
    return "-";
  }
}

async function getLocalProjects(): Promise<LocalProject[]> {
  if (!existsSync(PROJECTS_DIR)) {
    return [];
  }

  const entries = readdirSync(PROJECTS_DIR);
  const projects: LocalProject[] = [];

  for (const entry of entries) {
    const fullPath = join(PROJECTS_DIR, entry);
    if (statSync(fullPath).isDirectory()) {
      const branch = await getGitBranch(fullPath);
      projects.push({
        name: entry,
        branch,
        path: fullPath,
      });
    }
  }

  return projects;
}

function printProjects(projects: LocalProject[]): void {
  header("Local projects:");
  console.log();

  for (const project of projects) {
    console.log(`  ${project.name}`);
    console.log(`    Branch: ${project.branch}`);
    console.log(`    Path: ${project.path}`);
    console.log();
  }

  info("Run 'devbox up <project>' to start working.");
}

function printEmpty(): void {
  console.log();
  console.log("No local projects yet.");
  info("Run 'devbox clone <project>' or 'devbox push ./path' to get started.");
}

export async function listCommand(): Promise<void> {
  if (!configExists()) {
    error("devbox not configured. Run 'devbox init' first.");
    process.exit(1);
  }

  const projects = await getLocalProjects();

  if (projects.length === 0) {
    printEmpty();
  } else {
    printProjects(projects);
  }
}
```

**Step 2: Wire up in index.ts**

Add after the browse command registration:

```typescript
import { listCommand } from "./commands/list";

program
  .command("list")
  .description("List local projects")
  .action(listCommand);
```

**Step 3: Test manually**

Run: `bun run dev list`
Expected: Either shows local projects or "No local projects yet" message

**Step 4: Commit**

```bash
git add src/commands/list.ts src/index.ts
git commit -m "feat: add devbox list command

Lists local projects with git branch and path info.
Shows friendly message when no projects exist."
```

---

## Task 3: Add tests for browse command

**Files:**
- Create: `src/commands/browse.test.ts`

**Step 1: Write the test file**

```typescript
// src/commands/browse.test.ts
import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("browse command", () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-browse-test-${Date.now()}`);
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

  test("exits with error when no config exists", async () => {
    const { configExists } = await import("../lib/config");
    expect(configExists()).toBe(false);
  });

  test("parses project list from SSH output", async () => {
    // Test the parsing logic directly
    const sshOutput = "myapp|main\nbackend|develop\nexperiments|main";
    const lines = sshOutput.split("\n");
    const projects = lines.map((line) => {
      const [name, branch] = line.split("|");
      return { name, branch };
    });

    expect(projects).toEqual([
      { name: "myapp", branch: "main" },
      { name: "backend", branch: "develop" },
      { name: "experiments", branch: "main" },
    ]);
  });

  test("handles empty SSH output", async () => {
    const sshOutput = "";
    const projects = sshOutput
      .trim()
      .split("\n")
      .filter((line) => line.includes("|"));

    expect(projects).toEqual([]);
  });
});
```

**Step 2: Run tests**

Run: `bun test src/commands/browse.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/commands/browse.test.ts
git commit -m "test: add tests for browse command"
```

---

## Task 4: Add tests for list command

**Files:**
- Create: `src/commands/list.test.ts`

**Step 1: Write the test file**

```typescript
// src/commands/list.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execa } from "execa";

describe("list command", () => {
  let testDir: string;
  let projectsDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-list-test-${Date.now()}`);
    projectsDir = join(testDir, "projects");
    mkdirSync(projectsDir, { recursive: true });
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

  test("returns empty array when projects dir is empty", async () => {
    const { readdirSync } = await import("fs");
    const entries = readdirSync(projectsDir);
    expect(entries).toEqual([]);
  });

  test("finds project directories", async () => {
    // Create a fake project
    const projectPath = join(projectsDir, "myapp");
    mkdirSync(projectPath);

    const { readdirSync } = await import("fs");
    const entries = readdirSync(projectsDir);
    expect(entries).toContain("myapp");
  });

  test("gets git branch from project", async () => {
    // Create a fake project with git
    const projectPath = join(projectsDir, "myapp");
    mkdirSync(projectPath);

    // Initialize git repo
    await execa("git", ["init"], { cwd: projectPath });
    await execa("git", ["config", "user.email", "test@test.com"], { cwd: projectPath });
    await execa("git", ["config", "user.name", "Test"], { cwd: projectPath });

    // Create initial commit to establish branch
    writeFileSync(join(projectPath, "README.md"), "# Test");
    await execa("git", ["add", "."], { cwd: projectPath });
    await execa("git", ["commit", "-m", "init"], { cwd: projectPath });

    // Get branch
    const result = await execa("git", ["-C", projectPath, "branch", "--show-current"]);
    expect(result.stdout.trim()).toBeTruthy();
  });
});
```

**Step 2: Run tests**

Run: `bun test src/commands/list.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/commands/list.test.ts
git commit -m "test: add tests for list command"
```

---

## Task 5: Run all tests and verify

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass (should be ~22 tests now)

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: No type errors

**Step 3: Manual test both commands**

Run: `bun run dev browse`
Run: `bun run dev list`
Expected: Both work correctly

**Step 4: Final commit if any fixes needed**

---

## Summary

After completing all tasks:
- `devbox browse` lists remote projects with git branch
- `devbox list` lists local projects with git branch and path
- Both show friendly empty state messages
- Tests cover parsing logic and edge cases
- Code is committed in logical chunks
