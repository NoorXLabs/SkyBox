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
