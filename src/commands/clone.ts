// src/commands/clone.ts
import inquirer from "inquirer";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { loadConfig, configExists, saveConfig } from "../lib/config";
import { runRemoteCommand } from "../lib/ssh";
import { createSyncSession, waitForSync, getSyncStatus, resumeSync, terminateSession } from "../lib/mutagen";
import { PROJECTS_DIR } from "../lib/paths";
import { success, error, info, header, spinner } from "../lib/ui";

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

	header(
		`Cloning '${project}' from ${config.remote.host}:${config.remote.base_path}/${project}...`,
	);

	// Check project exists on remote
	const checkSpin = spinner("Checking remote project...");
	const exists = await checkRemoteProjectExists(
		config.remote.host,
		config.remote.base_path,
		project,
	);

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
	const remotePath = `${config.remote.base_path}/${project}`;
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
		config.remote.host,
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

	// Register in config
	config.projects[project] = {};
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
		const { upCommand } = await import("./up");
		await upCommand(project, {});
	} else {
		info(`Run 'devbox up ${project}' when ready to start working.`);
	}
}
