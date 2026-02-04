// src/commands/remote.ts

import { loadConfig, saveConfig } from "@lib/config.ts";
import { escapeShellArg } from "@lib/shell.ts";
import {
	copyKey,
	findSSHKeys,
	runRemoteCommand,
	testConnection,
} from "@lib/ssh.ts";
import {
	dryRun,
	error,
	header,
	info,
	isDryRun,
	spinner,
	success,
	warn,
} from "@lib/ui.ts";
import type { DevboxConfigV2, RemoteEntry } from "@typedefs/index.ts";
import chalk from "chalk";
import inquirer from "inquirer";

/**
 * Prompt user to select a remote from configured remotes.
 * If only one remote exists, returns it automatically.
 */
export async function selectRemote(
	config?: DevboxConfigV2 | null,
): Promise<string> {
	const cfg = config ?? loadConfig();
	if (!cfg) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const remotes = Object.keys(cfg.remotes);
	if (remotes.length === 0) {
		error("No remotes configured. Run 'devbox remote add' first.");
		process.exit(1);
	}

	if (remotes.length === 1) {
		return remotes[0];
	}

	const { selected } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "selected",
			message: "Select remote:",
			choices: remotes.map((name) => {
				const r = cfg.remotes[name];
				const userPart = r.user ? `${r.user}@` : "";
				return { name: `${name} (${userPart}${r.host})`, value: name };
			}),
		},
	]);

	return selected;
}

/**
 * Get the remote associated with a project.
 * Returns null if project not found or remote not configured.
 */
export function getProjectRemote(
	projectName: string,
	config?: DevboxConfigV2 | null,
): { name: string; remote: RemoteEntry } | null {
	const cfg = config ?? loadConfig();
	if (!cfg) return null;

	const project = cfg.projects[projectName];
	if (!project?.remote) return null;

	const remote = cfg.remotes[project.remote];
	if (!remote) return null;

	return { name: project.remote, remote };
}

/**
 * Build SSH connection string from remote entry.
 * Returns "user@host" or just "host" if no user specified.
 */
export function getRemoteHost(remote: RemoteEntry): string {
	return remote.user ? `${remote.user}@${remote.host}` : remote.host;
}

/**
 * Build remote path for a project on a given remote.
 */
export function getRemotePath(
	remote: RemoteEntry,
	projectName: string,
): string {
	return `${remote.path}/${projectName}`;
}

/**
 * Parse a remote string in "user@host:path" format
 */
export function parseRemoteString(
	str: string,
): { user: string; host: string; path: string } | null {
	const match = str.match(/^([^@]+)@([^:]+):(.+)$/);
	if (!match) return null;
	return { user: match[1], host: match[2], path: match[3] };
}

/**
 * Add a remote directly without interaction (for CLI direct mode)
 */
export async function addRemoteDirect(
	name: string,
	remoteStr: string,
	options?: { key?: string },
): Promise<{ success: boolean; error?: string }> {
	const parsed = parseRemoteString(remoteStr);
	if (!parsed) {
		return {
			success: false,
			error:
				'Invalid remote format. Expected "user@host:path" (e.g., "root@192.168.1.100:~/code")',
		};
	}

	let config = loadConfig();
	if (!config) {
		// Create default config if none exists
		config = {
			editor: "cursor",
			defaults: {
				sync_mode: "two-way-resolved",
				ignore: [],
			},
			remotes: {},
			projects: {},
		};
	}

	// Check for duplicate name
	if (config.remotes[name]) {
		return {
			success: false,
			error: `Remote "${name}" already exists`,
		};
	}

	if (isDryRun()) {
		dryRun(
			`Would add remote '${name}' (${parsed.user}@${parsed.host}:${parsed.path})`,
		);
		return { success: true };
	}

	// Add the new remote
	const newRemote: RemoteEntry = {
		host: parsed.host,
		user: parsed.user,
		path: parsed.path,
		key: options?.key,
	};

	config.remotes[name] = newRemote;
	saveConfig(config);

	return { success: true };
}

/**
 * Interactive wizard for adding a remote
 */
