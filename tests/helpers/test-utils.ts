// tests/helpers/test-utils.ts
/**
 * @file test-utils.ts
 * @description Shared utilities for test setup and teardown.
 */

import { spyOn } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RemoteEntry, SkyboxConfigV2 } from "@typedefs/index.ts";
import { execa } from "execa";
import { stringify } from "yaml";

export interface TestContext {
	testDir: string;
	cleanup: () => void;
}

export interface UnitTestContext extends TestContext {
	logOutput: string[];
	restoreConsole: () => void;
}

type TestConfigOverrides = Omit<Partial<SkyboxConfigV2>, "defaults"> & {
	defaults?: Partial<SkyboxConfigV2["defaults"]>;
};

/**
 * Creates an isolated test environment with SKYBOX_HOME set.
 */
export const createTestContext = (name: string): TestContext => {
	const testDir = join(tmpdir(), `skybox-${name}-test-${Date.now()}`);
	const originalEnv = process.env.SKYBOX_HOME;

	mkdirSync(testDir, { recursive: true });
	process.env.SKYBOX_HOME = testDir;

	return {
		testDir,
		cleanup: () => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
			if (originalEnv) {
				process.env.SKYBOX_HOME = originalEnv;
			} else {
				delete process.env.SKYBOX_HOME;
			}
		},
	};
};

/**
 * Creates a test config with sensible defaults.
 */
export const createTestConfig = (
	overrides: TestConfigOverrides = {},
): SkyboxConfigV2 => {
	const { defaults: defaultsOverride, ...restOverrides } = overrides;
	const defaults: SkyboxConfigV2["defaults"] = {
		sync_mode: "two-way-resolved",
		ignore: [],
		...defaultsOverride,
	};

	return {
		editor: "cursor",
		defaults,
		remotes: {},
		projects: {},
		...restOverrides,
	};
};

/**
 * Creates a standard unit test context and captures console.log output.
 */
export const createUnitTestContext = (name: string): UnitTestContext => {
	const testContext = createTestContext(name);
	const logOutput: string[] = [];
	const consoleLogSpy = spyOn(console, "log").mockImplementation(
		(...args: unknown[]) => {
			logOutput.push(
				args.map((a) => (typeof a === "string" ? a : String(a))).join(" "),
			);
		},
	);

	return {
		...testContext,
		logOutput,
		restoreConsole: () => {
			consoleLogSpy.mockRestore();
		},
	};
};

/**
 * Creates a test remote entry.
 */
export const createTestRemote = (
	name: string,
	overrides: Partial<RemoteEntry> = {},
): RemoteEntry => {
	return {
		host: `${name}.example.com`,
		user: "testuser",
		path: "/home/testuser/projects",
		...overrides,
	};
};

/**
 * Writes a test config to the test directory.
 */
export const writeTestConfig = (
	testDir: string,
	config: SkyboxConfigV2,
): void => {
	const configPath = join(testDir, "config.yaml");
	writeFileSync(configPath, stringify(config));
};

/**
 * Creates an initialized git repository in the given directory.
 * Includes an initial commit so branches are established.
 */
export const createTestGitRepo = async (dir: string): Promise<void> => {
	await execa("git", ["init"], { cwd: dir });
	await execa("git", ["config", "user.email", "test@test.com"], { cwd: dir });
	await execa("git", ["config", "user.name", "Test"], { cwd: dir });
	writeFileSync(join(dir, "README.md"), "# Test");
	await execa("git", ["add", "."], { cwd: dir });
	await execa("git", ["commit", "-m", "init"], { cwd: dir });
};

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

/**
 * Check if the devcontainer CLI is available on the system.
 * Integration tests require both Docker AND the devcontainer CLI.
 */
export const isDevcontainerCliAvailable = async (): Promise<boolean> => {
	try {
		const result = await execa("devcontainer", ["--version"], {
			timeout: 5000,
		});
		return result.exitCode === 0;
	} catch {
		return false;
	}
};
