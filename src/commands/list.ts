// src/commands/list.ts

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { configExists } from "@lib/config.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { error, header, info } from "@lib/ui.ts";
import type { LocalProject } from "@typedefs/index.ts";
import { execa } from "execa";

async function getGitBranch(projectPath: string): Promise<string> {
	try {
		const result = await execa("git", [
			"-C",
			projectPath,
			"branch",
			"--show-current",
		]);
		return result.stdout.trim() || "-";
	} catch (err) {
		if (process.env.DEBUG) {
			console.error("[debug] getGitBranch:", err);
		}
		return "-";
	}
}

async function getLocalProjects(): Promise<LocalProject[]> {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) {
		return [];
	}

	const entries = readdirSync(projectsDir);
	const projects: LocalProject[] = [];

	for (const entry of entries) {
		const fullPath = join(projectsDir, entry);
		try {
			if (statSync(fullPath).isDirectory()) {
				const branch = await getGitBranch(fullPath);
				projects.push({
					name: entry,
					branch,
					path: fullPath,
				});
			}
		} catch (err) {
			if (process.env.DEBUG) {
				console.error(`[debug] getLocalProjects entry "${entry}":`, err);
			}
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
