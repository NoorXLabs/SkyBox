// src/commands/init.ts
import inquirer from "inquirer";
import { existsSync, mkdirSync } from "fs";
import { execa } from "execa";
import { configExists, loadConfig, saveConfig } from "../lib/config";
import {
	parseSSHConfig,
	findSSHKeys,
	testConnection,
	copyKey,
	runRemoteCommand,
	writeSSHConfigEntry,
} from "../lib/ssh";
import { isMutagenInstalled, downloadMutagen } from "../lib/download";
import { DEVBOX_HOME, PROJECTS_DIR, BIN_DIR } from "../lib/paths";
import {
	success,
	error,
	warn,
	info,
	header,
	spinner,
	printNextSteps,
} from "../lib/ui";
import { DEFAULT_IGNORE, type DevboxConfig } from "../types";

async function checkDependencies(): Promise<boolean> {
	header("Checking dependencies...");

	// Check Docker
	try {
		await execa("docker", ["--version"]);
		success("Docker installed");
	} catch {
		error("Docker not found");
		info("Install Docker: https://docs.docker.com/get-docker/");
		return false;
	}

	// Check Node (for devcontainer-cli later)
	try {
		await execa("node", ["--version"]);
		success("Node.js available");
	} catch {
		error("Node.js not found");
		info("Install Node.js: https://nodejs.org/");
		return false;
	}

	return true;
}

async function handleMutagen(): Promise<boolean> {
	if (isMutagenInstalled()) {
		success("Mutagen already installed");
		return true;
	}

	header("Installing mutagen...");
	const spin = spinner("Downloading mutagen...");

	const result = await downloadMutagen((msg) => {
		spin.text = msg;
	});

	if (result.success) {
		spin.succeed("Mutagen installed");
		return true;
	} else {
		spin.fail(`Failed to install mutagen: ${result.error}`);
		info(
			"Manual install: https://mutagen.io/documentation/introduction/installation",
		);
		return false;
	}
}

async function configureRemote(): Promise<{
	host: string;
	basePath: string;
} | null> {
	header("Configure remote server");

	const existingHosts = parseSSHConfig();
	const choices = [
		...existingHosts.map((h) => ({
			name: `${h.name}${h.hostname ? ` (${h.hostname})` : ""}`,
			value: h.name,
		})),
		{ name: "+ Add new server", value: "__new__" },
	];

	const { hostChoice } = await inquirer.prompt([
		{
			type: "list",
			name: "hostChoice",
			message: "Select SSH host:",
			choices,
		},
	]);

	let sshHost: string; // The host name for config (friendly name or existing host)
	let sshConnectString: string; // The actual connection string for SSH commands
	let identityFile: string | undefined; // SSH key path (for new servers with custom keys)

	if (hostChoice === "__new__") {
		const { hostname, username, friendlyName } = await inquirer.prompt([
			{ type: "input", name: "hostname", message: "Server hostname or IP:" },
			{
				type: "input",
				name: "username",
				message: "SSH username:",
				default: "root",
			},
			{
				type: "input",
				name: "friendlyName",
				message: "Friendly name for this host:",
			},
		]);

		sshHost = friendlyName;
		sshConnectString = `${username}@${hostname}`;

		// For new servers, ask about SSH key FIRST before testing connection
		const keys = findSSHKeys();
		const keyChoices = [
			...keys.map((k) => ({ name: k, value: k })),
			{ name: "+ Enter custom path", value: "__custom__" },
		];

		const { keyChoice } = await inquirer.prompt([
			{
				type: "list",
				name: "keyChoice",
				message: "Select SSH key to use:",
				choices: keyChoices,
			},
		]);

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
		} else {
			identityFile = keyChoice;
		}

		// Test connection with the specified key
		const spin = spinner("Testing SSH connection...");
		const connResult = await testConnection(sshConnectString, identityFile);

		if (connResult.success) {
			spin.succeed("SSH connection successful");

			// Write SSH config entry
			const writeResult = writeSSHConfigEntry({
				name: friendlyName,
				hostname,
				user: username,
				identityFile: identityFile!,
			});

			if (writeResult.success) {
				success(`Added "${friendlyName}" to ~/.ssh/config`);
			} else {
				warn(`Could not update SSH config: ${writeResult.error}`);
				info(`Add this to ~/.ssh/config manually:`);
				console.log(`
Host ${friendlyName}
  HostName ${hostname}
  User ${username}
  IdentityFile ${identityFile}
`);
			}
		} else {
			spin.fail("SSH connection failed - key may not be on server");

			const { copyKey: shouldCopy } = await inquirer.prompt([
				{
					type: "confirm",
					name: "copyKey",
					message: "Copy SSH key to server? (requires password)",
					default: true,
				},
			]);

			if (shouldCopy) {
				info("Running ssh-copy-id (enter your password when prompted)...");
				const copyResult = await copyKey(sshConnectString, identityFile!);

				if (copyResult.success) {
					success("SSH key installed");

					// Re-test connection with identity file
					const retestResult = await testConnection(
						sshConnectString,
						identityFile,
					);
					if (!retestResult.success) {
						error("Connection still failing after key setup");
						return null;
					}
					success("SSH connection now working");

					// Write SSH config entry
					const writeResult = writeSSHConfigEntry({
						name: friendlyName,
						hostname,
						user: username,
						identityFile: identityFile!,
					});

					if (writeResult.success) {
						success(`Added "${friendlyName}" to ~/.ssh/config`);
					} else {
						warn(`Could not update SSH config: ${writeResult.error}`);
						info(`Add this to ~/.ssh/config manually:`);
						console.log(`
Host ${friendlyName}
  HostName ${hostname}
  User ${username}
  IdentityFile ${identityFile}
`);
					}
				} else {
					error("Failed to install SSH key");
					info(
						`Manually copy your public key to the server's ~/.ssh/authorized_keys`,
					);
					return null;
				}
			} else {
				return null;
			}
		}
	} else {
		sshHost = hostChoice;
		sshConnectString = hostChoice;

		// For existing hosts, test connection first
		const spin = spinner("Testing SSH connection...");
		const connResult = await testConnection(sshConnectString);

		if (connResult.success) {
			spin.succeed("SSH connection successful");
		} else {
			spin.fail("SSH connection failed");
			error("Check your SSH config and try again");
			return null;
		}
	}

	// Configure remote path
	const { basePath } = await inquirer.prompt([
		{
			type: "input",
			name: "basePath",
			message: "Remote code directory:",
			default: "~/code",
		},
	]);

	// Check if directory exists
	const checkSpin = spinner("Checking remote directory...");
	const checkResult = await runRemoteCommand(
		sshConnectString,
		`ls -d ${basePath} 2>/dev/null || echo "__NOT_FOUND__"`,
		identityFile,
	);

	if (checkResult.stdout?.includes("__NOT_FOUND__")) {
		checkSpin.warn("Directory doesn't exist");
		const { createDir } = await inquirer.prompt([
			{
				type: "confirm",
				name: "createDir",
				message: `Create ${basePath} on remote?`,
				default: true,
			},
		]);

		if (createDir) {
			const mkdirResult = await runRemoteCommand(
				sshConnectString,
				`mkdir -p ${basePath}`,
				identityFile,
			);
			if (mkdirResult.success) {
				success("Created remote directory");
			} else {
				error(`Failed to create directory: ${mkdirResult.error}`);
				return null;
			}
		} else {
			return null;
		}
	} else {
		checkSpin.succeed("Remote directory exists");

		// List existing projects
		const lsResult = await runRemoteCommand(
			sshConnectString,
			`ls -1 ${basePath} 2>/dev/null | head -10`,
			identityFile,
		);
		if (lsResult.stdout?.trim()) {
			info("Existing projects on remote:");
			lsResult.stdout.split("\n").forEach((p) => console.log(`    ${p}`));
		}
	}

	return { host: sshHost, basePath };
}

