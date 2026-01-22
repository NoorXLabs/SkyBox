# Status Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `devbox status [project]` command with overview and detailed modes for comprehensive project visibility.

**Architecture:** Single command file (`src/commands/status.ts`) that uses existing lib functions for container/sync status, adds new helpers for git info, disk usage, and last activity. Overview mode runs checks in parallel for speed.

**Tech Stack:** TypeScript, execa for shell commands, chalk for colors, existing container.ts and mutagen.ts libs.

---

## Task 1: Add Status Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Write the types**

Add to end of `src/types/index.ts`:

```typescript
// Status command types
export interface ProjectSummary {
  name: string;
  container: "running" | "stopped" | "unknown";
  sync: "syncing" | "paused" | "no session" | "error" | "unknown";
  branch: string;
  lock: string;
  lastActive: Date | null;
  size: string;
  path: string;
}

export interface ContainerDetails {
  status: "running" | "stopped" | "unknown";
  image: string;
  uptime: string;
  cpu: string;
  memory: string;
}

export interface SyncDetails {
  status: "syncing" | "paused" | "no session" | "error" | "unknown";
  session: string;
  pending: string;
  lastSync: string;
}

export interface GitDetails {
  branch: string;
  status: "clean" | "dirty";
  ahead: number;
  behind: number;
}

export interface DiskDetails {
  local: string;
  remote: string;
}

export interface DetailedStatus {
  name: string;
  path: string;
  container: ContainerDetails;
  sync: SyncDetails;
  git: GitDetails | null;
  lock: string;
  disk: DiskDetails;
}
```

**Step 2: Verify types compile**

Run: `bun run tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(status): add types for status command"
```

---

## Task 2: Create Status Command Skeleton with CLI Registration

**Files:**
- Create: `src/commands/status.ts`
- Modify: `src/index.ts`

**Step 1: Write the command skeleton**

Create `src/commands/status.ts`:

```typescript
// src/commands/status.ts
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { configExists } from "../lib/config";
import { PROJECTS_DIR } from "../lib/paths";
import { error, header } from "../lib/ui";
import type { ProjectSummary, DetailedStatus } from "../types";

export async function statusCommand(project?: string): Promise<void> {
  if (!configExists()) {
    error("devbox not configured. Run 'devbox init' first.");
    process.exit(1);
  }

  if (project) {
    await showDetailed(project);
  } else {
    await showOverview();
  }
}

async function showOverview(): Promise<void> {
  if (!existsSync(PROJECTS_DIR)) {
    console.log();
    console.log("No projects found. Use 'devbox clone' or 'devbox push' to get started.");
    return;
  }

  const entries = readdirSync(PROJECTS_DIR);
  const projectDirs = entries.filter((entry) => {
    const fullPath = join(PROJECTS_DIR, entry);
    return statSync(fullPath).isDirectory();
  });

  if (projectDirs.length === 0) {
    console.log();
    console.log("No projects found. Use 'devbox clone' or 'devbox push' to get started.");
    return;
  }

  // TODO: Implement overview table
  header("Projects:");
  console.log("  (overview not yet implemented)");
}

async function showDetailed(projectName: string): Promise<void> {
  const projectPath = join(PROJECTS_DIR, projectName);

  if (!existsSync(projectPath)) {
    error(`Project '${projectName}' not found. Run 'devbox list' to see available projects.`);
    process.exit(1);
  }

  // TODO: Implement detailed view
  header(`Project: ${projectName}`);
  console.log("  (detailed view not yet implemented)");
}
```

**Step 2: Register the command in CLI**

Add to `src/index.ts` after the editor command import:

```typescript
import { statusCommand } from "./commands/status";
```

Add before `program.parse()`:

```typescript
program
  .command("status [project]")
  .description("Show project status")
  .action(statusCommand);
```

**Step 3: Verify command works**

Run: `bun run src/index.ts status`
Expected: Shows "Projects:" header and placeholder message (or "No projects found" if no projects dir)

**Step 4: Commit**

```bash
git add src/commands/status.ts src/index.ts
git commit -m "feat(status): add status command skeleton with CLI registration"
```

