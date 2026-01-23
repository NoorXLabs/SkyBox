// src/lib/__tests__/container.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContainerStatus } from "../../types/index.ts";
import {
	attachToShell,
	getContainerStatus,
	hasLocalDevcontainerConfig,
	openInEditor,
	removeContainer,
	SUPPORTED_EDITORS,
	startContainer,
	stopContainer,
} from "../container.ts";

describe("container module", () => {
	test("getContainerStatus returns NotFound for non-existent container", async () => {
		const status = await getContainerStatus("/nonexistent/path");
		expect(status).toBe(ContainerStatus.NotFound);
	});
});

describe("removeContainer", () => {
	test("removeContainer function exists", () => {
		expect(typeof removeContainer).toBe("function");
	});
});

describe("startContainer", () => {
	test("startContainer function exists", () => {
		expect(typeof startContainer).toBe("function");
	});
});

describe("stopContainer", () => {
	test("stopContainer function exists", () => {
		expect(typeof stopContainer).toBe("function");
	});
});

describe("editor support", () => {
	test("SUPPORTED_EDITORS contains expected editors", () => {
		expect(SUPPORTED_EDITORS).toContainEqual({ id: "code", name: "VS Code" });
		expect(SUPPORTED_EDITORS).toContainEqual({ id: "cursor", name: "Cursor" });
	});

	test("openInEditor function exists", () => {
		expect(typeof openInEditor).toBe("function");
	});
});

describe("attachToShell", () => {
	test("attachToShell function exists", () => {
		expect(typeof attachToShell).toBe("function");
	});
});

describe("hasLocalDevcontainerConfig", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-container-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	test("returns false when no devcontainer.json exists", () => {
		expect(hasLocalDevcontainerConfig(testDir)).toBe(false);
	});

	test("returns true when devcontainer.json exists", () => {
		const devcontainerDir = join(testDir, ".devcontainer");
		mkdirSync(devcontainerDir, { recursive: true });
		writeFileSync(join(devcontainerDir, "devcontainer.json"), "{}");
		expect(hasLocalDevcontainerConfig(testDir)).toBe(true);
	});
});

describe("getDevcontainerConfig", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-container-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	test("reads workspaceFolder from devcontainer.json", async () => {
		const devcontainerDir = join(testDir, ".devcontainer");
		mkdirSync(devcontainerDir);
		writeFileSync(
			join(devcontainerDir, "devcontainer.json"),
			JSON.stringify({ workspaceFolder: "/custom/workspace" }),
		);

		const { getDevcontainerConfig } = await import("../container.ts");
		const config = getDevcontainerConfig(testDir);

		expect(config?.workspaceFolder).toBe("/custom/workspace");
	});

	test("returns null when no devcontainer.json exists", async () => {
		const { getDevcontainerConfig } = await import("../container.ts");
		const config = getDevcontainerConfig(testDir);

		expect(config).toBeNull();
	});
});

// Mock execa for getContainerId tests
import { mock } from "bun:test";

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