async function configureEditor(): Promise<string> {
	header("Configure editor");

	const { editor } = await inquirer.prompt([
		{
			type: "list",
			name: "editor",
			message: "Preferred editor:",
			choices: [
				{ name: "Cursor", value: "cursor" },
				{ name: "VS Code", value: "code" },
				{ name: "Zed", value: "zed" },
				{ name: "Vim", value: "vim" },
				{ name: "Neovim", value: "nvim" },
				{ name: "Other", value: "__other__" },
			],
		},
	]);

	if (editor === "__other__") {
		const { customEditor } = await inquirer.prompt([
			{ type: "input", name: "customEditor", message: "Editor command:" },
		]);
		return customEditor;
	}

	return editor;
}

export async function initCommand(): Promise<void> {
	console.log();
	console.log("Welcome to devbox setup!");
	console.log();

	// Check for existing config
	if (configExists()) {
		const existingConfig = loadConfig();
		if (existingConfig) {
			header("Current Configuration");
			console.log(`  Remote Host:  ${existingConfig.remote.host}`);
			console.log(`  Base Path:    ${existingConfig.remote.base_path}`);
			console.log(`  Editor:       ${existingConfig.editor}`);
			const projectCount = Object.keys(existingConfig.projects).length;
			console.log(`  Projects:     ${projectCount} registered`);
			console.log();
		}

		const { reconfigure } = await inquirer.prompt([
			{
				type: "confirm",
				name: "reconfigure",
				message: "devbox is already configured. Reconfigure?",
				default: false,
			},
		]);

		if (!reconfigure) {
			info("Keeping existing configuration.");
			return;
		}
	}

	// Check dependencies
	const depsOk = await checkDependencies();
	if (!depsOk) {
		error("Please install missing dependencies and try again.");
		process.exit(1);
	}

	// Handle mutagen
	const mutagenOk = await handleMutagen();
	if (!mutagenOk) {
		const { continueAnyway } = await inquirer.prompt([
			{
				type: "confirm",
				name: "continueAnyway",
				message: "Continue without mutagen? (sync won't work)",
				default: false,
			},
		]);

		if (!continueAnyway) {
			return;
		}
	}

	// Configure remote
	const remote = await configureRemote();
	if (!remote) {
		error("Remote configuration failed.");
		process.exit(1);
	}

	// Configure editor
	const editor = await configureEditor();

	// Create directories
	header("Setting up devbox...");
	mkdirSync(PROJECTS_DIR, { recursive: true });
	mkdirSync(BIN_DIR, { recursive: true });
	success(`Created ${DEVBOX_HOME}`);

	// Save config
	const config: DevboxConfig = {
		remote: {
			host: remote.host,
			base_path: remote.basePath,
		},
		editor,
		defaults: {
			sync_mode: "two-way-resolved",
			ignore: DEFAULT_IGNORE,
		},
		projects: {},
	};

	saveConfig(config);
	success("Saved configuration");

	// Done!
	console.log();
	success("devbox is ready!");

	printNextSteps([
		`Push a local project: devbox push ./my-project`,
		`Clone from remote: devbox clone <project-name>`,
		`Browse remote projects: devbox browse`,
	]);
}