---

## Task 3: Implement Git Info Helper

**Files:**
- Create: `src/commands/status.test.ts`
- Modify: `src/commands/status.ts`

**Step 1: Write the failing test**

Create `src/commands/status.test.ts`:

```typescript
// src/commands/status.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execa } from "execa";

describe("status command helpers", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-status-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("getGitInfo", () => {
    test("returns null for non-git directory", async () => {
      const { getGitInfo } = await import("./status");
      const result = await getGitInfo(testDir);
      expect(result).toBeNull();
    });

    test("returns branch and clean status for git repo", async () => {
      // Initialize git repo
      await execa("git", ["init"], { cwd: testDir });
      await execa("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
      await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
      writeFileSync(join(testDir, "README.md"), "# Test");
      await execa("git", ["add", "."], { cwd: testDir });
      await execa("git", ["commit", "-m", "init"], { cwd: testDir });

      const { getGitInfo } = await import("./status");
      const result = await getGitInfo(testDir);

      expect(result).not.toBeNull();
      expect(result!.branch).toBeTruthy();
      expect(result!.status).toBe("clean");
      expect(result!.ahead).toBe(0);
      expect(result!.behind).toBe(0);
    });

    test("returns dirty status for uncommitted changes", async () => {
      // Initialize git repo
      await execa("git", ["init"], { cwd: testDir });
      await execa("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
      await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
      writeFileSync(join(testDir, "README.md"), "# Test");
      await execa("git", ["add", "."], { cwd: testDir });
      await execa("git", ["commit", "-m", "init"], { cwd: testDir });

      // Make uncommitted change
      writeFileSync(join(testDir, "new.txt"), "new file");

      const { getGitInfo } = await import("./status");
      const result = await getGitInfo(testDir);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("dirty");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/status.test.ts`
Expected: FAIL - getGitInfo is not exported

**Step 3: Write the implementation**

Add to `src/commands/status.ts` after imports:

```typescript
import { execa } from "execa";
import type { ProjectSummary, DetailedStatus, GitDetails } from "../types";
```

Add function before `statusCommand`:

```typescript
export async function getGitInfo(projectPath: string): Promise<GitDetails | null> {
  try {
    // Check if it's a git repo
    await execa("git", ["-C", projectPath, "rev-parse", "--git-dir"]);
  } catch {
    return null;
  }

  try {
    // Get current branch
    const branchResult = await execa("git", ["-C", projectPath, "rev-parse", "--abbrev-ref", "HEAD"]);
    const branch = branchResult.stdout.trim() || "HEAD";

    // Get dirty/clean status
    const statusResult = await execa("git", ["-C", projectPath, "status", "--porcelain"]);
    const status = statusResult.stdout.trim() ? "dirty" : "clean";

    // Get ahead/behind (may fail if no upstream)
    let ahead = 0;
    let behind = 0;
    try {
      const countResult = await execa("git", [
        "-C", projectPath,
        "rev-list", "--left-right", "--count", "@{upstream}...HEAD"
      ]);
      const [behindStr, aheadStr] = countResult.stdout.trim().split(/\s+/);
      behind = parseInt(behindStr, 10) || 0;
      ahead = parseInt(aheadStr, 10) || 0;
    } catch {
      // No upstream configured, that's fine
    }

    return { branch, status: status as "clean" | "dirty", ahead, behind };
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/status.ts src/commands/status.test.ts
git commit -m "feat(status): implement getGitInfo helper with tests"
```

---

## Task 4: Implement Disk Usage Helper

**Files:**
- Modify: `src/commands/status.test.ts`
- Modify: `src/commands/status.ts`

**Step 1: Write the failing test**

Add to `src/commands/status.test.ts`:

```typescript
describe("getDiskUsage", () => {
  test("returns size string for directory", async () => {
    // Create some files
    writeFileSync(join(testDir, "file1.txt"), "hello world");
    writeFileSync(join(testDir, "file2.txt"), "more content");

    const { getDiskUsage } = await import("./status");
    const result = await getDiskUsage(testDir);

    // Should return something like "4.0K" or "8.0K" depending on filesystem
    expect(result).toMatch(/^\d+(\.\d+)?[KMGT]?$/i);
  });

  test("returns 'unknown' on error", async () => {
    const { getDiskUsage } = await import("./status");
    const result = await getDiskUsage("/nonexistent/path/that/does/not/exist");
    expect(result).toBe("unknown");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/status.test.ts`