export async function addRemoteInteractive(): Promise<void> {
	header("Add new remote");

	if (isDryRun()) {
		dryRun("Would prompt for remote connection details");
		dryRun("Would test SSH connection");
		dryRun("Would save remote to config");
		return;
	}

	// Prompt for remote name
	const { name } = await inquirer.prompt([
		{
			type: "input",
			name: "name",
			message: "Remote name:",
			validate: (input: string) => {
				if (!input.trim()) return "Name is required";
				const config = loadConfig();
				if (config?.remotes[input]) {
					return `Remote "${input}" already exists`;
				}
				return true;
			},
		},
	]);

	// Prompt for connection details
	const { host, user, path } = await inquirer.prompt([
		{
			type: "input",
			name: "host",
			message: "Server hostname or IP:",
			validate: (input: string) => (input.trim() ? true : "Host is required"),
		},
		{
			type: "input",
			name: "user",
			message: "SSH username:",
			default: "root",
		},
		{
			type: "input",
			name: "path",
			message: "Remote projects directory:",
			default: "~/code",
		},
	]);

	// Show SSH key picker
	const keys = findSSHKeys();
	const keyChoices = [
		{ name: "+ Enter custom path...", value: "__custom__" },
		{ name: "(Use SSH config default)", value: "__none__" },
		...keys.map((k) => ({ name: k, value: k })),
	];

	const { keyChoice } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "keyChoice",
			message: "Select SSH key:",
			choices: keyChoices,
		},
	]);

	let identityFile: string | undefined;
	if (keyChoice === "__custom__") {
		const { customPath } = await inquirer.prompt([
			{
				type: "input",
				name: "customPath",
				message: "Path to SSH private key:",
				default: "~/.ssh/id_ed25519",
			},
		]);
		identityFile = customPath.replace(/^~/, process.env.HOME || "");
	} else if (keyChoice !== "__none__") {
		identityFile = keyChoice;
	}

	// Test connection
	const sshConnectString = `${user}@${host}`;
	const spin = spinner("Testing SSH connection...");
	const connResult = await testConnection(sshConnectString, identityFile);

	if (connResult.success) {
		spin.succeed("SSH connection successful");
	} else {
		spin.fail("SSH connection failed");

		const { shouldCopyKey } = await inquirer.prompt([
			{
				type: "confirm",
				name: "shouldCopyKey",
				message: "Copy SSH key to server? (requires password)",
				default: true,
			},
		]);

		if (shouldCopyKey) {
			const keyToCopy = identityFile ?? findSSHKeys()[0];
			if (!keyToCopy) {
				error("No SSH key found to copy");
				return;
			}

			info("Running ssh-copy-id (enter your password when prompted)...");
			const copyResult = await copyKey(sshConnectString, keyToCopy);

			if (copyResult.success) {
				success("SSH key installed");

				// Re-test connection
				const retestResult = await testConnection(
					sshConnectString,
					identityFile,
				);
				if (!retestResult.success) {
					error("Connection still failing after key setup");
					return;
				}
				success("SSH connection now working");
			} else {
				error("Failed to install SSH key");
				info(
					"Manually copy your public key to the server's ~/.ssh/authorized_keys",
				);
				return;
			}
		} else {
			return;
		}
	}

	// Check/create remote directory
	const checkSpin = spinner("Checking remote directory...");
	const checkResult = await runRemoteCommand(
		sshConnectString,
		`ls -d ${escapeShellArg(path)} 2>/dev/null || echo "__NOT_FOUND__"`,
		identityFile,
	);

	if (checkResult.stdout?.includes("__NOT_FOUND__")) {
		checkSpin.warn("Directory doesn't exist");
		const { createDir } = await inquirer.prompt([
			{
				type: "confirm",
				name: "createDir",
				message: `Create ${path} on remote?`,
				default: true,
			},
		]);

		if (createDir) {
			const mkdirResult = await runRemoteCommand(
				sshConnectString,
				`mkdir -p ${escapeShellArg(path)}`,
				identityFile,
			);
			if (mkdirResult.success) {
				success("Created remote directory");
			} else {
				error(`Failed to create directory: ${mkdirResult.error}`);
				return;
			}
		} else {
			warn("Skipping directory creation");
		}
	} else {
		checkSpin.succeed("Remote directory exists");
	}

	// Save remote
	let config = loadConfig();
	if (!config) {
		config = {
			editor: "cursor",
			defaults: {
				sync_mode: "two-way-resolved",
				ignore: [],
			},
			remotes: {},
			projects: {},
		};
	}

	const newRemote: RemoteEntry = {
		host,
		user,
		path,
		key: identityFile,
	};

	config.remotes[name] = newRemote;
	saveConfig(config);

	success(`Remote "${name}" added`);
}

/**
 * Display all configured remotes
 */
export function listRemotes(): void {
	const config = loadConfig();

	if (!config?.remotes || Object.keys(config.remotes).length === 0) {
		info("No remotes configured");
		info("Run: devbox remote add <name> <user@host:path>");
		return;
	}

	console.log();
	for (const [name, remote] of Object.entries(config.remotes)) {
		const userPart = remote.user ? `${remote.user}@` : "";
		console.log(
			`  ${chalk.bold(name)}  ${chalk.dim(`${userPart}${remote.host}:${remote.path}`)}`,
		);
	}
	console.log();
}

