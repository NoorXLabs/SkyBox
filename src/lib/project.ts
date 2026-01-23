// src/lib/project.ts
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";

// Dynamic function to get fresh PROJECTS_DIR on each call
function getProjectsDir(): string {
	const home = process.env.DEVBOX_HOME || join(homedir(), ".devbox");
	return join(home, "projects");
}

export function resolveProjectFromCwd(): string | null {
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
}

export function getLocalProjects(): string[] {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) {
		return [];
	}

	return readdirSync(projectsDir).filter((entry) => {
		const fullPath = join(projectsDir, entry);
		return statSync(fullPath).isDirectory();
	});
}

export function getProjectPath(projectName: string): string {
	return join(getProjectsDir(), projectName);
}

export function projectExists(projectName: string): boolean {
	return existsSync(getProjectPath(projectName));
}
