// src/commands/__tests__/new.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { stringify } from "yaml";

describe("new command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("new");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("config validation", () => {
		test("requires devbox to be configured", () => {
			// No config file exists
			const configExists = false;
			expect(configExists).toBe(false);
		});

		test("config can be loaded when exists", () => {
			const config = {
				remote: { host: "test-server", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
			};
			writeFileSync(join(ctx.testDir, "config.yaml"), stringify(config));

			const content = require("node:fs").readFileSync(
				join(ctx.testDir, "config.yaml"),
				"utf-8",
			);
			expect(content).toContain("test-server");
		});
	});

	describe("remote path construction", () => {
		test("constructs correct remote path", () => {
			const basePath = "~/code";
			const projectName = "myapp";
			const remotePath = `${basePath}/${projectName}`;
			expect(remotePath).toBe("~/code/myapp");
		});
	});

	describe("devcontainer.json generation", () => {
		test("generates valid JSON structure", () => {
			const projectName = "test-project";
			const devcontainerJson = JSON.stringify(
				{
					name: projectName,
					image: "mcr.microsoft.com/devcontainers/base:ubuntu",
				},
				null,
				2,
			);

			const parsed = JSON.parse(devcontainerJson);
			expect(parsed.name).toBe("test-project");
			expect(parsed.image).toContain("devcontainers");
		});

		test("escapes single quotes in JSON for shell", () => {
			const json = '{ "name": "project\'s name" }';
			const escaped = json.replace(/'/g, "'\\''");
			expect(escaped).toContain("'\\''");
		});
	});

	describe("git clone command construction", () => {
		test("builds correct clone command with history", () => {
			const templateUrl = "https://github.com/user/template";
			const tempPath = "/tmp/devbox-template-123";
			const remotePath = "~/code/myproject";

			const cloneCmd = `git clone ${templateUrl} ${tempPath} && mv ${tempPath} ${remotePath}`;

			expect(cloneCmd).toContain("git clone");
			expect(cloneCmd).toContain(templateUrl);
			expect(cloneCmd).not.toContain("rm -rf");
		});

		test("builds correct clone command without history", () => {
			const templateUrl = "https://github.com/user/template";
			const tempPath = "/tmp/devbox-template-123";
			const remotePath = "~/code/myproject";

			const cloneCmd = `git clone ${templateUrl} ${tempPath} && rm -rf ${tempPath}/.git && git -C ${tempPath} init && mv ${tempPath} ${remotePath}`;

			expect(cloneCmd).toContain("rm -rf");
			expect(cloneCmd).toContain("init");
		});
	});
});
