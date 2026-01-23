// src/commands/__tests__/editor.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";

describe("editor command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-editor-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("can read editor from config", () => {
		const config = {
			remote: { host: "myserver", base_path: "~/code" },
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			projects: {},
		};
		const configPath = join(testDir, "config.yaml");
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
		const configPath = join(testDir, "config.yaml");
		writeFileSync(configPath, stringify(config));

		// Update editor
		const parsed = parse(readFileSync(configPath, "utf-8"));
		parsed.editor = "cursor";
		writeFileSync(configPath, stringify(parsed));

		const updated = parse(readFileSync(configPath, "utf-8"));
		expect(updated.editor).toBe("cursor");
	});
});
