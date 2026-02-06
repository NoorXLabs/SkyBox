// src/commands/up.ts

import { realpathSync } from "node:fs";
import {
	getProjectRemote,
	getRemoteHost,
	getRemotePath,
} from "@commands/remote.ts";
import { checkbox, password, select } from "@inquirer/prompts";
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
import { requireConfig, saveConfig } from "@lib/config.ts";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	MAX_PASSPHRASE_ATTEMPTS,
	SUPPORTED_EDITORS,
	WORKSPACE_PATH_PREFIX,
} from "@lib/constants.ts";
import {
	attachToShell,
	getContainerStatus,
	hasLocalDevcontainerConfig,
	openInEditor,
	startContainer,
	stopContainer,
} from "@lib/container.ts";
import { deriveKey } from "@lib/encryption.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { runHooks } from "@lib/hooks.ts";
import { getSyncStatus, resumeSync } from "@lib/mutagen.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
	resolveProjectFromCwd,
} from "@lib/project.ts";
import {
	createRemoteArchiveTarget,
	decryptRemoteArchive,
	remoteArchiveExists,
} from "@lib/remote-encryption.ts";
import {
	deleteSession,
	getMachineName,
	readSession,
	writeSession,
} from "@lib/session.ts";
import { selectTemplate, writeDevcontainerConfig } from "@lib/templates.ts";
import {
	dryRun,
	error,
	header,
	info,
	isDryRun,
	spinner,
	success,
	warn,
} from "@lib/ui.ts";
import {
	ContainerStatus,
	type ResolvedProject,
	type SkyboxConfigV2,
	type UpOptions,
} from "@typedefs/index.ts";
import inquirer from "inquirer";

/**
 * Sanitize Docker error output for display.
 * Removes potentially sensitive information while preserving useful details.
 * @internal Exported for testing
 */
export function sanitizeDockerError(errorStr: string): string {
	let sanitized = errorStr;

	// Only redact paths that likely contain sensitive info
	// Keep general paths for debugging, redact config/credential paths
	const sensitivePathPatterns = [
		/\/Users\/[^/]+\/(\.ssh|\.aws|\.config|\.gnupg|\.skybox)[^\s]*/g,
		/\/home\/[^/]+\/(\.ssh|\.aws|\.config|\.gnupg|\.skybox)[^\s]*/g,
		/\/Users\/[^/]+\/\.[^/\s]+/g, // Any dotfile in home
		/\/home\/[^/]+\/\.[^/\s]+/g, // Any dotfile in home
	];

	for (const pattern of sensitivePathPatterns) {
		sanitized = sanitized.replace(pattern, "[REDACTED_PATH]");
	}

	// Remove potential credential fragments
	sanitized = sanitized.replace(/password[=:]\S+/gi, "password=[REDACTED]");
	sanitized = sanitized.replace(/token[=:]\S+/gi, "token=[REDACTED]");

	return sanitized;
}

/**
 * Normalize a project name to a ResolvedProject with realpath-resolved path.
 * Returns null if the project doesn't exist locally.
 */
async function normalizeProject(
	project: string,
): Promise<ResolvedProject | null> {
	if (!projectExists(project)) {
		error(
			`Project '${project}' not found locally. Run 'skybox clone ${project}' first.`,
		);
		return null;
	}

	const rawPath = getProjectPath(project);
	let normalizedPath: string;
	try {
		normalizedPath = realpathSync(rawPath);
	} catch {
		normalizedPath = rawPath;
	}

	return { project, projectPath: normalizedPath };
}

/**
 * Resolve which project(s) to operate on from argument, cwd, or prompt.
 * Returns an array of resolved projects, or null if resolution failed.
 * When no argument is given, shows a checkbox for multi-select.
 */
async function resolveProjects(
	projectArg: string | undefined,
	options: UpOptions,
): Promise<ResolvedProject[] | null> {
	// If explicit argument, return single project
	if (projectArg) {
		const resolved = await normalizeProject(projectArg);
		return resolved ? [resolved] : null;
	}

	// Try to resolve from cwd
	const cwdProject = resolveProjectFromCwd() ?? undefined;
	if (cwdProject) {
		const resolved = await normalizeProject(cwdProject);
		return resolved ? [resolved] : null;
	}

	// No argument and not in a project dir — prompt with checkbox
	const projects = getLocalProjects();

	if (projects.length === 0) {
		error(
			"No local projects found. Run 'skybox clone' or 'skybox push' first.",
		);
		return null;
	}

	if (options.noPrompt) {
		error("No project specified and --no-prompt is set.");
		return null;
	}

	const selected = await checkbox({
		message: "Select project(s) to start:",
		choices: projects.map((p) => ({ name: p, value: p })),
	});

	if (selected.length === 0) {
		error("No projects selected.");
		return null;
	}

	const resolved: ResolvedProject[] = [];
	for (const name of selected) {
		const r = await normalizeProject(name);
		if (!r) return null;
		resolved.push(r);
	}

	return resolved;
}

