// src/commands/open.ts

import {
	determinePostStartAction,
	executePostStartAction,
} from "@commands/up.ts";
import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import { getContainerStatus } from "@lib/container.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
	resolveProjectFromCwd,
} from "@lib/project.ts";
import { error, header, info, success } from "@lib/ui.ts";
import { ContainerStatus, type OpenOptions } from "@typedefs/index.ts";
import inquirer from "inquirer";

export async function openCommand(
	projectArg: string | undefined,
	options: OpenOptions,
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
		project = resolveProjectFromCwd() ?? undefined;
	}

	if (!project) {
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
		process.exit(1);
	}

	const projectPath = getProjectPath(project ?? "");

	// Step 3: Check container is running
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus !== ContainerStatus.Running) {
		error(`Container for '${project}' is not running.`);
		info("Run 'devbox up' to start the container first.");
		process.exit(1);
	}

	header(`Opening '${project}'...`);

	// Step 4: Convert options to UpOptions format for determinePostStartAction
	const upStyleOptions = {
		editor: options.editor,
		attach: options.shell,
		noPrompt: options.noPrompt,
	};

	// Step 5: Determine and execute action
	const { action, editor } = await determinePostStartAction(
		config,
		upStyleOptions,
	);

	// Handle editor preference saving (only in interactive mode)
	if (
		!options.noPrompt &&
		!options.editor &&
		!options.shell &&
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
