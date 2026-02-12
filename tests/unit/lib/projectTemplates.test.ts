import { describe, expect, test } from "bun:test";
import { validateProjectName } from "@lib/validation.ts";

describe("validateProjectName", () => {
	test("accepts valid alphanumeric names", () => {
		expect(validateProjectName("myproject")).toEqual({
			valid: true,
		});
		expect(validateProjectName("my-project")).toEqual({
			valid: true,
		});
		expect(validateProjectName("my_project")).toEqual({
			valid: true,
		});
		expect(validateProjectName("MyProject123")).toEqual({
			valid: true,
		});
	});

	test("rejects empty names", () => {
		const result = validateProjectName("");
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.error).toContain("empty");
	});

	test("rejects names with spaces", () => {
		const result = validateProjectName("my project");
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.error).toContain("alphanumeric");
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
