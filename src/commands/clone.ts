// src/commands/clone.ts

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import {
	createSyncSession,
	getSyncStatus,
	terminateSession,
	waitForSync,
} from "../lib/mutagen.ts";
import { getProjectsDir } from "../lib/paths.ts";
import { validateProjectName } from "../lib/projectTemplates.ts";
import { checkRemoteProjectExists } from "../lib/remote.ts";
import {
	confirmDestructiveAction,
	error,
	header,
	info,
	spinner,
	success,
} from "../lib/ui.ts";
import { getRemoteHost, getRemotePath, selectRemote } from "./remote.ts";

export async function cloneCommand(project: string): Promise<void> {
	if (!project) {
		error("Usage: devbox clone <project>");
		process.exit(1);
	}

	// Validate project name to prevent path traversal and invalid characters
	const validation = validateProjectName(project);
	if (!validation.valid) {
		error(validation.error || "Invalid project name");
		process.exit(1);
	}

	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Select which remote to clone from
	const remoteName = await selectRemote(config);
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
		process.exit(1);
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
			return;
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
		// Sync session already exists - terminate and recreate for clean state
		syncSpin.text = "Removing old sync session...";
		await terminateSession(project);
	}

	// Create new sync session
	syncSpin.text = "Creating sync session...";
	const createResult = await createSyncSession(
		project,
		localPath,
		host,
		remotePath,
		config.defaults.ignore,
	);

	if (!createResult.success) {
		syncSpin.fail("Failed to create sync session");
		// Clean up the empty directory on failure
		rmSync(localPath, { recursive: true, force: true });
		error(createResult.error || "Unknown error");
		process.exit(1);
	}

	// Wait for initial sync
	syncSpin.text = "Syncing files from remote...";
	const syncResult = await waitForSync(project, (msg) => {
		syncSpin.text = msg;
	});

	if (!syncResult.success) {
		syncSpin.fail("Sync failed");
		// Clean up directory and terminate sync session on failure
		await terminateSession(project);
		rmSync(localPath, { recursive: true, force: true });
		error(syncResult.error || "Unknown error");
		process.exit(1);
	}

	syncSpin.succeed("Initial sync complete");

	// Register in config with remote reference
	config.projects[project] = { remote: remoteName };
	saveConfig(config);

	// Offer to start container
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
		// Import and run up command
		const { upCommand } = await import("./up.ts");
		await upCommand(project, {});
	} else {
		info(`Run 'devbox up ${project}' when ready to start working.`);
	}
}
