// src/commands/up.ts
import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import {
	attachToShell,
	getContainerStatus,
	hasLocalDevcontainerConfig,
	openInEditor,
	SUPPORTED_EDITORS,
	startContainer,
	stopContainer,
} from "../lib/container.ts";
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
import { createDevcontainerConfig, TEMPLATES } from "../lib/templates.ts";
import { error, header, info, spinner, success, warn } from "../lib/ui.ts";
import {
	ContainerStatus,
	type DevboxConfigV2,
	type UpOptions,
} from "../types/index.ts";
import { getProjectRemote } from "./remote.ts";

/** Context passed between up command phases */
interface UpContext {
	project: string;
	projectPath: string;
	config: DevboxConfigV2;
	options: UpOptions;
	remoteInfo: LockRemoteInfo | null;
}

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

export async function upCommand(
	projectArg: string | undefined,
	options: UpOptions,
): Promise<void> {
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

	// Step 3: Ensure sync is running (background sync to remote)
	await checkAndResumeSync(project);

	// Step 4: Check container status
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus === ContainerStatus.Running) {
		if (options.noPrompt) {
			info("Container already running, continuing...");
		} else {
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

			if (action === "restart" || action === "rebuild") {
				const stopSpin = spinner("Stopping container...");
				const stopResult = await stopContainer(projectPath);
				if (!stopResult.success) {
					stopSpin.fail("Failed to stop container");
					error(stopResult.error || "Unknown error");
					process.exit(1);
				}
				stopSpin.succeed("Container stopped");

				if (action === "rebuild") {
					options.rebuild = true;
				}
			} else {
				// Skip to post-start options
				await handlePostStart(projectPath, config, options);
				return;
			}
		}
	} else if (containerStatus === ContainerStatus.Stopped) {
		info("Found stopped container, will restart it...");
	}

	// Step 5: Check for devcontainer.json
	if (!hasLocalDevcontainerConfig(projectPath)) {
		if (options.noPrompt) {
			error("No devcontainer.json found and --no-prompt is set.");
			process.exit(1);
		}

		warn("No devcontainer.json found");

		// Offer to create template
		const { createTemplate } = await inquirer.prompt([
			{
				type: "confirm",
				name: "createTemplate",
				message:
					"Would you like to create a devcontainer.json from a template?",
				default: true,
			},
		]);

		if (!createTemplate) {
			info("Please add a .devcontainer/devcontainer.json and try again.");
			return;
		}

		const { templateId } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "templateId",
				message: "Select a template:",
				choices: TEMPLATES.map((t) => ({
					name: `${t.name} - ${t.description}`,
					value: t.id,
				})),
			},
		]);

		createDevcontainerConfig(projectPath, templateId, project);
		success("Created .devcontainer/devcontainer.json");

		// Commit the new config
		await commitDevcontainerConfig(projectPath);
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
			".devcontainer/devcontainer.json",
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

async function handlePostStart(
	projectPath: string,
	config: DevboxConfigV2,
	options: UpOptions,
): Promise<void> {
	// Handle flags for non-interactive mode
	if (options.editor && options.attach) {
		const editor = config.editor || "cursor";
		await openInEditor(projectPath, editor);
		await attachToShell(projectPath);
		return;
	}

	if (options.editor) {
		const editor = config.editor || "cursor";
		await openInEditor(projectPath, editor);
		return;
	}

	if (options.attach) {
		await attachToShell(projectPath);
		return;
	}

	if (options.noPrompt) {
		success("Container ready.");
		return;
	}

	// Interactive mode - check if we need to ask for editor preference
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

	if (action === "editor" || action === "both") {
		const openSpin = spinner(`Opening in ${editor}...`);
		const openResult = await openInEditor(projectPath, editor);
		if (openResult.success) {
			openSpin.succeed(`Opened in ${editor}`);
		} else {
			openSpin.fail(`Failed to open in ${editor}`);
			warn(openResult.error || "Unknown error");
		}
	}

	if (action === "shell" || action === "both") {
		info("Attaching to shell (Ctrl+D to exit)...");
		await attachToShell(projectPath);
	}

	if (action === "none") {
		success("Container ready. Run 'devbox up' again to open editor or attach.");
	}
}
