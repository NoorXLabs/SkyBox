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
	type DevboxConfig,
	type UpOptions,
} from "../types/index.ts";

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
	let project = projectArg;

	if (!project) {
		// Try to detect from current directory
		project = resolveProjectFromCwd() ?? undefined;
	}

	if (!project) {
		// Prompt for project selection
		const projects = getLocalProjects();

		if (projects.length === 0) {
			error(
				"No local projects found. Run 'devbox clone' or 'devbox push' first.",
			);
			process.exit(1);
		}

		if (options.noPrompt) {
			error("No project specified and --no-prompt is set.");
			process.exit(1);
		}

		const { selectedProject } = await inquirer.prompt([
			{
				type: "list",
				name: "selectedProject",
				message: "Select a project:",
				choices: projects,
			},
		]);
		project = selectedProject;
	}

	// Verify project exists locally
	if (!projectExists(project ?? "")) {
		error(
			`Project '${project}' not found locally. Run 'devbox clone ${project}' first.`,
		);
		process.exit(1);
	}

	const projectPath = getProjectPath(project ?? "");
	header(`Starting '${project}'...`);

	// Step 3: Ensure sync is running (background sync to remote)
	const syncSpin = spinner("Checking sync status...");
	const syncStatus = await getSyncStatus(project ?? "");

	if (!syncStatus.exists) {
		syncSpin.warn("No sync session found - remote backup not active");
		info("Run 'devbox push' to set up remote sync.");
	} else if (syncStatus.paused) {
		syncSpin.text = "Resuming sync...";
		const resumeResult = await resumeSync(project ?? "");
		if (!resumeResult.success) {
			syncSpin.warn("Failed to resume sync - continuing without remote backup");
		} else {
			syncSpin.succeed("Sync resumed");
		}
	} else {
		syncSpin.succeed("Sync is active");
	}

	// Step 4: Check container status
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus === ContainerStatus.Running) {
		if (options.noPrompt) {
			info("Container already running, continuing...");
		} else {
			const { action } = await inquirer.prompt([
				{
					type: "list",
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
				type: "list",
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
	config: DevboxConfig,
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
				type: "list",
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
			type: "list",
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
