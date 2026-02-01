// src/commands/up.ts
import { password } from "@inquirer/prompts";
import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	SUPPORTED_EDITORS,
	WORKSPACE_PATH_PREFIX,
} from "../lib/constants.ts";
import {
	attachToShell,
	getContainerStatus,
	hasLocalDevcontainerConfig,
	openInEditor,
	startContainer,
	stopContainer,
} from "../lib/container.ts";
import { deriveKey } from "../lib/encryption.ts";
import { getErrorMessage } from "../lib/errors.ts";
import {
	acquireLock,
	createLockRemoteInfo,
	type LockRemoteInfo,
	releaseLock,
} from "../lib/lock.ts";
import { getSyncStatus, resumeSync } from "../lib/mutagen.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
	resolveProjectFromCwd,
} from "../lib/project.ts";
import { escapeShellArg } from "../lib/shell.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { selectTemplate, writeDevcontainerConfig } from "../lib/templates.ts";
import { error, header, info, spinner, success, warn } from "../lib/ui.ts";
import {
	ContainerStatus,
	type DevboxConfigV2,
	type UpOptions,
} from "../types/index.ts";
import { getProjectRemote, getRemoteHost, getRemotePath } from "./remote.ts";

/** Result of project resolution phase */
interface ResolvedProject {
	project: string;
	projectPath: string;
}

/**
 * Resolve which project to operate on from argument, cwd, or prompt.
 * Returns null if no project could be resolved.
 */
async function resolveProject(
	projectArg: string | undefined,
	options: UpOptions,
): Promise<ResolvedProject | null> {
	let project = projectArg;

	if (!project) {
		project = resolveProjectFromCwd() ?? undefined;
	}

	if (!project) {
		const projects = getLocalProjects();

		if (projects.length === 0) {
			error(
				"No local projects found. Run 'devbox clone' or 'devbox push' first.",
			);
			return null;
		}

		if (options.noPrompt) {
			error("No project specified and --no-prompt is set.");
			return null;
		}

		const { selectedProject } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "selectedProject",
				message: "Select a project:",
				choices: projects,
			},
		]);
		project = selectedProject;
	}

	if (!projectExists(project ?? "")) {
		error(
			`Project '${project}' not found locally. Run 'devbox clone ${project}' first.`,
		);
		return null;
	}

	const rawPath = getProjectPath(project ?? "");
	const { realpathSync } = await import("node:fs");
	let normalizedPath: string;
	try {
		normalizedPath = realpathSync(rawPath);
	} catch {
		normalizedPath = rawPath;
	}

	return { project: project ?? "", projectPath: normalizedPath };
}

/**
 * Acquire lock for the project on the remote server.
 * Handles lock conflicts with optional takeover prompt.
 * Returns true if lock acquired (or no remote), false if user cancelled.
 */
async function handleLockAcquisition(
	project: string,
	config: DevboxConfigV2,
	options: UpOptions,
): Promise<{ success: boolean; remoteInfo: LockRemoteInfo | null }> {
	const projectRemote = getProjectRemote(project, config);

	if (!projectRemote) {
		warn("No remote configured for this project - skipping lock");
		return { success: true, remoteInfo: null };
	}

	const remoteInfo = createLockRemoteInfo(projectRemote.remote);
	const lockResult = await acquireLock(project, remoteInfo);

	if (lockResult.success) {
		info("Lock acquired");
		return { success: true, remoteInfo };
	}

	if (lockResult.existingLock) {
		const { machine, timestamp } = lockResult.existingLock;
		warn(`Project locked by '${machine}' since ${timestamp}`);

		if (options.noPrompt) {
			error("Cannot take over lock with --no-prompt. Exiting.");
			return { success: false, remoteInfo };
		}

		const { takeover } = await inquirer.prompt([
			{
				type: "confirm",
				name: "takeover",
				message: "Take over lock anyway?",
				default: false,
			},
		]);

		if (!takeover) {
			info("Exiting without starting.");
			return { success: false, remoteInfo };
		}

		const releaseResult = await releaseLock(project, remoteInfo);
		if (!releaseResult.success) {
			error(`Failed to release existing lock: ${releaseResult.error}`);
			return { success: false, remoteInfo };
		}

		const forceResult = await acquireLock(project, remoteInfo);
		if (!forceResult.success) {
			error(`Failed to acquire lock: ${forceResult.error}`);
			return { success: false, remoteInfo };
		}

		success("Lock acquired (forced takeover)");
		return { success: true, remoteInfo };
	}

	error(`Failed to acquire lock: ${lockResult.error}`);
	return { success: false, remoteInfo };
}

/**
 * Check sync status and resume if paused.
 * Non-fatal - container can start without sync.
 */
