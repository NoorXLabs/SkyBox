// src/commands/browse.ts

import { getRemoteHost, selectRemote } from "@commands/remote.ts";
import { configExists, loadConfig } from "@lib/config.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { error, header, info, spinner } from "@lib/ui.ts";
import type { RemoteProject } from "@typedefs/index.ts";
import chalk from "chalk";

export async function getRemoteProjects(
	host: string,
	basePath: string,
	key?: string,
): Promise<RemoteProject[]> {
	const script = `for d in "${basePath}"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "-")
    echo "$name|$branch"
  done`;

	const result = await runRemoteCommand(host, script, key);

	if (!result.success || !result.stdout?.trim()) {
		return [];
	}

	return result.stdout
		.trim()
		.split("\n")
		.filter((line) => line.includes("|"))
		.map((line) => {
			const [name, branch] = line.split("|");
			return { name, branch };
		});
}

function printProjects(
	projects: RemoteProject[],
	host: string,
	basePath: string,
): void {
	header(`Remote projects (${host}:${basePath}):`);
	console.log();

	// Calculate column widths
	const nameWidth = Math.max(4, ...projects.map((p) => p.name.length));
	const branchWidth = Math.max(6, ...projects.map((p) => p.branch.length));

	// Header
	const headerRow = `  ${"NAME".padEnd(nameWidth)}  ${"BRANCH".padEnd(branchWidth)}`;
	console.log(chalk.dim(headerRow));

	// Rows
	for (const project of projects) {
		const row = `  ${project.name.padEnd(nameWidth)}  ${project.branch.padEnd(branchWidth)}`;
		console.log(row);
	}

	console.log();
	info("Run 'devbox clone <project>' to clone a project locally.");
}

function printEmpty(): void {
	console.log();
	console.log("No projects found on remote.");
	info("Run 'devbox push ./my-project' to push your first project.");
}

export async function browseCommand(): Promise<void> {
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Select which remote to browse
	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);

	const spin = spinner(`Fetching projects from ${remoteName}...`);

	try {
		const projects = await getRemoteProjects(host, remote.path, remote.key);
		spin.stop();

		if (projects.length === 0) {
			printEmpty();
		} else {
			printProjects(projects, host, remote.path);
		}
	} catch (err: unknown) {
		spin.fail("Failed to connect to remote");
		error(getErrorMessage(err) || "Check your SSH config.");
		process.exit(1);
	}
}
