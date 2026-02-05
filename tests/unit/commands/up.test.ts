// tests/unit/commands/up.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { sanitizeDockerError } from "@commands/up.ts";
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
	test("redacts sensitive macOS home directory paths", () => {
		const input = "Error reading /Users/john/.ssh/id_rsa";
		const sanitized = sanitizeDockerError(input);
		expect(sanitized).toContain("[REDACTED_PATH]");
		expect(sanitized).not.toContain(".ssh");
	});

	test("redacts sensitive Linux home directory paths", () => {
		const input = "Error reading /home/deploy/.aws/credentials";
		const sanitized = sanitizeDockerError(input);
		expect(sanitized).toContain("[REDACTED_PATH]");
		expect(sanitized).not.toContain(".aws");
	});

	test("preserves non-sensitive project paths", () => {
		const input = "Error at /Users/john/projects/app/file.ts";
		const sanitized = sanitizeDockerError(input);
		expect(sanitized).toContain("/Users/john/projects/app/file.ts");
	});

	test("preserves /tmp paths", () => {
		const input = "Created temp file at /tmp/skybox-12345/file";
		const sanitized = sanitizeDockerError(input);
		expect(sanitized).toContain("/tmp/skybox-12345/file");
	});

	test("preserves Docker socket paths", () => {
		const input = "Cannot connect to /var/run/docker.sock";
		const sanitized = sanitizeDockerError(input);
		expect(sanitized).toContain("/var/run/docker.sock");
	});

	test("redacts password fragments", () => {
		const input = "Auth failed: password=secret123 for user";
		const sanitized = sanitizeDockerError(input);
		expect(sanitized).toContain("password=[REDACTED]");
		expect(sanitized).not.toContain("secret123");
	});

	test("redacts token fragments", () => {
		const input = "Invalid token=ghp_abcdefg123456";
		const sanitized = sanitizeDockerError(input);
		expect(sanitized).toContain("token=[REDACTED]");
		expect(sanitized).not.toContain("ghp_abcdefg123456");
	});
});
