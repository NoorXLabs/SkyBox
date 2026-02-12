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
import { deriveKey, resolveProjectKdf } from "@lib/encryption.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { runHooks } from "@lib/hooks.ts";
import { pauseSync, waitForSync } from "@lib/mutagen.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
	resolveProjectsMulti,
	runBatchOperation,
} from "@lib/project.ts";
import {
	createRemoteArchiveTarget,
	encryptRemoteArchive,
} from "@lib/remote-encryption.ts";
import { ensureRemoteKeyReady } from "@lib/ssh.ts";
import { deleteSession } from "@lib/state.ts";
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

// encrypt project directory on remote after sync flush.
// tars project, downloads tar, encrypts locally, uploads encrypted archive, deletes plaintext on remote.
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

	try {
		resolveProjectKdf(projectConfig.encryption);
	} catch (err) {
		error(getErrorMessage(err));
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

// resolve which project(s) to operate on from argument, cwd, or multi-select prompt.
// returns an array of project names, or null if resolution failed.
const resolveProjectsForDown = async (
	projectArg: string | undefined,
	options: DownOptions,
): Promise<string[] | null> => {
	return resolveProjectsMulti({
		projectArg,
		noPrompt: options.noPrompt,
		promptMessage: "Select project(s) to stop:",
		emptyMessage: "No local projects found.",
	});
};

// stop a single project: hooks, sync flush, container stop, encryption, session delete.
// returns true if the project was stopped successfully.
const stopSingleProject = async (
	project: string,
	config: SkyboxConfigV2,
	options: DownOptions,
): Promise<boolean> => {
	if (!projectExists(project)) {
		error(`Project '${project}' not found locally.`);
		return false;
	}

	const projectPath = getProjectPath(project);
	header(`Stopping '${project}'...`);

	// Ensure SSH key is loaded for remote operations (encryption)
	const projectRemote = getProjectRemote(project, config);
	if (projectRemote) {
		const keyReady = await ensureRemoteKeyReady(projectRemote.remote);
		if (!keyReady) {
			error("Could not authenticate SSH key.");
			info("Run 'ssh-add <keypath>' manually or check your key.");
			return false;
		}
	}

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
		return true;
	}

	// Run pre-down hooks
	const projectConfig = config.projects[project];
	if (projectConfig?.hooks) {
		await runHooks("pre-down", projectConfig.hooks, projectPath);
	}

	// Check container status
	const containerStatus = await getContainerStatus(projectPath);

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
					return false;
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

	// Run post-down hooks
	if (projectConfig?.hooks) {
		await runHooks("post-down", projectConfig.hooks, projectPath);
	}

	logAuditEvent(AuditActions.DOWN, { project });
	return true;
};

type CleanupMode = "single" | "multi";

interface CleanupTarget {
	project: string;
	projectPath: string;
	hasContainer: boolean;
}

// collect cleanup targets and whether each has a container.
const resolveCleanupTargets = async (
	projects: string[],
	includeContainerless: boolean,
): Promise<CleanupTarget[]> => {
	const targets: CleanupTarget[] = [];
	for (const project of projects) {
		const projectPath = getProjectPath(project);
		const hasContainer = Boolean(await getContainerInfo(projectPath));
		if (hasContainer || includeContainerless) {
			targets.push({ project, projectPath, hasContainer });
		}
	}
	return targets;
};

// generate mode-dependent message: in single mode returns the base message,
// in multi mode appends the project name for context.
const cleanupMsg = (
	mode: CleanupMode,
	base: string,
	project?: string,
): string => {
	if (mode === "single" || !project) return base;
	return `${base} for '${project}'`;
};

