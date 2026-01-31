import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("update-check", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-test-update-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv !== undefined) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("shouldCheckForUpdate returns true when no metadata file exists", async () => {
		const { shouldCheckForUpdate } = await import("../update-check.ts");
		expect(shouldCheckForUpdate()).toBe(true);
	});

	test("shouldCheckForUpdate returns false when checked less than 24h ago", async () => {
		const { shouldCheckForUpdate } = await import("../update-check.ts");
		const metadataPath = join(testDir, ".update-check.json");
		const metadata = {
			lastCheck: new Date().toISOString(),
			latestVersion: "0.7.0",
			latestStableVersion: "0.7.0",
		};
		writeFileSync(metadataPath, JSON.stringify(metadata));
		expect(shouldCheckForUpdate()).toBe(false);
	});

	test("shouldCheckForUpdate returns true when checked more than 24h ago", async () => {
		const { shouldCheckForUpdate } = await import("../update-check.ts");
		const metadataPath = join(testDir, ".update-check.json");
		const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
		const metadata = {
			lastCheck: yesterday.toISOString(),
			latestVersion: "0.7.0",
			latestStableVersion: "0.7.0",
		};
		writeFileSync(metadataPath, JSON.stringify(metadata));
		expect(shouldCheckForUpdate()).toBe(true);
	});

	test("saveUpdateCheckMetadata writes valid JSON", async () => {
		const { saveUpdateCheckMetadata } = await import("../update-check.ts");
		saveUpdateCheckMetadata("1.0.0", "0.9.0");
		const metadataPath = join(testDir, ".update-check.json");
		const raw = readFileSync(metadataPath, "utf-8");
		const parsed = JSON.parse(raw);
		expect(parsed.latestVersion).toBe("1.0.0");
		expect(parsed.latestStableVersion).toBe("0.9.0");
		expect(parsed.lastCheck).toBeTruthy();
	});

	test("getUpgradeCommand returns correct command per install method", async () => {
		const { getUpgradeCommand } = await import("../update-check.ts");
		expect(getUpgradeCommand("homebrew")).toBe("brew upgrade devbox");
		expect(getUpgradeCommand("npm")).toBe("npm update -g devbox");
		expect(getUpgradeCommand("github-release")).toContain("github.com");
		expect(getUpgradeCommand("source")).toBe("git pull && bun install");
	});

	test("isNewerVersion correctly compares semver strings", async () => {
		const { isNewerVersion } = await import("../update-check.ts");
		expect(isNewerVersion("0.7.0", "0.6.0-beta")).toBe(true);
		expect(isNewerVersion("0.6.0-beta", "0.7.0")).toBe(false);
		expect(isNewerVersion("0.6.0-beta", "0.6.0-beta")).toBe(false);
		expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true);
		expect(isNewerVersion("0.6.1", "0.6.0")).toBe(true);
	});
});
