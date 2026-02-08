// src/commands/list.ts

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { configExists } from "@lib/config.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { getGitBranch } from "@lib/git.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { error, header, info } from "@lib/ui.ts";
import type { LocalProject } from "@typedefs/index.ts";

// scan the projects directory and return local project names with git branch info
const getLocalProjects = async (): Promise<LocalProject[]> => {
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
				console.error(
					`[debug] getLocalProjects entry "${entry}":`,
					getErrorMessage(err),
				);
			}
		}
	}

	return projects;
};

// display a formatted list of local projects with branch and path info
const printProjects = (projects: LocalProject[]): void => {
	header("Local projects:");
	console.log();

	for (const project of projects) {
		console.log(`  ${project.name}`);
		console.log(`    Branch: ${project.branch}`);
		console.log(`    Path: ${project.path}`);
		console.log();
	}

	info("Run 'skybox up <project>' to start working.");
};

// display a message when no local projects are found
const printEmpty = (): void => {
	console.log();
	console.log("No local projects yet.");
	info("Run 'skybox clone <project>' or 'skybox push ./path' to get started.");
};

// list all locally cloned projects with branch information
export const listCommand = async (): Promise<void> => {
	if (!configExists()) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

	const projects = await getLocalProjects();

	if (projects.length === 0) {
		printEmpty();
	} else {
		printProjects(projects);
	}
};