async function checkAndResumeSync(project: string): Promise<void> {
	const syncSpin = spinner("Checking sync status...");
	const syncStatus = await getSyncStatus(project);

	if (!syncStatus.exists) {
		syncSpin.warn("No sync session found - remote backup not active");
		info("Run 'devbox push' to set up remote sync.");
		return;
	}

	if (syncStatus.paused) {
		syncSpin.text = "Resuming sync...";
		const resumeResult = await resumeSync(project);
		if (!resumeResult.success) {
			syncSpin.warn("Failed to resume sync - continuing without remote backup");
		} else {
			syncSpin.succeed("Sync resumed");
		}
		return;
	}

	syncSpin.succeed("Sync is active");
}

/**
 * Handle existing container status (running or stopped).
 * Returns 'skip' to skip to post-start, 'continue' to proceed, or 'exit' to abort.
 */
async function handleContainerStatus(
	projectPath: string,
	options: UpOptions,
): Promise<{ action: "skip" | "continue" | "exit"; rebuild?: boolean }> {
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus === ContainerStatus.Running) {
		if (options.noPrompt) {
			info("Container already running, continuing...");
			return { action: "continue" };
		}

		const { action } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "action",
				message: "Container already running. What would you like to do?",
				choices: [
					{ name: "Continue with existing container", value: "continue" },
					{ name: "Restart container", value: "restart" },
					{ name: "Rebuild container", value: "rebuild" },
				],
			},
		]);

		if (action === "continue") {
			return { action: "skip" };
		}

		const stopSpin = spinner("Stopping container...");
		const stopResult = await stopContainer(projectPath);
		if (!stopResult.success) {
			stopSpin.fail("Failed to stop container");
			error(stopResult.error || "Unknown error");
			return { action: "exit" };
		}
		stopSpin.succeed("Container stopped");

		return { action: "continue", rebuild: action === "rebuild" };
	}

	if (containerStatus === ContainerStatus.Stopped) {
		info("Found stopped container, will restart it...");
	}

	return { action: "continue" };
}

/**
 * Ensure project has devcontainer.json, creating from template if needed.
 * Returns true if config exists (or was created), false if user cancelled.
 */
async function ensureDevcontainerConfig(
	projectPath: string,
	project: string,
	options: UpOptions,
): Promise<boolean> {
	if (hasLocalDevcontainerConfig(projectPath)) {
		return true;
	}

	if (options.noPrompt) {
		error("No devcontainer.json found and --no-prompt is set.");
		return false;
	}

	warn("No devcontainer.json found");

	const { createTemplate } = await inquirer.prompt([
		{
			type: "confirm",
			name: "createTemplate",
			message: "Would you like to create a devcontainer.json from a template?",
			default: true,
		},
	]);

	if (!createTemplate) {
		info("Please add a .devcontainer/devcontainer.json and try again.");
		return false;
	}

	const selection = await selectTemplate();
	if (!selection) {
		return false;
	}

	if (selection.source === "git") {
		info(`Git URL templates are not supported for devcontainer setup.`);
		info("Use 'devbox new' to create a project from a git template.");
		return false;
	}

	const config = {
		...selection.config,
		workspaceFolder: `${WORKSPACE_PATH_PREFIX}/${project}`,
		workspaceMount: `source=\${localWorkspaceFolder},target=${WORKSPACE_PATH_PREFIX}/${project},type=bind,consistency=cached`,
	};

	writeDevcontainerConfig(projectPath, config);
	success("Created .devcontainer/devcontainer.json");

	await commitDevcontainerConfig(projectPath);
	return true;
}

const MAX_PASSPHRASE_ATTEMPTS = 3;

/**
 * Decrypt project archive on remote if encryption is enabled and archive exists.
 * Downloads archive, decrypts locally, uploads tar, extracts on remote.
 */
