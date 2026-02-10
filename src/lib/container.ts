// Docker container operations: query, start, stop, inspect.

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
import { launchProjectInEditor } from "@lib/editor-launch.ts";
import { execa } from "execa";

// Normalize path to real case (important for macOS case-insensitive filesystem)
// Docker labels use exact string match, so paths must match exactly
const normalizePath = (path: string): string => {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
};

// resolve devcontainer config path
const resolveDevcontainerConfigPath = (projectPath: string): string | null => {
	const configPath = join(
		projectPath,
		DEVCONTAINER_DIR_NAME,
		DEVCONTAINER_CONFIG_NAME,
	);
	const altConfigPath = join(projectPath, DEVCONTAINER_ALT_CONFIG_NAME);
	if (existsSync(configPath)) return configPath;
	if (existsSync(altConfigPath)) return altConfigPath;
	return null;
};

// parse container status
const parseContainerStatus = (
	rawStatus: string | undefined,
): ContainerStatus => {
	return rawStatus?.toLowerCase().startsWith("up")
		? ContainerStatus.Running
		: ContainerStatus.Stopped;
};

// validate a Docker container ID (short or full hex format).
const isValidContainerId = (id: string): boolean => {
	return /^[a-f0-9]{12,64}$/.test(id);
};

import { getExecaErrorMessage, hasExitCode } from "@lib/errors.ts";
import {
	type ContainerInfo,
	type ContainerResult,
	ContainerStatus,
	type DevcontainerWorkspaceConfig,
} from "@typedefs/index.ts";

export type EditorId = (typeof SUPPORTED_EDITORS)[number]["id"] | string;

// query Docker for containers matching a label filter.
// centralizes the common Docker query pattern used throughout the codebase.
const queryDockerContainers = async (options: {
	projectPath?: string;
	includeAll?: boolean; // Include stopped containers (-a)
	idsOnly?: boolean; // Return only container IDs (-q)
	format?: string; // Custom format string
}): Promise<string> => {
	const { projectPath, includeAll = false, idsOnly = false, format } = options;

	const args = ["ps"];
	if (includeAll) args.push("-a");
	if (idsOnly) args.push("-q");

	// Filter by label
	if (projectPath) {
		const normalizedPath = normalizePath(projectPath);
		args.push("--filter", `label=${DOCKER_LABEL_KEY}=${normalizedPath}`);
	} else {
		args.push("--filter", `label=${DOCKER_LABEL_KEY}`);
	}

	if (format) {
		args.push("--format", format);
	}

	const result = await execa("docker", args);
	return result.stdout.trim();
};

// Read devcontainer.json configuration
export const getDevcontainerConfig = (
	projectPath: string,
): DevcontainerWorkspaceConfig | null => {
	let content: string;
	try {
		const configPath = resolveDevcontainerConfigPath(projectPath);
		if (!configPath) return null;
		content = readFileSync(configPath, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
};

// Get container ID for a local project
export const getContainerId = async (
	projectPath: string,
): Promise<string | null> => {
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
};

// Get container status for a local project
export const getContainerStatus = async (
	projectPath: string,
): Promise<ContainerStatus> => {
	try {
		const status = await queryDockerContainers({
			projectPath,
			includeAll: true,
			format: "{{.Status}}",
		});

		if (!status) {
			return ContainerStatus.NotFound;
		}
		return parseContainerStatus(status);
	} catch {
		return ContainerStatus.Error;
	}
};

// Get container info for a local project
export const getContainerInfo = async (
	projectPath: string,
): Promise<ContainerInfo | null> => {
	try {
		const line = await queryDockerContainers({
			projectPath,
			includeAll: true,
			format: "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
		});

		if (!line) return null;

		const [id, name, rawStatus, image] = line.split("\t");
		if (!isValidContainerId(id)) return null;
		const status = parseContainerStatus(rawStatus);
		return { id, name, status, rawStatus: rawStatus || "", image };
	} catch {
		return null;
	}
};

// Start a devcontainer locally
export const startContainer = async (
	projectPath: string,
	options?: { rebuild?: boolean },
): Promise<ContainerResult> => {
	const args = ["up", "--workspace-folder", projectPath];

	if (options?.rebuild) {
		args.push("--remove-existing-container");
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
};

// Stop a devcontainer
export const stopContainer = async (
	projectPath: string,
): Promise<ContainerResult> => {
	try {
		const containerId = await queryDockerContainers({
			projectPath,
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
};

// Remove a devcontainer and its volumes
export const removeContainer = async (
	projectPath: string,
	options?: { removeVolumes?: boolean },
): Promise<ContainerResult> => {
	try {
		// Get container ID
		const containerId = await queryDockerContainers({
			projectPath,
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
};

// Get all skybox-related containers
export const listSkyboxContainers = async (): Promise<ContainerInfo[]> => {
	try {
		const output = await queryDockerContainers({
			includeAll: true,
			format: "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
		});

		if (!output) return [];

		return output.split("\n").map((line) => {
			const [id, name, rawStatus, image] = line.split("\t");
			const status = parseContainerStatus(rawStatus);
			return { id, name, status, rawStatus: rawStatus || "", image };
		});
	} catch {
		return [];
	}
};

// Open project in editor with devcontainer
export const openInEditor = async (
	projectPath: string,
	editor: EditorId,
): Promise<ContainerResult> => {
	const normalizedPath = normalizePath(projectPath);
	try {
		// Get the container ID for this project
		const containerId = await queryDockerContainers({
			projectPath,
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

		const openResult = await launchProjectInEditor(
			editor,
			normalizedPath,
			devcontainerUri,
		);
		if (!openResult.success) {
			return {
				success: false,
				error: openResult.error || "Failed to open editor.",
			};
		}
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
};

// Attach to shell inside devcontainer
export const attachToShell = async (
	projectPath: string,
): Promise<ContainerResult> => {
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
};

// Check if devcontainer.json exists locally
export const hasLocalDevcontainerConfig = (projectPath: string): boolean => {
	return resolveDevcontainerConfigPath(projectPath) !== null;
};
