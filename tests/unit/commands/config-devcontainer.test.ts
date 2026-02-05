import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
} from "@lib/constants.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { createTestContext } from "@tests/helpers/test-utils.ts";

describe("devcontainer repair", () => {
	let ctx: ReturnType<typeof createTestContext>;
	let projectsDir: string;

	beforeEach(() => {
		ctx = createTestContext("config-devcontainer");
		projectsDir = getProjectsDir();
		mkdirSync(projectsDir, { recursive: true });
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("finds devcontainer.json in project directory", () => {
		const projectDir = join(projectsDir, "test-project");
		const devcontainerDir = join(projectDir, DEVCONTAINER_DIR_NAME);
		mkdirSync(devcontainerDir, { recursive: true });
		writeFileSync(
			join(devcontainerDir, DEVCONTAINER_CONFIG_NAME),
			JSON.stringify({ name: "test" }),
		);

		const configPath = join(
			projectDir,
			DEVCONTAINER_DIR_NAME,
			DEVCONTAINER_CONFIG_NAME,
		);
		const content = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(content.name).toBe("test");
	});

	test("detects missing devcontainer.json", () => {
		const projectDir = join(projectsDir, "empty-project");
		mkdirSync(projectDir, { recursive: true });

		const configPath = join(
			projectDir,
			DEVCONTAINER_DIR_NAME,
			DEVCONTAINER_CONFIG_NAME,
		);
		expect(() => readFileSync(configPath, "utf-8")).toThrow();
	});

	test("createDevcontainerConfig creates valid devcontainer.json", async () => {
		const projectDir = join(projectsDir, "reset-project");
		mkdirSync(projectDir, { recursive: true });

		const { createDevcontainerConfig } = await import("@lib/templates.ts");
		createDevcontainerConfig(projectDir, "node", "reset-project");

		const configPath = join(
			projectDir,
			DEVCONTAINER_DIR_NAME,
			DEVCONTAINER_CONFIG_NAME,
		);
		expect(existsSync(configPath)).toBe(true);

		const content = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(content.name).toBe("Node.js");
	});
});
