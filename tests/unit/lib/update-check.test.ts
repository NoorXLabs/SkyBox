import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupTestContext } from "@tests/helpers/test-utils.ts";

describe("update-check", () => {
	const getCtx = setupTestContext("update-check");

	test("shouldCheckForUpdate returns true when no metadata file exists", async () => {
		const { shouldCheckForUpdate } = await import("@lib/update-check.ts");
		expect(shouldCheckForUpdate()).toBe(true);
	});

	test("shouldCheckForUpdate returns false when checked less than 24h ago", async () => {
		const { shouldCheckForUpdate } = await import("@lib/update-check.ts");
		const testDir = getCtx().testDir;
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
		const { shouldCheckForUpdate } = await import("@lib/update-check.ts");
		const testDir = getCtx().testDir;
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
		const { saveUpdateCheckMetadata } = await import("@lib/update-check.ts");
		const testDir = getCtx().testDir;
		saveUpdateCheckMetadata("1.0.0", "0.9.0");
		const metadataPath = join(testDir, ".update-check.json");
		const raw = readFileSync(metadataPath, "utf-8");
		const parsed = JSON.parse(raw);
		expect(parsed.latestVersion).toBe("1.0.0");
		expect(parsed.latestStableVersion).toBe("0.9.0");
		expect(parsed.lastCheck).toBeTruthy();
	});

	test("getUpgradeCommand returns correct command per install method", async () => {
		const { getUpgradeCommand } = await import("@lib/update-check.ts");
		expect(getUpgradeCommand("homebrew")).toBe("brew upgrade skybox");
		expect(getUpgradeCommand("github-release")).toBe("skybox update");
		expect(getUpgradeCommand("source")).toBe("git pull && bun install");
	});

	test("isNewerVersion correctly compares semver strings", async () => {
		const { isNewerVersion } = await import("@lib/update-check.ts");
		expect(isNewerVersion("0.7.0", "0.6.0-beta")).toBe(true);
		expect(isNewerVersion("0.6.0-beta", "0.7.0")).toBe(false);
		expect(isNewerVersion("0.6.0-beta", "0.6.0-beta")).toBe(false);
		expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true);
		expect(isNewerVersion("0.6.1", "0.6.0")).toBe(true);
	});
});
