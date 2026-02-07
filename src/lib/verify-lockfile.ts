#!/usr/bin/env bun
/**
 * Verify bun.lock integrity by checking consistency with package.json.
 * Run before builds to detect potential tampering.
 */

import { existsSync } from "node:fs";

const LOCKFILE_PATH = "bun.lock";
const PACKAGE_JSON_PATH = "package.json";

const main = (): void => {
	// Check lockfile exists
	if (!existsSync(LOCKFILE_PATH)) {
		console.error("❌ bun.lock not found");
		process.exit(1);
	}

	// Check package.json exists
	if (!existsSync(PACKAGE_JSON_PATH)) {
		console.error("❌ package.json not found");
		process.exit(1);
	}

	// Run bun install --frozen-lockfile to verify consistency
	console.log("🔒 Verifying lockfile consistency...");
	const result = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], {
		stdio: ["inherit", "inherit", "inherit"],
	});

	if (result.exitCode !== 0) {
		console.error("❌ Lockfile verification failed!");
		console.error("   bun.lock is inconsistent with package.json");
		process.exit(1);
	}

	console.log("✅ Lockfile integrity verified");
};

main();
