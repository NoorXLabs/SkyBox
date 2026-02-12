import { describe, expect, test } from "bun:test";
import { validateProjectName } from "@lib/validation.ts";

describe("rm command validation", () => {
	test("validateProjectName rejects path traversal", () => {
		const result = validateProjectName("../etc/passwd");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName rejects shell metacharacters", () => {
		const result = validateProjectName("project;rm -rf /");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName rejects command substitution", () => {
		const result = validateProjectName("$(whoami)");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName rejects backticks", () => {
		const result = validateProjectName("`id`");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName accepts valid names", () => {
		expect(validateProjectName("my-project").valid).toBe(true);
		expect(validateProjectName("my_project").valid).toBe(true);
		expect(validateProjectName("myProject123").valid).toBe(true);
	});
});