// handle cleanup prompts and actions for stopped projects.
// single mode keeps prior behavior where --cleanup can still remove local files
// even if no container exists.
const handleCleanupForProjects = async (
	projects: string[],
	config: SkyboxConfigV2,
	options: DownOptions,
	mode: CleanupMode,
): Promise<void> => {
	const targets = await resolveCleanupTargets(projects, mode === "single");
	const targetsWithContainers = targets.filter((t) => t.hasContainer);

	let shouldCleanup = options.cleanup;
	if (
		!options.noPrompt &&
		shouldCleanup === undefined &&
		targetsWithContainers.length > 0
	) {
		const message =
			mode === "single"
				? "Remove the container to free up resources?"
				: `Remove containers for ${targetsWithContainers.length} project(s) to free up resources?`;
		const { cleanup } = await inquirer.prompt([
			{
				type: "confirm",
				name: "cleanup",
				message,
				default: false,
			},
		]);
		shouldCleanup = cleanup;
	}

	if (shouldCleanup && targetsWithContainers.length > 0) {
		for (const target of targetsWithContainers) {
			const removeSpin = spinner(
				cleanupMsg(mode, "Removing container...", target.project),
			);
			const removeResult = await removeContainer(target.projectPath, {
				removeVolumes: true,
			});
			if (removeResult.success) {
				removeSpin.succeed(
					cleanupMsg(mode, "Container removed", target.project),
				);
			} else {
				removeSpin.fail(
					cleanupMsg(mode, "Failed to remove container", target.project),
				);
				warn(removeResult.error || "Unknown error");
			}
		}
	}

	let shouldRemoveLocal = false;
	if (!options.noPrompt && shouldCleanup && targets.length > 0) {
		const removeLocalMessage =
			mode === "single"
				? "Also remove local project files? (Remote copy will be preserved)"
				: `Also remove local project files for ${targets.length} project(s) with containers? (Remote copies will be preserved)`;
		const { removeLocal } = await inquirer.prompt([
			{
				type: "confirm",
				name: "removeLocal",
				message: removeLocalMessage,
				default: false,
			},
		]);
		shouldRemoveLocal = removeLocal;

		if (shouldRemoveLocal) {
			const projectNames = targets.map((target) => target.project).join(", ");
			const confirmMessage =
				mode === "single"
					? `Are you sure? This will delete ${targets[0].projectPath}`
					: `Are you sure? This will delete local files for: ${projectNames}`;
			const { confirmRemove } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirmRemove",
					message: confirmMessage,
					default: false,
				},
			]);
			shouldRemoveLocal = confirmRemove;
		}
	}

	if (shouldRemoveLocal) {
		for (const target of targets) {
			const syncSpin = spinner(
				cleanupMsg(mode, "Stopping sync...", target.project),
			);
			await pauseSync(target.project);
			syncSpin.succeed(cleanupMsg(mode, "Sync paused", target.project));

			const rmSpin = spinner(
				cleanupMsg(mode, "Removing local files...", target.project),
			);
			try {
				if (existsSync(target.projectPath)) {
					rmSync(target.projectPath, { recursive: true });
				}
				rmSpin.succeed(cleanupMsg(mode, "Local files removed", target.project));

				const projectRemoteInfo = getProjectRemote(target.project, config);
				if (config.projects?.[target.project]) {
					delete config.projects[target.project];
					saveConfig(config);
				}

				if (projectRemoteInfo) {
					const host = getRemoteHost(projectRemoteInfo.remote);
					const remotePath = getRemotePath(
						projectRemoteInfo.remote,
						target.project,
					);
					info(`Remote copy preserved at ${host}:${remotePath}`);
				}
				info(`Run 'skybox clone ${target.project}' to restore locally.`);
			} catch (err: unknown) {
				rmSpin.fail(
					cleanupMsg(mode, "Failed to remove local files", target.project),
				);
				error(getErrorMessage(err));
			}
		}
	} else if (!shouldCleanup && !options.noPrompt) {
		const pauseMessage =
			mode === "single"
				? "Pause background sync to save resources?"
				: "Pause background sync for all stopped projects?";
		const { pauseSyncSession } = await inquirer.prompt([
			{
				type: "confirm",
				name: "pauseSyncSession",
				message: pauseMessage,
				default: false,
			},
		]);

		if (pauseSyncSession) {
			for (const project of projects) {
				const syncSpin = spinner(cleanupMsg(mode, "Pausing sync...", project));
				const pauseResult = await pauseSync(project);
				if (pauseResult.success) {
					syncSpin.succeed(cleanupMsg(mode, "Sync paused", project));
				} else {
					syncSpin.warn(cleanupMsg(mode, "Could not pause sync", project));
				}
			}
		}
	}

	if (mode === "single") {
		success(`'${projects[0]}' stopped.`);
	}
};

// stop project containers, flush sync, optionally encrypt, and clean up
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
		const config = requireConfig();
		const { succeeded } = await runBatchOperation({
			projects,
			operation: (project) => stopSingleProject(project, config, options),
			label: "stopped",
		});
		if (succeeded.length > 0) {
			await handleCleanupForProjects(succeeded, config, options, "multi");
		}
		return;
	}

	const config = requireConfig();

	// Resolve project(s)
	const resolvedProjects = await resolveProjectsForDown(projectArg, options);
	if (!resolvedProjects) {
		process.exit(1);
	}

	// Single project: use original interactive flow
	if (resolvedProjects.length === 1) {
		const project = resolvedProjects[0];
		const ok = await stopSingleProject(project, config, options);
		if (!ok && !options.force) {
			process.exit(1);
		}
		await handleCleanupForProjects([project], config, options, "single");
		return;
	}

	// Multi-project: stop each, then batch cleanup
	const { succeeded } = await runBatchOperation({
		projects: resolvedProjects,
		operation: (project) => stopSingleProject(project, config, options),
		label: "stopped",
	});

	if (succeeded.length > 0) {
		await handleCleanupForProjects(succeeded, config, options, "multi");
	}
};