/**
 * Check for session conflicts and write session file.
 * Sessions are local files synced by Mutagen - no SSH involved.
 * Returns true if session written successfully, false if user cancelled.
 */
async function handleSessionAcquisition(
	projectPath: string,
	options: UpOptions,
): Promise<boolean> {
	const existingSession = readSession(projectPath);
	const currentMachine = getMachineName();

	if (existingSession) {
		if (existingSession.machine === currentMachine) {
			// Same machine - update timestamp and continue
			info(`Resuming session on ${currentMachine}`);
			writeSession(projectPath);
			return true;
		}

		// Different machine has an active session
		const { machine, timestamp } = existingSession;
		warn(`This project is running on ${machine} (since ${timestamp})`);

		if (options.noPrompt) {
			error("Cannot continue with --no-prompt. Exiting.");
			return false;
		}

		const { continueAnyway } = await inquirer.prompt([
			{
				type: "confirm",
				name: "continueAnyway",
				message: "Continue anyway?",
				default: false,
			},
		]);

		if (!continueAnyway) {
			info("Exiting without starting.");
			return false;
		}

		// Override the other machine's session
		writeSession(projectPath);
		success(`Session started (took over from ${machine})`);
		return true;
	}

	// No existing session - write fresh
	writeSession(projectPath);
	info("Session started");
	return true;
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
		info("Run 'skybox push' to set up remote sync.");
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
		info("Use 'skybox new' to create a project from a git template.");
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

/**
 * Decrypt project archive on remote if encryption is enabled and archive exists.
 * Downloads archive, decrypts locally, uploads tar, extracts on remote.
 */
async function handleDecryption(
	project: string,
	config: SkyboxConfigV2,
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
	const archiveTarget = createRemoteArchiveTarget(project, host, remotePath);

	// Check if encrypted archive exists on remote
	if (!(await remoteArchiveExists(archiveTarget))) {
		return true; // No archive, continue normally
	}

	info("Encrypted archive found on remote. Decryption required.");

	const salt = projectConfig.encryption.salt;
	if (!salt) {
		error(
			"Encryption enabled but no salt in config. Run 'skybox encrypt disable' then re-enable.",
		);
		return false;
	}

	for (let attempt = 1; attempt <= MAX_PASSPHRASE_ATTEMPTS; attempt++) {
		const passphrase = await password({
			message: "Enter passphrase:",
		});

		if (!passphrase) {
			error("Passphrase is required.");
			continue;
		}

		const decryptSpin = spinner("Decrypting project archive...");

		try {
			const key = await deriveKey(passphrase, salt);
			const decryptResult = await decryptRemoteArchive(
				archiveTarget,
				key,
				(message) => {
					decryptSpin.text = message;
				},
			);

			if (!decryptResult.success) {
				decryptSpin.fail("Failed to extract archive on remote");
				error(decryptResult.error || "Unknown error");
				return false;
			}

			decryptSpin.succeed("Project decrypted and extracted");
			return true;
		} catch {
			if (attempt === MAX_PASSPHRASE_ATTEMPTS) {
				decryptSpin.fail("Decryption failed");
				error("Too many failed attempts. Run 'skybox up' to try again.");
				return false;
			}
			decryptSpin.fail("Wrong passphrase. Please try again.");
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

	// Step 1: Load config
	const config = requireConfig();

	// Step 2: Resolve project(s)
	const resolvedProjects = await resolveProjects(projectArg, options);
	if (!resolvedProjects) {
		process.exit(1);
	}

	// Single project: use existing flow with handlePostStart
	if (resolvedProjects.length === 1) {
		const { project, projectPath } = resolvedProjects[0];
		try {
			await startSingleProject(project, projectPath, config, options);
		} catch (err) {
			error(getErrorMessage(err));
			process.exit(1);
		}
		await handlePostStart(projectPath, config, options);
		return;
	}

	// Multi-project: start each sequentially, then multi-post-start
	const succeeded: ResolvedProject[] = [];
	for (const resolved of resolvedProjects) {
		try {
			header(`\n${resolved.project}`);
			await startSingleProject(
				resolved.project,
				resolved.projectPath,
				config,
				options,
			);
			succeeded.push(resolved);
		} catch (err) {
			error(`Failed to start '${resolved.project}': ${getErrorMessage(err)}`);
		}
	}

	info(
		`\nDone: ${succeeded.length} started, ${resolvedProjects.length - succeeded.length} failed.`,
	);

	if (succeeded.length > 0) {
		await handleMultiPostStart(succeeded, config, options);
	}
}

/**
 * Start a single project (session, decrypt, sync, container).
 * Extracted from upCommand so it can be called in a loop.
 */
async function startSingleProject(
	project: string,
	projectPath: string,
	config: SkyboxConfigV2,
	options: UpOptions,
): Promise<void> {
	logAuditEvent(AuditActions.UP_START, { project });
	header(`Starting '${project}'...`);

	if (isDryRun()) {
		const projectConfig = config.projects[project];
		if (projectConfig?.hooks) {
			dryRun(`Would run pre-up hooks for '${project}'`);
		}
		dryRun(`Would write session file at ${projectPath}`);
		dryRun(`Would check and resume sync for '${project}'`);
		dryRun(`Would start container at ${projectPath}`);
		if (projectConfig?.hooks) {
			dryRun(`Would run post-up hooks for '${project}'`);
		}
		return;
	}

	// Run pre-up hooks
	const projectConfig = config.projects[project];
	if (projectConfig?.hooks) {
		await runHooks("pre-up", projectConfig.hooks, projectPath);
	}

	const sessionOk = await handleSessionAcquisition(projectPath, options);
	if (!sessionOk) {
		throw new Error("Session conflict - user cancelled");
	}

	try {
		const decryptOk = await handleDecryption(project, config);
		if (!decryptOk) {
			throw new Error("Decryption failed");
		}

		await checkAndResumeSync(project);

		const statusResult = await handleContainerStatus(projectPath, options);
		if (statusResult.action === "exit") {
			throw new Error("Container status check failed");
		}
		if (statusResult.action === "skip") {
			return;
		}
		if (statusResult.rebuild) {
			options.rebuild = true;
		}

		const hasConfig = await ensureDevcontainerConfig(
			projectPath,
			project,
			options,
		);
		if (!hasConfig) {
			return;
		}

		await startContainerWithRetry(projectPath, options);

		logAuditEvent(AuditActions.UP_SUCCESS, { project });

		// Run post-up hooks
		if (projectConfig?.hooks) {
			await runHooks("post-up", projectConfig.hooks, projectPath);
		}
	} catch (err) {
		// Clear session on failure so user can retry
		deleteSession(projectPath);
		throw err;
	}
}

/**
 * Handle post-start behavior when multiple projects were started.
 * Offers to open all/some/none in editor.
 */
async function handleMultiPostStart(
	succeeded: ResolvedProject[],
	config: SkyboxConfigV2,
	options: UpOptions,
): Promise<void> {
	if (options.noPrompt) {
		return;
	}

	// --editor or --attach flags: open all in editor
	if (options.editor || options.attach) {
		const editor = config.editor || "cursor";
		for (const { projectPath } of succeeded) {
			const openSpin = spinner(`Opening in ${editor}...`);
			const openResult = await openInEditor(projectPath, editor);
			if (openResult.success) {
				openSpin.succeed(`Opened in ${editor}`);
			} else {
				openSpin.fail(`Failed to open in ${editor}`);
				warn(openResult.error || "Unknown error");
			}
		}
		return;
	}

	// Resolve editor
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

	const choice = await select({
		message: "What would you like to do?",
		choices: [
			{ name: "Open all in editor", value: "all" as const },
			{ name: "Choose which to open", value: "choose" as const },
			{ name: "Skip", value: "skip" as const },
		],
	});

	let projectsToOpen: ResolvedProject[] = [];

	if (choice === "all") {
		projectsToOpen = succeeded;
	} else if (choice === "choose") {
		const selected = await checkbox({
			message: "Select projects to open:",
			choices: succeeded.map((r) => ({ name: r.project, value: r })),
		});
		projectsToOpen = selected;
	}

	for (const { projectPath } of projectsToOpen) {
		if (!editor) {
			warn("No editor configured");
			break;
		}
		const openSpin = spinner(`Opening in ${editor}...`);
		const openResult = await openInEditor(projectPath, editor);
		if (openResult.success) {
			openSpin.succeed(`Opened in ${editor}`);
		} else {
			openSpin.fail(`Failed to open in ${editor}`);
			warn(openResult.error || "Unknown error");
		}
	}

	// Save editor preference if newly selected
	if (!config.editor && editor) {
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
				console.log(sanitizeDockerError(result.error || ""));
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
	config: SkyboxConfigV2,
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
		success("Container ready. Run 'skybox up' again to open editor or attach.");
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
	config: SkyboxConfigV2,
	options: UpOptions,
): Promise<void> {
	if (isDryRun()) {
		dryRun("Would prompt for post-start action (editor/shell)");
		return;
	}

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
