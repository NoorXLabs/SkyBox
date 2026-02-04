// src/commands/shell.ts

import { upCommand } from "@commands/up.ts";
import { configExists, loadConfig } from "@lib/config.ts";
import { WORKSPACE_PATH_PREFIX } from "@lib/constants.ts";
import {
	getContainerId,
	getContainerStatus,
	getDevcontainerConfig,
} from "@lib/container.ts";
import { getProjectPath, projectExists } from "@lib/project.ts";
import { checkSessionConflict, readSession } from "@lib/session.ts";
import { error, header, info, warn } from "@lib/ui.ts";
import { ContainerStatus, type ShellOptions } from "@typedefs/index.ts";
import { execa } from "execa";
import inquirer from "inquirer";

export async function shellCommand(
	project: string,
	options: ShellOptions,
): Promise<void> {
	// Step 1: Check config exists
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Step 2: Verify project exists locally
	if (!projectExists(project)) {
		error(
			`Project '${project}' not found. Run 'devbox clone ${project}' first.`,
		);
		process.exit(1);
	}

	const projectPath = getProjectPath(project);

	// Step 3: Check session status
	if (!options.force) {
		const sessionConflict = checkSessionConflict(projectPath);

		if (sessionConflict.hasConflict && sessionConflict.existingSession) {
			error(
				`Project '${project}' has an active session on ${sessionConflict.existingSession.machine} (${sessionConflict.existingSession.user}).`,
			);
			info("Use --force to bypass session check (use with caution).");
			process.exit(1);
		}

		const currentSession = readSession(projectPath);
		if (!currentSession) {
			warn(
				"No active session. Consider running 'devbox up' first to prevent sync conflicts across machines.",
			);
		}
	}

	// Step 4: Check container status
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus !== ContainerStatus.Running) {
		const { startContainer } = await inquirer.prompt([
			{
				type: "confirm",
				name: "startContainer",
				message: "Container is not running. Start it now?",
				default: true,
			},
		]);

		if (!startContainer) {
			info("Exiting. Run 'devbox up' to start the container first.");
			return;
		}

		// Start the container using devbox up
		await upCommand(project, { noPrompt: true });
	}

	// Step 5: Get container ID
	const containerId = await getContainerId(projectPath);
	if (!containerId) {
		error("Failed to find container. Try running 'devbox up' first.");
		process.exit(1);
	}

	// Step 6: Get workspace path from devcontainer.json
	const devcontainerConfig = getDevcontainerConfig(projectPath);
	const workspacePath =
		devcontainerConfig?.workspaceFolder ||
		`${WORKSPACE_PATH_PREFIX}/${project}`;

	// Step 7: Execute docker exec
	header(`Entering shell for '${project}'...`);

	if (options.command) {
		// Command mode: run command and exit
		try {
			await execa(
				"docker",
				[
					"exec",
					"-w",
					workspacePath,
					containerId,
					"/bin/sh",
					"-c",
					options.command,
				],
				{ stdio: "inherit" },
			);
		} catch (err: unknown) {
			const exitCode = (err as { exitCode?: number })?.exitCode;
			if (exitCode !== undefined) {
				process.exit(exitCode);
			}
			error("Failed to execute command in container.");
			process.exit(1);
		}
	} else {
		// Interactive mode
		info("Attaching to shell (Ctrl+D to exit)...");
		try {
			await execa(
				"docker",
				["exec", "-it", "-w", workspacePath, containerId, "/bin/sh"],
				{ stdio: "inherit" },
			);
		} catch (err: unknown) {
			// Exit code 130 is normal Ctrl+C exit
			const exitCode = (err as { exitCode?: number })?.exitCode;
			if (exitCode === 130) {
				return;
			}
			error("Failed to enter shell.");
			process.exit(1);
		}
	}
}