Expected: FAIL - getDiskUsage is not exported

**Step 3: Write the implementation**

Add to `src/commands/status.ts`:

```typescript
export async function getDiskUsage(path: string): Promise<string> {
  try {
    const result = await execa("du", ["-sh", path], { timeout: 5000 });
    // Output is like "1.2G\t/path/to/dir"
    const size = result.stdout.trim().split(/\s+/)[0];
    return size || "unknown";
  } catch {
    return "unknown";
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/status.ts src/commands/status.test.ts
git commit -m "feat(status): implement getDiskUsage helper with tests"
```

---

## Task 5: Implement Last Active Helper

**Files:**
- Modify: `src/commands/status.test.ts`
- Modify: `src/commands/status.ts`

**Step 1: Write the failing test**

Add to `src/commands/status.test.ts`:

```typescript
describe("getLastActive", () => {
  test("returns date from git log if available", async () => {
    // Initialize git repo with a commit
    await execa("git", ["init"], { cwd: testDir });
    await execa("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
    await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
    writeFileSync(join(testDir, "README.md"), "# Test");
    await execa("git", ["add", "."], { cwd: testDir });
    await execa("git", ["commit", "-m", "init"], { cwd: testDir });

    const { getLastActive } = await import("./status");
    const result = await getLastActive(testDir);

    expect(result).toBeInstanceOf(Date);
    // Should be recent (within last minute)
    expect(Date.now() - result!.getTime()).toBeLessThan(60000);
  });

  test("returns directory mtime for non-git directory", async () => {
    writeFileSync(join(testDir, "file.txt"), "content");

    const { getLastActive } = await import("./status");
    const result = await getLastActive(testDir);

    expect(result).toBeInstanceOf(Date);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/status.test.ts`
Expected: FAIL - getLastActive is not exported

**Step 3: Write the implementation**

Add to `src/commands/status.ts`:

```typescript
export async function getLastActive(projectPath: string): Promise<Date | null> {
  // Try git log first
  try {
    const result = await execa("git", ["-C", projectPath, "log", "-1", "--format=%ct"]);
    const timestamp = parseInt(result.stdout.trim(), 10);
    if (!isNaN(timestamp)) {
      return new Date(timestamp * 1000);
    }
  } catch {
    // Not a git repo or no commits
  }

  // Fall back to directory mtime
  try {
    const stats = statSync(projectPath);
    return stats.mtime;
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/status.ts src/commands/status.test.ts
git commit -m "feat(status): implement getLastActive helper with tests"
```

---

## Task 6: Implement Overview Table Formatting

**Files:**
- Modify: `src/commands/status.ts`

**Step 1: Add formatRelativeTime helper**

Add to `src/commands/status.ts`:

```typescript
function formatRelativeTime(date: Date | null): string {
  if (!date) return "-";

  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}
```

**Step 2: Add color helpers**

Add to `src/commands/status.ts`:

```typescript
function colorContainer(status: string): string {
  switch (status) {
    case "running": return chalk.green(status);
    case "stopped": return chalk.dim(status);
    default: return chalk.dim(status);
  }
}

function colorSync(status: string): string {
  switch (status) {
    case "syncing": return chalk.green(status);
    case "paused": return chalk.yellow(status);
    case "error": return chalk.red(status);
    default: return chalk.dim(status);
  }
}
```

**Step 3: Add getProjectSummary function**

Add to `src/commands/status.ts`:

