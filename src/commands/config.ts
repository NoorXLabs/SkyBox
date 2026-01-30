// src/commands/config.ts

import chalk from "chalk";
import { loadConfig, saveConfig } from "../lib/config.ts";
import { testConnection } from "../lib/ssh.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";
import { validatePath } from "../lib/validation.ts";
import {
	devcontainerEditCommand,
	devcontainerResetCommand,
} from "./config-devcontainer.ts";

/**
 * Display all configuration settings including remotes
 */
export async function showConfig(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	console.log();
	header("Remotes:");
	console.log();

	const remotes = Object.entries(config.remotes);
	if (remotes.length === 0) {
		info("  No remotes configured");
	} else {
		for (const [name, remote] of remotes) {
			const userPart = remote.user ? `${remote.user}@` : "";
			console.log(
				`  ${chalk.bold(name)}  ${userPart}${remote.host}:${remote.path}`,
			);
		}
	}

	console.log();
	header("Settings:");
	console.log();
	console.log(`  editor: ${config.editor}`);
	console.log();
}

/**
 * Test SSH connection to all configured remotes and show project counts
 */
export async function validateConfig(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	console.log();
	header("Testing remotes...");
	console.log();

	const remotes = Object.entries(config.remotes);
	if (remotes.length === 0) {
		info("No remotes configured.");
		return;
	}

	// Count projects per remote
	const projectCounts: Record<string, number> = {};
	for (const project of Object.values(config.projects)) {
		if (project.remote) {
			projectCounts[project.remote] = (projectCounts[project.remote] || 0) + 1;
		}
	}

	let allPassed = true;
	for (const [name, remote] of remotes) {
		const spin = spinner(`Testing ${name}...`);
		const connectString = remote.user
			? `${remote.user}@${remote.host}`
			: remote.host;
		const result = await testConnection(connectString, remote.key ?? undefined);
		const projectCount = projectCounts[name] || 0;

		if (result.success) {
			spin.succeed(
				`${chalk.green("\u2713")} ${name} - connected (${projectCount} project${projectCount !== 1 ? "s" : ""})`,
			);
		} else {
			spin.fail(`${chalk.red("\u2717")} ${name} - failed`);
			allPassed = false;
		}
	}

	console.log();
	if (allPassed) {
		success("All remotes connected successfully.");
	} else {
		error("Some remotes failed to connect.");
	}
}

/**
 * Set a global configuration value
 */
export async function setConfigValue(
	key: string,
	value: string,
): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	// Currently only 'editor' is supported as a settable config value
	const allowedKeys = ["editor"];

	if (!allowedKeys.includes(key)) {
		error(`Unknown config key: ${key}`);
		info(`Allowed keys: ${allowedKeys.join(", ")}`);
		return;
	}

	if (key === "editor") {
		config.editor = value;
		saveConfig(config);
		success(`Set editor to "${value}"`);
	}
}

/**
 * Show help for the config command
 */
function showHelp(): void {
	console.log();
	console.log(`${chalk.bold("Usage:")} devbox config [subcommand] [options]`);
	console.log();
	console.log(chalk.bold("Subcommands:"));
	console.log("  (none)                       Show current configuration");
	console.log("  set <key> <value>            Set a configuration value");
	console.log(
		"  sync-paths <project> [paths] Show or set selective sync paths",
	);
	console.log(
		"  devcontainer edit <project>  Edit devcontainer.json in editor",
	);
	console.log(
		"  devcontainer reset <project> Reset devcontainer.json from template",
	);
	console.log();
	console.log(chalk.bold("Options:"));
	console.log(
		"  --validate                   Test SSH connection to all remotes",
	);
	console.log();
	console.log(chalk.bold("Settable keys:"));
	console.log(
		"  editor                       Default editor (cursor, code, etc.)",
	);
	console.log();
	console.log(chalk.bold("Examples:"));
	console.log("  devbox config                # Show current configuration");
	console.log("  devbox config --validate     # Test all remote connections");
	console.log("  devbox config set editor vim # Change default editor");
	console.log();
}

/**
 * Main handler for config command
 */
export interface ConfigOptions {
	validate?: boolean;
}

export async function configCommand(
	options: ConfigOptions,
	subcommand?: string,
	arg1?: string,
	arg2?: string,
): Promise<void> {
	if (options.validate) {
		await validateConfig();
		return;
	}

	if (subcommand === "devcontainer") {
		if (arg1 === "edit") {
			if (!arg2) {
				error(
					"Missing project name. Usage: devbox config devcontainer edit <project>",
				);
				return;
			}
			await devcontainerEditCommand(arg2);
			return;
		}
		if (arg1 === "reset") {
			if (!arg2) {
				error(
					"Missing project name. Usage: devbox config devcontainer reset <project>",
				);
				return;
			}
			await devcontainerResetCommand(arg2);
			return;
		}
		error(`Unknown devcontainer action: ${arg1 || "(none)"}`);
		info("Available actions: edit, reset");
		return;
	}

	if (subcommand === "sync-paths") {
		const config = loadConfig();
		if (!config) {
			error("devbox not configured. Run 'devbox init' first.");
			process.exit(1);
		}

		if (!arg1) {
			error(
				"Missing project name. Usage: devbox config sync-paths <project> [path1,path2,...]",
			);
			return;
		}

		const projectConfig = config.projects[arg1];
		if (!projectConfig) {
			error(`Project '${arg1}' not found in config.`);
			return;
		}

		if (!arg2) {
			// Show current sync paths
			const paths = projectConfig.sync_paths;
			if (paths && paths.length > 0) {
				info(`Sync paths for '${arg1}':`);
				for (const p of paths) {
					console.log(`  ${p}`);
				}
			} else {
				info(`No sync paths configured for '${arg1}' (syncs entire project).`);
			}
			return;
		}

		// Set sync paths
		const paths = arg2
			.split(",")
			.map((p) => p.trim())
			.filter(Boolean);

		// Validate each path before saving
		for (const p of paths) {
			const check = validatePath(p);
			if (!check.valid) {
				error(`Invalid sync path "${p}": ${check.error}`);
				return;
			}
		}

		if (paths.length === 0) {
			projectConfig.sync_paths = undefined;
			saveConfig(config);
			success(`Cleared sync paths for '${arg1}'. Will sync entire project.`);
		} else {
			projectConfig.sync_paths = paths;
			saveConfig(config);
			success(`Set sync paths for '${arg1}': ${paths.join(", ")}`);
		}
		return;
	}

	if (subcommand === "set") {
		if (!arg1 || !arg2) {
			error("Missing arguments. Usage: devbox config set <key> <value>");
			return;
		}
		await setConfigValue(arg1, arg2);
		return;
	}

	if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
		showHelp();
		return;
	}

	if (subcommand) {
		error(`Unknown subcommand: ${subcommand}`);
		showHelp();
		return;
	}

	await showConfig();
}
