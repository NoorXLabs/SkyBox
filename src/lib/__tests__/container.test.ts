// src/lib/__tests__/container.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContainerStatus } from "../../types/index.ts";
import {
	attachToShell,
	getContainerStatus,
	getDevcontainerConfig,
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

		const config = getDevcontainerConfig(testDir);

		expect(config?.workspaceFolder).toBe("/custom/workspace");
	});

	test("returns null when no devcontainer.json exists", async () => {
		const config = getDevcontainerConfig(testDir);

		expect(config).toBeNull();
	});
});

// Note: getContainerId tests are in container-id-isolated.test.ts to avoid execa mock polluting other tests
