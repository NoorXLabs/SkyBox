// src/lib/__tests__/templates.test.ts
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
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	TEMPLATES,
} from "@lib/constants.ts";
import {
	createDevcontainerConfig,
	loadUserTemplates,
	scaffoldTemplate,
	validateTemplate,
	writeDevcontainerConfig,
} from "@lib/templates.ts";

describe("templates", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-templates-test-${Date.now()}`);
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

	test("TEMPLATES contains expected templates", () => {
		expect(TEMPLATES.map((t) => t.id)).toContain("node");
		expect(TEMPLATES.map((t) => t.id)).toContain("python");
		expect(TEMPLATES.map((t) => t.id)).toContain("go");
		expect(TEMPLATES.map((t) => t.id)).toContain("generic");
	});

	test("createDevcontainerConfig creates .devcontainer directory", () => {
		createDevcontainerConfig(testDir, "node");
		expect(existsSync(join(testDir, DEVCONTAINER_DIR_NAME))).toBe(true);
		expect(
			existsSync(
				join(testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
			),
		).toBe(true);
	});

	test("createDevcontainerConfig writes valid JSON", () => {
		createDevcontainerConfig(testDir, "node");
		const content = readFileSync(
			join(testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
			"utf-8",
		);
		const parsed = JSON.parse(content);
		expect(parsed.name).toBe("Node.js");
	});

	describe("validateTemplate", () => {
		test("valid config with required fields", () => {
			const result = validateTemplate({
				workspaceFolder: "/workspaces/test",
				workspaceMount: "source=...,target=...,type=bind",
			});
			expect(result.valid).toBe(true);
		});

		test("missing workspaceFolder", () => {
			const result = validateTemplate({
				workspaceMount: "source=...,target=...,type=bind",
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("workspaceFolder");
		});

		test("missing workspaceMount", () => {
			const result = validateTemplate({
				workspaceFolder: "/workspaces/test",
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("workspaceMount");
		});

		test("non-object input", () => {
			const result = validateTemplate("not an object");
			expect(result.valid).toBe(false);
		});

		test("null input", () => {
			const result = validateTemplate(null);
			expect(result.valid).toBe(false);
		});
	});

	describe("loadUserTemplates", () => {
		test("returns empty array when templates dir does not exist", () => {
			const templates = loadUserTemplates();
			expect(templates).toEqual([]);
		});

		test("loads valid template", () => {
			const templatesDir = join(testDir, "templates");
			mkdirSync(templatesDir, { recursive: true });
			const config = {
				name: "test",
				image: "node:20",
				workspaceFolder: "/workspaces/test",
				workspaceMount: "source=x,target=y,type=bind",
			};
			writeFileSync(
				join(templatesDir, "mytemplate.json"),
				JSON.stringify(config),
			);

			const templates = loadUserTemplates();
			expect(templates).toHaveLength(1);
			expect(templates[0].name).toBe("mytemplate");
			expect(templates[0].valid).toBe(true);
			expect(templates[0].config.image).toBe("node:20");
		});

		test("marks template with invalid JSON", () => {
			const templatesDir = join(testDir, "templates");
			mkdirSync(templatesDir, { recursive: true });
			writeFileSync(join(templatesDir, "bad.json"), "not json{{{");

			const templates = loadUserTemplates();
			expect(templates).toHaveLength(1);
			expect(templates[0].name).toBe("bad");
			expect(templates[0].valid).toBe(false);
			expect(templates[0].error).toBe("invalid JSON");
		});

		test("marks template missing required fields", () => {
			const templatesDir = join(testDir, "templates");
			mkdirSync(templatesDir, { recursive: true });
			writeFileSync(
				join(templatesDir, "incomplete.json"),
				JSON.stringify({ name: "test" }),
			);

			const templates = loadUserTemplates();
			expect(templates).toHaveLength(1);
			expect(templates[0].valid).toBe(false);
			expect(templates[0].error).toContain("workspaceFolder");
		});

		test("ignores non-json files", () => {
			const templatesDir = join(testDir, "templates");
			mkdirSync(templatesDir, { recursive: true });
			writeFileSync(join(templatesDir, "readme.txt"), "hello");
			writeFileSync(join(templatesDir, "notes.md"), "# notes");

			const templates = loadUserTemplates();
			expect(templates).toEqual([]);
		});
	});

	describe("scaffoldTemplate", () => {
		test("creates template file with required fields", () => {
			const filePath = scaffoldTemplate("myapp");
			expect(existsSync(filePath)).toBe(true);

			const content = JSON.parse(readFileSync(filePath, "utf-8"));
			expect(content.name).toBe("myapp");
			expect(content.workspaceFolder).toBeDefined();
			expect(content.workspaceMount).toBeDefined();
			expect(content.image).toBe("mcr.microsoft.com/devcontainers/base:debian");
		});

		test("creates templates directory if it does not exist", () => {
			const templatesDir = join(testDir, "templates");
			expect(existsSync(templatesDir)).toBe(false);

			scaffoldTemplate("test");
			expect(existsSync(templatesDir)).toBe(true);
		});
	});

	describe("writeDevcontainerConfig", () => {
		test("writes config to .devcontainer/devcontainer.json", () => {
			const config = {
				name: "test",
				image: "node:20",
				workspaceFolder: "/workspaces/test",
			};
			writeDevcontainerConfig(testDir, config);

			const content = JSON.parse(
				readFileSync(
					join(testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
					"utf-8",
				),
			);
			expect(content.name).toBe("test");
			expect(content.image).toBe("node:20");
		});
	});
});
