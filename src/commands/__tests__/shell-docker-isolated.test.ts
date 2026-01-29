// src/commands/__tests__/shell-docker.test.ts
// Tests for shell command that require execa mocking (docker exec calls)
// Isolated to prevent polluting other test files
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";
import type { LockInfo, LockStatus } from "../../types/index.ts";

// Mock execa first - this will persist globally for this file
const mockExeca = mock(() => Promise.resolve({ exitCode: 0 }));
mock.module("execa", () => ({ execa: mockExeca }));

// Import original lock module BEFORE mocking to preserve real implementations
import * as originalLock from "../../lib/lock.ts";

// Mock the lock module - spread original exports, only override getLockStatus
const mockGetLockStatus = mock(
	(_project: string, _config: unknown): Promise<LockStatus> =>
		Promise.resolve({ locked: false }),
);

mock.module("../../lib/lock.ts", () => ({
	...originalLock,
	getLockStatus: mockGetLockStatus,
}));

// Mock inquirer
const mockPrompt = mock(
	(_questions: unknown[]): Promise<Record<string, unknown>> =>
		Promise.resolve({ startContainer: true }),
);

mock.module("inquirer", () => ({
	default: { prompt: mockPrompt },
}));

// Mock container module with all exports
const mockGetContainerStatus = mock(
	(_path: string): Promise<string> => Promise.resolve("running"),
);

const mockGetContainerId = mock(
	(_path: string): Promise<string | null> =>
		Promise.resolve("container-abc123"),
);

const mockGetDevcontainerConfig = mock(
	(_path: string): { workspaceFolder?: string } | null => ({
		workspaceFolder: "/workspaces/myapp",
	}),
);

mock.module("../../lib/container.ts", () => ({
	getContainerStatus: mockGetContainerStatus,
	getContainerId: mockGetContainerId,
	getDevcontainerConfig: mockGetDevcontainerConfig,
	getContainerInfo: mock(() => Promise.resolve(null)),
	startContainer: mock(() => Promise.resolve({ success: true })),
	stopContainer: mock(() => Promise.resolve({ success: true })),
	removeContainer: mock(() => Promise.resolve({ success: true })),
	listDevboxContainers: mock(() => Promise.resolve([])),
	openInEditor: mock(() => Promise.resolve()),
	attachToShell: mock(() => Promise.resolve()),
	hasLocalDevcontainerConfig: mock(() => false),
	ContainerStatus: {
		Running: "running",
		Stopped: "stopped",
		NotFound: "not_found",
	},
	SUPPORTED_EDITORS: [
		{ id: "code", name: "VS Code" },
		{ id: "cursor", name: "Cursor" },
	],
}));

// Mock up command
const mockUpCommand = mock(
	(_project: string, _options: unknown): Promise<void> => Promise.resolve(),
);

mock.module("../up.ts", () => ({
	upCommand: mockUpCommand,
}));

describe("shell command docker exec", () => {
	let ctx: TestContext;
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;

	beforeEach(() => {
		ctx = createTestContext("shell-docker");
		mkdirSync(join(ctx.testDir, "Projects", "myapp"), { recursive: true });
		mkdirSync(join(ctx.testDir, "Projects", "myapp", ".devcontainer"), {
			recursive: true,
		});

		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			`remote:
  host: devbox-server
  base_path: ~/code
editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
projects: {}
`,
		);

		writeFileSync(
			join(
				ctx.testDir,
				"Projects",
				"myapp",
				".devcontainer",
				"devcontainer.json",
			),
			JSON.stringify({ workspaceFolder: "/workspaces/myapp" }),
		);

		exitCode = undefined;
		originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as typeof process.exit;

		// Reset all mocks
		mockExeca.mockReset();
		mockGetLockStatus.mockReset();
		mockPrompt.mockReset();
		mockGetContainerStatus.mockReset();
		mockGetContainerId.mockReset();
		mockGetDevcontainerConfig.mockReset();
		mockUpCommand.mockReset();

		// Set default mock returns
		mockExeca.mockResolvedValue({ exitCode: 0 });
		mockGetLockStatus.mockResolvedValue({ locked: false });
		mockPrompt.mockResolvedValue({ startContainer: true });
		mockGetContainerStatus.mockResolvedValue("running");
		mockGetContainerId.mockResolvedValue("container-abc123");
		mockGetDevcontainerConfig.mockReturnValue({
			workspaceFolder: "/workspaces/myapp",
		});
	});

	afterEach(() => {
		ctx.cleanup();
		process.exit = originalExit;
	});

	describe("successful execution", () => {
		test("proceeds when lock is owned by current machine", async () => {
			const lockInfo: LockInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date().toISOString(),
				pid: process.pid,
			};

			mockGetLockStatus.mockResolvedValueOnce({
				locked: true,
				ownedByMe: true,
				info: lockInfo,
			});

			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", {});

			expect(exitCode).toBeUndefined();
			expect(mockExeca).toHaveBeenCalled();
		});

		test("proceeds when project is not locked", async () => {
			mockGetLockStatus.mockResolvedValueOnce({ locked: false });

			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", {});

			expect(exitCode).toBeUndefined();
			expect(mockExeca).toHaveBeenCalled();
		});
	});

	describe("container auto-start", () => {
		test("prompts and starts container when not running", async () => {
			mockGetContainerStatus.mockResolvedValueOnce("stopped");
			mockPrompt.mockResolvedValueOnce({ startContainer: true });

			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", {});

			expect(mockPrompt).toHaveBeenCalled();
			expect(mockUpCommand).toHaveBeenCalledWith("myapp", { noPrompt: true });
		});

		test("skips prompt when container is running", async () => {
			mockGetContainerStatus.mockResolvedValueOnce("running");

			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", {});

			expect(mockPrompt).not.toHaveBeenCalled();
		});
	});

	describe("workspace path", () => {
		test("uses custom workspace path from devcontainer.json", async () => {
			mockGetDevcontainerConfig.mockReturnValueOnce({
				workspaceFolder: "/custom/path",
			});

			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", {});

			expect(mockExeca).toHaveBeenCalledWith(
				"docker",
				expect.arrayContaining(["-w", "/custom/path"]),
				expect.any(Object),
			);
		});

		test("falls back to default workspace path when not specified", async () => {
			mockGetDevcontainerConfig.mockReturnValueOnce({});

			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", {});

			expect(mockExeca).toHaveBeenCalledWith(
				"docker",
				expect.arrayContaining(["-w", "/workspaces/myapp"]),
				expect.any(Object),
			);
		});
	});

	describe("docker exec modes", () => {
		test("uses -it flags for interactive mode", async () => {
			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", {});

			const calls = mockExeca.mock.calls;
			const lastCall = calls[calls.length - 1] as unknown as [
				string,
				string[],
				unknown,
			];
			expect(lastCall[1]).toContain("-it");
		});

		test("runs command with -c flag in command mode", async () => {
			const { shellCommand } = await import("../shell.ts");
			await shellCommand("myapp", { command: "npm test" });

			const calls = mockExeca.mock.calls;
			const lastCall = calls[calls.length - 1] as unknown as [
				string,
				string[],
				unknown,
			];
			expect(lastCall[1]).toContain("-c");
			expect(lastCall[1]).toContain("npm test");
			expect(lastCall[1]).not.toContain("-it");
		});
	});
});
