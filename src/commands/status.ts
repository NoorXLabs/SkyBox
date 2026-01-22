// src/commands/status.ts
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { execa } from "execa";
import { configExists } from "../lib/config";
import { PROJECTS_DIR } from "../lib/paths";
import { error, header } from "../lib/ui";
import type { ProjectSummary, DetailedStatus, GitDetails } from "../types";

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
