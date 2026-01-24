// src/commands/new.ts
import inquirer from "inquirer";
import { configExists, loadConfig } from "../lib/config.ts";
import {
	getAllTemplates,
	validateProjectName,
} from "../lib/projectTemplates.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";
import type { RemoteEntry } from "../types/index.ts";
import { getRemoteHost, selectRemote } from "./remote.ts";

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

	// Step 1: Get project name
	const { projectName } = await inquirer.prompt([
		{
			type: "input",
			name: "projectName",
			message: "Project name:",
			validate: (input: string) => {
				const result = validateProjectName(input);
				return result.valid ? true : result.error || "Invalid name";
			},
		},
	]);

	// Step 2: Check if project exists on remote
	const checkSpin = spinner("Checking remote...");
	const checkResult = await runRemoteCommand(
		host,
		`test -d ${remote.path}/${projectName} && echo "EXISTS" || echo "NOT_FOUND"`,
	);

	if (checkResult.stdout?.includes("EXISTS")) {
		checkSpin.fail("Project already exists");
		error(
			`A project named '${projectName}' already exists on the remote. Please choose a different name.`,
		);
		// Recursively call to re-prompt
		return newCommand();
	}
	checkSpin.succeed("Name available");

	// Step 3: Choose project type
	const { projectType } = await inquirer.prompt([
		{
			type: "list",
			name: "projectType",
			message: "How would you like to create this project?",
			choices: [
				{ name: "Empty project (with devcontainer.json)", value: "empty" },
				{ name: "From a template", value: "template" },
			],
		},
	]);

	if (projectType === "empty") {
		await createEmptyProject(remote, projectName);
	} else {
		await createFromTemplate(remote, projectName);
	}
}

