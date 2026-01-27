// src/lib/__tests__/test-utils.ts
/**
 * @file test-utils.ts
 * @description Shared utilities for test setup and teardown.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { stringify } from "yaml";
import type { DevboxConfigV2, RemoteEntry } from "../../types/index.ts";

export interface TestContext {
	testDir: string;
	cleanup: () => void;
}

/**
 * Creates an isolated test environment with DEVBOX_HOME set.
 */
export function createTestContext(name: string): TestContext {
	const testDir = join(tmpdir(), `devbox-${name}-test-${Date.now()}`);
	const originalEnv = process.env.DEVBOX_HOME;

	mkdirSync(testDir, { recursive: true });
	process.env.DEVBOX_HOME = testDir;

	return {
		testDir,
		cleanup: () => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true });
			}
			if (originalEnv) {
				process.env.DEVBOX_HOME = originalEnv;
			} else {
				delete process.env.DEVBOX_HOME;
			}
		},
	};
}

/**
 * Creates a test config with sensible defaults.
 */
export function createTestConfig(
	overrides: Partial<DevboxConfigV2> = {},
): DevboxConfigV2 {
	return {
		editor: "cursor",
		defaults: { sync_mode: "two-way-resolved", ignore: [] },
		remotes: {},
		projects: {},
		...overrides,
	};
}

/**
 * Creates a test remote entry.
 */
export function createTestRemote(
	name: string,
	overrides: Partial<RemoteEntry> = {},
): RemoteEntry {
	return {
		host: `${name}.example.com`,
		user: "testuser",
		path: "/home/testuser/projects",
		...overrides,
	};
}

/**
 * Writes a test config to the test directory.
 */
export function writeTestConfig(testDir: string, config: DevboxConfigV2): void {
	const configPath = join(testDir, "config.yaml");
	writeFileSync(configPath, stringify(config));
}

/**
 * Check if execa module is mocked by another test file.
 * When mocked, execa won't execute real commands properly.
 */
export const isExecaMocked = async (): Promise<boolean> => {
	try {
		const result = await execa("echo", ["test"]);
		return (
			typeof result?.stdout !== "string" || result.stdout.trim() !== "test"
		);
	} catch {
		return true;
	}
};

/**
 * Check if Docker is available on the system.
 */
export const isDockerAvailable = async (): Promise<boolean> => {
	try {
		const result = await execa("docker", ["info"], { timeout: 5000 });
		return result.exitCode === 0;
	} catch {
		return false;
	}
};
