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
import { PROJECTS_DIR } from "../lib/paths.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";
import { getRemoteHost, getRemotePath, selectRemote } from "./remote.ts";

async function checkRemoteProjectExists(
	host: string,
	basePath: string,
	project: string,
): Promise<boolean> {
	const result = await runRemoteCommand(
		host,
		`test -d ${basePath}/${project} && echo "EXISTS" || echo "NOT_FOUND"`,
	);
	return result.stdout?.includes("EXISTS") ?? false;
}

export async function cloneCommand(project: string): Promise<void> {
	if (!project) {
		error("Usage: devbox clone <project>");
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
	const localPath = join(PROJECTS_DIR, project);

	if (existsSync(localPath)) {
		const { overwrite } = await inquirer.prompt([
			{
				type: "confirm",
				name: "overwrite",
				message: "Project already exists locally. Overwrite?",
				default: false,
			},
		]);

		if (!overwrite) {
			info("Clone cancelled.");
			return;
		}

		const { confirmOverwrite } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirmOverwrite",
				message: "Are you sure? All local changes will be lost.",
				default: false,
			},
		]);

		if (!confirmOverwrite) {
			info("Clone cancelled.");
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
