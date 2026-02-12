// src/commands/clone.ts

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { getRemoteProjects } from "@commands/browse.ts";
import {
	getRemoteHost,
	getRemotePath,
	selectRemote,
} from "@commands/remote.ts";
import { upCommand } from "@commands/up.ts";
import { checkbox, select } from "@inquirer/prompts";
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
import { requireConfig } from "@lib/config.ts";
import { offerStartContainer } from "@lib/container-start.ts";
import { getSyncStatus, terminateSession } from "@lib/mutagen.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { getLocalProjects } from "@lib/project.ts";
import { finalizeProjectSync } from "@lib/project-sync.ts";
import { checkRemoteProjectExists } from "@lib/remote.ts";
import { escapeRemotePath } from "@lib/shell.ts";
import { requireRemoteKeyReady, runRemoteCommand } from "@lib/ssh.ts";
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
import { validateProjectName } from "@lib/validation.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";

// clone a single project from remote. This is the core clone logic
// used by both direct invocation and interactive multi-clone.
export const cloneSingleProject = async (
	project: string,
	remoteName: string,
	config: SkyboxConfigV2,
): Promise<boolean> => {
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);
	const remotePath = getRemotePath(remote, project);

	logAuditEvent(AuditActions.CLONE_START, { project, remote: remoteName });

	header(`Cloning '${project}' from ${host}:${remotePath}...`);

	const localPath = join(getProjectsDir(), project);

	// Defense-in-depth: verify resolved path stays under projects directory
	const normalizedLocal = resolve(localPath);
	const normalizedProjectsDir = resolve(getProjectsDir());
	if (!normalizedLocal.startsWith(`${normalizedProjectsDir}/`)) {
		error("Invalid project path: would write outside projects directory");
		logAuditEvent(AuditActions.CLONE_FAIL, {
			project,
			remote: remoteName,
			error: "Path traversal detected",
		});
		return false;
	}

	if (isDryRun()) {
		dryRun(`Would check if project exists on remote`);
		if (existsSync(localPath)) {
			dryRun(`Would remove existing local directory: ${localPath}`);
		}
		dryRun(`Would create local directory: ${localPath}`);
		dryRun(`Would create sync session: ${host}:${remotePath} <-> ${localPath}`);
		dryRun(`Would register project '${project}' in config`);
		return true;
	}

	// Check project exists on remote
	const checkSpin = spinner("Checking remote project...");
	const exists = await checkRemoteProjectExists(host, remote.path, project);

	if (!exists) {
		checkSpin.fail("Project not found on remote");
		error(
			`Project '${project}' not found on remote. Run 'skybox browse' to see available projects.`,
		);
		logAuditEvent(AuditActions.CLONE_FAIL, {
			project,
			remote: remoteName,
			error: "Project not found on remote",
		});
		return false;
	}
	checkSpin.succeed("Project found on remote");

	// Check local doesn't exist
	if (existsSync(localPath)) {
		const confirmed = await confirmDestructiveAction({
			firstPrompt: "Project already exists locally. Overwrite?",
			secondPrompt: "Are you sure? All local changes will be lost.",
			cancelMessage: "Clone cancelled.",
		});

		if (!confirmed) {
			return false;
		}

		rmSync(localPath, { recursive: true });
	}

	// Create local directory
	mkdirSync(localPath, { recursive: true });
	success(`Created ${localPath}`);

	// Check if sync session already exists
	const syncSpin = spinner("Setting up sync...");
	const existingSync = await getSyncStatus(project);

	if (existingSync.exists) {
		syncSpin.text = "Removing old sync session...";
		await terminateSession(project);
	}

	// Create new sync session
	syncSpin.text = "Creating sync session...";
	const projectConfig = config.projects[project];
	const ignores = config.defaults.ignore;
	const syncSetupResult = await finalizeProjectSync({
		projectName: project,
		localPath,
		remoteHost: host,
		remotePath,
		ignores,
		syncPaths: projectConfig?.sync_paths,
		config,
		remoteName,
		onProgress: (message) => {
			syncSpin.text = message;
		},
	});

	if (!syncSetupResult.success) {
		const failMessage =
			syncSetupResult.stage === "create"
				? "Failed to create sync session"
				: "Sync failed";
		syncSpin.fail(failMessage);
		if (syncSetupResult.stage === "sync") {
			await terminateSession(project);
		}
		rmSync(localPath, { recursive: true, force: true });
		error(syncSetupResult.error);
		logAuditEvent(AuditActions.CLONE_FAIL, {
			project,
			remote: remoteName,
			error: syncSetupResult.error,
		});
		return false;
	}

	syncSpin.succeed("Initial sync complete");

	// Check if project is encrypted on remote
	const encArchivePath = `${remotePath}/${project}.tar.enc`;
	const encCheck = await runRemoteCommand(
		host,
		`test -f ${escapeRemotePath(encArchivePath)} && echo "ENCRYPTED" || echo "PLAIN"`,
	);

	if (encCheck.stdout?.includes("ENCRYPTED")) {
		info("This project is encrypted on the remote.");
		info("You'll need the passphrase when running 'skybox up' to decrypt it.");
	}

	logAuditEvent(AuditActions.CLONE_SUCCESS, { project, remote: remoteName });
	return true;
};

