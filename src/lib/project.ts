/** Local project path resolution and validation. */
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { getProjectsDir } from "@lib/paths.ts";
import inquirer from "inquirer";

export type SingleProjectResolution =
	| { project: string }
	| { reason: "no-projects" | "no-prompt" };

export const resolveProjectFromCwd = (): string | null => {
	const cwd = process.cwd();
	const projectsDir = getProjectsDir();

	// Resolve real paths to handle symlinks (e.g., /var -> /private/var on macOS)
	let realCwd: string;
	let realProjectsDir: string;
	try {
		realCwd = realpathSync(cwd);
		realProjectsDir = realpathSync(projectsDir);
	} catch {
		// If either path doesn't exist, we're not in a project
		return null;
	}

	const rel = relative(realProjectsDir, realCwd);

	// If relative path starts with "..", we're not in PROJECTS_DIR
	if (rel.startsWith("..") || rel === cwd) {
		return null;
	}

	// Get the first directory component (the project name)
	const parts = rel.split(sep);
	return parts[0] || null;
};

export const getLocalProjects = (): string[] => {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) {
		return [];
	}

	return readdirSync(projectsDir).filter((entry) => {
		const fullPath = join(projectsDir, entry);
		return statSync(fullPath).isDirectory();
	});
};

export const getProjectPath = (projectName: string): string => {
	return join(getProjectsDir(), projectName);
};

export const projectExists = (projectName: string): boolean => {
	return existsSync(getProjectPath(projectName));
};

export const resolveSingleProject = async (options: {
	projectArg?: string;
	noPrompt?: boolean;
	promptMessage: string;
}): Promise<SingleProjectResolution> => {
	let project = options.projectArg;

	if (!project) {
		project = resolveProjectFromCwd() ?? undefined;
	}

	if (project) {
		return { project };
	}

	const projects = getLocalProjects();
	if (projects.length === 0) {
		return { reason: "no-projects" };
	}

	if (options.noPrompt) {
		return { reason: "no-prompt" };
	}

	const { selectedProject } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "selectedProject",
			message: options.promptMessage,
			choices: projects,
		},
	]);

	return { project: selectedProject };
};
