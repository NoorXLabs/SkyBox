import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAuditLogPath, logAuditEvent, setAuditEnabled } from "@lib/audit.ts";

describe("audit logging", () => {
	let testDir: string;
	let originalEnv: string | undefined;
	let originalHome: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-audit-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.SKYBOX_AUDIT;
		originalHome = process.env.SKYBOX_HOME;
		process.env.SKYBOX_HOME = testDir;
		setAuditEnabled(true);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.SKYBOX_AUDIT = originalEnv;
		} else {
			delete process.env.SKYBOX_AUDIT;
		}
		if (originalHome) {
			process.env.SKYBOX_HOME = originalHome;
		} else {
			delete process.env.SKYBOX_HOME;
		}
		setAuditEnabled(false);
	});

	test("logAuditEvent writes to audit log", () => {
		logAuditEvent("test-action", { project: "test-project" });

		const logPath = getAuditLogPath();
		expect(existsSync(logPath)).toBe(true);

		const content = readFileSync(logPath, "utf-8");
		expect(content).toContain("test-action");
		expect(content).toContain("test-project");
	});

	test("audit log entries are JSON lines", () => {
		logAuditEvent("action1", { data: "first" });
		logAuditEvent("action2", { data: "second" });

		const logPath = getAuditLogPath();
		const lines = readFileSync(logPath, "utf-8").trim().split("\n");

		expect(lines.length).toBe(2);
		expect(() => JSON.parse(lines[0])).not.toThrow();
		expect(() => JSON.parse(lines[1])).not.toThrow();
	});

	test("audit entries include timestamp", () => {
		logAuditEvent("test-action", {});

		const logPath = getAuditLogPath();
		const content = readFileSync(logPath, "utf-8");
		const entry = JSON.parse(content.trim());

		expect(entry.timestamp).toBeDefined();
		expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
	});

	test("audit disabled by default", () => {
		setAuditEnabled(false);
		logAuditEvent("should-not-log", {});

		const logPath = getAuditLogPath();
		expect(existsSync(logPath)).toBe(false);
	});

	test("audit entries include user and machine", () => {
		logAuditEvent("test-action", { project: "test-project" });

		const logPath = getAuditLogPath();
		const content = readFileSync(logPath, "utf-8");
		const entry = JSON.parse(content.trim());

		expect(entry.user).toBeDefined();
		expect(typeof entry.user).toBe("string");
		expect(entry.machine).toBeDefined();
		expect(typeof entry.machine).toBe("string");
	});

	test("audit entries include action and details", () => {
		logAuditEvent("clone:start", { project: "my-project", remote: "work" });

		const logPath = getAuditLogPath();
		const content = readFileSync(logPath, "utf-8");
		const entry = JSON.parse(content.trim());

		expect(entry.action).toBe("clone:start");
		expect(entry.details.project).toBe("my-project");
		expect(entry.details.remote).toBe("work");
	});

	test("setAuditEnabled(null) restores default env var behavior", () => {
		// Disable override to use env var
		setAuditEnabled(null);

		// With no env var set, logging should be disabled
		delete process.env.SKYBOX_AUDIT;
		logAuditEvent("should-not-log", {});
		const logPath = getAuditLogPath();
		expect(existsSync(logPath)).toBe(false);

		// With env var set, logging should be enabled
		process.env.SKYBOX_AUDIT = "1";
		logAuditEvent("should-log", {});
		expect(existsSync(logPath)).toBe(true);
	});
});
