// src/commands/config-devcontainer.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { loadConfig } from "../lib/config.ts";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	WORKSPACE_PATH_PREFIX,
} from "../lib/constants.ts";
import { getErrorMessage } from "../lib/errors.ts";
import { getProjectPath, projectExists } from "../lib/project.ts";
import { escapeShellArg } from "../lib/shell.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { selectTemplate, writeDevcontainerConfig } from "../lib/templates.ts";
import { error, info, spinner, success } from "../lib/ui.ts";
import type { DevboxConfigV2 } from "../types/index.ts";

function getDevcontainerPath(projectPath: string): string {
	return join(projectPath, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME);
}

export async function devcontainerEditCommand(project: string): Promise<void> {
	if (!projectExists(project)) {
		error(`Project "${project}" not found locally.`);
		return;
	}

	const projectPath = getProjectPath(project);
	const configPath = getDevcontainerPath(projectPath);

	if (!existsSync(configPath)) {
		error(`No devcontainer.json found for "${project}".`);
		info(
			'Use "devbox config devcontainer reset" to create one from a template.',
		);
		return;
	}

	const config = loadConfig();
	const editor = config?.editor || process.env.EDITOR || "vim";

	try {
		const result = await execa(editor, [configPath], { stdio: "inherit" });
		if (result.exitCode !== 0) {
			error(
				`Editor exited with code ${result.exitCode}. Skipping push to remote.`,
			);
			return;
		}
	} catch (err) {
		error(`Editor failed: ${getErrorMessage(err)}`);
		return;
	}

	// Push to remote
	await pushDevcontainerToRemote(project, projectPath, config);
}

export async function devcontainerResetCommand(project: string): Promise<void> {
	if (!projectExists(project)) {
		error(`Project "${project}" not found locally.`);
		return;
	}

	const projectPath = getProjectPath(project);

	const selection = await selectTemplate();
	if (!selection) {
		return;
	}

	if (selection.source === "git") {
		error("Git URL templates are not supported for devcontainer reset.");
		info("Use 'devbox new' to create a project from a git template.");
		return;
	}

	const devcontainerConfig = {
		...selection.config,
		workspaceFolder: `${WORKSPACE_PATH_PREFIX}/${project}`,
		workspaceMount: `source=\${localWorkspaceFolder},target=${WORKSPACE_PATH_PREFIX}/${project},type=bind,consistency=cached`,
	};

	writeDevcontainerConfig(projectPath, devcontainerConfig);
	success("Reset devcontainer.json from template.");

	// Push to remote
	const appConfig = loadConfig();
	await pushDevcontainerToRemote(project, projectPath, appConfig);
}

async function pushDevcontainerToRemote(
	project: string,
	projectPath: string,
	config: DevboxConfigV2 | null,
): Promise<void> {
	if (!config) {
		info("No config found. Skipped pushing to remote.");
		return;
	}

	const projectConfig = config.projects?.[project];
	if (!projectConfig) {
		info("No remote configured for this project. Skipped pushing to remote.");
		return;
	}

	const remoteName = projectConfig.remote;
	const remote = config.remotes?.[remoteName];
	if (!remote) {
		info("No remote configured. Skipped pushing to remote.");
		return;
	}

	const remoteHost = remote.user
		? `${remote.user}@${remote.host}`
		: remote.host;
	const remotePath = `${remote.path}/${project}`;
	const configPath = getDevcontainerPath(projectPath);
	const configContent = readFileSync(configPath, "utf-8");

	const s = spinner("Pushing devcontainer.json to remote...");
	try {
		const encoded = Buffer.from(configContent).toString("base64");
		const result = await runRemoteCommand(
			remoteHost,
			`mkdir -p ${escapeShellArg(`${remotePath}/${DEVCONTAINER_DIR_NAME}`)} && echo ${escapeShellArg(encoded)} | base64 -d > ${escapeShellArg(`${remotePath}/${DEVCONTAINER_DIR_NAME}/${DEVCONTAINER_CONFIG_NAME}`)}`,
			remote.key ?? undefined,
		);
		if (result.success) {
			s.succeed("Pushed devcontainer.json to remote.");
		} else {
			s.fail(`Failed to push: ${result.error}`);
		}
	} catch (err) {
		s.fail(`Failed to push: ${getErrorMessage(err)}`);
	}
}
