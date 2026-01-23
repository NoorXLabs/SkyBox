// src/commands/new.ts
import inquirer from "inquirer";
import { configExists, loadConfig } from "../lib/config.ts";
import { validateProjectName } from "../lib/projectTemplates.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";
import type { DevboxConfig } from "../types/index.ts";

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
		config.remote.host,
		`test -d ${config.remote.base_path}/${projectName} && echo "EXISTS" || echo "NOT_FOUND"`,
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
		await createEmptyProject(config, projectName);
	} else {
		await createFromTemplate(config, projectName);
	}
}

async function createEmptyProject(
	config: DevboxConfig,
	projectName: string,
): Promise<void> {
	// TODO: Implement in Task 7
	info(`Creating empty project: ${projectName}`);
}

async function createFromTemplate(
	config: DevboxConfig,
	projectName: string,
): Promise<void> {
	// TODO: Implement in Task 8
	info(`Creating from template: ${projectName}`);
}
