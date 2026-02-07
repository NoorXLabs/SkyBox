// src/commands/down.ts

import { existsSync, rmSync } from "node:fs";
import {
	getProjectRemote,
	getRemoteHost,
	getRemotePath,
} from "@commands/remote.ts";
import { password } from "@inquirer/prompts";
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
import { requireConfig, saveConfig } from "@lib/config.ts";
import { MAX_PASSPHRASE_ATTEMPTS } from "@lib/constants.ts";
import {
	getContainerInfo,
	getContainerStatus,
	removeContainer,
	stopContainer,
} from "@lib/container.ts";
import { deriveKey } from "@lib/encryption.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { runHooks } from "@lib/hooks.ts";
import { pauseSync, waitForSync } from "@lib/mutagen.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
	resolveSingleProject,
} from "@lib/project.ts";
import {
	createRemoteArchiveTarget,
	encryptRemoteArchive,
} from "@lib/remote-encryption.ts";
import { deleteSession } from "@lib/session.ts";
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
import {
	ContainerStatus,
	type DownOptions,
	type SkyboxConfigV2,
} from "@typedefs/index.ts";
import inquirer from "inquirer";

/**
 * Encrypt project directory on remote after sync flush.
 * Tars project, downloads tar, encrypts locally, uploads encrypted archive, deletes plaintext on remote.
 */
const handleEncryption = async (
	project: string,
	config: SkyboxConfigV2,
): Promise<boolean> => {
	const projectConfig = config.projects[project];
	if (!projectConfig?.encryption?.enabled) {
		return true;
	}

	const projectRemote = getProjectRemote(project, config);
	if (!projectRemote) {
		return true;
	}

	const host = getRemoteHost(projectRemote.remote);
	const remotePath = getRemotePath(projectRemote.remote, project);
	const archiveTarget = createRemoteArchiveTarget(project, host, remotePath);

	const salt = projectConfig.encryption.salt;
	if (!salt) {
		error(
			"Encryption enabled but no salt in config. Run 'skybox encrypt disable' then re-enable.",
		);
		return false;
	}

	for (let attempt = 1; attempt <= MAX_PASSPHRASE_ATTEMPTS; attempt++) {
		const passphrase = await password({
			message: `Enter passphrase to encrypt (attempt ${attempt}/${MAX_PASSPHRASE_ATTEMPTS}):`,
		});

		if (!passphrase) {
			error("Passphrase is required.");
			continue;
		}

		const encryptSpin = spinner("Encrypting project archive...");

		try {
			const key = await deriveKey(passphrase, salt);
			const encryptResult = await encryptRemoteArchive(
				archiveTarget,
				key,
				(message) => {
					encryptSpin.text = message;
				},
			);

			if (!encryptResult.success) {
				encryptSpin.fail("Failed to create archive on remote");
				error(encryptResult.error || "Unknown error");
				return false;
			}

			if (encryptResult.cleanupWarning) {
				warn("Could not fully clean up plaintext on remote");
			}

			encryptSpin.succeed("Project encrypted and plaintext removed");
			return true;
		} catch {
			encryptSpin.fail("Encryption failed");
			if (attempt === MAX_PASSPHRASE_ATTEMPTS) {
				error(`Failed to encrypt after ${MAX_PASSPHRASE_ATTEMPTS} attempts.`);
				return false;
			}
		}
	}

	return false;
};

