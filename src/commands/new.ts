// src/commands/new.ts
import { select } from "@inquirer/prompts";
import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	WORKSPACE_PATH_PREFIX,
} from "../lib/constants.ts";
import { validateProjectName } from "../lib/projectTemplates.ts";
import { escapeShellArg } from "../lib/shell.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { selectTemplate } from "../lib/templates.ts";
import { error, header, info, spinner, success, warn } from "../lib/ui.ts";
import type { DevcontainerConfig, RemoteEntry } from "../types/index.ts";
import { getRemoteHost, selectRemote } from "./remote.ts";

const MAX_NAME_ATTEMPTS = 5;

export async function newCommand(): Promise<void> {
	// Check config exists
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	header("Create a new project");

	// Select which remote to create the project on
	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);

	// Step 1: Get project name (with retry loop for existing names)
	let projectName: string;
	let nameAttempts = 0;

	while (true) {
		const { name } = await inquirer.prompt([
			{
				type: "input",
				name: "name",
				message: "Project name:",
				validate: (input: string) => {
					const result = validateProjectName(input);
					return result.valid ? true : result.error || "Invalid name";
				},
			},
		]);
		projectName = name;

		// Step 2: Check if project exists on remote
		const checkSpin = spinner("Checking remote...");
		const checkResult = await runRemoteCommand(
			host,
			`test -d ${escapeShellArg(`${remote.path}/${projectName}`)} && echo "EXISTS" || echo "NOT_FOUND"`,
		);

		if (checkResult.stdout?.includes("EXISTS")) {
			checkSpin.fail("Project already exists");
			nameAttempts++;

			if (nameAttempts >= MAX_NAME_ATTEMPTS) {
				error("Too many attempts. Please try again later.");
				process.exit(1);
			}

			info(
				`A project named '${projectName}' already exists. Please choose a different name.`,
			);
			continue;
		}

		checkSpin.succeed("Name available");
		break;
	}

	// Step 3: Select template using unified selector
	const selection = await selectTemplate();
	if (!selection) {
		return;
	}

	if (selection.source === "git") {
		// Git URL: clone the repo to remote
		await cloneGitToRemote(remote, projectName, selection.url);
	} else {
		// Built-in or user template: create empty project with devcontainer config
		await createProjectWithConfig(remote, projectName, selection.config);
	}

	// Prompt for encryption if default is enabled
	if (config.defaults.encryption) {
		const { confirm: confirmPrompt, password: passwordPrompt } = await import(
			"@inquirer/prompts"
		);
		const { randomBytes } = await import("node:crypto");

		const enableEnc = await confirmPrompt({
			message: "Enable encryption for this project?",
			default: true,
		});

		if (enableEnc) {
			warn(
				"Your passphrase is NEVER stored. If you forget it, your encrypted data CANNOT be recovered.",
			);

			const understood = await confirmPrompt({
				message: "I understand the risks",
				default: false,
			});

			if (understood) {
				const passphrase = await passwordPrompt({
					message: "Enter encryption passphrase:",
				});

				if (passphrase) {
					const salt = randomBytes(16).toString("hex");
					const currentConfig = loadConfig();
					if (currentConfig) {
						if (!currentConfig.projects[projectName]) {
							currentConfig.projects[projectName] = { remote: remoteName };
						}
						currentConfig.projects[projectName].encryption = {
							enabled: true,
							salt,
						};
						saveConfig(currentConfig);
						success("Encryption enabled for this project.");
					}
				}
			}
		}
	}

	await offerClone(projectName);
}

async function createProjectWithConfig(
	remote: RemoteEntry,
	projectName: string,
	devcontainerConfig: DevcontainerConfig,
): Promise<void> {
	const host = getRemoteHost(remote);
	const remotePath = `${remote.path}/${projectName}`;

	const createSpin = spinner("Creating project on remote...");

	// Add workspace settings to the config
	const config = {
		...devcontainerConfig,
		workspaceFolder: `${WORKSPACE_PATH_PREFIX}/${projectName}`,
		workspaceMount: `source=\${localWorkspaceFolder},target=${WORKSPACE_PATH_PREFIX}/${projectName},type=bind,consistency=cached`,
	};

	const devcontainerJson = JSON.stringify(config, null, 2);
	const encoded = Buffer.from(devcontainerJson).toString("base64");

	const createCmd = `mkdir -p ${escapeShellArg(`${remotePath}/${DEVCONTAINER_DIR_NAME}`)} && echo ${escapeShellArg(encoded)} | base64 -d > ${escapeShellArg(`${remotePath}/${DEVCONTAINER_DIR_NAME}/${DEVCONTAINER_CONFIG_NAME}`)}`;

	const createResult = await runRemoteCommand(host, createCmd);

	if (!createResult.success) {
		createSpin.fail("Failed to create project");
		error(createResult.error || "Unknown error");
		process.exit(1);
	}

	// Initialize git repo
	const gitResult = await runRemoteCommand(
		host,
		`cd ${escapeShellArg(remotePath)} && git init`,
	);

	if (!gitResult.success) {
		createSpin.warn("Project created but git init failed");
	} else {
		createSpin.succeed("Project created on remote");
	}
}

