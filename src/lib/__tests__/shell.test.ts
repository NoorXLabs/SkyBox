// src/lib/__tests__/shell.test.ts
import { describe, expect, test } from "bun:test";
import { buildShellCommand, escapeShellArg } from "@lib/shell.ts";

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

		test("handles spaces in argument", () => {
			const result = escapeShellArg("hello world");
			expect(result).toBe("'hello world'");
		});

		test("handles semicolons and pipes", () => {
			const result = escapeShellArg("cmd; echo pwned | cat");
			expect(result).toBe("'cmd; echo pwned | cat'");
		});

		test("handles double quotes", () => {
			const result = escapeShellArg('say "hello"');
			expect(result).toBe("'say \"hello\"'");
		});

		test("handles tab characters", () => {
			const result = escapeShellArg("col1\tcol2");
			expect(result).toBe("'col1\tcol2'");
		});
	});

	describe("buildShellCommand", () => {
		test("buildShellCommand joins args with escaping", () => {
			const result = buildShellCommand("ssh", ["host", "echo", "hello world"]);
			expect(result).toBe("ssh 'host' 'echo' 'hello world'");
		});

		test("buildShellCommand handles empty args", () => {
			const result = buildShellCommand("ls", []);
			expect(result).toBe("ls");
		});
	});
});