async function createEmptyProject(
	remote: RemoteEntry,
	projectName: string,
): Promise<void> {
	const host = getRemoteHost(remote);
	const remotePath = `${remote.path}/${projectName}`;

	// Create project directory with devcontainer
	const createSpin = spinner("Creating project on remote...");

	const devcontainerJson = JSON.stringify(
		{
			name: projectName,
			image: "mcr.microsoft.com/devcontainers/base:ubuntu",
		},
		null,
		2,
	);

	// Escape the JSON for shell
	const escapedJson = devcontainerJson.replace(/'/g, "'\\''");

	const createCmd = `mkdir -p ${remotePath}/.devcontainer && echo '${escapedJson}' > ${remotePath}/.devcontainer/devcontainer.json`;

	const createResult = await runRemoteCommand(host, createCmd);

	if (!createResult.success) {
		createSpin.fail("Failed to create project");
		error(createResult.error || "Unknown error");
		process.exit(1);
	}

	createSpin.succeed("Project created on remote");

	// Offer to clone locally
	await offerClone(projectName);
}

async function createFromTemplate(
	remote: RemoteEntry,
	projectName: string,
): Promise<void> {
	const { builtIn, user } = getAllTemplates();

	// Build choices with separators
	type ChoiceItem =
		| { name: string; value: string }
		| InstanceType<typeof inquirer.Separator>;
	const choices: ChoiceItem[] = [];

	// Built-in templates
	if (builtIn.length > 0) {
		choices.push(new inquirer.Separator("──── Built-in ────"));
		for (const t of builtIn) {
			choices.push({ name: t.name, value: `builtin:${t.id}` });
		}
	}

	// User templates
	if (user.length > 0) {
		choices.push(new inquirer.Separator("──── Custom ────"));
		for (const t of user) {
			choices.push({ name: t.name, value: `user:${t.name}` });
		}
	}

	// Git URL option
	choices.push(new inquirer.Separator("────────────────"));
	choices.push({ name: "Enter git URL...", value: "custom" });

	const { templateChoice } = await inquirer.prompt([
		{
			type: "list",
			name: "templateChoice",
			message: "Select a template:",
			choices,
		},
	]);

	let templateUrl: string;

	if (templateChoice === "custom") {
		const { gitUrl } = await inquirer.prompt([
			{
				type: "input",
				name: "gitUrl",
				message: "Git repository URL:",
				validate: (input: string) => {
					if (!input.trim()) return "URL cannot be empty";
					if (!input.startsWith("https://") && !input.startsWith("git@")) {
						return "URL must start with https:// or git@";
					}
					return true;
				},
			},
		]);
		templateUrl = gitUrl;
	} else if (templateChoice.startsWith("builtin:")) {
		const id = templateChoice.replace("builtin:", "");
		const template = builtIn.find((t) => t.id === id);
		if (!template) {
			error("Template not found");
			process.exit(1);
		}
		templateUrl = template.url;
	} else {
		const name = templateChoice.replace("user:", "");
		const template = user.find((t) => t.name === name);
		if (!template) {
			error("Template not found");
			process.exit(1);
		}
		templateUrl = template.url;
	}

	// Ask about git history for custom URLs
	let keepHistory = false;
	if (templateChoice === "custom") {
		const { historyChoice } = await inquirer.prompt([
			{
				type: "list",
				name: "historyChoice",
				message: "Git history:",
				choices: [
					{ name: "Start fresh (recommended)", value: "fresh" },
					{ name: "Keep original history", value: "keep" },
				],
			},
		]);
		keepHistory = historyChoice === "keep";
	}

	await cloneTemplateToRemote(remote, projectName, templateUrl, keepHistory);
}

async function cloneTemplateToRemote(
	remote: RemoteEntry,
	projectName: string,
	templateUrl: string,
	keepHistory: boolean,
): Promise<void> {
	const host = getRemoteHost(remote);
	const remotePath = `${remote.path}/${projectName}`;

	const cloneSpin = spinner("Cloning template to remote...");

	// Clone to temp, then move to final location
	const tempPath = `/tmp/devbox-template-${Date.now()}`;

	let cloneCmd: string;
	if (keepHistory) {
		cloneCmd = `git clone ${templateUrl} ${tempPath} && mv ${tempPath} ${remotePath}`;
	} else {
		cloneCmd = `git clone ${templateUrl} ${tempPath} && rm -rf ${tempPath}/.git && git -C ${tempPath} init && mv ${tempPath} ${remotePath}`;
	}

	const cloneResult = await runRemoteCommand(host, cloneCmd);

	if (!cloneResult.success) {
		cloneSpin.fail("Failed to clone template");
		error(cloneResult.error || "Unknown error");

		// Offer to retry or go back
		const { retryChoice } = await inquirer.prompt([
			{
				type: "list",
				name: "retryChoice",
				message: "What would you like to do?",
				choices: [
					{ name: "Try again", value: "retry" },
					{ name: "Go back to template selection", value: "back" },
					{ name: "Cancel", value: "cancel" },
				],
			},
		]);

		if (retryChoice === "retry") {
			return cloneTemplateToRemote(
				remote,
				projectName,
				templateUrl,
				keepHistory,
			);
		} else if (retryChoice === "back") {
			return createFromTemplate(remote, projectName);
		} else {
			process.exit(1);
		}
	}

	cloneSpin.succeed("Template cloned to remote");

	// Check if devcontainer.json exists, add if not
	const checkDevcontainer = await runRemoteCommand(
		host,
		`test -f ${remotePath}/.devcontainer/devcontainer.json && echo "EXISTS" || echo "NOT_FOUND"`,
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
		const escapedJson = devcontainerJson.replace(/'/g, "'\\''");

		await runRemoteCommand(
			host,
			`mkdir -p ${remotePath}/.devcontainer && echo '${escapedJson}' > ${remotePath}/.devcontainer/devcontainer.json`,
		);

		addSpin.succeed("Added devcontainer.json");
	}

	// Offer to clone locally
	await offerClone(projectName);
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