```typescript
import { getContainerStatus, ContainerStatus } from "../lib/container";
import { getSyncStatus } from "../lib/mutagen";

async function getProjectSummary(projectName: string): Promise<ProjectSummary> {
  const projectPath = join(PROJECTS_DIR, projectName);

  // Run checks in parallel
  const [containerStatus, syncStatus, gitInfo, diskUsage, lastActive] = await Promise.all([
    getContainerStatus(projectPath),
    getSyncStatus(projectName),
    getGitInfo(projectPath),
    getDiskUsage(projectPath),
    getLastActive(projectPath),
  ]);

  // Map container status
  let container: ProjectSummary["container"] = "unknown";
  if (containerStatus === ContainerStatus.Running) container = "running";
  else if (containerStatus === ContainerStatus.Stopped || containerStatus === ContainerStatus.NotFound) container = "stopped";

  // Map sync status
  let sync: ProjectSummary["sync"] = "unknown";
  if (!syncStatus.exists) sync = "no session";
  else if (syncStatus.status === "paused") sync = "paused";
  else if (syncStatus.status === "syncing") sync = "syncing";
  else if (syncStatus.status === "error") sync = "error";

  return {
    name: projectName,
    container,
    sync,
    branch: gitInfo?.branch || "-",
    lock: "n/a",
    lastActive,
    size: diskUsage,
    path: projectPath,
  };
}
```

**Step 4: Add formatOverviewTable function and update showOverview**

Add to `src/commands/status.ts`:

```typescript
function formatOverviewTable(summaries: ProjectSummary[]): void {
  // Column headers
  const headers = ["NAME", "CONTAINER", "SYNC", "BRANCH", "LOCK", "LAST ACTIVE", "SIZE"];

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const values = summaries.map((s) => {
      switch (i) {
        case 0: return s.name;
        case 1: return s.container;
        case 2: return s.sync;
        case 3: return s.branch;
        case 4: return s.lock;
        case 5: return formatRelativeTime(s.lastActive);
        case 6: return s.size;
        default: return "";
      }
    });
    return Math.max(h.length, ...values.map((v) => v.length));
  });

  // Print header
  const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  console.log(chalk.dim(`  ${headerRow}`));

  // Print rows
  for (const s of summaries) {
    const row = [
      s.name.padEnd(widths[0]),
      colorContainer(s.container).padEnd(widths[1] + (s.container === "running" ? 10 : 0)), // Account for color codes
      colorSync(s.sync).padEnd(widths[2] + (s.sync === "syncing" ? 10 : s.sync === "paused" ? 9 : 0)),
      s.branch.padEnd(widths[3]),
      chalk.dim(s.lock).padEnd(widths[4]),
      formatRelativeTime(s.lastActive).padEnd(widths[5]),
      s.size.padEnd(widths[6]),
    ].join("  ");
    console.log(`  ${row}`);
  }
}
```

Update `showOverview` function:

```typescript
async function showOverview(): Promise<void> {
  if (!existsSync(PROJECTS_DIR)) {
    console.log();
    console.log("No projects found. Use 'devbox clone' or 'devbox push' to get started.");
    return;
  }

  const entries = readdirSync(PROJECTS_DIR);
  const projectDirs = entries.filter((entry) => {
    const fullPath = join(PROJECTS_DIR, entry);
    return statSync(fullPath).isDirectory();
  });

  if (projectDirs.length === 0) {
    console.log();
    console.log("No projects found. Use 'devbox clone' or 'devbox push' to get started.");
    return;
  }

  // Gather summaries in parallel
  const summaries = await Promise.all(projectDirs.map(getProjectSummary));

  header("Projects:");
  console.log();
  formatOverviewTable(summaries);
  console.log();
}
```

**Step 5: Verify it compiles and runs**

Run: `bun run tsc --noEmit && bun run src/index.ts status`
Expected: Shows formatted table (or "No projects found")

**Step 6: Commit**

```bash
git add src/commands/status.ts
git commit -m "feat(status): implement overview table with colored output"
```

---

## Task 7: Implement Detailed View

**Files:**
- Modify: `src/commands/status.ts`

**Step 1: Add getContainerDetails function**

Add to `src/commands/status.ts`:

