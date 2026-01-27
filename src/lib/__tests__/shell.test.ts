// src/lib/__tests__/shell.test.ts
import { describe, expect, test } from "bun:test";
import { escapeShellArg } from "../shell.ts";

describe("shell", () => {
	describe("escapeShellArg", () => {
		test("escapes single quotes", () => {
			const result = escapeShellArg("it's");
			expect(result).toBe("'it'\\''s'");
		});

		test("handles special characters safely", () => {
			const malicious = "admin'; rm -rf /";
			const result = escapeShellArg(malicious);
			// Result should be safely quoted, not executable
			// The single quote in the input gets replaced with '\''
			// Input: admin'; rm -rf /
			// Output: 'admin' + '\'' + '; rm -rf /'
			expect(result).toBe("'admin'\\''; rm -rf /'");
		});

		test("handles empty strings", () => {
			const result = escapeShellArg("");
			expect(result).toBe("''");
		});

		test("handles backslashes", () => {
			const result = escapeShellArg("path\\with\\backslashes");
			expect(result).toBe("'path\\with\\backslashes'");
		});

		test("handles strings without special characters", () => {
			const result = escapeShellArg("normal-string");
			expect(result).toBe("'normal-string'");
		});

		test("handles multiple single quotes", () => {
			const result = escapeShellArg("it's got 'quotes' here");
			expect(result).toBe("'it'\\''s got '\\''quotes'\\'' here'");
		});

		test("handles newlines", () => {
			const result = escapeShellArg("line1\nline2");
			expect(result).toBe("'line1\nline2'");
		});

		test("handles dollar signs", () => {
			const result = escapeShellArg("$HOME/path");
			expect(result).toBe("'$HOME/path'");
		});

		test("handles backticks", () => {
			const result = escapeShellArg("`whoami`");
			expect(result).toBe("'`whoami`'");
		});
	});
});
