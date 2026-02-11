// tests/unit/lib/templates.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	TEMPLATES,
} from "@lib/constants.ts";
import {
	buildDevcontainerConfigFromTemplate,
	loadUserTemplates,
	scaffoldTemplate,
	validateTemplate,
	writeDevcontainerConfig,
} from "@lib/templates.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("templates", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("templates");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("TEMPLATES contains expected templates", () => {
		expect(TEMPLATES.map((t) => t.id)).toContain("node");
		expect(TEMPLATES.map((t) => t.id)).toContain("bun");
		expect(TEMPLATES.map((t) => t.id)).toContain("python");
		expect(TEMPLATES.map((t) => t.id)).toContain("go");
		expect(TEMPLATES.map((t) => t.id)).toContain("generic");
	});

	test("buildDevcontainerConfigFromTemplate + writeDevcontainerConfig creates .devcontainer directory", () => {
		const config = buildDevcontainerConfigFromTemplate(ctx.testDir, "node");
		writeDevcontainerConfig(ctx.testDir, config);
		expect(existsSync(join(ctx.testDir, DEVCONTAINER_DIR_NAME))).toBe(true);
		expect(
			existsSync(
				join(ctx.testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
			),
		).toBe(true);
	});

	test("buildDevcontainerConfigFromTemplate writes valid JSON", () => {
		const config = buildDevcontainerConfigFromTemplate(ctx.testDir, "node");
		writeDevcontainerConfig(ctx.testDir, config);
		const content = readFileSync(
			join(ctx.testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
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
			if (!result.valid) {
				expect(result.error).toContain("workspaceFolder");
			}
		});

		test("missing workspaceMount", () => {
			const result = validateTemplate({
				workspaceFolder: "/workspaces/test",
			});
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("workspaceMount");
			}
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
			const templatesDir = join(ctx.testDir, "templates");
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
			const templatesDir = join(ctx.testDir, "templates");
			mkdirSync(templatesDir, { recursive: true });
			writeFileSync(join(templatesDir, "bad.json"), "not json{{{");

			const templates = loadUserTemplates();
			expect(templates).toHaveLength(1);
			expect(templates[0].name).toBe("bad");
			expect(templates[0].valid).toBe(false);
			expect(templates[0].error).toBe("invalid JSON");
		});

		test("marks template missing required fields", () => {
			const templatesDir = join(ctx.testDir, "templates");
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
			const templatesDir = join(ctx.testDir, "templates");
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
			const templatesDir = join(ctx.testDir, "templates");
			expect(existsSync(templatesDir)).toBe(false);

			scaffoldTemplate("test");
			expect(existsSync(templatesDir)).toBe(true);
		});

		test("rejects path traversal in template name", () => {
			expect(() => scaffoldTemplate("../evil")).toThrow(
				"Invalid template name",
			);
		});

		test("rejects forward slash in template name", () => {
			expect(() => scaffoldTemplate("foo/bar")).toThrow(
				"Invalid template name",
			);
		});

		test("rejects backslash in template name", () => {
			expect(() => scaffoldTemplate("foo\\bar")).toThrow(
				"Invalid template name",
			);
		});

		test("rejects leading dash in template name", () => {
			expect(() => scaffoldTemplate("-evil")).toThrow("Invalid template name");
		});

		test("rejects empty template name", () => {
			expect(() => scaffoldTemplate("")).toThrow("Invalid template name");
		});
	});

	describe("writeDevcontainerConfig", () => {
		test("writes config to .devcontainer/devcontainer.json", () => {
			const config = {
				name: "test",
				image: "node:20",
				workspaceFolder: "/workspaces/test",
			};
			writeDevcontainerConfig(ctx.testDir, config);

			const content = JSON.parse(
				readFileSync(
					join(ctx.testDir, DEVCONTAINER_DIR_NAME, DEVCONTAINER_CONFIG_NAME),
					"utf-8",
				),
			);
			expect(content.name).toBe("test");
			expect(content.image).toBe("node:20");
		});
	});
});