async function handleDecryption(
	project: string,
	config: DevboxConfigV2,
): Promise<boolean> {
	const projectConfig = config.projects[project];
	if (!projectConfig?.encryption?.enabled) {
		return true;
	}

	const projectRemote = getProjectRemote(project, config);
	if (!projectRemote) {
		return true;
	}

	const host = getRemoteHost(projectRemote.remote);
	const remotePath = getRemotePath(projectRemote.remote, project);
	const archiveName = `${project}.tar.enc`;
	const remoteArchivePath = `${remotePath}/${archiveName}`;

	// Check if encrypted archive exists on remote
	const checkResult = await runRemoteCommand(
		host,
		`test -f ${escapeShellArg(remoteArchivePath)} && echo "EXISTS" || echo "NOT_FOUND"`,
	);

	if (!checkResult.success || checkResult.stdout?.includes("NOT_FOUND")) {
		return true; // No archive, continue normally
	}

	info("Encrypted archive found on remote. Decryption required.");

	const salt = projectConfig.encryption.salt;
	if (!salt) {
		error(
			"Encryption enabled but no salt in config. Run 'devbox encrypt disable' then re-enable.",
		);
		return false;
	}

	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { unlinkSync } = await import("node:fs");
	const { execa } = await import("execa");
	const { decryptFile } = await import("../lib/encryption.ts");

	const timestamp = Date.now();
	const localEncPath = join(tmpdir(), `devbox-${project}-${timestamp}.tar.enc`);
	const localTarPath = join(tmpdir(), `devbox-${project}-${timestamp}.tar`);

	for (let attempt = 1; attempt <= MAX_PASSPHRASE_ATTEMPTS; attempt++) {
		const passphrase = await password({
			message: `Enter passphrase (attempt ${attempt}/${MAX_PASSPHRASE_ATTEMPTS}):`,
		});

		if (!passphrase) {
			error("Passphrase is required.");
			continue;
		}

		const decryptSpin = spinner("Decrypting project archive...");

		try {
			const key = await deriveKey(passphrase, salt);

			// Download encrypted archive from remote
			decryptSpin.text = "Downloading encrypted archive...";
			await execa("scp", [`${host}:${remoteArchivePath}`, localEncPath]);

			// Decrypt locally
			decryptSpin.text = "Decrypting...";
			decryptFile(localEncPath, localTarPath, key);

			// Upload decrypted tar to remote
			decryptSpin.text = "Uploading decrypted files...";
			const remoteTarPath = `${remotePath}/${project}.tar`;
			await execa("scp", [localTarPath, `${host}:${remoteTarPath}`]);

			// Extract on remote and clean up
			decryptSpin.text = "Extracting...";
			const extractResult = await runRemoteCommand(
				host,
				`cd ${escapeShellArg(remotePath)} && tar xf ${escapeShellArg(`${project}.tar`)} && rm -f ${escapeShellArg(`${project}.tar`)} ${escapeShellArg(archiveName)}`,
			);

			if (!extractResult.success) {
				decryptSpin.fail("Failed to extract archive on remote");
				error(extractResult.error || "Unknown error");
				return false;
			}

			decryptSpin.succeed("Project decrypted and extracted");
			return true;
		} catch {
			decryptSpin.fail(
				"Decryption failed — incorrect passphrase or corrupted archive",
			);
			if (attempt === MAX_PASSPHRASE_ATTEMPTS) {
				error(
					`Failed to decrypt after ${MAX_PASSPHRASE_ATTEMPTS} attempts. Run 'devbox up' to try again.`,
				);
				return false;
			}
		} finally {
			try {
				unlinkSync(localEncPath);
			} catch {}
			try {
				unlinkSync(localTarPath);
			} catch {}
		}
	}

	return false;
}

export async function upCommand(
	projectArg: string | undefined,
	options: UpOptions,
): Promise<void> {
	// Batch mode: start all local projects
	if (options.all) {
		const projects = getLocalProjects();
		if (projects.length === 0) {
			info("No local projects found.");
			return;
		}
		info(`Starting ${projects.length} projects...`);
		let succeeded = 0;
		let failed = 0;
		for (const project of projects) {
			try {
				header(`\n${project}`);
				await upCommand(project, { ...options, all: false });
				succeeded++;
			} catch (err) {
				failed++;
				error(`Failed: ${getErrorMessage(err)}`);
			}
		}
		info(`\nDone: ${succeeded} started, ${failed} failed.`);
		return;
	}

	// Step 1: Check config exists
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Step 2: Resolve project
	const resolved = await resolveProject(projectArg, options);
	if (!resolved) {
		process.exit(1);
	}
	const { project, projectPath } = resolved;

	header(`Starting '${project}'...`);

	// Step 2.5: Acquire lock before any container/sync operations
	const lockResult = await handleLockAcquisition(project, config, options);
	if (!lockResult.success) {
		if (lockResult.remoteInfo) {
			process.exit(1);
		}
		return;
	}

	// Step 2.6: Decrypt remote archive if encryption enabled
	const decryptOk = await handleDecryption(project, config);
	if (!decryptOk) {
		process.exit(1);
	}

	// Step 3: Ensure sync is running (background sync to remote)
	await checkAndResumeSync(project);

	// Step 4: Check container status
	const statusResult = await handleContainerStatus(projectPath, options);
	if (statusResult.action === "exit") {
		process.exit(1);
	}
	if (statusResult.action === "skip") {
		await handlePostStart(projectPath, config, options);
		return;
	}
	if (statusResult.rebuild) {
		options.rebuild = true;
	}

	// Step 5: Check for devcontainer.json
	const hasConfig = await ensureDevcontainerConfig(
		projectPath,
		project,
		options,
	);
	if (!hasConfig) {
		return;
	}

	// Step 6: Start container locally with retry
	await startContainerWithRetry(projectPath, options);

	// Step 7: Post-start options
	await handlePostStart(projectPath, config, options);
}

