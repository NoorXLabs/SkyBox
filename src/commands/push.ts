// src/commands/push.ts

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
	getRemoteHost,
	getRemotePath,
	selectRemote,
} from "@commands/remote.ts";
import { upCommand } from "@commands/up.ts";
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import { getErrorMessage } from "@lib/errors.ts";
import {
	createSelectiveSyncSessions,
	createSyncSession,
	waitForSync,
} from "@lib/mutagen.ts";
import { checkWriteAuthorization, setOwnership } from "@lib/ownership.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { validateProjectName } from "@lib/projectTemplates.ts";
import { checkRemoteProjectExists } from "@lib/remote.ts";
import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import {
	confirmDestructiveAction,
	dryRun,
	error,
	header,
	info,
	isDryRun,
	spinner,
	success,
	warn,
} from "@lib/ui.ts";
import { execa } from "execa";
import inquirer from "inquirer";

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
		error("Usage: skybox push <path> [name]");
		process.exit(1);
	}

	if (!configExists()) {
		error("skybox not configured. Run 'skybox init' first.");
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

	logAuditEvent(AuditActions.PUSH_START, {
		project: projectName,
		remote: remoteName,
		sourcePath: absolutePath,
	});

	header(`Pushing '${projectName}' to ${host}:${remotePath}...`);

	if (isDryRun()) {
		if (!(await isGitRepo(absolutePath))) {
			dryRun("Would initialize git repository");
		}
		dryRun(`Would check if project exists on remote`);
		dryRun(`Would create remote directory: ${host}:${remotePath}`);
		const localPath = join(getProjectsDir(), projectName);
		if (absolutePath !== localPath) {
			dryRun(`Would copy ${absolutePath} to ${localPath}`);
		}
		dryRun(`Would create sync session: ${localPath} <-> ${host}:${remotePath}`);
		dryRun(`Would register project '${projectName}' in config`);
		return;
	}

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
				logAuditEvent(AuditActions.PUSH_FAIL, {
					project: projectName,
					remote: remoteName,
					error: "Failed to initialize git",
				});
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
		checkSpin.text = "Checking authorization...";
		const authResult = await checkWriteAuthorization(host, remotePath);

		if (!authResult.authorized) {
			checkSpin.fail("Not authorized");
			error(`Cannot overwrite: ${authResult.error}`);
			info(
				"Contact the project owner to transfer ownership or use a different project name.",
			);
			logAuditEvent(AuditActions.AUTH_DENIED, {
				project: projectName,
				remote: remoteName,
				operation: "push",
				error: authResult.error,
			});
			process.exit(1);
		}
		checkSpin.warn("Project already exists on remote (you have permission)");

		const confirmed = await confirmDestructiveAction({
			firstPrompt: "Project already exists on remote. Overwrite?",
			secondPrompt: "Are you sure? All remote changes will be lost.",
			cancelMessage: "Push cancelled.",
		});

		if (!confirmed) {
			return;
		}

		// Remove remote directory
		await runRemoteCommand(host, `rm -rf ${escapeShellArg(remotePath)}`);
	} else {
		checkSpin.succeed("Remote path available");
	}

	// Create remote directory
	const mkdirSpin = spinner("Creating remote directory...");
	const mkdirResult = await runRemoteCommand(
		host,
		`mkdir -p ${escapeShellArg(remotePath)}`,
	);

	if (!mkdirResult.success) {
		mkdirSpin.fail("Failed to create remote directory");
		error(mkdirResult.error || "Unknown error");
		logAuditEvent(AuditActions.PUSH_FAIL, {
			project: projectName,
			remote: remoteName,
			error: mkdirResult.error || "Failed to create remote directory",
		});
		process.exit(1);
	}
	mkdirSpin.succeed("Created remote directory");

	// Copy to skybox projects directory
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

	const projectConfig = config.projects[projectName];
	const ignores = config.defaults.ignore;
	const createResult =
		projectConfig?.sync_paths && projectConfig.sync_paths.length > 0
			? await createSelectiveSyncSessions(
					projectName,
					localPath,
					host,
					remotePath,
					projectConfig.sync_paths,
					ignores,
				)
			: await createSyncSession(
					projectName,
					localPath,
					host,
					remotePath,
					ignores,
				);

	if (!createResult.success) {
		syncSpin.fail("Failed to create sync session");
		error(createResult.error || "Unknown error");
		logAuditEvent(AuditActions.PUSH_FAIL, {
			project: projectName,
			remote: remoteName,
			error: createResult.error || "Failed to create sync session",
		});
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
		logAuditEvent(AuditActions.PUSH_FAIL, {
			project: projectName,
			remote: remoteName,
			error: syncResult.error || "Sync failed",
		});
		process.exit(1);
	}

	syncSpin.succeed("Initial sync complete");

	// Set ownership for new projects
	const ownerResult = await setOwnership(host, remotePath);
	if (!ownerResult.success) {
		warn(`Could not set ownership: ${ownerResult.error}`);
	}

	// Register in config with remote reference
	config.projects[projectName] = { remote: remoteName };
	saveConfig(config);

	logAuditEvent(AuditActions.PUSH_SUCCESS, {
		project: projectName,
		remote: remoteName,
	});

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
		info(`Run 'skybox up ${projectName}' when ready to start working.`);
	}
}
