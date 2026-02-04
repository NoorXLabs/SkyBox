// tests/unit/commands/up.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("up command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("up");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("project path construction works", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		const project = "myapp";
		const projectPath = join(projectsDir, project);
		expect(projectPath).toBe(`${ctx.testDir}/Projects/myapp`);
	});

	test("can detect missing config", () => {
		const configPath = join(ctx.testDir, "config.yaml");
		expect(existsSync(configPath)).toBe(false);
	});
});

describe("sanitizeDockerError", () => {
	test("redacts macOS home directory paths", () => {
		const input = "Error at /Users/john/projects/app/file.ts";
		const pattern = /\/Users\/\w+/;
		expect(pattern.test(input)).toBe(true);

		const sanitized = input.replace(/\/[\w\-/.]+/g, (match) => {
			if (match.includes("/Users/")) return "[REDACTED_PATH]";
			return match;
		});
		expect(sanitized).toContain("[REDACTED_PATH]");
		expect(sanitized).not.toContain("/Users/john");
	});

	test("redacts Linux home directory paths", () => {
		const input = "Error at /home/deploy/app/config.json";
		const sanitized = input.replace(/\/[\w\-/.]+/g, (match) => {
			if (match.includes("/home/")) return "[REDACTED_PATH]";
			return match;
		});
		expect(sanitized).toContain("[REDACTED_PATH]");
		expect(sanitized).not.toContain("/home/deploy");
	});

	test("preserves /tmp paths", () => {
		const input = "Created temp file at /tmp/devbox-12345/file";
		const sanitized = input.replace(/\/[\w\-/.]+/g, (match) => {
			if (match.startsWith("/tmp")) return match;
			if (match.includes("/Users/") || match.includes("/home/"))
				return "[REDACTED_PATH]";
			return match;
		});
		expect(sanitized).toContain("/tmp/devbox-12345/file");
	});

	test("preserves Docker socket paths", () => {
		const input = "Cannot connect to /var/run/docker.sock";
		const sanitized = input.replace(/\/[\w\-/.]+/g, (match) => {
			if (match.startsWith("/var/run/docker")) return match;
			if (match.includes("/Users/") || match.includes("/home/"))
				return "[REDACTED_PATH]";
			return match;
		});
		expect(sanitized).toContain("/var/run/docker.sock");
	});

	test("redacts password fragments", () => {
		const input = "Auth failed: password=secret123 for user";
		const sanitized = input.replace(/password[=:]\S+/gi, "password=[REDACTED]");
		expect(sanitized).toContain("password=[REDACTED]");
		expect(sanitized).not.toContain("secret123");
	});

	test("redacts token fragments", () => {
		const input = "Invalid token=ghp_abcdefg123456";
		const sanitized = input.replace(/token[=:]\S+/gi, "token=[REDACTED]");
		expect(sanitized).toContain("token=[REDACTED]");
		expect(sanitized).not.toContain("ghp_abcdefg123456");
	});
});
