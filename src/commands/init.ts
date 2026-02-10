// src/commands/init.ts

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import { DEFAULT_IGNORE } from "@lib/constants.ts";
import { downloadMutagen, isMutagenInstalled } from "@lib/download.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { getBinDir, getProjectsDir, getSkyboxHome } from "@lib/paths.ts";
import { escapeRemotePath } from "@lib/shell.ts";
import {
	copyKey,
	ensureKeyInAgent,
	findSSHKeys,
	isKeyPassphraseProtected,
	parseSSHConfig,
	runRemoteCommand,
	testConnection,
	writeSSHConfigEntry,
} from "@lib/ssh.ts";
import {
	dryRun,
	error,
	header,
	info,
	isDryRun,
	printNextSteps,
	spinner,
	success,
	warn,
} from "@lib/ui.ts";
import { sshFieldValidator } from "@lib/validation.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";
import { execa } from "execa";
import inquirer from "inquirer";

// verify Docker and Node.js are installed
const checkDependencies = async (): Promise<boolean> => {
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
};

// check if Mutagen is installed and download it if not
const handleMutagen = async (): Promise<boolean> => {
	if (await isMutagenInstalled()) {
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
};

// write an SSH host entry and print fallback instructions when automatic write fails.
const persistSSHConfig = (
	name: string,
	hostname: string,
	user: string,
	identityFile: string | undefined,
): void => {
	const writeResult = writeSSHConfigEntry({
		name,
		hostname,
		user,
		identityFile: identityFile ?? "",
	});

	if (writeResult.success) {
		success(`Added "${name}" to ~/.ssh/config`);
		return;
	}

	warn(`Could not update SSH config: ${writeResult.error}`);
	info("Add this to ~/.ssh/config manually:");
	console.log(`
Host ${name}
  HostName ${hostname}
  User ${user}
  IdentityFile ${identityFile}
`);
};

// interactively configure a remote server via SSH host selection and path verification
const configureRemote = async (): Promise<{
	name: string;
	host: string;
	user?: string;
	basePath: string;
	key?: string;
	useKeychain?: boolean;
} | null> => {
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
			type: "rawlist",
			name: "hostChoice",
			message: "Select SSH host:",
			choices,
		},
	]);

	let remoteName: string; // The friendly name for the remote
	let remoteHostname: string; // The actual hostname or IP
	let remoteUser: string | undefined; // The SSH username (undefined = use SSH config default)
	let sshConnectString: string; // The actual connection string for SSH commands
	let identityFile: string | undefined; // SSH key path (undefined = use SSH config default)
	let useKeychain: boolean | undefined; // macOS Keychain persistence (set in new server flow)

	if (hostChoice === "__new__") {
		const { hostname, username, friendlyName } = await inquirer.prompt([
			{
				type: "input",
				name: "hostname",
				message: "Server hostname or IP:",
				validate: sshFieldValidator("Hostname"),
			},
			{
				type: "input",
				name: "username",
				message: "SSH username:",
				default: "root",
				validate: sshFieldValidator("Username"),
			},
			{
				type: "input",
				name: "friendlyName",
				message: "Friendly name for this host:",
				validate: sshFieldValidator("Name"),
			},
		]);

		remoteName = friendlyName;
		remoteHostname = hostname;
		remoteUser = username;
		sshConnectString = `${username}@${hostname}`;

		// For new servers, ask about SSH key FIRST before testing connection
		const keys = findSSHKeys();
		const keyChoices = [
			...keys.map((k) => ({ name: k, value: k })),
			{ name: "+ Enter custom path", value: "__custom__" },
		];

		const { keyChoice } = await inquirer.prompt([
			{
				type: "rawlist",
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
					validate: sshFieldValidator("Key path"),
				},
			]);
			identityFile = customPath.replace(/^~/, homedir());
		} else {
			identityFile = keyChoice as string;
		}

		// If key is passphrase-protected, load it into the agent before testing
		if (identityFile) {
			// Check once — reuse for Keychain prompt and Linux info below
			const keyIsProtected = await isKeyPassphraseProtected(identityFile);

			if (keyIsProtected) {
				// On macOS, ask about Keychain persistence before loading the key
				// so we can pass the flag to ensureKeyInAgent and avoid a double prompt
				let wantsKeychain = false;
				if (process.platform === "darwin") {
					const { saveToKeychain } = await inquirer.prompt([
						{
							type: "confirm",
							name: "saveToKeychain",
							message:
								"Save passphrase to macOS Keychain? (won't need to enter it again after reboot)",
							default: true,
						},
					]);
					wantsKeychain = saveToKeychain;
				}

				const keyReady = await ensureKeyInAgent(
					identityFile,
					wantsKeychain || undefined,
				);
				if (!keyReady) {
					error("Could not load SSH key into agent.");
					info("Run 'ssh-add <keypath>' manually or check your key.");
					return null;
				}

				if (wantsKeychain) {
					useKeychain = true;
				} else if (process.platform !== "darwin") {
					info(
						"Passphrase loaded for this session. You'll need to enter it again after reboot.",
					);
				}
			}
		}

		// Test connection with the specified key (now succeeds because key is in agent)
		const spin = spinner("Testing SSH connection...");
		const connResult = await testConnection(
			sshConnectString,
			identityFile ?? undefined,
		);

		if (connResult.success) {
			spin.succeed("SSH connection successful");
			persistSSHConfig(friendlyName, hostname, username, identityFile);
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
				const copyResult = await copyKey(sshConnectString, identityFile ?? "");

				if (copyResult.success) {
					success("SSH key installed");

					// Re-test connection with identity file
					const retestResult = await testConnection(
						sshConnectString,
						identityFile ?? undefined,
					);
					if (!retestResult.success) {
						error("Connection still failing after key setup");
						return null;
					}
					success("SSH connection now working");
					persistSSHConfig(friendlyName, hostname, username, identityFile);
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
		// For existing SSH config hosts, use the host name for all fields
		// The SSH config will handle the actual connection details
		remoteName = hostChoice;
		remoteHostname = hostChoice;
		remoteUser = undefined; // Will use SSH config's default
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
		`ls -d ${escapeRemotePath(basePath)} 2>/dev/null || echo "__NOT_FOUND__"`,
		identityFile ?? undefined,
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
				`mkdir -p ${escapeRemotePath(basePath)}`,
				identityFile ?? undefined,
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
			`ls -1 ${escapeRemotePath(basePath)} 2>/dev/null | head -10`,
			identityFile ?? undefined,
		);
		if (lsResult.stdout?.trim()) {
			info("Existing projects on remote:");
			lsResult.stdout.split("\n").forEach((p) => {
				console.log(`    ${p}`);
			});
		}
	}

	return {
		name: remoteName,
		host: remoteHostname,
		user: remoteUser,
		basePath,
		key: identityFile,
		useKeychain,
	};
};

