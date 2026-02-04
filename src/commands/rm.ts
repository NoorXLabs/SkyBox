// src/commands/rm.ts

import { existsSync, rmSync } from "node:fs";
import { getProjectRemote, getRemoteHost } from "@commands/remote.ts";
import { checkbox } from "@inquirer/prompts";
import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import {
	getContainerStatus,
	removeContainer,
	stopContainer,
} from "@lib/container.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { terminateSession } from "@lib/mutagen.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
} from "@lib/project.ts";
import { deleteSession, readSession } from "@lib/session.ts";
import { escapeShellArg } from "@lib/shell.ts";
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
} from "@lib/ui.ts";
import { validatePath } from "@lib/validation.ts";
import {
	ContainerStatus,
	type DevboxConfigV2,
	type RmOptions,
} from "@typedefs/index.ts";
import inquirer from "inquirer";

export async function rmCommand(
	project: string | undefined,
	options: RmOptions,
): Promise<void> {
	// Interactive multi-select when no project argument given
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

	// Validate project name
	const pathCheck = validatePath(project);
	if (!pathCheck.valid) {
		error(`Invalid project name: ${pathCheck.error}`);
		return;
	}

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

	const projectPath = getProjectPath(project);
	header(`Removing '${project}'...`);

	if (isDryRun()) {
		dryRun(`Would clear session file for '${project}'`);
		const containerStatus = await getContainerStatus(projectPath);
		if (containerStatus === ContainerStatus.Running) {
			dryRun(`Would stop running container`);
		}
		if (containerStatus !== ContainerStatus.NotFound) {
			dryRun(`Would remove container and volumes`);
		}
		dryRun(`Would terminate sync session`);
		dryRun(`Would delete local files: ${projectPath}`);
		dryRun(`Would remove '${project}' from config`);
		if (options.remote) {
			dryRun(`Would delete project from remote server`);
		}
		return;
	}

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
		if (!options.remote) {
			delete config.projects[project];
			saveConfig(config);
		}
	}

	// Handle remote deletion if --remote flag is set
	if (options.remote) {
		await deleteFromRemote(project, config, options);
	} else {
		success(`Project '${project}' removed locally. Remote copy preserved.`);
	}
}

async function deleteFromRemote(
	project: string,
	config: DevboxConfigV2,
	options: RmOptions,
): Promise<void> {
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

	const remoteSpin = spinner(`Deleting '${project}' from remote...`);
	try {
		const result = await runRemoteCommand(
			host,
			`rm -rf ${escapeShellArg(remotePath)}`,
			remote.key,
		);

		if (result.success) {
			remoteSpin.succeed(`Deleted '${project}' from remote`);
		} else {
			remoteSpin.fail("Failed to delete from remote");
			error(result.error || "Unknown error");
			return;
		}
	} catch (err: unknown) {
		remoteSpin.fail("Failed to delete from remote");
		error(getErrorMessage(err));
		return;
	}

	// Remove project from config after successful remote deletion
	if (config.projects?.[project]) {
		delete config.projects[project];
		saveConfig(config);
	}

	success(`Project '${project}' removed locally and from remote.`);
}