```typescript
import { getContainerStatus, getContainerInfo, ContainerStatus } from "../lib/container";

async function getContainerDetails(projectPath: string): Promise<ContainerDetails> {
  const status = await getContainerStatus(projectPath);
  const info = await getContainerInfo(projectPath);

  if (status !== ContainerStatus.Running || !info) {
    return {
      status: status === ContainerStatus.Running ? "running" : "stopped",
      image: info?.image || "-",
      uptime: "-",
      cpu: "-",
      memory: "-",
    };
  }

  // Get stats for running container
  try {
    const statsResult = await execa("docker", [
      "stats", "--no-stream", "--format",
      "{{.CPUPerc}}\t{{.MemUsage}}",
      info.id,
    ], { timeout: 5000 });

    const [cpu, memory] = statsResult.stdout.trim().split("\t");

    // Parse uptime from status string (e.g., "Up 2 hours")
    const uptimeMatch = info.status.match(/Up\s+(.+)/i);
    const uptime = uptimeMatch ? uptimeMatch[1] : "-";

    return {
      status: "running",
      image: info.image,
      uptime,
      cpu: cpu || "-",
      memory: memory || "-",
    };
  } catch {
    return {
      status: "running",
      image: info.image,
      uptime: "-",
      cpu: "-",
      memory: "-",
    };
  }
}
```

**Step 2: Add getSyncDetails function**

Add to `src/commands/status.ts`:

```typescript
import { getSyncStatus, sessionName } from "../lib/mutagen";

async function getSyncDetails(projectName: string): Promise<SyncDetails> {
  const status = await getSyncStatus(projectName);

  if (!status.exists) {
    return {
      status: "no session",
      session: "-",
      pending: "-",
      lastSync: "-",
    };
  }

  return {
    status: status.paused ? "paused" : "syncing",
    session: sessionName(projectName),
    pending: "0 files", // Would need more mutagen parsing for real count
    lastSync: "-", // Would need more mutagen parsing
  };
}
```

**Step 3: Add getRemoteDiskUsage function**

Add to `src/commands/status.ts`:

```typescript
import { loadConfig } from "../lib/config";

async function getRemoteDiskUsage(projectName: string): Promise<string> {
  try {
    const config = loadConfig();
    const remotePath = `${config.remote.base_path}/${projectName}`;
    const result = await execa("ssh", [
      config.remote.host,
      `du -sh ${remotePath} 2>/dev/null | cut -f1`,
    ], { timeout: 10000 });
    return result.stdout.trim() || "unknown";
  } catch {
    return "unavailable";
  }
}
```

**Step 4: Update showDetailed function**

Replace the `showDetailed` function:

```typescript
import type { ProjectSummary, DetailedStatus, GitDetails, ContainerDetails, SyncDetails, DiskDetails } from "../types";

async function showDetailed(projectName: string): Promise<void> {
  const projectPath = join(PROJECTS_DIR, projectName);

  if (!existsSync(projectPath)) {
    error(`Project '${projectName}' not found. Run 'devbox list' to see available projects.`);
    process.exit(1);
  }

  // Gather all details
  const [container, sync, git, localDisk, remoteDisk] = await Promise.all([
    getContainerDetails(projectPath),
    getSyncDetails(projectName),
    getGitInfo(projectPath),
    getDiskUsage(projectPath),
    getRemoteDiskUsage(projectName),
  ]);

  // Print header
  console.log();
  console.log(chalk.bold(`Project: ${projectName}`));
  console.log(chalk.dim("━".repeat(50)));

  // Container section
  console.log();
  console.log(chalk.bold("Container"));
  console.log(`  Status:     ${colorContainer(container.status)}`);
  console.log(`  Image:      ${container.image}`);
  console.log(`  Uptime:     ${container.uptime}`);
  console.log(`  CPU:        ${container.cpu}`);
  console.log(`  Memory:     ${container.memory}`);

  // Sync section
  console.log();
  console.log(chalk.bold("Sync"));
  console.log(`  Status:     ${colorSync(sync.status)}`);
  console.log(`  Session:    ${sync.session}`);
  console.log(`  Pending:    ${sync.pending}`);
  console.log(`  Last sync:  ${sync.lastSync}`);

  // Git section
  console.log();
  console.log(chalk.bold("Git"));
  if (git) {
    const statusColor = git.status === "clean" ? chalk.green : chalk.yellow;
    console.log(`  Branch:     ${git.branch}`);
    console.log(`  Status:     ${statusColor(git.status)}`);
    console.log(`  Ahead:      ${git.ahead} commits`);
    console.log(`  Behind:     ${git.behind} commits`);
  } else {
    console.log(chalk.dim("  Not a git repository"));
  }

  // Lock section
  console.log();
  console.log(chalk.bold("Lock"));
  console.log(`  Status:     ${chalk.dim("n/a (not implemented)")}`);

  // Disk section
  console.log();
  console.log(chalk.bold("Disk Usage"));
  console.log(`  Local:      ${localDisk}`);
  console.log(`  Remote:     ${remoteDisk}`);
  console.log();
}
```

