// local project path resolution and validation.
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { checkbox } from "@inquirer/prompts";
import { getErrorMessage } from "@lib/errors.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { error, header, info } from "@lib/ui.ts";
import inquirer from "inquirer";

export type SingleProjectResolution =
	| { project: string }
	| { reason: "no-projects" | "no-prompt" };

// resolve project from cwd
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

	// If relative path starts with "..", we're not in PROJECTS_DIR.
	// rel === "" means cwd is the projects root itself, not a project.
	if (rel.startsWith("..") || rel === "") {
		return null;
	}

	// Get the first directory component (the project name)
	const parts = rel.split(sep);
	return parts[0] || null;
};

// get local projects
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

// get project path
export const getProjectPath = (projectName: string): string => {
	return join(getProjectsDir(), projectName);
};

// project exists
export const projectExists = (projectName: string): boolean => {
	return existsSync(getProjectPath(projectName));
};

// resolve single project
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

// resolve one or more project names from an explicit argument, cwd, or interactive checkbox.
// returns project names as strings, or null if resolution failed.
export const resolveProjectsMulti = async (options: {
	projectArg?: string;
	noPrompt?: boolean;
	promptMessage: string;
	emptyMessage: string;
}): Promise<string[] | null> => {
	if (options.projectArg) {
		return [options.projectArg];
	}

	const cwdProject = resolveProjectFromCwd() ?? undefined;
	if (cwdProject) {
		return [cwdProject];
	}

	const projects = getLocalProjects();
	if (projects.length === 0) {
		error(options.emptyMessage);
		return null;
	}

	if (options.noPrompt) {
		error("No project specified and --no-prompt is set.");
		return null;
	}

	const selected = await checkbox({
		message: options.promptMessage,
		choices: projects.map((p) => ({ name: p, value: p })),
	});

	if (selected.length === 0) {
		error("No projects selected.");
		return null;
	}

	return selected;
};

// run an operation on a list of projects sequentially, tracking success and failure.
// returns the list of projects that succeeded and the count of failures.
export const runBatchOperation = async (options: {
	projects: string[];
	operation: (project: string) => Promise<boolean>;
	label: string;
}): Promise<{ succeeded: string[]; failed: number }> => {
	const succeeded: string[] = [];
	let failed = 0;

	for (const project of options.projects) {
		try {
			header(`\n${project}`);
			const ok = await options.operation(project);
			if (ok) {
				succeeded.push(project);
			} else {
				failed++;
			}
		} catch (err) {
			failed++;
			error(`Failed: ${getErrorMessage(err)}`);
		}
	}

	info(`\nDone: ${succeeded.length} ${options.label}, ${failed} failed.`);

	return { succeeded, failed };
};
