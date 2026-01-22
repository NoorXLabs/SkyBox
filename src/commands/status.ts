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