**Step 5: Verify it compiles and runs**

Run: `bun run tsc --noEmit && bun run src/index.ts status testproject`
Expected: Shows detailed view (or "Project not found" error)

**Step 6: Commit**

```bash
git add src/commands/status.ts
git commit -m "feat(status): implement detailed view with all sections"
```

---

## Task 8: Fix Import Organization and Final Cleanup

**Files:**
- Modify: `src/commands/status.ts`

**Step 1: Reorganize imports at top of file**

Ensure `src/commands/status.ts` has clean imports at top:

```typescript
// src/commands/status.ts
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { execa } from "execa";
import { configExists, loadConfig } from "../lib/config";
import { getContainerStatus, getContainerInfo, ContainerStatus } from "../lib/container";
import { getSyncStatus, sessionName } from "../lib/mutagen";
import { PROJECTS_DIR } from "../lib/paths";
import { error, header } from "../lib/ui";
import type {
  ProjectSummary,
  DetailedStatus,
  GitDetails,
  ContainerDetails,
  SyncDetails,
  DiskDetails,
} from "../types";
```

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Run type check**

Run: `bun run tsc --noEmit`
Expected: No errors

**Step 4: Final commit**

```bash
git add src/commands/status.ts
git commit -m "refactor(status): clean up imports and organization"
```

---

## Task 9: Add Integration Test

**Files:**
- Modify: `src/commands/status.test.ts`

**Step 1: Add integration test for statusCommand**

Add to end of `src/commands/status.test.ts`:

```typescript
describe("statusCommand", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = join(testDir, ".devbox");
    const projectsDir = join(configDir, "Projects");
    mkdirSync(projectsDir, { recursive: true });
    process.env.DEVBOX_HOME = configDir;

    // Create minimal config
    const configPath = join(configDir, "config.yaml");
    writeFileSync(configPath, `
remote:
  host: testhost
  base_path: ~/code
editor: code
defaults:
  sync_mode: two-way-resolved
  ignore: []
projects: {}
`);
  });

  test("shows empty message when no projects", async () => {
    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    const { statusCommand } = await import("./status");
    await statusCommand();

    console.log = originalLog;

    expect(logs.some((l) => l.includes("No projects found"))).toBe(true);
  });

  test("shows project in overview when project exists", async () => {
    // Create a project directory
    const projectsDir = join(configDir, "Projects");
    const projectPath = join(projectsDir, "myapp");
    mkdirSync(projectPath);

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    const { statusCommand } = await import("./status");
    await statusCommand();

    console.log = originalLog;

    expect(logs.some((l) => l.includes("myapp"))).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `bun test src/commands/status.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/commands/status.test.ts
git commit -m "test(status): add integration tests for statusCommand"
```

---

## Summary

After completing all tasks, you will have:

1. **Types** in `src/types/index.ts` for status data structures
2. **Status command** in `src/commands/status.ts` with:
   - Overview mode showing table of all projects
   - Detailed mode showing single project deep dive
   - Color-coded container and sync statuses
   - Git info (branch, clean/dirty, ahead/behind)
   - Disk usage (local and remote)
   - Lock placeholder for future implementation
3. **Tests** in `src/commands/status.test.ts` for helpers and integration
4. **CLI registration** in `src/index.ts`

Run `bun run src/index.ts status` to see the overview, or `bun run src/index.ts status <project>` for detailed view.
