import { describe, expect, test } from "bun:test";
import { isPathTraversal, validatePath } from "@lib/validation.ts";

describe("validation", () => {
	describe("isPathTraversal", () => {
		test("detects ../etc/passwd", () => {
			expect(isPathTraversal("../etc/passwd")).toBe(true);
		});

		test("detects foo/../../../etc/passwd", () => {
			expect(isPathTraversal("foo/../../../etc/passwd")).toBe(true);
		});

		test("detects ..\\windows\\system32", () => {
			expect(isPathTraversal("..\\windows\\system32")).toBe(true);
		});

		test("allows my-project", () => {
			expect(isPathTraversal("my-project")).toBe(false);
		});

		test("allows src/lib/config.ts", () => {
			expect(isPathTraversal("src/lib/config.ts")).toBe(false);
		});

		test("detects bare ..", () => {
			expect(isPathTraversal("..")).toBe(true);
		});
	});

	describe("validatePath", () => {
		test("accepts valid project name", () => {
			const result = validatePath("my-project");
			expect(result.valid).toBe(true);
		});

		test("rejects path traversal", () => {
			const result = validatePath("../secret");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("path traversal");
			}
		});

		test("rejects absolute path", () => {
			const result = validatePath("/etc/passwd");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("absolute");
			}
		});

		test("rejects empty string", () => {
			const result = validatePath("");
			expect(result.valid).toBe(false);
		});
	});
});
