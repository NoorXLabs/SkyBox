// tests/unit/lib/session.test.ts
//
// Tests for the local session management module.
// Tests filesystem operations for session file creation, reading, and deletion.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { hostname, tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { SESSION_FILE, SESSION_TTL_MS } from "@lib/constants.ts";
import {
	checkSessionConflict,
	deleteSession,
	getMachineName,
	getSessionFilePath,
	readSession,
	type SessionInfo,
	writeSession,
} from "@lib/session.ts";

describe("session", () => {
	let testDir: string;
	let projectPath: string;

	beforeEach(() => {
		// Create isolated test directory
		testDir = join(tmpdir(), `devbox-session-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Create a mock project directory
		projectPath = join(testDir, "test-project");
		mkdirSync(projectPath, { recursive: true });
	});

	afterEach(() => {
		// Cleanup
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("getMachineName", () => {
		test("returns the hostname", () => {
			const machineName = getMachineName();
			expect(machineName).toBe(hostname());
		});
	});

	describe("getSessionFilePath", () => {
		test("returns correct path for project", () => {
			const sessionPath = getSessionFilePath(projectPath);
			expect(sessionPath).toBe(join(projectPath, SESSION_FILE));
		});

		test("includes .devbox directory in path", () => {
			const sessionPath = getSessionFilePath(projectPath);
			expect(sessionPath).toContain(".devbox");
			expect(sessionPath).toContain("session.lock");
		});
	});

	describe("writeSession", () => {
		test("creates .devbox directory if it does not exist", () => {
			const devboxDir = join(projectPath, ".devbox");
			expect(existsSync(devboxDir)).toBe(false);

			writeSession(projectPath);

			expect(existsSync(devboxDir)).toBe(true);
		});

		test("creates session file with correct content", () => {
			writeSession(projectPath);

			const sessionPath = getSessionFilePath(projectPath);
			expect(existsSync(sessionPath)).toBe(true);

			const content = readFileSync(sessionPath, "utf-8");
			const session: SessionInfo = JSON.parse(content);

			expect(session.machine).toBe(hostname());
			expect(session.user).toBe(userInfo().username);
			expect(session.pid).toBe(process.pid);
			expect(session.timestamp).toBeDefined();
			expect(session.expires).toBeDefined();
		});

		test("sets expiry to TTL from now", () => {
			const beforeWrite = Date.now();
			writeSession(projectPath);
			const afterWrite = Date.now();

			const sessionPath = getSessionFilePath(projectPath);
			const content = readFileSync(sessionPath, "utf-8");
			const session: SessionInfo = JSON.parse(content);

			const expiresTime = new Date(session.expires).getTime();
			const expectedMin = beforeWrite + SESSION_TTL_MS;
			const expectedMax = afterWrite + SESSION_TTL_MS;

			expect(expiresTime).toBeGreaterThanOrEqual(expectedMin);
			expect(expiresTime).toBeLessThanOrEqual(expectedMax);
		});

		test("overwrites existing session file", () => {
			// Create initial session
			writeSession(projectPath);
			const sessionPath = getSessionFilePath(projectPath);
			const firstContent = readFileSync(sessionPath, "utf-8");
			const firstSession: SessionInfo = JSON.parse(firstContent);

			// Write again (overwrites)
			writeSession(projectPath);
			const secondContent = readFileSync(sessionPath, "utf-8");
			const secondSession: SessionInfo = JSON.parse(secondContent);

			// Should have same machine and PID
			expect(secondSession.machine).toBe(firstSession.machine);
			expect(secondSession.pid).toBe(process.pid);
		});
	});

	describe("readSession", () => {
		test("returns null when session file does not exist", () => {
			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when session file contains invalid JSON", () => {
			const sessionPath = getSessionFilePath(projectPath);
			const devboxDir = join(projectPath, ".devbox");
			mkdirSync(devboxDir, { recursive: true });
			writeFileSync(sessionPath, "not valid json", "utf-8");

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when session is missing required fields", () => {
			const sessionPath = getSessionFilePath(projectPath);
			const devboxDir = join(projectPath, ".devbox");
			mkdirSync(devboxDir, { recursive: true });

			// Missing 'machine' field
			const incompleteSession = {
				user: "testuser",
				timestamp: new Date().toISOString(),
				pid: 12345,
				expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};
			writeFileSync(sessionPath, JSON.stringify(incompleteSession), "utf-8");

			const session = readSession(projectPath);
			expect(session).toBeNull();
		});

		test("returns null when session has expired", () => {
			const sessionPath = getSessionFilePath(projectPath);
			const devboxDir = join(projectPath, ".devbox");
			mkdirSync(devboxDir, { recursive: true });

			const expiredSession: SessionInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date(Date.now() - 2 * SESSION_TTL_MS).toISOString(),
				pid: 12345,
				expires: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
			};
			writeFileSync(sessionPath, JSON.stringify(expiredSession), "utf-8");

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
			const sessionPath = getSessionFilePath(projectPath);
			const devboxDir = join(projectPath, ".devbox");
			mkdirSync(devboxDir, { recursive: true });

			const otherMachineSession: SessionInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 99999,
				expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};
			writeFileSync(sessionPath, JSON.stringify(otherMachineSession), "utf-8");

			const session = readSession(projectPath);

			expect(session).not.toBeNull();
			expect(session?.machine).toBe("other-machine");
			expect(session?.user).toBe("otheruser");
		});
	});

	describe("deleteSession", () => {
		test("removes session file when it exists", () => {
			writeSession(projectPath);
			const sessionPath = getSessionFilePath(projectPath);
			expect(existsSync(sessionPath)).toBe(true);

			deleteSession(projectPath);

			expect(existsSync(sessionPath)).toBe(false);
		});

		test("silently succeeds when session file does not exist", () => {
			const sessionPath = getSessionFilePath(projectPath);
			expect(existsSync(sessionPath)).toBe(false);

			// Should not throw
			deleteSession(projectPath);

			expect(existsSync(sessionPath)).toBe(false);
		});

		test("does not remove .devbox directory", () => {
			writeSession(projectPath);
			const devboxDir = join(projectPath, ".devbox");
			expect(existsSync(devboxDir)).toBe(true);

			deleteSession(projectPath);

			// .devbox directory should still exist
			expect(existsSync(devboxDir)).toBe(true);
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
			const sessionPath = getSessionFilePath(projectPath);
			const devboxDir = join(projectPath, ".devbox");
			mkdirSync(devboxDir, { recursive: true });

			const otherMachineSession: SessionInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 99999,
				expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};
			writeFileSync(sessionPath, JSON.stringify(otherMachineSession), "utf-8");

			const result = checkSessionConflict(projectPath);

			expect(result.hasConflict).toBe(true);
			expect(result.existingSession).toBeDefined();
			expect(result.existingSession?.machine).toBe("other-machine");
			expect(result.existingSession?.user).toBe("otheruser");
		});

		test("returns no conflict when session from different machine has expired", () => {
			const sessionPath = getSessionFilePath(projectPath);
			const devboxDir = join(projectPath, ".devbox");
			mkdirSync(devboxDir, { recursive: true });

			const expiredSession: SessionInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date(Date.now() - 2 * SESSION_TTL_MS).toISOString(),
				pid: 99999,
				expires: new Date(Date.now() - 1000).toISOString(), // Expired
			};
			writeFileSync(sessionPath, JSON.stringify(expiredSession), "utf-8");

			const result = checkSessionConflict(projectPath);

			expect(result.hasConflict).toBe(false);
			expect(result.existingSession).toBeUndefined();
		});
	});
});