async function commitDevcontainerConfig(projectPath: string): Promise<void> {
	try {
		const { execa } = await import("execa");
		await execa("git", [
			"-C",
			projectPath,
			"add",
			`${DEVCONTAINER_DIR_NAME}/${DEVCONTAINER_CONFIG_NAME}`,
		]);
		await execa("git", [
			"-C",
			projectPath,
			"commit",
			"-m",
			"Add devcontainer configuration",
		]);
		info("Committed devcontainer.json to git");
	} catch {
		// Git commit might fail if no changes or not a git repo - that's ok
	}
}

async function startContainerWithRetry(
	projectPath: string,
	options: UpOptions,
): Promise<void> {
	const startSpin = spinner("Starting container locally...");

	let result = await startContainer(projectPath, { rebuild: options.rebuild });

	if (!result.success) {
		startSpin.text = "Container failed, retrying with rebuild...";
		result = await startContainer(projectPath, { rebuild: true });

		if (!result.success) {
			startSpin.fail("Container failed to start");
			error(result.error || "Unknown error");
			if (options.verbose) {
				console.log("\nFull error output:");
				console.log(result.error);
			} else {
				info("Run with --verbose for full logs.");
			}
			process.exit(1);
		}
	}

	startSpin.succeed("Container started");
}

export type PostStartAction = "editor" | "shell" | "both" | "none";

/**
 * Determine what post-start action to take based on options or user prompt.
 */
export async function determinePostStartAction(
	config: DevboxConfigV2,
	options: UpOptions,
): Promise<{ action: PostStartAction; editor: string | undefined }> {
	// Handle flags for non-interactive mode
	if (options.editor && options.attach) {
		return { action: "both", editor: config.editor || "cursor" };
	}
	if (options.editor) {
		return { action: "editor", editor: config.editor || "cursor" };
	}
	if (options.attach) {
		return { action: "shell", editor: undefined };
	}
	if (options.noPrompt) {
		return { action: "none", editor: undefined };
	}

	// Interactive mode - may need to select editor
	let editor = config.editor;

	if (!editor) {
		const { selectedEditor } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "selectedEditor",
				message: "Which editor would you like to use?",
				choices: [
					...SUPPORTED_EDITORS.map((e) => ({ name: e.name, value: e.id })),
					{ name: "Other (specify command)", value: "other" },
				],
			},
		]);

		if (selectedEditor === "other") {
			const { customEditor } = await inquirer.prompt([
				{
					type: "input",
					name: "customEditor",
					message: "Enter editor command:",
				},
			]);
			editor = customEditor;
		} else {
			editor = selectedEditor;
		}
	}

	// Ask what to do
	const { action } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "action",
			message: "What would you like to do?",
			choices: [
				{ name: "Open in editor", value: "editor" },
				{ name: "Attach to shell", value: "shell" },
				{ name: "Both", value: "both" },
				{ name: "Neither (just exit)", value: "none" },
			],
		},
	]);

	return { action, editor };
}

/**
 * Execute the determined post-start action (open editor, attach shell, or both).
 */
export async function executePostStartAction(
	projectPath: string,
	action: PostStartAction,
	editor: string | undefined,
): Promise<void> {
	if (action === "none") {
		success("Container ready. Run 'devbox up' again to open editor or attach.");
		return;
	}

	if (action === "editor" || action === "both") {
		if (!editor) {
			warn("No editor configured");
		} else {
			const openSpin = spinner(`Opening in ${editor}...`);
			const openResult = await openInEditor(projectPath, editor);
			if (openResult.success) {
				openSpin.succeed(`Opened in ${editor}`);
			} else {
				openSpin.fail(`Failed to open in ${editor}`);
				warn(openResult.error || "Unknown error");
			}
		}
	}

	if (action === "shell" || action === "both") {
		info("Attaching to shell (Ctrl+D to exit)...");
		await attachToShell(projectPath);
	}
}

async function handlePostStart(
	projectPath: string,
	config: DevboxConfigV2,
	options: UpOptions,
): Promise<void> {
	const { action, editor } = await determinePostStartAction(config, options);

	// Handle editor preference saving (only in interactive mode)
	if (
		!options.noPrompt &&
		!options.editor &&
		!options.attach &&
		!config.editor &&
		editor
	) {
		const { makeDefault } = await inquirer.prompt([
			{
				type: "confirm",
				name: "makeDefault",
				message: `Make ${editor} your default editor for future sessions?`,
				default: true,
			},
		]);

		if (makeDefault) {
			config.editor = editor;
			saveConfig(config);
			success(`Set ${editor} as default editor.`);
		}
	}

	await executePostStartAction(projectPath, action, editor);
}
