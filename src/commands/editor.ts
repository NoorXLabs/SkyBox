// src/commands/editor.ts

import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import { SUPPORTED_EDITORS } from "@lib/constants.ts";
import { dryRun, error, header, info, isDryRun, success } from "@lib/ui.ts";
import inquirer from "inquirer";

export async function editorCommand(): Promise<void> {
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	const currentEditor = config.editor || "not set";
	header("Editor Configuration");
	info(`Current default: ${currentEditor}`);
	console.log();

	const choices = SUPPORTED_EDITORS.map((e) => ({
		name: e.id === config.editor ? `${e.name} (current)` : e.name,
		value: e.id,
	}));
	choices.push({ name: "Other (specify command)", value: "other" });

	const { selectedEditor } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "selectedEditor",
			message: "Select default editor:",
			choices,
		},
	]);

	let editor = selectedEditor;

	if (selectedEditor === "other") {
		const { customEditor } = await inquirer.prompt([
			{
				type: "input",
				name: "customEditor",
				message: "Enter editor command:",
			},
		]);
		editor = customEditor;
	}

	if (editor === config.editor) {
		info("Editor unchanged.");
		return;
	}

	if (isDryRun()) {
		dryRun(`Would change editor from '${config.editor}' to '${editor}'`);
		return;
	}

	config.editor = editor;
	saveConfig(config);
	success(`Default editor updated to ${editor}.`);
}
