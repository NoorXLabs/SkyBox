// tests/integration/helpers/docker-test-utils.ts
/**
 * @file docker-test-utils.ts
 * @description Utilities for Docker-based integration tests.
 * Provides isolated test contexts, container management, and cleanup functions.
 */

import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	CONTAINER_POLL_INTERVAL,
	DEFAULT_CONTAINER_TIMEOUT,
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	DOCKER_LABEL_KEY,
	DOCKER_TEST_LABEL,
	TEMPLATES,
} from "@lib/constants.ts";
import {
	createTestConfig,
	createTestContext,
	createTestRemote,
	writeTestConfig,
} from "@tests/helpers/test-utils.ts";
import type { DevcontainerConfig, Template } from "@typedefs/index.ts";
import { execa } from "execa";

// Re-export availability checks from existing test-utils
export {
	isDevcontainerCliAvailable,
	isDockerAvailable,
} from "@tests/helpers/test-utils.ts";
/**
 * Container state as reported by Docker inspect.
 */
export type ContainerState = "running" | "exited" | null;

/**
 * Context for Docker-based integration tests.
 */
export interface DockerTestContext {
	/** Unique project name for this test */
	projectName: string;
	/** Temporary test directory set as SKYBOX_HOME */
	testDir: string;
	/** Project directory under testDir/Projects */
	projectDir: string;
	/** Normalized project directory path (for container label matching) */
	normalizedProjectDir: string;
	/** Cleanup function that removes container and temp directory */
	cleanup: () => Promise<void>;
}

/**
 * Generates a unique project name for tests.
 * Format: test-{name}-{timestamp}-{random}
 */
const generateTestProjectName = (name: string): string => {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `test-${name}-${timestamp}-${random}`;
};

/**
 * Creates an isolated Docker test context with a unique project name,
 * temporary directory, and cleanup function.
 *
 * @param name - Base name for the test (will be made unique)
 * @returns DockerTestContext with project info and cleanup function
 */
export const createDockerTestContext = (name: string): DockerTestContext => {
	const projectName = generateTestProjectName(name);
	const baseContext = createTestContext(`integration-${projectName}`);
	const testDir = baseContext.testDir;
	const projectDir = join(testDir, "Projects", projectName);

	// Create directory structure
	mkdirSync(projectDir, { recursive: true });

	// Normalize path for container label matching (macOS symlinks like /var -> /private/var)
	const normalizedProjectDir = realpathSync(projectDir);

	const cleanup = async (): Promise<void> => {
		// Find and remove the container by the devcontainer.local_folder label
		try {
			const containerId =
				await getContainerIdByProjectPath(normalizedProjectDir);
			if (containerId) {
				await execa("docker", ["rm", "-f", containerId], { reject: false });
			}
		} catch {
			// Ignore errors - container may not exist
		}

		baseContext.cleanup();
	};

	return {
		projectName,
		testDir,
		projectDir,
		normalizedProjectDir,
		cleanup,
	};
};

/**
 * Creates a Docker test context with standard test config and devcontainer setup.
 *
 * @param name - Base name for this test context
 * @param templateId - Devcontainer template id (default: node)
 * @returns Configured DockerTestContext
 */
export const createDockerProjectTestContext = (
	name: string,
	templateId = "node",
): DockerTestContext => {
	const ctx = createDockerTestContext(name);
	const config = createTestConfig({
		remotes: { test: createTestRemote("test") },
		projects: { [ctx.projectName]: { remote: "test" } },
	});
	writeTestConfig(ctx.testDir, config);
	createMinimalDevcontainer(ctx.projectDir, templateId);
	return ctx;
};

/**
 * Boots a configured test project container and waits for it to be running.
 *
 * @param ctx - Docker test context for the project
 */
export const startDockerProjectContainer = async (
	ctx: DockerTestContext,
): Promise<void> => {
	await execa("devcontainer", ["up", "--workspace-folder", ctx.projectDir]);
	await waitForContainer(ctx.normalizedProjectDir);
};

/**
 * Finds a container ID by the devcontainer.local_folder label.
 * This is how devcontainer CLI labels containers.
 *
 * @param projectPath - Normalized project path to search for
 * @returns Container ID if found, null otherwise
 */
export const getContainerIdByProjectPath = async (
	projectPath: string,
): Promise<string | null> => {
	try {
		const result = await execa("docker", [
			"ps",
			"-aq",
			"--filter",
			`label=${DOCKER_LABEL_KEY}=${projectPath}`,
		]);
		const containerId = result.stdout.trim();
		return containerId || null;
	} catch {
		return null;
	}
};

