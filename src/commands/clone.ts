// src/commands/clone.ts

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getRemoteProjects } from "@commands/browse.ts";
import {
	getRemoteHost,
	getRemotePath,
	selectRemote,
} from "@commands/remote.ts";
import { upCommand } from "@commands/up.ts";
import { checkbox, select } from "@inquirer/prompts";
import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import {
	createSelectiveSyncSessions,
	createSyncSession,
	getSyncStatus,
	terminateSession,
	waitForSync,
} from "@lib/mutagen.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { getLocalProjects } from "@lib/project.ts";
import { validateProjectName } from "@lib/projectTemplates.ts";
import { checkRemoteProjectExists } from "@lib/remote.ts";
import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import {
	confirmDestructiveAction,
	error,
	header,
	info,
	spinner,
	success,
} from "@lib/ui.ts";
import inquirer from "inquirer";

/**
 * Clone a single project from remote. This is the core clone logic
 * used by both direct invocation and interactive multi-clone.
 */
async function cloneSingleProject(
	project: string,
	remoteName: string,
	config: ReturnType<typeof loadConfig>,
): Promise<boolean> {
	if (!config) return false;

	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);
	const remotePath = getRemotePath(remote, project);

	header(`Cloning '${project}' from ${host}:${remotePath}...`);

	// Check project exists on remote
	const checkSpin = spinner("Checking remote project...");
	const exists = await checkRemoteProjectExists(host, remote.path, project);

	if (!exists) {
		checkSpin.fail("Project not found on remote");
		error(
			`Project '${project}' not found on remote. Run 'devbox browse' to see available projects.`,
		);
		return false;
	}
	checkSpin.succeed("Project found on remote");

	// Check local doesn't exist
	const localPath = join(getProjectsDir(), project);

	if (existsSync(localPath)) {
		const confirmed = await confirmDestructiveAction({
			firstPrompt: "Project already exists locally. Overwrite?",
			secondPrompt: "Are you sure? All local changes will be lost.",
			cancelMessage: "Clone cancelled.",
		});

		if (!confirmed) {
			return false;
		}

		rmSync(localPath, { recursive: true });
	}

	// Create local directory
	mkdirSync(localPath, { recursive: true });
	success(`Created ${localPath}`);

	// Check if sync session already exists
	const syncSpin = spinner("Setting up sync...");
	const existingSync = await getSyncStatus(project);

	if (existingSync.exists) {
		syncSpin.text = "Removing old sync session...";
		await terminateSession(project);
	}

	// Create new sync session
	syncSpin.text = "Creating sync session...";
	const projectConfig = config.projects[project];
	const ignores = config.defaults.ignore;
	const createResult =
		projectConfig?.sync_paths && projectConfig.sync_paths.length > 0
			? await createSelectiveSyncSessions(
					project,
					localPath,
					host,
					remotePath,
					projectConfig.sync_paths,
					ignores,
				)
			: await createSyncSession(project, localPath, host, remotePath, ignores);

	if (!createResult.success) {
		syncSpin.fail("Failed to create sync session");
		rmSync(localPath, { recursive: true, force: true });
		error(createResult.error || "Unknown error");
		return false;
	}

	// Wait for initial sync
	syncSpin.text = "Syncing files from remote...";
	const syncResult = await waitForSync(project, (msg) => {
		syncSpin.text = msg;
	});

	if (!syncResult.success) {
		syncSpin.fail("Sync failed");
		await terminateSession(project);
		rmSync(localPath, { recursive: true, force: true });
		error(syncResult.error || "Unknown error");
		return false;
	}

	syncSpin.succeed("Initial sync complete");

	// Register in config with remote reference
	config.projects[project] = { remote: remoteName };
	saveConfig(config);

	// Check if project is encrypted on remote
	const encArchivePath = `${remotePath}/${project}.tar.enc`;
	const encCheck = await runRemoteCommand(
		host,
		`test -f ${escapeShellArg(encArchivePath)} && echo "ENCRYPTED" || echo "PLAIN"`,
	);

	if (encCheck.stdout?.includes("ENCRYPTED")) {
		info("This project is encrypted on the remote.");
		info("You'll need the passphrase when running 'devbox up' to decrypt it.");
	}

	return true;
}

export async function cloneCommand(project?: string): Promise<void> {
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// If project provided directly, use single-clone flow
	if (project) {
		const validation = validateProjectName(project);
		if (!validation.valid) {
			error(validation.error || "Invalid project name");
			process.exit(1);
		}

		const remoteName = await selectRemote(config);
		const cloned = await cloneSingleProject(project, remoteName, config);
		if (!cloned) {
			process.exit(1);
		}

		// Offer to start container (existing behavior)
		console.log();
		const { startContainer } = await inquirer.prompt([
			{
				type: "confirm",
				name: "startContainer",
				message: "Start dev container now?",
				default: true,
			},
		]);

		if (startContainer) {
			await upCommand(project, {});
		} else {
			info(`Run 'devbox up ${project}' when ready to start working.`);
		}
		return;
	}

	// Interactive flow: select remote, fetch projects, multi-select
	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);

	const fetchSpin = spinner(`Fetching projects from ${remoteName}...`);
	const remoteProjects = await getRemoteProjects(host, remote.path);
	fetchSpin.succeed("Projects fetched");

	if (remoteProjects.length === 0) {
		info("No projects found on remote.");
		info("Run 'devbox push ./my-project' to push your first project.");
		return;
	}

	// Filter out already-local projects
	const localProjects = getLocalProjects();
	const localSet = new Set(localProjects);
	const available = remoteProjects.filter((p) => !localSet.has(p.name));

	if (available.length === 0) {
		info("All remote projects are already cloned locally.");
		return;
	}

	const selected = await checkbox({
		message: "Select projects to clone:",
		choices: available.map((p) => ({
			name: `${p.name} (${p.branch})`,
			value: p.name,
		})),
	});

	if (selected.length === 0) {
		info("No projects selected.");
		return;
	}

	// Clone each project sequentially
	const cloned: string[] = [];
	for (const name of selected) {
		const ok = await cloneSingleProject(name, remoteName, config);
		if (ok) {
			cloned.push(name);
		}
	}

	if (cloned.length === 0) {
		error("No projects were cloned successfully.");
		return;
	}

	// Summary
	console.log();
	success(`Cloned ${cloned.length} projects: ${cloned.join(", ")}`);

	if (cloned.length === 1) {
		// Single clone — offer to start container (same as direct invocation)
		const { startContainer } = await inquirer.prompt([
			{
				type: "confirm",
				name: "startContainer",
				message: "Start dev container now?",
				default: true,
			},
		]);

		if (startContainer) {
			await upCommand(cloned[0], {});
		} else {
			info(`Run 'devbox up ${cloned[0]}' when ready to start working.`);
		}
		return;
	}

	// Multi-clone: ask which to start
	const startProject = await select({
		message: "Which project would you like to start working on?",
		choices: [
			...cloned.map((name) => ({ name, value: name })),
			{ name: "None", value: "__none__" },
		],
	});

	if (startProject !== "__none__") {
		await upCommand(startProject, {});
		const remaining = cloned.filter((n) => n !== startProject);
		if (remaining.length > 0) {
			console.log();
			info("Run 'devbox up <name>' to start your other cloned projects:");
			for (const name of remaining) {
				console.log(`  - ${name}`);
			}
		}
	} else {
		console.log();
		info("Run 'devbox up <name>' to start your cloned projects:");
		for (const name of cloned) {
			console.log(`  - ${name}`);
		}
	}
}
