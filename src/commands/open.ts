// src/commands/open.ts

import {
	determinePostStartAction,
	executePostStartAction,
} from "@commands/up.ts";
import {
	exitWithError,
	exitWithErrorAndInfo,
	requireLoadedConfigOrExit,
} from "@lib/command-guard.ts";
import { saveConfig } from "@lib/config.ts";
import { getContainerStatus } from "@lib/container.ts";
import {
	getProjectPath,
	projectExists,
	resolveSingleProject,
} from "@lib/project.ts";
import { dryRun, header, isDryRun, success } from "@lib/ui.ts";
import { ContainerStatus, type OpenOptions } from "@typedefs/index.ts";
import inquirer from "inquirer";

// open an editor or shell for an already-running project container
export const openCommand = async (
	projectArg: string | undefined,
	options: OpenOptions,
): Promise<void> => {
	const config = requireLoadedConfigOrExit();

	// Step 2: Resolve project
	const resolution = await resolveSingleProject({
		projectArg,
		noPrompt: options.noPrompt,
		promptMessage: "Select a project:",
	});

	if ("reason" in resolution) {
		if (resolution.reason === "no-projects") {
			exitWithError(
				"No local projects found. Run 'skybox clone' or 'skybox push' first.",
			);
		}
		exitWithError("No project specified and --no-prompt is set.");
	}

	const project = resolution.project;

	if (!projectExists(project)) {
		exitWithError(
			`Project '${project}' not found locally. Run 'skybox clone ${project}' first.`,
		);
	}

	const projectPath = getProjectPath(project);

	if (isDryRun()) {
		dryRun(`Would open editor/shell for '${project}'`);
		return;
	}

	// Step 3: Check container is running
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus !== ContainerStatus.Running) {
		exitWithErrorAndInfo(
			`Container for '${project}' is not running.`,
			"Run 'skybox up' to start the container first.",
		);
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
};
