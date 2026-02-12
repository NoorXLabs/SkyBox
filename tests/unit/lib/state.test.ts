// tests/unit/lib/state.test.ts
//
// Tests for the unified state module (ownership + session).
// Ownership tests require SSH mocking (isolated process).
//
// ISOLATION REQUIRED: Bun's mock.module() is permanent per process and cannot
// be reset in afterEach. This file must run in its own test process.
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { hostname, tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import {
	SESSION_FILE_MODE,
	SESSION_HMAC_KEY,
	SESSION_TTL_MS,
	STATE_FILE,
} from "@lib/constants.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

// Mock runRemoteCommand for ownership tests
const mockRunRemoteCommand = mock(
	(
		_host: string,
		_command: string,
	): Promise<{ success: boolean; stdout?: string; error?: string }> =>
		Promise.resolve({ success: true, stdout: "" }),
);

import * as originalSsh from "@lib/ssh.ts";

mock.module("@lib/ssh.ts", () => ({
	...originalSsh,
	runRemoteCommand: mockRunRemoteCommand,
}));

// Now import state module (which uses ssh.ts)
import {
	checkSessionConflict,
	checkWriteAuthorization,
	createOwnershipInfo,
	deleteSession,
	getMachineName,
	getOwnershipStatus,
	getStateFilePath,
	isOwner,
	parseOwnershipInfo,
	readSession,
	setOwnership,
	writeSession,
} from "@lib/state.ts";
import type { SessionInfo } from "@typedefs/index.ts";

// mirrors the private computeSessionHash in state.ts for test use
const computeTestHash = (session: SessionInfo): string => {
	const payload = `${session.machine}:${session.user}:${session.timestamp}:${session.pid}:${session.expires}`;
	return createHmac("sha256", SESSION_HMAC_KEY).update(payload).digest("hex");
};

// write a manually-constructed session to the state file with a valid integrity hash
const writeTestSession = (projectPath: string, session: SessionInfo): void => {
	const filePath = join(projectPath, STATE_FILE);
	const dir = join(projectPath, ".skybox");
	mkdirSync(dir, { recursive: true });

	const existing = existsSync(filePath)
		? JSON.parse(readFileSync(filePath, "utf-8"))
		: {};
	existing.session = { ...session, hash: computeTestHash(session) };
	writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8");
};

// ── Ownership Tests ──

describe("ownership", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("state-ownership");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("parseOwnershipInfo", () => {
		test("parses valid ownership JSON (top-level format)", () => {
			const json = JSON.stringify({
				owner: "testuser",
				created: "2026-02-03T12:00:00Z",
				machine: "test-machine",
			});

			const result = parseOwnershipInfo(json);

			expect(result).not.toBeNull();
			expect(result?.owner).toBe("testuser");
			expect(result?.created).toBe("2026-02-03T12:00:00Z");
			expect(result?.machine).toBe("test-machine");
		});

		test("parses valid ownership JSON (nested format)", () => {
			const json = JSON.stringify({
				ownership: {
					owner: "testuser",
					created: "2026-02-03T12:00:00Z",
					machine: "test-machine",
				},
				session: {
					machine: "some-machine",
					user: "someuser",
				},
			});

			const result = parseOwnershipInfo(json);

			expect(result).not.toBeNull();
			expect(result?.owner).toBe("testuser");
		});

		test("returns null for invalid JSON", () => {
			const result = parseOwnershipInfo("not json");
			expect(result).toBeNull();
		});

		test("returns null for incomplete ownership info", () => {
			const json = JSON.stringify({ owner: "testuser" });
			const result = parseOwnershipInfo(json);
			expect(result).toBeNull();
		});
	});

	describe("createOwnershipInfo", () => {
		test("creates ownership info with current user and timestamp", () => {
			const info = createOwnershipInfo();

			expect(info.owner).toBeTruthy();
			expect(info.machine).toBeTruthy();
			expect(new Date(info.created).getTime()).toBeGreaterThan(0);
		});
	});

	describe("isOwner", () => {
		test("returns true when current user matches owner", () => {
			const info = createOwnershipInfo();
			expect(isOwner(info)).toBe(true);
		});

		test("returns false when owner is different user", () => {
			const info = {
				owner: "different-user",
				created: new Date().toISOString(),
				machine: "some-machine",
			};
			expect(isOwner(info)).toBe(false);
		});
	});
});

