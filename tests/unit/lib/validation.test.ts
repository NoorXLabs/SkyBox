import { describe, expect, test } from "bun:test";
import {
	isPathTraversal,
	validatePath,
	validateRemotePath,
} from "@lib/validation.ts";

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

	describe("validateRemotePath", () => {
		test("accepts valid absolute paths", () => {
			expect(validateRemotePath("/home/user/code").valid).toBe(true);
			expect(validateRemotePath("/var/projects").valid).toBe(true);
		});

		test("accepts tilde paths", () => {
			expect(validateRemotePath("~/code").valid).toBe(true);
			expect(validateRemotePath("~/projects/devbox").valid).toBe(true);
		});

		test("rejects command substitution with $()", () => {
			const result = validateRemotePath("/home/$(rm -rf /)/code");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("command substitution");
			}
		});

		test("rejects command substitution with backticks", () => {
			const result = validateRemotePath("/home/`whoami`/code");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("command substitution");
			}
		});

		test("rejects semicolon command chaining", () => {
			const result = validateRemotePath("/home/user; rm -rf /");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects pipe command chaining", () => {
			const result = validateRemotePath("/home/user | cat /etc/passwd");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects ampersand command chaining", () => {
			const result = validateRemotePath("/home/user && rm -rf /");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects newlines", () => {
			const result = validateRemotePath("/home/user\nrm -rf /");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects empty paths", () => {
			const result = validateRemotePath("");
			expect(result.valid).toBe(false);
		});

		test("rejects paths with only whitespace", () => {
			const result = validateRemotePath("   ");
			expect(result.valid).toBe(false);
		});
	});
});
