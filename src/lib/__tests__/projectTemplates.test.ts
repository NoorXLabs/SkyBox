// src/lib/__tests__/projectTemplates.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { BuiltInTemplate } from "../../types/index.ts";
import { BUILT_IN_TEMPLATES } from "../constants.ts";
import {
	getAllTemplates,
	getBuiltInTemplates,
	getUserTemplates,
	validateProjectName,
} from "../projectTemplates.ts";
import { createTestContext, type TestContext } from "./test-utils.ts";

describe("projectTemplates", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("templates");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("BUILT_IN_TEMPLATES", () => {
		test("includes node template", () => {
			const node = BUILT_IN_TEMPLATES.find(
				(t: BuiltInTemplate) => t.id === "node",
			);
			expect(node).toBeDefined();
			expect(node?.url).toContain("github.com");
		});

		test("includes bun template", () => {
			const bun = BUILT_IN_TEMPLATES.find(
				(t: BuiltInTemplate) => t.id === "bun",
			);
			expect(bun).toBeDefined();
		});

		test("includes python template", () => {
			const python = BUILT_IN_TEMPLATES.find(
				(t: BuiltInTemplate) => t.id === "python",
			);
			expect(python).toBeDefined();
		});

		test("includes go template", () => {
			const go = BUILT_IN_TEMPLATES.find((t: BuiltInTemplate) => t.id === "go");
			expect(go).toBeDefined();
		});
	});

	describe("getBuiltInTemplates", () => {
		test("returns all built-in templates", () => {
			const templates = getBuiltInTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(4);
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
