// src/lib/__tests__/lock.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { hostname, userInfo } from "node:os";
import { mockRunRemoteCommand } from "../../test/setup.ts";
import type { LockInfo } from "../../types/index.ts";
import {
	acquireLock,
	getLockStatus,
	getMachineName,
	type LockRemoteInfo,
	releaseLock,
} from "../lock.ts";

describe("lock", () => {
	const testRemoteInfo: LockRemoteInfo = {
		host: "testhost",
		basePath: "~/code",
	};

	beforeEach(() => {
		mockRunRemoteCommand.mockReset();
	});

	afterEach(() => {
		mockRunRemoteCommand.mockReset();
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
				"cat ~/code/.devbox-locks/myproject.lock 2>/dev/null",
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
	});

	describe("acquireLock", () => {
		test("creates lock when no existing lock", async () => {
			// First call: check for existing lock (none found)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});
			// Second call: create lock
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(2);
			// Verify the second call creates the lock
			const calls = mockRunRemoteCommand.mock.calls as [string, string][];
			expect(calls[1][0]).toBe("testhost");
			expect(calls[1][1]).toContain("mkdir -p ~/code/.devbox-locks");
			expect(calls[1][1]).toContain("~/code/.devbox-locks/myproject.lock");
		});

		test("updates timestamp when lock is owned by current machine", async () => {
			const lockInfo: LockInfo = {
				machine: hostname(),
				user: userInfo().username,
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			// First call: check for existing lock (owned by current machine)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});
			// Second call: update lock
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(2);
		});

		test("fails when lock is owned by different machine", async () => {
			const lockInfo: LockInfo = {
				machine: "other-machine",
				user: "otheruser",
				timestamp: new Date().toISOString(),
				pid: 12345,
			};

			// Check for existing lock (owned by different machine)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: JSON.stringify(lockInfo),
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(false);
			expect(result.error).toContain("other-machine");
			expect(result.error).toContain("otheruser");
			expect(result.existingLock).toEqual(lockInfo);
			// Should only call once (to check lock status)
			expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
		});

		test("returns error when lock creation fails", async () => {
			// First call: check for existing lock (none found)
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
				stdout: "",
			});
			// Second call: create lock fails
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
				error: "Permission denied",
			});

			const result = await acquireLock("myproject", testRemoteInfo);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Permission denied");
		});
	});

	describe("releaseLock", () => {
		test("deletes lock file successfully", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: true,
			});

			const result = await releaseLock("myproject", testRemoteInfo);

			expect(result.success).toBe(true);
			expect(mockRunRemoteCommand).toHaveBeenCalledWith(
				"testhost",
				"rm -f ~/code/.devbox-locks/myproject.lock",
			);
		});

		test("returns error when delete fails", async () => {
			mockRunRemoteCommand.mockResolvedValueOnce({
				success: false,
				error: "Permission denied",
			});

			const result = await releaseLock("myproject", testRemoteInfo);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Permission denied");
		});
	});
});
