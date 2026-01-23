// src/lib/container.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import {
	type ContainerInfo,
	type ContainerResult,
	ContainerStatus,
} from "../types/index.ts";
import { getExecaErrorMessage, hasExitCode } from "./errors.ts";

export interface DevcontainerConfig {
	workspaceFolder?: string;
}

// Read devcontainer.json configuration
export function getDevcontainerConfig(
	projectPath: string,
): DevcontainerConfig | null {
	const configPath = join(projectPath, ".devcontainer", "devcontainer.json");
	const altConfigPath = join(projectPath, ".devcontainer.json");

	let content: string;
	try {
		if (existsSync(configPath)) {
			content = readFileSync(configPath, "utf-8");
		} else if (existsSync(altConfigPath)) {
			content = readFileSync(altConfigPath, "utf-8");
		} else {
			return null;
		}
		return JSON.parse(content);
	} catch {
		return null;
	}
}

// Get container ID for a local project
export async function getContainerId(
	projectPath: string,
): Promise<string | null> {
	try {
		const result = await execa("docker", [
			"ps",
			"-q",
			"--filter",
			`label=devcontainer.local_folder=${projectPath}`,
		]);
		const containerId = result.stdout.trim();
		return containerId || null;
	} catch {
		return null;
	}
}

// Get container status for a local project
export async function getContainerStatus(
	projectPath: string,
): Promise<ContainerStatus> {
	try {
		const result = await execa("docker", [
			"ps",
			"-a",
			"--filter",
			`label=devcontainer.local_folder=${projectPath}`,
			"--format",
			"{{.Status}}",
		]);

		const status = result.stdout.trim();
		if (!status) {
			return ContainerStatus.NotFound;
		}
		if (status.toLowerCase().startsWith("up")) {
			return ContainerStatus.Running;
		}
		return ContainerStatus.Stopped;
	} catch {
		return ContainerStatus.Error;
	}
}

// Get container info for a local project
export async function getContainerInfo(
	projectPath: string,
): Promise<ContainerInfo | null> {
	try {
		const result = await execa("docker", [
			"ps",
			"-a",
			"--filter",
			`label=devcontainer.local_folder=${projectPath}`,
			"--format",
			"{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
		]);

		const line = result.stdout.trim();
		if (!line) return null;

		const [id, name, status, image] = line.split("\t");
		return { id, name, status, image };
	} catch {
		return null;
	}
}

// Start a devcontainer locally
export async function startContainer(
	projectPath: string,
	options?: { rebuild?: boolean },
): Promise<ContainerResult> {
	const args = ["up", "--workspace-folder", projectPath];

	if (options?.rebuild) {
		args.push("--rebuild-if-exists");
	}

	try {
		const _result = await execa("devcontainer", args, { stdio: "inherit" });
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

// Stop a devcontainer
export async function stopContainer(
	projectPath: string,
): Promise<ContainerResult> {
	try {
		const result = await execa("docker", [
			"ps",
			"-q",
			"--filter",
			`label=devcontainer.local_folder=${projectPath}`,
		]);

		const containerId = result.stdout.trim();
		if (!containerId) {
			return { success: true }; // Already stopped
		}

		await execa("docker", ["stop", containerId]);
		return { success: true, containerId };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

// Remove a devcontainer and its volumes
export async function removeContainer(
	projectPath: string,
	options?: { removeVolumes?: boolean },
): Promise<ContainerResult> {
	try {
		// Get container ID
		const result = await execa("docker", [
			"ps",
			"-a",
			"-q",
			"--filter",
			`label=devcontainer.local_folder=${projectPath}`,
		]);

		const containerId = result.stdout.trim();
		if (!containerId) {
			return { success: true }; // No container to remove
		}

		// Stop if running
		await execa("docker", ["stop", containerId]).catch(() => {});

		// Remove container
		const removeArgs = ["rm", containerId];
		if (options?.removeVolumes) {
			removeArgs.push("-v");
		}
		await execa("docker", removeArgs);

		return { success: true, containerId };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

// Get all devbox-related containers
export async function listDevboxContainers(): Promise<ContainerInfo[]> {
	try {
		const result = await execa("docker", [
			"ps",
			"-a",
			"--filter",
			"label=devcontainer.local_folder",
			"--format",
			"{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
		]);

		if (!result.stdout.trim()) return [];

		return result.stdout
			.trim()
			.split("\n")
			.map((line) => {
				const [id, name, status, image] = line.split("\t");
				return { id, name, status, image };
			});
	} catch {
		return [];
	}
}

export const SUPPORTED_EDITORS = [
	{ id: "cursor", name: "Cursor" },
	{ id: "code", name: "VS Code" },
	{ id: "code-insiders", name: "VS Code Insiders" },
	{ id: "other", name: "Other (specify command)" },
] as const;

export type EditorId = (typeof SUPPORTED_EDITORS)[number]["id"] | string;

// Open project in editor with devcontainer
export async function openInEditor(
	projectPath: string,
	editor: EditorId,
): Promise<ContainerResult> {
	try {
		// Get the container ID for this project
		const containerResult = await execa("docker", [
			"ps",
			"-q",
			"--filter",
			`label=devcontainer.local_folder=${projectPath}`,
		]);

		const containerId = containerResult.stdout.trim();
		if (!containerId) {
			return {
				success: false,
				error: "Container not running. Run 'devbox up' first.",
			};
		}

		// Get the workspace folder from devcontainer.json or use default
		const projectName = projectPath.split("/").pop();
		const workspaceFolder = `/workspaces/${projectName}`;

		// Build the devcontainer URI - hex encode the project path
		const hexPath = Buffer.from(projectPath).toString("hex");
		const devcontainerUri = `vscode-remote://dev-container+${hexPath}${workspaceFolder}`;

		// Use the editor to open the devcontainer URI
		if (
			editor === "cursor" ||
			editor === "code" ||
			editor === "code-insiders"
		) {
			await execa(editor, ["--folder-uri", devcontainerUri]);
		} else {
			// Fallback: just open the folder directly
			await execa(editor, [projectPath]);
		}
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

// Attach to shell inside devcontainer
export async function attachToShell(
	projectPath: string,
): Promise<ContainerResult> {
	try {
		await execa(
			"devcontainer",
			["exec", "--workspace-folder", projectPath, "/bin/bash"],
			{
				stdio: "inherit",
			},
		);
		return { success: true };
	} catch (error: unknown) {
		// Exit code 130 is normal Ctrl+C exit
		if (hasExitCode(error, 130)) {
			return { success: true };
		}
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

// Check if devcontainer.json exists locally
export function hasLocalDevcontainerConfig(projectPath: string): boolean {
	const configPath = join(projectPath, ".devcontainer", "devcontainer.json");
	const altConfigPath = join(projectPath, ".devcontainer.json");
	return existsSync(configPath) || existsSync(altConfigPath);
}
