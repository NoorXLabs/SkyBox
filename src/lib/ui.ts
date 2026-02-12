// terminal UI helpers: colored output, spinners, headers.
import { password } from "@inquirer/prompts";
import { SUPPORTED_EDITORS } from "@lib/constants.ts";
import chalk from "chalk";
import { program } from "commander";
import inquirer from "inquirer";
import ora, { type Ora } from "ora";

// success
export const success = (message: string): void => {
	console.log(chalk.green("  ✓"), message);
};

// error
export const error = (message: string): void => {
	console.log(chalk.red("  ✗"), message);
};

// warn
export const warn = (message: string): void => {
	console.log(chalk.yellow("  !"), message);
};

// info
export const info = (message: string): void => {
	console.log(chalk.blue("  ℹ"), message);
};

// dry run
export const dryRun = (message: string): void => {
	console.log(chalk.dim("  ⏭"), chalk.dim(`[dry-run] ${message}`));
};

// header
export const header = (message: string): void => {
	console.log();
	console.log(chalk.bold(message));
};

// spinner
export const spinner = (message: string): Ora => {
	// discardStdin: false prevents conflicts with inquirer prompts
	// See: https://github.com/sindresorhus/ora/issues/134
	return ora({ text: message, prefixText: " ", discardStdin: false }).start();
};

// print next steps
export const printNextSteps = (steps: string[]): void => {
	console.log();
	console.log(chalk.bold("Next steps:"));
	steps.forEach((step, i) => {
		console.log(chalk.dim(`  ${i + 1}.`), step);
	});
	console.log();
};

// prompt for double confirmation before a destructive action.
// returns true if user confirms both prompts, false otherwise.
export const confirmDestructiveAction = async (options: {
	firstPrompt: string;
	secondPrompt: string;
	cancelMessage?: string;
}): Promise<boolean> => {
	const { firstPrompt, secondPrompt, cancelMessage = "Cancelled." } = options;

	const { confirmed } = await inquirer.prompt([
		{
			type: "confirm",
			name: "confirmed",
			message: firstPrompt,
			default: false,
		},
	]);

	if (!confirmed) {
		info(cancelMessage);
		return false;
	}

	const { doubleConfirmed } = await inquirer.prompt([
		{
			type: "confirm",
			name: "doubleConfirmed",
			message: secondPrompt,
			default: false,
		},
	]);

	if (!doubleConfirmed) {
		info(cancelMessage);
		return false;
	}

	return true;
};

// prompt for a passphrase with confirmation (re-enter to verify match).
// loops until both entries match. rejects empty passphrases.
export const promptPassphraseWithConfirmation = async (
	message: string,
): Promise<string> => {
	for (;;) {
		const passphrase = await password({ message });

		if (!passphrase) {
			warn("Passphrase cannot be empty. Try again.");
			continue;
		}

		const confirmation = await password({ message: "Confirm passphrase:" });

		if (passphrase !== confirmation) {
			warn("Passphrases do not match. Try again.");
			continue;
		}

		return passphrase;
	}
};

// prompt the user to select an editor from SUPPORTED_EDITORS.
// handles the "other" option by prompting for a custom command.
export const promptEditorSelection = async (
	message = "Preferred editor:",
): Promise<string> => {
	const choices = SUPPORTED_EDITORS.map((e) => ({
		name: e.name,
		value: e.id,
	}));

	const { selectedEditor } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "selectedEditor",
			message,
			choices,
		},
	]);

	if (selectedEditor !== "other") {
		return selectedEditor;
	}

	const { customEditor } = await inquirer.prompt([
		{
			type: "input",
			name: "customEditor",
			message: "Enter editor command:",
		},
	]);
	return customEditor;
};

// check if --dry-run flag was passed to the CLI
export const isDryRun = (): boolean => {
	return program.opts().dryRun === true;
};
