// src/commands/rm.ts

import { existsSync, rmSync } from "node:fs";
import { getRemoteProjects } from "@commands/browse.ts";
import {
	getProjectRemote,
	getRemoteHost,
	selectRemote,
} from "@commands/remote.ts";
import { checkbox } from "@inquirer/prompts";
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import {
	getContainerStatus,
	removeContainer,
	stopContainer,
} from "@lib/container.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { terminateSession } from "@lib/mutagen.ts";
import { checkWriteAuthorization } from "@lib/ownership.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
} from "@lib/project.ts";
import { deleteSession, readSession } from "@lib/session.ts";
import { escapeRemotePath } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import {
	confirmDestructiveAction,
	dryRun,
	error,
	header,
	info,
	isDryRun,
	spinner,
	success,
	warn,
} from "@lib/ui.ts";
import { validateProjectName } from "@lib/validation.ts";
import {
	ContainerStatus,
	type RemoteEntry,
	type RemoteProject,
	type RmOptions,
	type SkyboxConfigV2,
} from "@typedefs/index.ts";
import inquirer from "inquirer";

// clean up a local project: stop container, terminate sync, remove files, clear session.
// logs errors but continues on failure (resilient cleanup).
const cleanupLocalProject = async (
	project: string,
	force: boolean,
): Promise<void> => {
	const projectPath = getProjectPath(project);

	// Check session status and delete if present
	const sessionSpin = spinner("Checking session status...");
	try {
		const session = readSession(projectPath);
		if (session) {
			sessionSpin.text = "Clearing session...";
			deleteSession(projectPath);
			sessionSpin.succeed("Session cleared");
		} else {
			sessionSpin.succeed("No active session");
		}
	} catch {
		sessionSpin.warn("Could not check session status");
	}

	// Check container status and stop if running
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus !== ContainerStatus.NotFound) {
		if (containerStatus === ContainerStatus.Running) {
			const stopSpin = spinner("Stopping container...");
			const stopResult = await stopContainer(projectPath);
			if (!stopResult.success) {
				stopSpin.fail("Failed to stop container");
				const msg = stopResult.error || "Unknown error";
				if (!force) {
					throw new Error(`Failed to stop container: ${msg}`);
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
			const msg = removeResult.error || "Unknown error";
			if (!force) {
				throw new Error(`Failed to remove container: ${msg}`);
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
		const msg = getErrorMessage(err);
		throw new Error(`Failed to remove local files: ${msg}`);
	}
};

// delete a single project from a remote server via rm -rf.
// does NOT prompt for confirmation — caller is responsible for that.
// returns true on success, false on failure (logs error).
const deleteProjectFromRemote = async (
	project: string,
	host: string,
	remote: RemoteEntry,
): Promise<boolean> => {
	const remotePath = `${remote.path}/${project}`;
	const remoteSpin = spinner(`Deleting '${project}' from remote...`);
	try {
		const result = await runRemoteCommand(
			host,
			`rm -rf ${escapeRemotePath(remotePath)}`,
			remote.key,
		);

		if (result.success) {
			remoteSpin.succeed(`Deleted '${project}' from remote`);
			return true;
		}
		remoteSpin.fail(`Failed to delete '${project}' from remote`);
		error(result.error || "Unknown error");
		return false;
	} catch (err: unknown) {
		remoteSpin.fail(`Failed to delete '${project}' from remote`);
		error(getErrorMessage(err));
		return false;
	}
};

type LocalCleanupMode = "prompt" | "skip";

// apply shared cleanup after successful remote deletion.
const handlePostRemoteDeletion = async (
	project: string,
	config: SkyboxConfigV2,
	options: RmOptions,
	localCleanupMode: LocalCleanupMode,
): Promise<void> => {
	if (config.projects?.[project]) {
		delete config.projects[project];
		saveConfig(config);
	}

	if (localCleanupMode === "skip" || !projectExists(project) || options.force) {
		return;
	}

	const { removeLocal } = await inquirer.prompt([
		{
			type: "confirm",
			name: "removeLocal",
			message: `'${project}' also exists locally. Remove local copy too?`,
			default: false,
		},
	]);

	if (!removeLocal) {
		return;
	}

	header(`Removing '${project}' locally...`);
	try {
		await cleanupLocalProject(project, false);
	} catch (err: unknown) {
		error(
			`Failed to clean up local project '${project}': ${getErrorMessage(err)}`,
		);
	}
};

// interactive multi-select flow for deleting remote projects.
// triggered by `skybox rm --remote` (no project argument).
const rmRemoteInteractive = async (
	config: SkyboxConfigV2,
	options: RmOptions,
): Promise<void> => {
	// Select which remote to delete from
	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);

	// Fetch remote project list
	const fetchSpin = spinner(`Fetching projects from ${remoteName}...`);
	let projects: RemoteProject[];
	try {
		projects = await getRemoteProjects(host, remote.path, remote.key);
		fetchSpin.stop();
	} catch (err: unknown) {
		fetchSpin.fail("Failed to connect to remote");
		error(getErrorMessage(err));
		return;
	}

	if (projects.length === 0) {
		info("No projects found on remote.");
		return;
	}

	// Interactive checkbox to select projects
	const selected = await checkbox({
		message: "Select remote projects to delete:",
		choices: projects.map((p) => ({
			name: p.branch !== "-" ? `${p.name} (${p.branch})` : p.name,
			value: p.name,
		})),
	});

	if (selected.length === 0) {
		info("No projects selected.");
		return;
	}

	// Double confirmation listing what will be deleted
	if (!options.force) {
		console.log();
		warn("The following projects will be permanently deleted from remote:");
		for (const name of selected) {
			console.log(`    ${name}`);
		}
		console.log();

		const confirmed = await confirmDestructiveAction({
			firstPrompt: `Delete ${selected.length} project(s) from ${remoteName}?`,
			secondPrompt: "Are you absolutely sure? This action cannot be undone.",
			cancelMessage: "Remote deletion cancelled.",
		});

		if (!confirmed) {
			return;
		}
	}

	// Delete each selected project from remote
	let deletedCount = 0;
	for (const projectName of selected) {
		const deleted = await deleteProjectFromRemote(projectName, host, remote);

		if (!deleted) {
			// Log error but continue with remaining projects
			continue;
		}

		deletedCount++;
		await handlePostRemoteDeletion(projectName, config, options, "prompt");
	}

	success(
		`Done. ${deletedCount} of ${selected.length} project(s) deleted from ${remoteName}.`,
	);
};

// remove a project locally and/or from remote with interactive multi-select
export const rmCommand = async (
	project: string | undefined,
	options: RmOptions,
): Promise<void> => {
	// Interactive remote multi-select when --remote flag but no project argument
	if (!project && options.remote) {
		if (!configExists()) {
			error("skybox not configured. Run 'skybox init' first.");
			process.exit(1);
		}

		const config = loadConfig();
		if (!config) {
			error("Failed to load config.");
			process.exit(1);
		}

		await rmRemoteInteractive(config, options);
		return;
	}

	// Interactive local multi-select when no project argument given
	if (!project) {
		const localProjects = getLocalProjects();
		if (localProjects.length === 0) {
			info("No local projects found.");
			return;
		}

		const selected = await checkbox({
			message: "Select projects to remove:",
			choices: localProjects.map((p) => ({
				name: p,
				value: p,
			})),
		});

		if (selected.length === 0) {
			info("No projects selected.");
			return;
		}

		for (const projectName of selected) {
			await rmCommand(projectName, options);
		}
		return;
	}

	// Validate project name (consistent with clone.ts, new.ts, push.ts)
	const validation = validateProjectName(project);
	if (!validation.valid) {
		error(`Invalid project name: ${validation.error}`);
		process.exit(1);
	}

	// Check config exists
	if (!configExists()) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	const localExists = projectExists(project);

	// If --remote only (no local project), skip local cleanup
	if (!localExists && !options.remote) {
		error(`Project '${project}' not found locally.`);
		process.exit(1);
	}

	if (!localExists && options.remote) {
		// Remote-only deletion: skip local cleanup, go straight to remote
		header(`Removing '${project}' from remote...`);
		await deleteFromRemote(project, config, options);
		return;
	}

	// Prompt for confirmation unless --force is set
	if (!options.force) {
		const message = options.remote
			? `Remove project '${project}' locally AND from the remote server?`
			: `Remove project '${project}' locally? This will NOT delete remote files.`;

		const { confirmed } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirmed",
				message,
				default: false,
			},
		]);

		if (!confirmed) {
			info("Removal cancelled.");
			return;
		}
	}

	header(`Removing '${project}'...`);

	if (isDryRun()) {
		dryRun(`Would clear session file for '${project}'`);
		dryRun(`Would stop container if running`);
		dryRun(`Would remove container and volumes if present`);
		dryRun(`Would terminate sync session`);
		dryRun(`Would delete local files: ${getProjectPath(project)}`);
		dryRun(`Would remove '${project}' from config`);
		if (options.remote) {
			dryRun(`Would delete project from remote server`);
		}
		return;
	}

	// Perform local cleanup
	try {
		await cleanupLocalProject(project, !!options.force);
	} catch (err: unknown) {
		error(getErrorMessage(err));
		process.exit(1);
	}

	// Remove project from config if present
	if (config.projects?.[project]) {
		if (!options.remote) {
			delete config.projects[project];
			saveConfig(config);
		}
	}

	// Handle remote deletion if --remote flag is set
	if (options.remote) {
		await deleteFromRemote(project, config, options);
	} else {
		logAuditEvent(AuditActions.RM_LOCAL, { project });
		success(`Project '${project}' removed locally. Remote copy preserved.`);
	}
};

