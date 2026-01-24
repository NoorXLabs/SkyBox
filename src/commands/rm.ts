// src/commands/rm.ts

import { existsSync, rmSync } from "node:fs";
import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import {
	getContainerStatus,
	removeContainer,
	stopContainer,
} from "../lib/container.ts";
import { getErrorMessage } from "../lib/errors.ts";
import { createLockRemoteInfo, getLockStatus, releaseLock } from "../lib/lock.ts";
import { terminateSession } from "../lib/mutagen.ts";
import { getProjectPath, projectExists } from "../lib/project.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";
import { ContainerStatus, type RmOptions } from "../types/index.ts";
import { getProjectRemote } from "./remote.ts";

export async function rmCommand(
	project: string,
	options: RmOptions,
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

	// Verify project exists locally
	if (!projectExists(project)) {
		error(`Project '${project}' not found locally.`);
		process.exit(1);
	}

	// Prompt for confirmation unless --force is set
	if (!options.force) {
		const { confirmed } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirmed",
				message: `Remove project '${project}' locally? This will NOT delete remote files.`,
				default: false,
			},
		]);

		if (!confirmed) {
			info("Removal cancelled.");
			return;
		}
	}

	const projectPath = getProjectPath(project);
	header(`Removing '${project}'...`);

	// Check lock status and release if owned by us (if project has a remote)
	const projectRemote = getProjectRemote(project, config);
	const lockSpin = spinner("Checking lock status...");
	try {
		if (projectRemote) {
			const remoteInfo = createLockRemoteInfo(projectRemote.remote);
			const lockStatus = await getLockStatus(project, remoteInfo);

			if (lockStatus.locked) {
				if (lockStatus.ownedByMe) {
					lockSpin.text = "Releasing lock...";
					const releaseResult = await releaseLock(project, remoteInfo);
					if (releaseResult.success) {
						lockSpin.succeed("Lock released");
					} else {
						lockSpin.warn("Failed to release lock");
					}
				} else {
					lockSpin.info(
						`Lock held by ${lockStatus.info.machine} (${lockStatus.info.user})`,
					);
				}
			} else {
				lockSpin.succeed("No lock held");
			}
		} else {
			lockSpin.succeed("No remote configured - skipping lock check");
		}
	} catch {
		lockSpin.warn("Could not check lock status");
	}

	// Check container status and stop if running
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus !== ContainerStatus.NotFound) {
		if (containerStatus === ContainerStatus.Running) {
			const stopSpin = spinner("Stopping container...");
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
		}

		// Remove the container
		const removeSpin = spinner("Removing container...");
		const removeResult = await removeContainer(projectPath, {
			removeVolumes: true,
		});
		if (removeResult.success) {
			removeSpin.succeed("Container removed");
		} else {
			removeSpin.warn("Failed to remove container");
			if (!options.force) {
				error(removeResult.error || "Unknown error");
				process.exit(1);
			}
		}
	} else {
		info("No container found for this project.");
	}

	// Terminate mutagen sync session
	const syncSpin = spinner("Terminating sync session...");
	const syncResult = await terminateSession(project);
	if (syncResult.success) {
		syncSpin.succeed("Sync session terminated");
	} else {
		syncSpin.warn("No sync session found or already terminated");
	}

	// Delete local files
	const rmSpin = spinner("Removing local files...");
	try {
		if (existsSync(projectPath)) {
			rmSync(projectPath, { recursive: true });
		}
		rmSpin.succeed("Local files removed");
	} catch (err: unknown) {
		rmSpin.fail("Failed to remove local files");
		error(getErrorMessage(err));
		process.exit(1);
	}

	// Remove project from config if present
	if (config.projects?.[project]) {
		delete config.projects[project];
		saveConfig(config);
	}

	success(`Project '${project}' removed locally. Remote copy preserved.`);
}
