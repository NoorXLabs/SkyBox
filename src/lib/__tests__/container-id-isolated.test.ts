// src/lib/__tests__/container-id.test.ts
// Isolated test file for getContainerId to avoid execa mock polluting other tests
import { beforeEach, describe, expect, mock, test } from "bun:test";

// Mock execa for getContainerId tests
const mockExeca = mock(() => Promise.resolve({ stdout: "" }));
mock.module("execa", () => ({
	execa: mockExeca,
}));

describe("getContainerId", () => {
	beforeEach(() => {
		mockExeca.mockReset();
	});

	test("returns container ID when container exists", async () => {
		mockExeca.mockResolvedValueOnce({ stdout: "abc123def456\n" });

		const { getContainerId } = await import("../container.ts");
		const result = await getContainerId("/path/to/project");

		expect(result).toBe("abc123def456");
	});

	test("returns null when no container found", async () => {
		mockExeca.mockResolvedValueOnce({ stdout: "" });

		const { getContainerId } = await import("../container.ts");
		const result = await getContainerId("/path/to/project");

		expect(result).toBeNull();
	});
});
