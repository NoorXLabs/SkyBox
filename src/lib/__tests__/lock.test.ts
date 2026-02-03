// src/lib/__tests__/lock.test.ts
//
// Tests for lock module with isolated execa and ssh mocking.
//
// ISOLATION REQUIRED: Bun's mock.module() is permanent per process and cannot
// be reset in afterEach. This file must run in its own test process. When run
// alongside other test files, mock pollution may cause other tests to skip.
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { hostname, userInfo } from "node:os";
import type { LockInfo } from "@typedefs/index.ts";

// Mock execa BEFORE importing any modules that use it
const mockExeca = mock(() =>
	Promise.resolve({ stdout: "", stderr: "", exitCode: 0 }),
);
mock.module("execa", () => ({ execa: mockExeca }));

// Mock runRemoteCommand for lock tests
const mockRunRemoteCommand = mock(
	(
		_host: string,
		_command: string,
	): Promise<{ success: boolean; stdout?: string; error?: string }> =>
		Promise.resolve({ success: true, stdout: "" }),
);

// Import original ssh module to spread its exports
import * as originalSsh from "@lib/ssh.ts";

mock.module("../ssh.ts", () => ({
	...originalSsh,
	runRemoteCommand: mockRunRemoteCommand,
}));

// Now import lock module (which uses ssh.ts)
import {
	acquireLock,
	forceLock,
	getAllLockStatuses,
	getLockStatus,
	getMachineName,
	type LockRemoteInfo,
	releaseLock,
} from "@lib/lock.ts";

