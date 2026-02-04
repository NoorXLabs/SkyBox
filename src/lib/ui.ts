/** Terminal UI helpers: colored output, spinners, headers. */
import chalk from "chalk";
import inquirer from "inquirer";
import ora, { type Ora } from "ora";

export function success(message: string): void {
	console.log(chalk.green("  ✓"), message);
}

export function error(message: string): void {
	console.log(chalk.red("  ✗"), message);
}

export function warn(message: string): void {
	console.log(chalk.yellow("  !"), message);
}

export function info(message: string): void {
	console.log(chalk.blue("  ℹ"), message);
}

export function dryRun(message: string): void {
	console.log(chalk.dim("  ⏭"), chalk.dim(`[dry-run] ${message}`));
}

export function header(message: string): void {
	console.log();
	console.log(chalk.bold(message));
}

export function spinner(message: string): Ora {
	// discardStdin: false prevents conflicts with inquirer prompts
	// See: https://github.com/sindresorhus/ora/issues/134
	return ora({ text: message, prefixText: " ", discardStdin: false }).start();
}

export function printNextSteps(steps: string[]): void {
	console.log();
	console.log(chalk.bold("Next steps:"));
	steps.forEach((step, i) => {
		console.log(chalk.dim(`  ${i + 1}.`), step);
	});
	console.log();
}

/**
 * Prompt for double confirmation before a destructive action.
 * Returns true if user confirms both prompts, false otherwise.
 */
export async function confirmDestructiveAction(options: {
	firstPrompt: string;
	secondPrompt: string;
	cancelMessage?: string;
}): Promise<boolean> {
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
}