describe("getOwnershipStatus", () => {
	beforeEach(() => {
		mockRunRemoteCommand.mockReset();
	});

	afterEach(() => {
		mockRunRemoteCommand.mockClear();
	});

	test("returns hasOwner: false when file not found", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: false,
			stdout: "",
			error: "No such file",
		});

		const result = await getOwnershipStatus("test-host", "/path/to/project");

		expect(result.hasOwner).toBe(false);
	});

	test("returns hasOwner: true with correct info when file exists", async () => {
		const stateJson = JSON.stringify({
			ownership: {
				owner: "testuser",
				created: "2026-02-04T12:00:00Z",
				machine: "test-machine",
			},
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: stateJson,
		});

		const result = await getOwnershipStatus("test-host", "/path/to/project");

		expect(result.hasOwner).toBe(true);
		if (result.hasOwner) {
			expect(result.info.owner).toBe("testuser");
			expect(result.info.created).toBe("2026-02-04T12:00:00Z");
			expect(result.info.machine).toBe("test-machine");
		}
	});

	test("returns hasOwner: false for malformed JSON", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: "not valid json",
		});

		const result = await getOwnershipStatus("test-host", "/path/to/project");

		expect(result.hasOwner).toBe(false);
	});

	test("returns hasOwner: false for empty stdout", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: "",
		});

		const result = await getOwnershipStatus("test-host", "/path/to/project");

		expect(result.hasOwner).toBe(false);
	});

	test("returns hasOwner: false for whitespace-only stdout", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: "   \n\t  ",
		});

		const result = await getOwnershipStatus("test-host", "/path/to/project");

		expect(result.hasOwner).toBe(false);
	});

	test("returns isOwner: false when different user owns project", async () => {
		const stateJson = JSON.stringify({
			ownership: {
				owner: "other-user",
				created: "2026-02-04T12:00:00Z",
				machine: "other-machine",
			},
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: stateJson,
		});

		const result = await getOwnershipStatus("test-host", "/path/to/project");

		expect(result.hasOwner).toBe(true);
		if (result.hasOwner) {
			expect(result.isOwner).toBe(false);
		}
	});
});

describe("setOwnership", () => {
	beforeEach(() => {
		mockRunRemoteCommand.mockReset();
	});

	afterEach(() => {
		mockRunRemoteCommand.mockClear();
	});

	test("writes ownership to remote state file", async () => {
		// First call: read existing state (empty)
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: false,
			stdout: "",
		});
		// Second call: write merged state
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
		});

		const result = await setOwnership("test-host", "/path/to/project");

		expect(result.success).toBe(true);
		expect(mockRunRemoteCommand).toHaveBeenCalledTimes(2);
	});

	test("preserves existing session data when writing ownership", async () => {
		const existingState = JSON.stringify({
			session: {
				machine: "some-machine",
				user: "someuser",
				timestamp: "2026-02-04T10:00:00Z",
				pid: 12345,
				expires: "2026-02-05T10:00:00Z",
			},
		});

		// First call: read existing state (has session)
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: existingState,
		});
		// Second call: write merged state
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
		});

		const result = await setOwnership("test-host", "/path/to/project");

		expect(result.success).toBe(true);
		// Verify the write command contains both sections
		const writeCall = mockRunRemoteCommand.mock.calls[1];
		const writeCommand = writeCall[1] as string;
		// The base64-encoded JSON should be present in the command
		expect(writeCommand).toContain("base64");
	});

	test("returns error on write failure", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: false,
			stdout: "",
		});
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: false,
			error: "Permission denied",
		});

		const result = await setOwnership("test-host", "/path/to/project");

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