// delete a project from its configured remote server with double-confirmation
const deleteFromRemote = async (
	project: string,
	config: SkyboxConfigV2,
	options: RmOptions,
): Promise<void> => {
	const projectRemote = getProjectRemote(project, config);

	if (!projectRemote) {
		error(
			`Project '${project}' has no configured remote. Cannot delete from remote.`,
		);
		return;
	}

	const { remote } = projectRemote;
	const remotePath = `${remote.path}/${project}`;
	const host = getRemoteHost(remote);

	// Check authorization before remote deletion
	const authCheckSpin = spinner("Checking authorization...");
	const authResult = await checkWriteAuthorization(host, remotePath);

	if (!authResult.authorized) {
		authCheckSpin.fail("Not authorized");
		error(`Cannot delete: ${authResult.error}`);
		info("Only the project owner can delete remote projects.");
		logAuditEvent(AuditActions.AUTH_DENIED, {
			project,
			remote: projectRemote.name,
			operation: "rm",
			error: authResult.error,
		});
		process.exit(1);
	}
	authCheckSpin.succeed("Authorization verified");

	// Double confirmation for remote deletion unless --force
	if (!options.force) {
		const confirmed = await confirmDestructiveAction({
			firstPrompt: `This will permanently delete '${project}' from ${host}:${remotePath}. Continue?`,
			secondPrompt: `Are you absolutely sure? This action cannot be undone.`,
			cancelMessage: "Remote deletion cancelled.",
		});

		if (!confirmed) {
			return;
		}
	}

	const deleted = await deleteProjectFromRemote(project, host, remote);
	if (!deleted) {
		return;
	}

	await handlePostRemoteDeletion(project, config, options, "skip");

	logAuditEvent(AuditActions.RM_REMOTE, {
		project,
		remote: projectRemote.name,
		host,
		path: remotePath,
	});
	success(`Project '${project}' removed locally and from remote.`);
};
