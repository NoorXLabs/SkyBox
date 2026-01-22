// src/commands/push.ts
import inquirer from "inquirer";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import { join, resolve, basename } from "path";
import { execa } from "execa";
import { loadConfig, configExists, saveConfig } from "../lib/config";
import { runRemoteCommand } from "../lib/ssh";
import { createSyncSession, waitForSync } from "../lib/mutagen";
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

async function isGitRepo(path: string): Promise<boolean> {
	return existsSync(join(path, ".git"));
}

async function initGit(path: string): Promise<void> {
	await execa("git", ["init"], { cwd: path });
	await execa("git", ["add", "."], { cwd: path });
	await execa("git", ["commit", "-m", "Initial commit"], { cwd: path });
}

export async function pushCommand(
	sourcePath: string,
	name?: string,
): Promise<void> {
	if (!sourcePath) {
		error("Usage: devbox push <path> [name]");
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

	// Resolve path
	const absolutePath = resolve(sourcePath);
	if (!existsSync(absolutePath)) {
		error(`Path '${sourcePath}' not found.`);
		process.exit(1);
	}

	// Determine project name
	const projectName = name || basename(absolutePath);

	header(
		`Pushing '${projectName}' to ${config.remote.host}:${config.remote.base_path}/${projectName}...`,
	);

	// Check if git repo
	if (!(await isGitRepo(absolutePath))) {
		const { initGitRepo } = await inquirer.prompt([
			{
				type: "confirm",
				name: "initGitRepo",
				message: "This project isn't a git repo. Initialize git?",
				default: true,
			},
		]);

		if (initGitRepo) {
			const gitSpin = spinner("Initializing git...");
			try {
				await initGit(absolutePath);
				gitSpin.succeed("Git initialized");
			} catch (err: any) {
				gitSpin.fail("Failed to initialize git");
				error(err.message);
				process.exit(1);
			}
		}
	}

	// Check remote doesn't exist
	const checkSpin = spinner("Checking remote...");
	const remoteExists = await checkRemoteProjectExists(
		config.remote.host,
		config.remote.base_path,
		projectName,
	);

	if (remoteExists) {
		checkSpin.warn("Project already exists on remote");

		const { overwrite } = await inquirer.prompt([
			{
				type: "confirm",
				name: "overwrite",
				message: "Project already exists on remote. Overwrite?",
				default: false,
			},
		]);

		if (!overwrite) {
			info("Push cancelled.");
			return;
		}

		const { confirmOverwrite } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirmOverwrite",
				message: "Are you sure? All remote changes will be lost.",
				default: false,
			},
		]);

		if (!confirmOverwrite) {
			info("Push cancelled.");
			return;
		}

		// Remove remote directory
		await runRemoteCommand(
			config.remote.host,
			`rm -rf ${config.remote.base_path}/${projectName}`,
		);
	} else {
		checkSpin.succeed("Remote path available");
	}

	// Create remote directory
	const mkdirSpin = spinner("Creating remote directory...");
	const mkdirResult = await runRemoteCommand(
		config.remote.host,
		`mkdir -p ${config.remote.base_path}/${projectName}`,
	);

	if (!mkdirResult.success) {
		mkdirSpin.fail("Failed to create remote directory");
		error(mkdirResult.error || "Unknown error");
		process.exit(1);
	}
	mkdirSpin.succeed("Created remote directory");

	// Copy to devbox projects directory
	const localPath = join(PROJECTS_DIR, projectName);

	if (absolutePath !== localPath) {
		if (existsSync(localPath)) {
			rmSync(localPath, { recursive: true });
		}
		mkdirSync(PROJECTS_DIR, { recursive: true });
		cpSync(absolutePath, localPath, { recursive: true });
		success(`Copied to ${localPath}`);
	}

	// Create sync session
	const syncSpin = spinner("Starting sync...");
	const remotePath = `${config.remote.base_path}/${projectName}`;

	const createResult = await createSyncSession(
		projectName,
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
	syncSpin.text = "Syncing files...";
	const syncResult = await waitForSync(projectName, (msg) => {
		syncSpin.text = msg;
	});

	if (!syncResult.success) {
		syncSpin.fail("Sync failed");
		error(syncResult.error || "Unknown error");
		process.exit(1);
	}

	syncSpin.succeed("Initial sync complete");

	// Register in config
	config.projects[projectName] = {};
	saveConfig(config);

	// Offer to start container
	console.log();
	const { startContainer } = await inquirer.prompt([
		{
			type: "confirm",
			name: "startContainer",
			message: "Start dev container now?",
			default: false,
		},
	]);

	if (startContainer) {
		info(
			"Container startup not yet implemented. Run 'devbox up " +
				projectName +
				"' when ready.",
		);
	} else {
		info(`Run 'devbox up ${projectName}' when ready to start working.`);
	}
}
