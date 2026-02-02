// src/lib/__tests__/projectTemplates.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { TEMPLATES } from "@lib/constants.ts";
import {
	getAllTemplates,
	getBuiltInTemplates,
	getUserTemplates,
	validateProjectName,
} from "@lib/projectTemplates.ts";
import { stringify } from "yaml";

describe("projectTemplates", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("templates");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("TEMPLATES", () => {
		test("all templates should have inline devcontainer configs", () => {
			for (const template of TEMPLATES) {
				expect(template.config).toBeDefined();
				expect(template.config.name).toBeTruthy();
				expect(template.config.image).toMatch(/mcr\.microsoft\.com/);
			}
		});

		test("should have templates for node, bun, python, and go", () => {
			const ids = TEMPLATES.map((t) => t.id);
			expect(ids).toContain("node");
			expect(ids).toContain("bun");
			expect(ids).toContain("python");
			expect(ids).toContain("go");
		});
	});

	describe("getBuiltInTemplates", () => {
		test("returns all built-in templates", () => {
			const templates = getBuiltInTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(5);
		});
	});

	describe("getUserTemplates", () => {
		test("returns empty array when no config", () => {
			const templates = getUserTemplates();
			expect(templates).toEqual([]);
		});

		test("returns empty array when no templates in config", () => {
			const config = {
				remote: { host: "test", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
			};
			writeFileSync(join(ctx.testDir, "config.yaml"), stringify(config));

			const templates = getUserTemplates();
			expect(templates).toEqual([]);
		});

		test("returns user templates from config", () => {
			const config = {
				remote: { host: "test", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
				templates: {
					react: "https://github.com/user/react-template",
					rust: "https://github.com/user/rust-template",
				},
			};
			writeFileSync(join(ctx.testDir, "config.yaml"), stringify(config));

			const templates = getUserTemplates();
			expect(templates).toHaveLength(2);
			expect(templates[0]).toEqual({
				name: "react",
				url: "https://github.com/user/react-template",
			});
		});
	});

	describe("getAllTemplates", () => {
		test("combines built-in and user templates", () => {
			const config = {
				remote: { host: "test", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
				templates: {
					custom: "https://github.com/user/custom",
				},
			};
			writeFileSync(join(ctx.testDir, "config.yaml"), stringify(config));

			const all = getAllTemplates();
			expect(all.builtIn.length).toBeGreaterThanOrEqual(4);
			expect(all.user).toHaveLength(1);
			expect(all.user[0].name).toBe("custom");
		});
	});

	describe("validateProjectName", () => {
		test("accepts valid alphanumeric names", () => {
			expect(validateProjectName("myproject")).toEqual({ valid: true });
			expect(validateProjectName("my-project")).toEqual({ valid: true });
			expect(validateProjectName("my_project")).toEqual({ valid: true });
			expect(validateProjectName("MyProject123")).toEqual({ valid: true });
		});

		test("rejects empty names", () => {
			const result = validateProjectName("");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("empty");
		});

		test("rejects names with spaces", () => {
			const result = validateProjectName("my project");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("alphanumeric");
		});

		test("rejects names with special characters", () => {
			const result = validateProjectName("my@project!");
			expect(result.valid).toBe(false);
		});

		test("rejects names starting with hyphen or underscore", () => {
			expect(validateProjectName("-myproject").valid).toBe(false);
			expect(validateProjectName("_myproject").valid).toBe(false);
		});
	});
});
