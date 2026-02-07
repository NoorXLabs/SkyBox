// src/commands/editor.ts

import { requireLoadedConfigOrExit } from "@lib/command-guard.ts";
import { saveConfig } from "@lib/config.ts";
import { SUPPORTED_EDITORS } from "@lib/constants.ts";
import { dryRun, header, info, isDryRun, success } from "@lib/ui.ts";
import inquirer from "inquirer";

export const editorCommand = async (): Promise<void> => {
	const config = requireLoadedConfigOrExit();

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
};