// clone one or more remote projects locally with sync and optional container start
export const cloneCommand = async (project?: string): Promise<void> => {
	const config = requireConfig();

	// If project provided directly, use single-clone flow
	if (project) {
		const validation = validateProjectName(project);
		if (!validation.valid) {
			error(validation.error || "Invalid project name");
			process.exit(1);
		}

		const remoteName = await selectRemote(config);
		const remote = config.remotes[remoteName];
		await requireRemoteKeyReady(remote);
		const cloned = await cloneSingleProject(project, remoteName, config);
		if (!cloned) {
			process.exit(1);
		}

		if (isDryRun()) return;

		await offerStartContainer({
			projectName: project,
			defaultStart: true,
			onStart: async (selectedProject) => upCommand(selectedProject, {}),
		});
		return;
	}

	// Interactive flow: select remote, fetch projects, multi-select
	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	await requireRemoteKeyReady(remote);
	const host = getRemoteHost(remote);

	const fetchSpin = spinner(`Fetching projects from ${remoteName}...`);
	const remoteProjects = await getRemoteProjects(host, remote.path, remote.key);
	fetchSpin.succeed("Projects fetched");

	if (remoteProjects.length === 0) {
		info("No projects found on remote.");
		info("Run 'skybox push ./my-project' to push your first project.");
		return;
	}

	// Filter out already-local projects
	const localProjects = getLocalProjects();
	const localSet = new Set(localProjects);
	const available = remoteProjects.filter((p) => {
		if (localSet.has(p.name)) return false;
		// Validate remote-sourced names for safety
		const validation = validateProjectName(p.name);
		if (!validation.valid) return false;
		return true;
	});

	if (available.length === 0) {
		info("All remote projects are already cloned locally.");
		return;
	}

	const selected = await checkbox({
		message: "Select projects to clone:",
		choices: available.map((p) => ({
			name: `${p.name} (${p.branch})`,
			value: p.name,
		})),
	});

	if (selected.length === 0) {
		info("No projects selected.");
		return;
	}

	// Clone each project sequentially
	const cloned: string[] = [];
	for (const name of selected) {
		const ok = await cloneSingleProject(name, remoteName, config);
		if (ok) {
			cloned.push(name);
		}
	}

	if (isDryRun()) return;

	if (cloned.length === 0) {
		error("No projects were cloned successfully.");
		return;
	}

	// Summary
	console.log();
	success(`Cloned ${cloned.length} projects: ${cloned.join(", ")}`);

	if (cloned.length === 1) {
		// Single clone — offer to start container (same as direct invocation)
		await offerStartContainer({
			projectName: cloned[0],
			defaultStart: true,
			onStart: async (selectedProject) => upCommand(selectedProject, {}),
		});
		return;
	}

	// Multi-clone: ask which to start
	const startProject = await select({
		message: "Which project would you like to start working on?",
		choices: [
			...cloned.map((name) => ({ name, value: name })),
			{ name: "None", value: "__none__" },
		],
	});

	if (startProject !== "__none__") {
		await upCommand(startProject, {});
		const remaining = cloned.filter((n) => n !== startProject);
		if (remaining.length > 0) {
			console.log();
			info("Run 'skybox up <name>' to start your other cloned projects:");
			for (const name of remaining) {
				console.log(`  - ${name}`);
			}
		}
	} else {
		console.log();
		info("Run 'skybox up <name>' to start your cloned projects:");
		for (const name of cloned) {
			console.log(`  - ${name}`);
		}
	}
};
