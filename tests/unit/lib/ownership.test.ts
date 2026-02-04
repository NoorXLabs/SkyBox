// src/lib/__tests__/ownership.test.ts
//
// Tests for ownership module with isolated ssh mocking.
//
// ISOLATION REQUIRED: Bun's mock.module() is permanent per process and cannot
// be reset in afterEach. This file must run in its own test process. When run
// alongside other test files, mock pollution may cause other tests to skip.
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";

// Mock runRemoteCommand for ownership tests
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

// Now import ownership module (which uses ssh.ts)
import {
	checkWriteAuthorization,
	createOwnershipInfo,
	getOwnershipStatus,
	isOwner,
	parseOwnershipInfo,
} from "@lib/ownership.ts";

describe("ownership", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("ownership");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("parseOwnershipInfo", () => {
		test("parses valid ownership JSON", () => {
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

		test("returns null for invalid JSON", () => {
			const result = parseOwnershipInfo("not json");
			expect(result).toBeNull();
		});

		test("returns null for incomplete ownership info", () => {
			const json = JSON.stringify({ owner: "testuser" }); // Missing fields
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
			const info = createOwnershipInfo(); // Creates with current user
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
		const ownershipJson = JSON.stringify({
			owner: "testuser",
			created: "2026-02-04T12:00:00Z",
			machine: "test-machine",
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: ownershipJson,
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
		const ownershipJson = JSON.stringify({
			owner: "other-user",
			created: "2026-02-04T12:00:00Z",
			machine: "other-machine",
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: ownershipJson,
		});

		const result = await getOwnershipStatus("test-host", "/path/to/project");

		expect(result.hasOwner).toBe(true);
		if (result.hasOwner) {
			expect(result.isOwner).toBe(false);
		}
	});
});

describe("checkWriteAuthorization", () => {
	beforeEach(() => {
		mockRunRemoteCommand.mockReset();
	});

	afterEach(() => {
		mockRunRemoteCommand.mockClear();
	});

	test("returns authorized: true when no ownership file", async () => {
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
		// Create ownership info for current user
		const currentOwnership = createOwnershipInfo();
		const ownershipJson = JSON.stringify(currentOwnership);

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: ownershipJson,
		});

		const result = await checkWriteAuthorization(
			"test-host",
			"/path/to/project",
		);

		expect(result.authorized).toBe(true);
	});

	test("returns authorized: false when different user owns", async () => {
		const ownershipJson = JSON.stringify({
			owner: "other-user",
			created: "2026-02-04T12:00:00Z",
			machine: "other-machine",
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: ownershipJson,
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
		const ownershipJson = JSON.stringify({
			owner: "other-user",
			created: "2026-02-04T12:00:00Z",
			machine: "other-machine",
		});

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: ownershipJson,
		});

		const result = await checkWriteAuthorization(
			"test-host",
			"/path/to/project",
		);

		expect(result.ownerInfo).toBeDefined();
		expect(result.ownerInfo?.owner).toBe("other-user");
		expect(result.ownerInfo?.machine).toBe("other-machine");
	});

	test("returns authorized: true for empty ownership file", async () => {
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
