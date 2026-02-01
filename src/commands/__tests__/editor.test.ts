// src/commands/__tests__/editor.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { parse, stringify } from "yaml";

describe("editor command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("editor");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("can read editor from config", () => {
		const config = {
			remote: { host: "myserver", base_path: "~/code" },
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			projects: {},
		};
		const configPath = join(ctx.testDir, "config.yaml");
		writeFileSync(configPath, stringify(config));

		const content = readFileSync(configPath, "utf-8");
		const parsed = parse(content);
		expect(parsed.editor).toBe("cursor");
	});

	test("can update editor in config", () => {
		const config = {
			remote: { host: "myserver", base_path: "~/code" },
			editor: "code",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			projects: {},
		};
		const configPath = join(ctx.testDir, "config.yaml");
		writeFileSync(configPath, stringify(config));

		// Update editor
		const parsed = parse(readFileSync(configPath, "utf-8"));
		parsed.editor = "cursor";
		writeFileSync(configPath, stringify(parsed));

		const updated = parse(readFileSync(configPath, "utf-8"));
		expect(updated.editor).toBe("cursor");
	});
});
