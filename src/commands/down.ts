// src/commands/down.ts

import { existsSync, rmSync } from "node:fs";
import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import {
	getContainerInfo,
	getContainerStatus,
	removeContainer,
	stopContainer,
} from "../lib/container.ts";
import { pauseSync } from "../lib/mutagen.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
	resolveProjectFromCwd,
} from "../lib/project.ts";
import { error, header, info, spinner, success, warn } from "../lib/ui.ts";
import { ContainerStatus } from "../types/index.ts";

interface DownOptions {
	cleanup?: boolean;
	force?: boolean;
	noPrompt?: boolean;
}

export async function downCommand(
	projectArg: string | undefined,
	options: DownOptions,
): Promise<void> {
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

	// Resolve project
	let project = projectArg;

	if (!project) {
		// Try to detect from current directory
		project = resolveProjectFromCwd() ?? undefined;
	}

	if (!project) {
		// Prompt for project selection
		const projects = getLocalProjects();

		if (projects.length === 0) {
			error("No local projects found.");
			process.exit(1);
		}

		if (options.noPrompt) {
			error("No project specified and --no-prompt is set.");
			process.exit(1);
		}

		const { selectedProject } = await inquirer.prompt([
			{
				type: "list",
				name: "selectedProject",
				message: "Select a project to stop:",
				choices: projects,
			},
		]);
		project = selectedProject;
	}

	// Verify project exists locally
	if (!projectExists(project ?? "")) {
		error(`Project '${project}' not found locally.`);
		process.exit(1);
	}

	const projectPath = getProjectPath(project ?? "");
	header(`Stopping '${project}'...`);

	// Check container status
	const containerStatus = await getContainerStatus(projectPath);
	const containerInfo = await getContainerInfo(projectPath);

	if (containerStatus === ContainerStatus.NotFound) {
		info("No container found for this project.");
	} else {
		// Stop the container
		const stopSpin = spinner("Stopping container...");

		if (containerStatus === ContainerStatus.Running) {
			const stopResult = await stopContainer(projectPath);
			if (!stopResult.success) {
				stopSpin.fail("Failed to stop container");
				error(stopResult.error || "Unknown error");
				if (!options.force) {
					process.exit(1);
				}
			} else {
				stopSpin.succeed("Container stopped");
			}
		} else {
			stopSpin.succeed("Container already stopped");
		}
	}

	// Ask about cleanup
	let shouldCleanup = options.cleanup;

	if (!options.noPrompt && shouldCleanup === undefined && containerInfo) {
		const { cleanup } = await inquirer.prompt([
			{
				type: "confirm",
				name: "cleanup",
				message: "Remove the container to free up resources?",
				default: false,
			},
		]);
		shouldCleanup = cleanup;
	}

	if (shouldCleanup && containerInfo) {
		const removeSpin = spinner("Removing container...");
		const removeResult = await removeContainer(projectPath, {
			removeVolumes: true,
		});
		if (removeResult.success) {
			removeSpin.succeed("Container removed");
		} else {
			removeSpin.fail("Failed to remove container");
			warn(removeResult.error || "Unknown error");
		}
	}

	// Ask about local files cleanup
	let shouldRemoveLocal = false;

	if (!options.noPrompt && shouldCleanup) {
		const { removeLocal } = await inquirer.prompt([
			{
				type: "confirm",
				name: "removeLocal",
				message:
					"Also remove local project files? (Remote copy will be preserved)",
				default: false,
			},
		]);
		shouldRemoveLocal = removeLocal;

		if (shouldRemoveLocal) {
			const { confirmRemove } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirmRemove",
					message: `Are you sure? This will delete ${projectPath}`,
					default: false,
				},
			]);
			shouldRemoveLocal = confirmRemove;
		}
	}

	if (shouldRemoveLocal) {
		// Pause sync first
		const syncSpin = spinner("Stopping sync...");
		await pauseSync(project ?? "");
		syncSpin.succeed("Sync paused");

		// Remove local files
		const rmSpin = spinner("Removing local files...");
		try {
			if (existsSync(projectPath)) {
				rmSync(projectPath, { recursive: true });
			}
			rmSpin.succeed("Local files removed");

			// Optionally remove from config
			if (config.projects?.[project ?? ""]) {
				delete config.projects[project ?? ""];
				saveConfig(config);
			}

			info(
				`Remote copy preserved at ${config.remote.host}:${config.remote.base_path}/${project}`,
			);
			info(`Run 'devbox clone ${project}' to restore locally.`);
		} catch (err: any) {
			rmSpin.fail("Failed to remove local files");
			error(err.message);
		}
	} else {
		// Just pause sync if not removing
		if (!shouldCleanup) {
			const { pauseSyncSession } = await inquirer.prompt([
				{
					type: "confirm",
					name: "pauseSyncSession",
					message: "Pause background sync to save resources?",
					default: false,
				},
			]);

			if (pauseSyncSession) {
				const syncSpin = spinner("Pausing sync...");
				const pauseResult = await pauseSync(project ?? "");
				if (pauseResult.success) {
					syncSpin.succeed("Sync paused");
				} else {
					syncSpin.warn("Could not pause sync");
				}
			}
		}
	}

	success(`'${project}' stopped.`);
}