describe("checkWriteAuthorization", () => {
	beforeEach(() => {
		mockRunRemoteCommand.mockReset();
	});

	afterEach(() => {
		mockRunRemoteCommand.mockClear();
	});

	test("returns authorized: true when no state file", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: false,
			stdout: "",
		});

		const result = await checkWriteAuthorization(
			"test-host",
			"/path/to/project",
		);

		expect(result.authorized).toBe(true);
	});

	test("returns authorized: true when current user owns project", async () => {
		const currentOwnership = createOwnershipInfo();
		const stateJson = JSON.stringify({ ownership: currentOwnership });

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: stateJson,
		});

		const result = await checkWriteAuthorization(
			"test-host",
			"/path/to/project",
		);

		expect(result.authorized).toBe(true);
	});

	test("returns authorized: false when different user owns", async () => {
		const stateJson = JSON.stringify({
			ownership: {
				owner: "other-user",
				created: "2026-02-04T12:00:00Z",
				machine: "other-machine",
			},
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: stateJson,
		});

		const result = await checkWriteAuthorization(
			"test-host",
			"/path/to/project",
		);

		expect(result.authorized).toBe(false);
		expect(result.error).toContain("other-user");
		expect(result.error).toContain("other-machine");
	});

	test("returns ownerInfo when not authorized", async () => {
		const stateJson = JSON.stringify({
			ownership: {
				owner: "other-user",
				created: "2026-02-04T12:00:00Z",
				machine: "other-machine",
			},
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: stateJson,
		});

		const result = await checkWriteAuthorization(
			"test-host",
			"/path/to/project",
		);

		expect(result.ownerInfo).toBeDefined();
		expect(result.ownerInfo?.owner).toBe("other-user");
		expect(result.ownerInfo?.machine).toBe("other-machine");
	});

	test("returns authorized: true for empty state file", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: "",
		});

		const result = await checkWriteAuthorization(
			"test-host",
			"/path/to/project",
		);

		expect(result.authorized).toBe(true);
	});
});

// ── Session Tests ──

