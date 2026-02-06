/** Docker container operations: query, start, stop, inspect. */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import {
	DEVCONTAINER_ALT_CONFIG_NAME,
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	DOCKER_LABEL_KEY,
	type SUPPORTED_EDITORS,
	VSCODE_REMOTE_URI_PREFIX,
	WORKSPACE_PATH_PREFIX,
} from "@lib/constants.ts";
import { execa } from "execa";

// Normalize path to real case (important for macOS case-insensitive filesystem)
// Docker labels use exact string match, so paths must match exactly
function normalizePath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

/** Validate a Docker container ID (short or full hex format). */
function isValidContainerId(id: string): boolean {
	return /^[a-f0-9]{12,64}$/.test(id);
}

import { getExecaErrorMessage, hasExitCode } from "@lib/errors.ts";
import {
	type ContainerInfo,
	type ContainerResult,
	ContainerStatus,
} from "@typedefs/index.ts";

export type EditorId = (typeof SUPPORTED_EDITORS)[number]["id"] | string;

/**
 * Query Docker for containers matching a label filter.
 * Centralizes the common Docker query pattern used throughout the codebase.
 */
async function queryDockerContainers(options: {
	projectPath?: string;
	includeAll?: boolean; // Include stopped containers (-a)
	idsOnly?: boolean; // Return only container IDs (-q)
	format?: string; // Custom format string
}): Promise<string> {
	const { projectPath, includeAll = false, idsOnly = false, format } = options;

	const args = ["ps"];
	if (includeAll) args.push("-a");
	if (idsOnly) args.push("-q");

	// Filter by label
	if (projectPath) {
		args.push("--filter", `label=${DOCKER_LABEL_KEY}=${projectPath}`);
	} else {
		args.push("--filter", `label=${DOCKER_LABEL_KEY}`);
	}

	if (format) {
		args.push("--format", format);
	}

	const result = await execa("docker", args);
	return result.stdout.trim();
}

export interface DevcontainerConfig {
	workspaceFolder?: string;
}

// Read devcontainer.json configuration
export function getDevcontainerConfig(
	projectPath: string,
): DevcontainerConfig | null {
	const configPath = join(
		projectPath,
		DEVCONTAINER_DIR_NAME,
		DEVCONTAINER_CONFIG_NAME,
	);
	const altConfigPath = join(projectPath, DEVCONTAINER_ALT_CONFIG_NAME);

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
		const containerId = await queryDockerContainers({
			projectPath,
			idsOnly: true,
		});
		if (!containerId || !isValidContainerId(containerId)) return null;
		return containerId;
	} catch {
		return null;
	}
}

// Get container status for a local project
export async function getContainerStatus(
	projectPath: string,
): Promise<ContainerStatus> {
	const normalizedPath = normalizePath(projectPath);
	try {
		const status = await queryDockerContainers({
			projectPath: normalizedPath,
			includeAll: true,
			format: "{{.Status}}",
		});

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
	const normalizedPath = normalizePath(projectPath);
	try {
		const line = await queryDockerContainers({
			projectPath: normalizedPath,
			includeAll: true,
			format: "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
		});

		if (!line) return null;

		const [id, name, rawStatus, image] = line.split("\t");
		if (!isValidContainerId(id)) return null;
		const status = rawStatus?.toLowerCase().startsWith("up")
			? ContainerStatus.Running
			: ContainerStatus.Stopped;
		return { id, name, status, rawStatus: rawStatus || "", image };
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
		// Use stdin: 'ignore' to prevent devcontainer from affecting
		// the terminal's stdin state, which can break subsequent
		// interactive prompts (inquirer list prompts)
		await execa("devcontainer", args, { stdin: "ignore" });
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

// Stop a devcontainer
export async function stopContainer(
	projectPath: string,
): Promise<ContainerResult> {
	const normalizedPath = normalizePath(projectPath);
	try {
		const containerId = await queryDockerContainers({
			projectPath: normalizedPath,
			idsOnly: true,
		});

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
	const normalizedPath = normalizePath(projectPath);
	try {
		// Get container ID
		const containerId = await queryDockerContainers({
			projectPath: normalizedPath,
			includeAll: true,
			idsOnly: true,
		});

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

// Get all skybox-related containers
export async function listSkyboxContainers(): Promise<ContainerInfo[]> {
	try {
		const output = await queryDockerContainers({
			includeAll: true,
			format: "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
		});

		if (!output) return [];

		return output.split("\n").map((line) => {
			const [id, name, rawStatus, image] = line.split("\t");
			const status = rawStatus?.toLowerCase().startsWith("up")
				? ContainerStatus.Running
				: ContainerStatus.Stopped;
			return { id, name, status, rawStatus: rawStatus || "", image };
		});
	} catch {
		return [];
	}
}

// Open project in editor with devcontainer
export async function openInEditor(
	projectPath: string,
	editor: EditorId,
): Promise<ContainerResult> {
	const normalizedPath = normalizePath(projectPath);
	try {
		// Get the container ID for this project
		const containerId = await queryDockerContainers({
			projectPath: normalizedPath,
			idsOnly: true,
		});

		if (!containerId) {
			return {
				success: false,
				error: "Container not running. Run 'skybox up' first.",
			};
		}

		// Get the workspace folder from devcontainer.json or use default
		const projectName = normalizedPath.split("/").pop();
		const workspaceFolder = `${WORKSPACE_PATH_PREFIX}/${projectName}`;

		// Build the devcontainer URI - hex encode the project path
		const hexPath = Buffer.from(normalizedPath).toString("hex");
		const devcontainerUri = `${VSCODE_REMOTE_URI_PREFIX}${hexPath}${workspaceFolder}`;

		// Use the editor to open the devcontainer URI
		if (
			editor === "cursor" ||
			editor === "code" ||
			editor === "code-insiders"
		) {
			await execa(editor, ["--folder-uri", devcontainerUri]);
		} else {
			// Fallback: just open the folder directly
			await execa(editor, [normalizedPath]);
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
	const configPath = join(
		projectPath,
		DEVCONTAINER_DIR_NAME,
		DEVCONTAINER_CONFIG_NAME,
	);
	const altConfigPath = join(projectPath, DEVCONTAINER_ALT_CONFIG_NAME);
	return existsSync(configPath) || existsSync(altConfigPath);
}
