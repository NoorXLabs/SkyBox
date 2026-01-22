// src/commands/status.ts
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { execa } from "execa";
import { configExists } from "../lib/config";
import { getContainerStatus, ContainerStatus } from "../lib/container";
import { getSyncStatus } from "../lib/mutagen";
import { PROJECTS_DIR } from "../lib/paths";
import { error, header } from "../lib/ui";
import type { ProjectSummary, DetailedStatus, GitDetails } from "../types";

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

  // Gather summaries in parallel
  const summaries = await Promise.all(projectDirs.map(getProjectSummary));

  header("Projects:");
  console.log();
  formatOverviewTable(summaries);
  console.log();
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