export const downCommand = async (
	projectArg: string | undefined,
	options: DownOptions,
): Promise<void> => {
	// Batch mode: stop all local projects
	if (options.all) {
		const projects = getLocalProjects();
		if (projects.length === 0) {
			info("No local projects found.");
			return;
		}
		info(`Stopping ${projects.length} projects...`);
		let succeeded = 0;
		let failed = 0;
		for (const project of projects) {
			try {
				header(`\n${project}`);
				await downCommand(project, { ...options, all: false });
				succeeded++;
			} catch (err) {
				failed++;
				error(`Failed: ${getErrorMessage(err)}`);
			}
		}
		info(`\nDone: ${succeeded} stopped, ${failed} failed.`);
		return;
	}

	const config = requireConfig();

	const resolution = await resolveSingleProject({
		projectArg,
		noPrompt: options.noPrompt,
		promptMessage: "Select a project to stop:",
	});
	if ("reason" in resolution) {
		if (resolution.reason === "no-projects") {
			error("No local projects found.");
			process.exit(1);
		}
		error("No project specified and --no-prompt is set.");
		process.exit(1);
	}
	const project = resolution.project;

	// Verify project exists locally
	if (!projectExists(project)) {
		error(`Project '${project}' not found locally.`);
		process.exit(1);
	}

	const projectPath = getProjectPath(project);
	header(`Stopping '${project}'...`);

	if (isDryRun()) {
		const projectConfig = config.projects[project];
		if (projectConfig?.hooks) {
			dryRun(`Would run pre-down hooks for '${project}'`);
		}
		dryRun(`Would flush pending sync for '${project}'`);
		dryRun(`Would stop container at ${projectPath}`);
		if (projectConfig?.encryption?.enabled) {
			dryRun(`Would encrypt project on remote`);
		}
		dryRun(`Would delete session file at ${projectPath}`);
		if (projectConfig?.hooks) {
			dryRun(`Would run post-down hooks for '${project}'`);
		}
		return;
	}

	// Run pre-down hooks
	const projectConfig = config.projects[project];
	if (projectConfig?.hooks) {
		await runHooks("pre-down", projectConfig.hooks, projectPath);
	}

	// Check container status
	const containerStatus = await getContainerStatus(projectPath);
	const containerInfo = await getContainerInfo(projectPath);

	if (containerStatus === ContainerStatus.NotFound) {
		info("No container found for this project.");
	} else {
		// Flush sync before stopping container
		const syncSpin = spinner("Syncing pending changes...");
		const syncResult = await waitForSync(project);
		if (syncResult.success) {
			syncSpin.succeed("Sync complete");
		} else {
			syncSpin.warn("Could not flush sync");
		}

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

		// Encrypt project on remote if encryption is enabled
		const encryptOk = await handleEncryption(project, config);
		if (!encryptOk) {
			warn("Encryption failed — project files remain unencrypted on remote");
		}

		// End session after container stopped
		deleteSession(projectPath);
		success("Session ended");
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

	// Run post-down hooks before potential directory deletion
	if (projectConfig?.hooks) {
		await runHooks("post-down", projectConfig.hooks, projectPath);
	}

	if (shouldRemoveLocal) {
		// Pause sync first
		const syncSpin = spinner("Stopping sync...");
		await pauseSync(project);
		syncSpin.succeed("Sync paused");

		// Remove local files
		const rmSpin = spinner("Removing local files...");
		try {
			if (existsSync(projectPath)) {
				rmSync(projectPath, { recursive: true });
			}
			rmSpin.succeed("Local files removed");

			// Get remote info for the info message
			const projectRemoteInfo = getProjectRemote(project, config);

			// Optionally remove from config
			if (config.projects?.[project]) {
				delete config.projects[project];
				saveConfig(config);
			}

			if (projectRemoteInfo) {
				const host = getRemoteHost(projectRemoteInfo.remote);
				const remotePath = getRemotePath(projectRemoteInfo.remote, project);
				info(`Remote copy preserved at ${host}:${remotePath}`);
			}
			info(`Run 'skybox clone ${project}' to restore locally.`);
		} catch (err: unknown) {
			rmSpin.fail("Failed to remove local files");
			error(getErrorMessage(err));
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
				const pauseResult = await pauseSync(project);
				if (pauseResult.success) {
					syncSpin.succeed("Sync paused");
				} else {
					syncSpin.warn("Could not pause sync");
				}
			}
		}
	}

	logAuditEvent(AuditActions.DOWN, { project });
	success(`'${project}' stopped.`);
};
