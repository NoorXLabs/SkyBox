// src/commands/push.ts

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execa } from "execa";
import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import { getErrorMessage } from "../lib/errors.ts";
import { createSyncSession, waitForSync } from "../lib/mutagen.ts";
import { getProjectsDir } from "../lib/paths.ts";
import { validateProjectName } from "../lib/projectTemplates.ts";
import { checkRemoteProjectExists } from "../lib/remote.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";
import { getRemoteHost, getRemotePath, selectRemote } from "./remote.ts";
import { upCommand } from "./up.ts";

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

	// Validate project name to prevent path traversal and invalid characters
	const validation = validateProjectName(projectName);
	if (!validation.valid) {
		error(validation.error || "Invalid project name");
		process.exit(1);
	}

	// Select which remote to push to
	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);
	const remotePath = getRemotePath(remote, projectName);

	header(`Pushing '${projectName}' to ${host}:${remotePath}...`);

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
			} catch (err: unknown) {
				gitSpin.fail("Failed to initialize git");
				error(getErrorMessage(err));
				process.exit(1);
			}
		}
	}

	// Check remote doesn't exist
	const checkSpin = spinner("Checking remote...");
	const remoteExists = await checkRemoteProjectExists(
		host,
		remote.path,
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
		await runRemoteCommand(host, `rm -rf "${remotePath}"`);
	} else {
		checkSpin.succeed("Remote path available");
	}

	// Create remote directory
	const mkdirSpin = spinner("Creating remote directory...");
	const mkdirResult = await runRemoteCommand(host, `mkdir -p "${remotePath}"`);

	if (!mkdirResult.success) {
		mkdirSpin.fail("Failed to create remote directory");
		error(mkdirResult.error || "Unknown error");
		process.exit(1);
	}
	mkdirSpin.succeed("Created remote directory");

	// Copy to devbox projects directory
	const projectsDir = getProjectsDir();
	const localPath = join(projectsDir, projectName);

	if (absolutePath !== localPath) {
		if (existsSync(localPath)) {
			rmSync(localPath, { recursive: true });
		}
		mkdirSync(projectsDir, { recursive: true });
		cpSync(absolutePath, localPath, { recursive: true });
		success(`Copied to ${localPath}`);
	}

	// Create sync session
	const syncSpin = spinner("Starting sync...");

	const createResult = await createSyncSession(
		projectName,
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

	// Register in config with remote reference
	config.projects[projectName] = { remote: remoteName };
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
		await upCommand(projectName, {});
	} else {
		info(`Project saved to ${localPath}`);
		info(`Run 'devbox up ${projectName}' when ready to start working.`);
	}
}