async function cloneGitToRemote(
	remote: RemoteEntry,
	projectName: string,
	templateUrl: string,
): Promise<void> {
	const host = getRemoteHost(remote);
	const remotePath = `${remote.path}/${projectName}`;

	// Ask about git history
	const historyChoice = await select({
		message: "Git history:",
		choices: [
			{ name: "Start fresh (recommended)", value: "fresh" },
			{ name: "Keep original history", value: "keep" },
		],
	});
	const keepHistory = historyChoice === "keep";

	const cloneSpin = spinner("Cloning template to remote...");

	const tempPath = `/tmp/devbox-template-${Date.now()}`;

	let cloneCmd: string;
	if (keepHistory) {
		cloneCmd = `git clone ${escapeShellArg(templateUrl)} ${escapeShellArg(tempPath)} && mv ${escapeShellArg(tempPath)} ${escapeShellArg(remotePath)}`;
	} else {
		cloneCmd = `git clone ${escapeShellArg(templateUrl)} ${escapeShellArg(tempPath)} && rm -rf ${escapeShellArg(`${tempPath}/.git`)} && git -C ${escapeShellArg(tempPath)} init && mv ${escapeShellArg(tempPath)} ${escapeShellArg(remotePath)}`;
	}

	const cloneResult = await runRemoteCommand(host, cloneCmd);

	if (!cloneResult.success) {
		cloneSpin.fail("Failed to clone template");
		error(cloneResult.error || "Unknown error");

		const retryChoice = await select({
			message: "What would you like to do?",
			choices: [
				{ name: "Try again", value: "retry" },
				{ name: "Cancel", value: "cancel" },
			],
		});

		if (retryChoice === "retry") {
			return cloneGitToRemote(remote, projectName, templateUrl);
		}
		process.exit(1);
	}

	cloneSpin.succeed("Template cloned to remote");

	// Check if devcontainer.json exists, add if not
	const checkDevcontainer = await runRemoteCommand(
		host,
		`test -f ${escapeShellArg(`${remotePath}/${DEVCONTAINER_DIR_NAME}/${DEVCONTAINER_CONFIG_NAME}`)} && echo "EXISTS" || echo "NOT_FOUND"`,
	);

	if (checkDevcontainer.stdout?.includes("NOT_FOUND")) {
		const addSpin = spinner("Adding devcontainer.json...");

		const devcontainerJson = JSON.stringify(
			{
				name: projectName,
				image: "mcr.microsoft.com/devcontainers/base:ubuntu",
			},
			null,
			2,
		);
		const encoded = Buffer.from(devcontainerJson).toString("base64");

		await runRemoteCommand(
			host,
			`mkdir -p ${escapeShellArg(`${remotePath}/${DEVCONTAINER_DIR_NAME}`)} && echo ${escapeShellArg(encoded)} | base64 -d > ${escapeShellArg(`${remotePath}/${DEVCONTAINER_DIR_NAME}/${DEVCONTAINER_CONFIG_NAME}`)}`,
		);

		addSpin.succeed("Added devcontainer.json");
	}
}

async function offerClone(projectName: string): Promise<void> {
	console.log();
	const { shouldClone } = await inquirer.prompt([
		{
			type: "confirm",
			name: "shouldClone",
			message: "Clone this project locally now?",
			default: true,
		},
	]);

	if (shouldClone) {
		const { cloneCommand } = await import("./clone.ts");
		await cloneCommand(projectName);
	} else {
		success(`Project '${projectName}' created on remote`);
		info(`Run 'devbox clone ${projectName}' to clone locally.`);
	}
}