/**
 * Remove a remote
 */
export async function removeRemote(name: string): Promise<void> {
	const config = loadConfig();

	if (!config) {
		error("No configuration found");
		return;
	}

	if (!config.remotes[name]) {
		error(`Remote "${name}" not found`);
		return;
	}

	if (isDryRun()) {
		dryRun(`Would remove remote '${name}' from config`);
		return;
	}

	// Check if any projects use this remote
	const projectsUsingRemote = Object.entries(config.projects)
		.filter(([_, project]) => project.remote === name)
		.map(([projectName]) => projectName);

	if (projectsUsingRemote.length > 0) {
		warn(`The following projects use this remote:`);
		for (const project of projectsUsingRemote) {
			console.log(`    ${project}`);
		}

		const { confirmRemove } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirmRemove",
				message: "Remove remote anyway? (projects will need to be reassigned)",
				default: false,
			},
		]);

		if (!confirmRemove) {
			info("Remote not removed");
			return;
		}
	}

	delete config.remotes[name];
	saveConfig(config);

	success(`Remote "${name}" removed`);
}

/**
 * Rename a remote and update project references
 */
export async function renameRemote(
	oldName: string,
	newName: string,
): Promise<void> {
	const config = loadConfig();

	if (!config) {
		error("No configuration found");
		return;
	}

	if (!config.remotes[oldName]) {
		error(`Remote "${oldName}" not found`);
		return;
	}

	if (config.remotes[newName]) {
		error(`Remote "${newName}" already exists`);
		return;
	}

	if (isDryRun()) {
		dryRun(`Would rename remote '${oldName}' to '${newName}'`);
		return;
	}

	// Move remote entry
	config.remotes[newName] = config.remotes[oldName];
	delete config.remotes[oldName];

	// Update all project references
	let updatedProjects = 0;
	for (const [projectName, project] of Object.entries(config.projects)) {
		if (project.remote === oldName) {
			config.projects[projectName].remote = newName;
			updatedProjects++;
		}
	}

	saveConfig(config);

	success(`Remote "${oldName}" renamed to "${newName}"`);
	if (updatedProjects > 0) {
		info(`Updated ${updatedProjects} project reference(s)`);
	}
}

/**
 * Show help for the remote command
 */
function showHelp(): void {
	console.log();
	console.log(`${chalk.bold("Usage:")} devbox remote <subcommand> [options]`);
	console.log();
	console.log(chalk.bold("Subcommands:"));
	console.log(
		"  add [name] [user@host:path]  Add a new remote (interactive if no args)",
	);
	console.log("  list                         List all configured remotes");
	console.log("  remove <name>                Remove a remote");
	console.log("  rename <old> <new>           Rename a remote");
	console.log();
	console.log(chalk.bold("Examples:"));
	console.log(
		"  devbox remote add                             # Interactive wizard",
	);
	console.log("  devbox remote add myserver root@192.168.1.100:~/code");
	console.log(
		"  devbox remote add myserver root@host:~/code --key ~/.ssh/id_ed25519",
	);
	console.log("  devbox remote list");
	console.log("  devbox remote remove myserver");
	console.log("  devbox remote rename myserver production");
	console.log();
}

/**
 * Main handler for remote subcommands
 */
export async function remoteCommand(
	subcommand?: string,
	arg1?: string,
	arg2?: string,
	options?: { key?: string },
): Promise<void> {
	switch (subcommand) {
		case "add":
			if (arg1 && arg2) {
				// Direct mode: devbox remote add <name> <user@host:path>
				const result = await addRemoteDirect(arg1, arg2, options);
				if (result.success) {
					success(`Remote "${arg1}" added`);
				} else {
					error(result.error ?? "Failed to add remote");
				}
			} else if (arg1 && !arg2) {
				// Missing path
				error(
					"Missing remote path. Expected: devbox remote add <name> <user@host:path>",
				);
			} else {
				// Interactive mode
				await addRemoteInteractive();
			}
			break;

		case "list":
			listRemotes();
			break;

		case "remove":
			if (!arg1) {
				error("Missing remote name. Usage: devbox remote remove <name>");
				return;
			}
			await removeRemote(arg1);
			break;

		case "rename":
			if (!arg1 || !arg2) {
				error("Missing arguments. Usage: devbox remote rename <old> <new>");
				return;
			}
			await renameRemote(arg1, arg2);
			break;

		default:
			showHelp();
			break;
	}
}
