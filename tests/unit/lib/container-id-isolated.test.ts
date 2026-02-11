// tests/unit/lib/container-id-isolated.test.ts
//
// Tests for getContainerId with isolated execa mocking.
// This file mocks execa before importing container.ts.
//
// ISOLATION REQUIRED: Bun's mock.module() is permanent per process and cannot
// be reset in afterEach. This file must run in its own test process. When run
// alongside other test files, mock pollution may cause skipIf guards to activate.

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Mock execa BEFORE importing container.ts
const mockExeca = mock(() =>
	Promise.resolve({ stdout: "", stderr: "", exitCode: 0 }),
);
mock.module("execa", () => ({ execa: mockExeca }));

// Now import the module under test
import { getContainerId, openInEditor } from "@lib/container.ts";

// Detect if container module was already mocked by another test file
// shell-docker-isolated.test.ts mocks getContainerId to always return "container-abc123"
const isModuleMocked = (): boolean => {
	// Real implementation closes over queryDockerContainers; mocked versions won't.
	return !getContainerId.toString().includes("queryDockerContainers");
};

describe("getContainerId", () => {
	beforeEach(() => {
		mockExeca.mockReset();
	});

	afterEach(() => {
		mockExeca.mockClear();
	});

	test.skipIf(isModuleMocked())(
		"returns container ID when container exists",
		async () => {
			mockExeca.mockResolvedValueOnce({
				stdout: "abc123def456\n",
				stderr: "",
				exitCode: 0,
			});
			const result = await getContainerId("/path/to/project");
			expect(result).toBe("abc123def456");
		},
	);

	test.skipIf(isModuleMocked())(
		"returns null when no container found",
		async () => {
			mockExeca.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });
			const result = await getContainerId("/path/to/project");
			expect(result).toBeNull();
		},
	);
});

describe("openInEditor", () => {
	beforeEach(() => {
		mockExeca.mockReset();
	});

	afterEach(() => {
		mockExeca.mockClear();
	});

	test.skipIf(isModuleMocked())(
		"opens VS Code-family editors using --folder-uri",
		async () => {
			mockExeca.mockResolvedValueOnce({
				stdout: "abc123def456\n",
				stderr: "",
				exitCode: 0,
			});
			mockExeca.mockResolvedValueOnce({
				stdout: "",
				stderr: "",
				exitCode: 0,
			});

			const projectPath = "/tmp/my-project";
			const expectedUri = `vscode-remote://dev-container+${Buffer.from(projectPath).toString("hex")}/workspaces/my-project`;

			const result = await openInEditor(projectPath, "code");
			const calls = mockExeca.mock.calls as unknown as Array<
				[string, string[], Record<string, unknown> | undefined]
			>;
			expect(result.success).toBe(true);
			expect(calls[1]?.[0]).toBe("code");
			expect(calls[1]?.[1]).toEqual(["--folder-uri", expectedUri]);
		},
	);

	test.skipIf(isModuleMocked())(
		"returns error when editor command is missing",
		async () => {
			mockExeca.mockResolvedValueOnce({
				stdout: "abc123def456\n",
				stderr: "",
				exitCode: 0,
			});
			mockExeca.mockRejectedValueOnce({ code: "ENOENT", message: "ENOENT" });

			const result = await openInEditor("/tmp/my-project", "custom-editor");
			expect(result.success).toBe(false);
			expect(result.error).toContain("custom-editor");
		},
	);
});
