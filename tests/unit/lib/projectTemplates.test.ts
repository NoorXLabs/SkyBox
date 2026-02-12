import { describe, expect, test } from "bun:test";
import {
	validateProjectName as validateFromProjectTemplates,
	validateProjectName as validateFromValidation,
} from "@lib/validation.ts";

describe("projectTemplates", () => {
	test("re-exports validateProjectName from validation", () => {
		expect(validateFromProjectTemplates).toBe(validateFromValidation);
	});

	describe("validateProjectName", () => {
		test("accepts valid alphanumeric names", () => {
			expect(validateFromProjectTemplates("myproject")).toEqual({
				valid: true,
			});
			expect(validateFromProjectTemplates("my-project")).toEqual({
				valid: true,
			});
			expect(validateFromProjectTemplates("my_project")).toEqual({
				valid: true,
			});
			expect(validateFromProjectTemplates("MyProject123")).toEqual({
				valid: true,
			});
		});

		test("rejects empty names", () => {
			const result = validateFromProjectTemplates("");
			expect(result.valid).toBe(false);
			if (!result.valid) expect(result.error).toContain("empty");
		});

		test("rejects names with spaces", () => {
			const result = validateFromProjectTemplates("my project");
			expect(result.valid).toBe(false);
			if (!result.valid) expect(result.error).toContain("alphanumeric");
		});

		test("rejects names with special characters", () => {
			const result = validateFromProjectTemplates("my@project!");
			expect(result.valid).toBe(false);
		});

		test("rejects names starting with hyphen or underscore", () => {
			expect(validateFromProjectTemplates("-myproject").valid).toBe(false);
			expect(validateFromProjectTemplates("_myproject").valid).toBe(false);
		});
	});
});
