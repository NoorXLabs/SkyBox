// src/lib/ui.ts
import chalk from "chalk";
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
