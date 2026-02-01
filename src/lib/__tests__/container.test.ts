// src/lib/__tests__/container.test.ts
//
// Tests for container module pure functions (no Docker required).
// Tests that need execa mocking are in container-id-isolated.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isExecaMocked } from "@lib/__tests__/test-utils.ts";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	SUPPORTED_EDITORS,
} from "@lib/constants.ts";
import {
	attachToShell,
	getDevcontainerConfig,
	hasLocalDevcontainerConfig,
	openInEditor,
	removeContainer,
	startContainer,
	stopContainer,
} from "@lib/container.ts";

const execaMocked = await isExecaMocked();

describe("container module exports", () => {
	test("removeContainer is a function", () => {
		expect(typeof removeContainer).toBe("function");
	});

	test("startContainer is a function", () => {
		expect(typeof startContainer).toBe("function");
	});

	test("stopContainer is a function", () => {
		expect(typeof stopContainer).toBe("function");
	});

	test("openInEditor is a function", () => {
		expect(typeof openInEditor).toBe("function");
	});

	test("attachToShell is a function", () => {
		expect(typeof attachToShell).toBe("function");
	});

	test("SUPPORTED_EDITORS contains expected editors", () => {
		expect(SUPPORTED_EDITORS).toContainEqual({ id: "code", name: "VS Code" });
		expect(SUPPORTED_EDITORS).toContainEqual({ id: "cursor", name: "Cursor" });
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

	test.skipIf(execaMocked)(
		"returns false when no devcontainer.json exists",
		() => {
			expect(hasLocalDevcontainerConfig(testDir)).toBe(false);
		},
	);

	test.skipIf(execaMocked)("returns true when devcontainer.json exists", () => {
		mkdirSync(join(testDir, DEVCONTAINER_DIR_NAME), { recursive: true });
		writeFileSync(
			join(testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
			"{}",
		);
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

	test.skipIf(execaMocked)(
		"reads workspaceFolder from devcontainer.json",
		() => {
			mkdirSync(join(testDir, DEVCONTAINER_DIR_NAME));
			writeFileSync(
				join(testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
				JSON.stringify({ workspaceFolder: "/custom/workspace" }),
			);
			const config = getDevcontainerConfig(testDir);
			expect(config?.workspaceFolder).toBe("/custom/workspace");
		},
	);

	test.skipIf(execaMocked)(
		"returns null when no devcontainer.json exists",
		() => {
			const config = getDevcontainerConfig(testDir);
			expect(config).toBeNull();
		},
	);
});
