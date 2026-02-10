// src/commands/down.ts

import { existsSync, rmSync } from "node:fs";
import {
	getProjectRemote,
	getRemoteHost,
	getRemotePath,
} from "@commands/remote.ts";
import { checkbox, password } from "@inquirer/prompts";
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
	resolveProjectFromCwd,
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
	// Explicit argument: single project
	if (projectArg) {
		return [projectArg];
	}

	// Try to resolve from cwd
	const cwdProject = resolveProjectFromCwd() ?? undefined;
	if (cwdProject) {
		return [cwdProject];
	}

	// No argument and not in a project dir — prompt with checkbox
	const projects = getLocalProjects();

	if (projects.length === 0) {
		error("No local projects found.");
		return null;
	}

	if (options.noPrompt) {
		error("No project specified and --no-prompt is set.");
		return null;
	}

	const selected = await checkbox({
		message: "Select project(s) to stop:",
		choices: projects.map((p) => ({ name: p, value: p })),
	});

	if (selected.length === 0) {
		error("No projects selected.");
		return null;
	}

	return selected;
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

// handle cleanup prompts and actions for a set of stopped projects.
// asks once, applies to all.
const handleBatchCleanup = async (
	projects: string[],
	config: SkyboxConfigV2,
	options: DownOptions,
): Promise<void> => {
	// Determine which projects have containers to clean up
	const projectsWithContainers: Array<{
		project: string;
		projectPath: string;
	}> = [];
	for (const project of projects) {
		const projectPath = getProjectPath(project);
		const containerInfo = await getContainerInfo(projectPath);
		if (containerInfo) {
			projectsWithContainers.push({ project, projectPath });
		}
	}

	// Ask about cleanup (once for all)
	let shouldCleanup = options.cleanup;

	if (
		!options.noPrompt &&
		shouldCleanup === undefined &&
		projectsWithContainers.length > 0
	) {
		const { cleanup } = await inquirer.prompt([
			{
				type: "confirm",
				name: "cleanup",
				message: `Remove containers for ${projectsWithContainers.length} project(s) to free up resources?`,
				default: false,
			},
		]);
		shouldCleanup = cleanup;
	}

	if (shouldCleanup && projectsWithContainers.length > 0) {
		for (const { project, projectPath } of projectsWithContainers) {
			const removeSpin = spinner(`Removing container for '${project}'...`);
			const removeResult = await removeContainer(projectPath, {
				removeVolumes: true,
			});
			if (removeResult.success) {
				removeSpin.succeed(`Container removed for '${project}'`);
			} else {
				removeSpin.fail(`Failed to remove container for '${project}'`);
				warn(removeResult.error || "Unknown error");
			}
		}
	}

	// Ask about local files cleanup (once for all)
	let shouldRemoveLocal = false;

	if (!options.noPrompt && shouldCleanup && projectsWithContainers.length > 0) {
		const { removeLocal } = await inquirer.prompt([
			{
				type: "confirm",
				name: "removeLocal",
				message: `Also remove local project files for ${projectsWithContainers.length} project(s) with containers? (Remote copies will be preserved)`,
				default: false,
			},
		]);
		shouldRemoveLocal = removeLocal;

		if (shouldRemoveLocal) {
			const projectNames = projectsWithContainers
				.map(({ project }) => project)
				.join(", ");
			const { confirmRemove } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirmRemove",
					message: `Are you sure? This will delete local files for: ${projectNames}`,
					default: false,
				},
			]);
			shouldRemoveLocal = confirmRemove;
		}
	}

	if (shouldRemoveLocal) {
		for (const { project, projectPath } of projectsWithContainers) {
			// Pause sync first
			const syncSpin = spinner(`Stopping sync for '${project}'...`);
			await pauseSync(project);
			syncSpin.succeed(`Sync paused for '${project}'`);

			// Remove local files
			const rmSpin = spinner(`Removing local files for '${project}'...`);
			try {
				if (existsSync(projectPath)) {
					rmSync(projectPath, { recursive: true });
				}
				rmSpin.succeed(`Local files removed for '${project}'`);

				const projectRemoteInfo = getProjectRemote(project, config);

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
				rmSpin.fail(`Failed to remove local files for '${project}'`);
				error(getErrorMessage(err));
			}
		}
	} else if (!shouldCleanup) {
		// Ask about pausing sync (once for all)
		if (!options.noPrompt) {
			const { pauseSyncSession } = await inquirer.prompt([
				{
					type: "confirm",
					name: "pauseSyncSession",
					message: "Pause background sync for all stopped projects?",
					default: false,
				},
			]);

			if (pauseSyncSession) {
				for (const project of projects) {
					const syncSpin = spinner(`Pausing sync for '${project}'...`);
					const pauseResult = await pauseSync(project);
					if (pauseResult.success) {
						syncSpin.succeed(`Sync paused for '${project}'`);
					} else {
						syncSpin.warn(`Could not pause sync for '${project}'`);
					}
				}
			}
		}
	}
};

// handle cleanup prompts and actions for a single project (original interactive flow).
const handleSingleCleanup = async (
	project: string,
	config: SkyboxConfigV2,
	options: DownOptions,
): Promise<void> => {
	const projectPath = getProjectPath(project);
	const containerInfo = await getContainerInfo(projectPath);

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
		await pauseSync(project);
		syncSpin.succeed("Sync paused");

		// Remove local files
		const rmSpin = spinner("Removing local files...");
		try {
			if (existsSync(projectPath)) {
				rmSync(projectPath, { recursive: true });
			}
			rmSpin.succeed("Local files removed");

			const projectRemoteInfo = getProjectRemote(project, config);

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
	} else if (!shouldCleanup) {
		// Ask about pausing sync
		if (!options.noPrompt) {
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

	success(`'${project}' stopped.`);
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
		let succeeded = 0;
		let failed = 0;
		const stoppedProjects: string[] = [];
		for (const project of projects) {
			try {
				header(`\n${project}`);
				const ok = await stopSingleProject(project, config, options);
				if (ok) {
					succeeded++;
					stoppedProjects.push(project);
				} else {
					failed++;
				}
			} catch (err) {
				failed++;
				error(`Failed: ${getErrorMessage(err)}`);
			}
		}
		if (stoppedProjects.length > 0) {
			await handleBatchCleanup(stoppedProjects, config, options);
		}
		info(`\nDone: ${succeeded} stopped, ${failed} failed.`);
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
		await handleSingleCleanup(project, config, options);
		return;
	}

	// Multi-project: stop each, then batch cleanup
	let succeeded = 0;
	let failed = 0;
	const stoppedProjects: string[] = [];
	for (const project of resolvedProjects) {
		try {
			const ok = await stopSingleProject(project, config, options);
			if (ok) {
				succeeded++;
				stoppedProjects.push(project);
			} else {
				failed++;
			}
		} catch (err) {
			failed++;
			error(`Failed to stop '${project}': ${getErrorMessage(err)}`);
		}
	}

	if (stoppedProjects.length > 0) {
		await handleBatchCleanup(stoppedProjects, config, options);
	}

	info(`\nDone: ${succeeded} stopped, ${failed} failed.`);
};
