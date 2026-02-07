/** Terminal UI helpers: colored output, spinners, headers. */
import chalk from "chalk";
import { program } from "commander";
import inquirer from "inquirer";
import ora, { type Ora } from "ora";

export const success = (message: string): void => {
	console.log(chalk.green("  ✓"), message);
};

export const error = (message: string): void => {
	console.log(chalk.red("  ✗"), message);
};

export const warn = (message: string): void => {
	console.log(chalk.yellow("  !"), message);
};

export const info = (message: string): void => {
	console.log(chalk.blue("  ℹ"), message);
};

export const dryRun = (message: string): void => {
	console.log(chalk.dim("  ⏭"), chalk.dim(`[dry-run] ${message}`));
};

export const header = (message: string): void => {
	console.log();
	console.log(chalk.bold(message));
};

export const spinner = (message: string): Ora => {
	// discardStdin: false prevents conflicts with inquirer prompts
	// See: https://github.com/sindresorhus/ora/issues/134
	return ora({ text: message, prefixText: " ", discardStdin: false }).start();
};

export const printNextSteps = (steps: string[]): void => {
	console.log();
	console.log(chalk.bold("Next steps:"));
	steps.forEach((step, i) => {
		console.log(chalk.dim(`  ${i + 1}.`), step);
	});
	console.log();
};

/**
 * Prompt for double confirmation before a destructive action.
 * Returns true if user confirms both prompts, false otherwise.
 */
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

export const isDryRun = (): boolean => {
	return program.opts().dryRun === true;
};