/**
 * Waits for a container to be in the running state.
 * Finds container by the devcontainer.local_folder label.
 *
 * @param projectPath - Normalized project path to find container for
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 * @throws Error if timeout is exceeded before container is running
 */
export const waitForContainer = async (
	projectPath: string,
	timeout = DEFAULT_CONTAINER_TIMEOUT,
): Promise<void> => {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		try {
			// Find container by label
			const containerId = await getContainerIdByProjectPath(projectPath);
			if (containerId) {
				const result = await execa("docker", [
					"inspect",
					"-f",
					"{{.State.Running}}",
					containerId,
				]);

				if (result.stdout.trim() === "true") {
					return;
				}
			}
		} catch {
			// Container may not exist yet, continue polling
		}

		await sleep(CONTAINER_POLL_INTERVAL);
	}

	throw new Error(
		`Timeout waiting for container at "${projectPath}" to be running after ${timeout}ms`,
	);
};

/**
 * Gets the current status of a container by project path.
 * Finds container by the devcontainer.local_folder label.
 *
 * @param projectPath - Normalized project path to find container for
 * @returns "running" if running, "exited" if stopped, or null if not found
 */
export const getContainerStatus = async (
	projectPath: string,
): Promise<ContainerState> => {
	try {
		const containerId = await getContainerIdByProjectPath(projectPath);
		if (!containerId) {
			return null;
		}

		const result = await execa("docker", [
			"inspect",
			"-f",
			"{{.State.Status}}",
			containerId,
		]);

		const status = result.stdout.trim().toLowerCase();

		if (status === "running") {
			return "running";
		}

		if (status === "exited" || status === "stopped" || status === "dead") {
			return "exited";
		}

		// Other states like "created", "paused", "restarting" map to null for simplicity
		return null;
	} catch {
		// Container not found or other error
		return null;
	}
};

/**
 * Removes all Docker containers with the skybox-test=true label.
 * Used for cleanup after test runs.
 *
 * @returns Number of containers removed
 */
export const cleanupTestContainers = async (): Promise<number> => {
	try {
		// Find all containers with the test label
		const listResult = await execa("docker", [
			"ps",
			"-aq",
			"--filter",
			`label=${DOCKER_TEST_LABEL}`,
		]);

		const containerIds = listResult.stdout
			.trim()
			.split("\n")
			.filter((id) => id.length > 0);

		if (containerIds.length === 0) {
			return 0;
		}

		// Remove all found containers
		await execa("docker", ["rm", "-f", ...containerIds]);

		return containerIds.length;
	} catch {
		return 0;
	}
};

/**
 * Creates a minimal devcontainer.json in the specified project directory.
 * Uses the node template by default, with test-specific labels for cleanup.
 *
 * @param projectDir - Directory to create .devcontainer in
 * @param templateId - Template ID to use (default: "node")
 * @returns Path to the created devcontainer.json
 */
export const createMinimalDevcontainer = (
	projectDir: string,
	templateId = "node",
): string => {
	const devcontainerDir = join(projectDir, DEVCONTAINER_DIR_NAME);
	const configPath = join(devcontainerDir, DEVCONTAINER_CONFIG_NAME);

	// Find the template
	const template = TEMPLATES.find((t: Template) => t.id === templateId);
	if (!template) {
		throw new Error(
			`Template "${templateId}" not found. Available: ${TEMPLATES.map((t: Template) => t.id).join(", ")}`,
		);
	}

	// Create minimal config with test label
	const config: DevcontainerConfig & {
		runArgs?: string[];
		containerEnv?: Record<string, string>;
	} = {
		name: `test-${templateId}`,
		image: template.config.image,
		// Add test label for easy cleanup
		runArgs: ["--label", DOCKER_TEST_LABEL],
		// Minimal features - just what's needed for tests
		features: {},
		// Skip post commands for faster test startup
		postCreateCommand: undefined,
		postStartCommand: undefined,
		// Disable workspace bind mount: CI self-hosted runners (e.g. Coolify) run inside
		// Docker containers. Paths in /tmp inside the runner don't exist on the Docker host,
		// so bind mounts fail. Tests don't need workspace files mounted.
		workspaceMount: "",
		// Use /tmp as workspaceFolder since it always exists in every container image.
		// Cannot use /workspaces/test because onCreateCommand (which would create it)
		// runs via docker exec, which chdir's to workspaceFolder first — circular dependency.
		workspaceFolder: "/tmp",
	};

	// Create directory and write config
	mkdirSync(devcontainerDir, { recursive: true });
	writeFileSync(configPath, JSON.stringify(config, null, "\t"));

	return configPath;
};

/**
 * Sleep utility for polling operations.
 */
const sleep = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
