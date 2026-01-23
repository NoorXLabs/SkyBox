// src/lib/templates.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDevcontainerConfig, TEMPLATES } from "./templates.ts";

describe("templates", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-templates-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	test("TEMPLATES contains expected templates", () => {
		expect(TEMPLATES.map((t) => t.id)).toContain("node");
		expect(TEMPLATES.map((t) => t.id)).toContain("python");
		expect(TEMPLATES.map((t) => t.id)).toContain("go");
		expect(TEMPLATES.map((t) => t.id)).toContain("generic");
	});

	test("createDevcontainerConfig creates .devcontainer directory", () => {
		createDevcontainerConfig(testDir, "node");
		expect(existsSync(join(testDir, ".devcontainer"))).toBe(true);
		expect(
			existsSync(join(testDir, ".devcontainer", "devcontainer.json")),
		).toBe(true);
	});

	test("createDevcontainerConfig writes valid JSON", () => {
		createDevcontainerConfig(testDir, "node");
		const content = readFileSync(
			join(testDir, ".devcontainer", "devcontainer.json"),
			"utf-8",
		);
		const parsed = JSON.parse(content);
		expect(parsed.name).toBe("Node.js");
	});
});