describe("session", () => {
	let testDir: string;
	let projectPath: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-state-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		projectPath = join(testDir, "test-project");
		mkdirSync(projectPath, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("getMachineName", () => {
		test("returns the hostname", () => {
			const machineName = getMachineName();
			expect(machineName).toBe(hostname());
		});
	});

	describe("getStateFilePath", () => {
		test("returns correct path for project", () => {
			const stateFilePath = getStateFilePath(projectPath);
			expect(stateFilePath).toBe(join(projectPath, STATE_FILE));
		});

		test("includes .skybox directory in path", () => {
			const stateFilePath = getStateFilePath(projectPath);
			expect(stateFilePath).toContain(".skybox");
			expect(stateFilePath).toContain("state.lock");
		});
	});

	describe("writeSession", () => {
		test("creates .skybox directory if it does not exist", () => {
			const skyboxDir = join(projectPath, ".skybox");
			expect(existsSync(skyboxDir)).toBe(false);

			writeSession(projectPath);

			expect(existsSync(skyboxDir)).toBe(true);
		});

		test("creates state file with correct session content and hash", () => {
			writeSession(projectPath);

			const stateFilePath = getStateFilePath(projectPath);
			expect(existsSync(stateFilePath)).toBe(true);

			const content = readFileSync(stateFilePath, "utf-8");
			const state = JSON.parse(content);
			const session: SessionInfo = state.session;

			expect(session.machine).toBe(hostname());
			expect(session.user).toBe(userInfo().username);
			expect(session.pid).toBe(process.pid);
			expect(session.timestamp).toBeDefined();
			expect(session.expires).toBeDefined();
			expect(session.hash).toBeDefined();
			expect(session.hash).toBe(computeTestHash(session));
		});

		test("sets expiry to TTL from now", () => {
			const beforeWrite = Date.now();
			writeSession(projectPath);
			const afterWrite = Date.now();

			const stateFilePath = getStateFilePath(projectPath);
			const content = readFileSync(stateFilePath, "utf-8");
			const state = JSON.parse(content);
			const session: SessionInfo = state.session;

			const expiresTime = new Date(session.expires).getTime();
			const expectedMin = beforeWrite + SESSION_TTL_MS;
			const expectedMax = afterWrite + SESSION_TTL_MS;

			expect(expiresTime).toBeGreaterThanOrEqual(expectedMin);
			expect(expiresTime).toBeLessThanOrEqual(expectedMax);
		});

		test("overwrites existing session", () => {
			writeSession(projectPath);
			const stateFilePath = getStateFilePath(projectPath);
			const firstContent = readFileSync(stateFilePath, "utf-8");
			const firstSession: SessionInfo = JSON.parse(firstContent).session;

			writeSession(projectPath);
			const secondContent = readFileSync(stateFilePath, "utf-8");
			const secondSession: SessionInfo = JSON.parse(secondContent).session;

			expect(secondSession.machine).toBe(firstSession.machine);
			expect(secondSession.pid).toBe(process.pid);
		});

		test("sets state file to read-only after write", () => {
			writeSession(projectPath);

			const stateFilePath = getStateFilePath(projectPath);
			const stats = statSync(stateFilePath);
			const mode = stats.mode & 0o777;

			expect(mode).toBe(SESSION_FILE_MODE);
		});

		test("preserves existing ownership data", () => {
			// Write ownership data first
			const stateFilePath = getStateFilePath(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			mkdirSync(skyboxDir, { recursive: true });
			writeFileSync(
				stateFilePath,
				JSON.stringify({
					ownership: {
						owner: "testuser",
						created: "2026-02-04T12:00:00Z",
						machine: "test-machine",
					},
				}),
			);

			// Write session — should preserve ownership
			writeSession(projectPath);

			const content = readFileSync(stateFilePath, "utf-8");
			const state = JSON.parse(content);

			expect(state.ownership).toBeDefined();
			expect(state.ownership.owner).toBe("testuser");
			expect(state.session).toBeDefined();
			expect(state.session.machine).toBe(hostname());
		});
	});

	describe("readSession", () => {
		test("returns null when state file does not exist", () => {
			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when state file contains invalid JSON", () => {
			const stateFilePath = getStateFilePath(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			mkdirSync(skyboxDir, { recursive: true });
			writeFileSync(stateFilePath, "not valid json", "utf-8");

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when session section is missing", () => {
			const stateFilePath = getStateFilePath(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			mkdirSync(skyboxDir, { recursive: true });
			writeFileSync(
				stateFilePath,
				JSON.stringify({
					ownership: {
						owner: "testuser",
						created: "2026-02-04T12:00:00Z",
						machine: "test-machine",
					},
				}),
			);

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when session is missing required fields", () => {
			const stateFilePath = getStateFilePath(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			mkdirSync(skyboxDir, { recursive: true });

			writeFileSync(
				stateFilePath,
				JSON.stringify({
					session: {
						user: "testuser",
						timestamp: new Date().toISOString(),
						pid: 12345,
						expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
					},
				}),
			);

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when session has expired", () => {
			const expiredSession: SessionInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date(Date.now() - 2 * SESSION_TTL_MS).toISOString(),
				pid: 12345,
				expires: new Date(Date.now() - 1000).toISOString(),
			};
			writeTestSession(projectPath, expiredSession);

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns session when valid and not expired", () => {
			writeSession(projectPath);

			const session = readSession(projectPath);

			expect(session).not.toBeNull();
			expect(session?.machine).toBe(hostname());
			expect(session?.user).toBe(userInfo().username);
			expect(session?.pid).toBe(process.pid);
		});

		test("returns session from a different machine if not expired", () => {
			const otherMachineSession: SessionInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 99999,
				expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};
			writeTestSession(projectPath, otherMachineSession);

			const session = readSession(projectPath);

			expect(session).not.toBeNull();
			expect(session?.machine).toBe("other-machine");
			expect(session?.user).toBe("otheruser");
		});

		test("returns null when session has no hash", () => {
			const stateFilePath = getStateFilePath(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			mkdirSync(skyboxDir, { recursive: true });

			writeFileSync(
				stateFilePath,
				JSON.stringify({
					session: {
						machine: "other-machine",
						user: "otheruser",
						timestamp: new Date().toISOString(),
						pid: 99999,
						expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
					},
				}),
			);

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when session has been tampered with", () => {
			const original: SessionInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 99999,
				expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};
			const hash = computeTestHash(original);

			const stateFilePath = getStateFilePath(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			mkdirSync(skyboxDir, { recursive: true });

			// Tamper with machine name but keep old hash
			writeFileSync(
				stateFilePath,
				JSON.stringify({
					session: { ...original, machine: "hacked-machine", hash },
				}),
			);

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});
	});

	describe("deleteSession", () => {
		test("removes session section when it exists", () => {
			writeSession(projectPath);
			const stateFilePath = getStateFilePath(projectPath);
			expect(existsSync(stateFilePath)).toBe(true);

			deleteSession(projectPath);

			// File should be deleted since session was the only section
			expect(existsSync(stateFilePath)).toBe(false);
		});

		test("silently succeeds when state file does not exist", () => {
			const stateFilePath = getStateFilePath(projectPath);
			expect(existsSync(stateFilePath)).toBe(false);

			deleteSession(projectPath);

			expect(existsSync(stateFilePath)).toBe(false);
		});

		test("preserves ownership when deleting session", () => {
			// Write state with both sections
			const stateFilePath = getStateFilePath(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			mkdirSync(skyboxDir, { recursive: true });

			const session: SessionInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date().toISOString(),
				pid: process.pid,
				expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};

			writeFileSync(
				stateFilePath,
				JSON.stringify({
					ownership: {
						owner: "testuser",
						created: "2026-02-04T12:00:00Z",
						machine: "test-machine",
					},
					session: { ...session, hash: computeTestHash(session) },
				}),
			);

			deleteSession(projectPath);

			// File should still exist with ownership
			expect(existsSync(stateFilePath)).toBe(true);
			const content = JSON.parse(readFileSync(stateFilePath, "utf-8"));
			expect(content.ownership).toBeDefined();
			expect(content.ownership.owner).toBe("testuser");
			expect(content.session).toBeUndefined();
		});

		test("does not remove .skybox directory", () => {
			writeSession(projectPath);
			const skyboxDir = join(projectPath, ".skybox");
			expect(existsSync(skyboxDir)).toBe(true);

			deleteSession(projectPath);

			expect(existsSync(skyboxDir)).toBe(true);
		});
	});

	describe("checkSessionConflict", () => {
		test("returns no conflict when no session exists", () => {
			const result = checkSessionConflict(projectPath);

			expect(result.hasConflict).toBe(false);
			expect(result.existingSession).toBeUndefined();
		});

		test("returns no conflict when session is from current machine", () => {
			writeSession(projectPath);

			const result = checkSessionConflict(projectPath);

			expect(result.hasConflict).toBe(false);
			expect(result.existingSession).toBeUndefined();
		});

		test("returns conflict when session is from different machine", () => {
			const otherMachineSession: SessionInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 99999,
				expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};
			writeTestSession(projectPath, otherMachineSession);

			const result = checkSessionConflict(projectPath);

			expect(result.hasConflict).toBe(true);
			expect(result.existingSession).toBeDefined();
			expect(result.existingSession?.machine).toBe("other-machine");
			expect(result.existingSession?.user).toBe("otheruser");
		});

		test("returns no conflict when session from different machine has expired", () => {
			const expiredSession: SessionInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date(Date.now() - 2 * SESSION_TTL_MS).toISOString(),
				pid: 99999,
				expires: new Date(Date.now() - 1000).toISOString(),
			};
			writeTestSession(projectPath, expiredSession);

			const result = checkSessionConflict(projectPath);

			expect(result.hasConflict).toBe(false);
			expect(result.existingSession).toBeUndefined();
		});
	});
});
