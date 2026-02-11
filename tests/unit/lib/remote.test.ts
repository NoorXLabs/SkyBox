// tests/unit/lib/remote.test.ts
import { describe, expect, test } from "bun:test";
import { escapeShellArg } from "@lib/shell.ts";

describe("remote module", () => {
	test("exports checkRemoteProjectExists function", async () => {
		const { checkRemoteProjectExists } = await import("@lib/remote.ts");
		expect(typeof checkRemoteProjectExists).toBe("function");
	});
});

describe("shell injection prevention", () => {
	test("escapeShellArg prevents command substitution in paths", () => {
		const maliciousPath = "/home/user/$(rm -rf /)/projects";
		const escaped = escapeShellArg(maliciousPath);

		// Should be wrapped in single quotes, neutralizing $()
		expect(escaped).toBe("'/home/user/$(rm -rf /)/projects'");
		// The content is preserved but wrapped in single quotes, which prevents execution
		expect(escaped.startsWith("'")).toBe(true);
		expect(escaped.endsWith("'")).toBe(true);
	});

	test("escapeShellArg prevents backtick injection", () => {
		const maliciousPath = "/home/user/`whoami`/projects";
		const escaped = escapeShellArg(maliciousPath);

		expect(escaped).toBe("'/home/user/`whoami`/projects'");
	});

	test("escapeShellArg handles embedded single quotes", () => {
		const pathWithQuote = "/home/user's/projects";
		const escaped = escapeShellArg(pathWithQuote);

		// Single quotes should be properly escaped
		expect(escaped).toBe("'/home/user'\\''s/projects'");
	});
});