// prompt user to select a preferred editor
const configureEditor = async (): Promise<string> => {
	header("Configure editor");

	const { editor } = await inquirer.prompt([
		{
			type: "rawlist",
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
};

// run the first-time SkyBox setup wizard
export const initCommand = async (): Promise<void> => {
	console.log();
	console.log("Welcome to skybox setup!");
	console.log();

	// Check for existing config
	if (configExists()) {
		const existingConfig = loadConfig();
		if (existingConfig) {
			header("Current Configuration");
			const remoteCount = Object.keys(existingConfig.remotes).length;
			console.log(`  Remotes:      ${remoteCount} configured`);
			for (const [name, remote] of Object.entries(existingConfig.remotes)) {
				const userPart = remote.user ? `${remote.user}@` : "";
				console.log(`                - ${name} (${userPart}${remote.host})`);
			}
			console.log(`  Editor:       ${existingConfig.editor}`);
			const projectCount = Object.keys(existingConfig.projects).length;
			console.log(`  Projects:     ${projectCount} registered`);
			console.log();
		}

		const { reconfigure } = await inquirer.prompt([
			{
				type: "confirm",
				name: "reconfigure",
				message: "skybox is already configured. Reconfigure?",
				default: false,
			},
		]);

		if (!reconfigure) {
			info("Keeping existing configuration.");
			return;
		}
	}

	if (isDryRun()) {
		dryRun("Would check dependencies (Docker, Node.js)");
		dryRun("Would download/install Mutagen binary");
		dryRun("Would configure remote server via SSH");
		dryRun("Would configure editor preference");
		dryRun(`Would create directories: ${getSkyboxHome()}`);
		dryRun("Would save config.yaml");
		return;
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

	// Ask about default encryption
	const { confirm: confirmPrompt } = await import("@inquirer/prompts");
	const enableDefaultEncryption = await confirmPrompt({
		message: "Enable encryption for new projects by default?",
		default: false,
	});

	// Create directories with secure permissions (owner-only access)
	header("Setting up skybox...");
	try {
		mkdirSync(getProjectsDir(), { recursive: true, mode: 0o700 });
		mkdirSync(getBinDir(), { recursive: true, mode: 0o700 });
	} catch (err) {
		error(`Failed to create skybox directories: ${getErrorMessage(err)}`);
		process.exit(1);
	}
	success(`Created ${getSkyboxHome()}`);

	// Save config
	const config: SkyboxConfigV2 = {
		editor,
		defaults: {
			sync_mode: "two-way-resolved",
			ignore: DEFAULT_IGNORE,
			...(enableDefaultEncryption && { encryption: true }),
		},
		remotes: {
			[remote.name]: {
				host: remote.host,
				user: remote.user,
				path: remote.basePath,
				key: remote.key,
				...(remote.useKeychain && { useKeychain: true }),
			},
		},
		projects: {},
	};

	saveConfig(config);
	success("Saved configuration");

	// Done!
	console.log();
	success("skybox is ready!");

	printNextSteps([
		`Push a local project: skybox push ./my-project`,
		`Clone from remote: skybox clone <project-name>`,
		`Browse remote projects: skybox browse`,
	]);
};
