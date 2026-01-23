// src/lib/__tests__/projectTemplates.test.ts
import { describe, expect, test } from "bun:test";
import {
	BUILT_IN_TEMPLATES,
	getBuiltInTemplates,
} from "../projectTemplates.ts";

describe("projectTemplates", () => {
	describe("BUILT_IN_TEMPLATES", () => {
		test("includes node template", () => {
			const node = BUILT_IN_TEMPLATES.find((t) => t.id === "node");
			expect(node).toBeDefined();
			expect(node?.url).toContain("github.com");
		});

		test("includes bun template", () => {
			const bun = BUILT_IN_TEMPLATES.find((t) => t.id === "bun");
			expect(bun).toBeDefined();
		});

		test("includes python template", () => {
			const python = BUILT_IN_TEMPLATES.find((t) => t.id === "python");
			expect(python).toBeDefined();
		});

		test("includes go template", () => {
			const go = BUILT_IN_TEMPLATES.find((t) => t.id === "go");
			expect(go).toBeDefined();
		});
	});

	describe("getBuiltInTemplates", () => {
		test("returns all built-in templates", () => {
			const templates = getBuiltInTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(4);
		});
	});
});
