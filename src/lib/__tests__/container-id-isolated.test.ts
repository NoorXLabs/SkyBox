// src/lib/__tests__/container-id-isolated.test.ts
// Tests for getContainerId using global execa mock from test setup
import { beforeEach, describe, expect, test } from "bun:test";
import { mockExeca } from "../../test/setup.ts";
import { getContainerId } from "../container.ts";

describe("getContainerId", () => {
	beforeEach(() => {
		mockExeca.mockReset();
	});

	test("returns container ID when container exists", async () => {
		mockExeca.mockResolvedValueOnce({
			stdout: "abc123def456\n",
			stderr: "",
			exitCode: 0,
		});

		const result = await getContainerId("/path/to/project");

		expect(result).toBe("abc123def456");
	});

	test("returns null when no container found", async () => {
		mockExeca.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

		const result = await getContainerId("/path/to/project");

		expect(result).toBeNull();
	});
});