describe("lock", () => {
	const testRemoteInfo: LockRemoteInfo = {
		host: "testhost",
		basePath: "~/code",
	};

	beforeEach(() => {
		mockRunRemoteCommand.mockReset();
	});

	afterEach(() => {
		mockExeca.mockClear();
		mockRunRemoteCommand.mockClear();
	});

	describe("getMachineName", () => {
		test("returns the hostname", () => {
			const machineName = getMachineName();
			expect(machineName).toBe(hostname());
		});
	});

	describe("getLockStatus", () => {
		test("returns locked: false when no lock file exists", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(false);
			expect(mockRunRemoteCommand).toHaveBeenCalledWith(
				"testhost",
				"cat '~/code/.devbox-locks/myproject.lock' 2>/dev/null",
			);
		});

		test("returns locked: false when ssh command fails", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
				error: "Connection failed",
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(false);
		});

		test("returns locked: true with ownedByMe: true when lock is owned by current machine", async () => {
			const lockInfo: LockInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(true);
			if (status.locked) {
				expect(status.ownedByMe).toBe(true);
				expect(status.info.machine).toBe(hostname());
			}
		});

		test("returns locked: true with ownedByMe: false when lock is owned by different machine", async () => {
			const lockInfo: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(true);
			if (status.locked) {
				expect(status.ownedByMe).toBe(false);
				expect(status.info.machine).toBe("other-machine");
			}
		});

		test("returns locked: false when lock file contains invalid JSON", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "invalid json",
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(false);
		});

		test("returns locked: false when lock has expired", async () => {
			const lockInfo: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
				pid: 12345,
				expires: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
			};

			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(false);
		});

		test("returns locked: true when lock has not expired", async () => {
			const lockInfo: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 12345,
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			};

			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(true);
			if (status.locked) {
				expect(status.ownedByMe).toBe(false);
			}
		});

		test("returns locked: true when lock has no expires field (backward compat)", async () => {
			const lockInfo: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 12345,
				// no expires field
			};

			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const status = await getLockStatus("myproject", testRemoteInfo);

			expect(status.locked).toBe(true);
		});
	});

	describe("acquireLock", () => {
		test("creates lock atomically when no existing lock", async () => {
			// Atomic create succeeds immediately
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
			// Verify the atomic create command uses noclobber (set -C)
			const calls = mockRunRemoteCommand.mock.calls as [string, string][];
			expect(calls[0][0]).toBe("testhost");
			expect(calls[0][1]).toContain("mkdir -p '~/code/.devbox-locks'");
			expect(calls[0][1]).toContain("set -C");
			expect(calls[0][1]).toContain("| base64 -d >");
			expect(calls[0][1]).toContain("'~/code/.devbox-locks/myproject.lock'");
		});

		test("updates timestamp when lock is owned by current machine", async () => {
			const lockInfo: LockInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			// First call: atomic create fails (file exists)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
			});
			// Second call: check lock status (owned by current machine)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});
			// Third call: update lock
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(3);
		});

		test("fails when lock is owned by different machine", async () => {
			const lockInfo: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			// First call: atomic create fails (file exists)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
			});
			// Second call: check lock status (owned by different machine)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(false);
			expect(result.error).toContain("other-machine");
			expect(result.error).toContain("otheruser");
			expect(result.existingLock).toEqual(lockInfo);
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(2);
		});

		test("retries when lock file disappears during check", async () => {
			// First call: atomic create fails (file exists)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
			});
			// Second call: check lock status (lock gone - race condition)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});
			// Third call: retry atomic create (succeeds)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(3);
		});

		test("returns error when retry also fails", async () => {
			// First call: atomic create fails
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
			});
			// Second call: check lock status (lock gone)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});
			// Third call: retry atomic create (fails again)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(false);
			expect(result.error).toContain("concurrent access");
		});
	});

	describe("releaseLock", () => {
		test("deletes lock file when owned by current machine", async () => {
			const lockInfo: LockInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			// First call: getLockStatus check (owned by me)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});
			// Second call: rm -f
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await releaseLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(result.skipped).toBeUndefined();
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(2);
		});

		test("skips deletion when lock is owned by another machine", async () => {
			const lockInfo: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			// getLockStatus returns lock owned by someone else
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const result = await releaseLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(result.skipped).toBe(true);
			// Should NOT have called rm
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
		});

		test("deletes lock file when no lock exists", async () => {
			// getLockStatus returns unlocked
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});
			// rm -f succeeds
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await releaseLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
		});

		test("returns error when delete fails", async () => {
			// getLockStatus returns unlocked
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});
			// rm -f fails
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
				error: "Permission denied",
			});

			const result = await releaseLock("myproject", testRemoteInfo);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Permission denied");
		});
	});

	describe("forceLock", () => {
		test("overwrites lock file without noclobber", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await forceLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
			const calls = mockRunRemoteCommand.mock.calls as [string, string][];
			expect(calls[0][1]).toContain("mkdir -p '~/code/.devbox-locks'");
			expect(calls[0][1]).toContain("| base64 -d >");
			// Should NOT contain set -C (noclobber)
			expect(calls[0][1]).not.toContain("set -C");
		});

		test("returns error when overwrite fails", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
				error: "Connection failed",
			});

			const result = await forceLock("myproject", testRemoteInfo);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Connection failed");
		});
	});

	describe("getAllLockStatuses", () => {
		test("parses multiple lock files from single SSH call", async () => {
			const lockInfo1: LockInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date().toISOString(),
				pid: 12345,
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			};
			const lockInfo2: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 99999,
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			};

			// SSH returns newline-delimited "filename\tJSON" lines
			const output = [
				`backend-api.lock\t${JSON.stringify(lockInfo1)}`,
				`frontend-app.lock\t${JSON.stringify(lockInfo2)}`,
			].join("\n");

			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: output,
			});

			const statuses = await getAllLockStatuses(testRemoteInfo);

			expect(statuses.size).toBe(2);
			const backend = statuses.get("backend-api");
			expect(backend?.locked).toBe(true);
			if (backend?.locked) {
				expect(backend.ownedByMe).toBe(true);
			}
			const frontend = statuses.get("frontend-app");
			expect(frontend?.locked).toBe(true);
			if (frontend?.locked) {
				expect(frontend.ownedByMe).toBe(false);
			}
		});

		test("returns empty map when no lock files exist", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});

			const statuses = await getAllLockStatuses(testRemoteInfo);

			expect(statuses.size).toBe(0);
		});

		test("skips expired locks", async () => {
			const expiredLock: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
				pid: 12345,
				expires: new Date(Date.now() - 1000).toISOString(),
			};

			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: `myproject.lock\t${JSON.stringify(expiredLock)}`,
			});

			const statuses = await getAllLockStatuses(testRemoteInfo);

			const status = statuses.get("myproject");
			expect(status?.locked).toBe(false);
		});
	});
});
