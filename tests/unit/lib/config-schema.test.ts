// tests/unit/lib/config-schema.test.ts
import { describe, expect, test } from "bun:test";
import { ConfigValidationError, validateConfig } from "@lib/config-schema.ts";

// minimal valid config for testing
const baseConfig = () => ({
	editor: "cursor",
	defaults: { sync_mode: "two-way-resolved", ignore: [] },
	remotes: {
		work: { host: "work-server", path: "~/code" },
	},
	projects: {},
});

describe("config-schema", () => {
	describe("useKeychain validation", () => {
		test("valid config with useKeychain: true passes validation", () => {
			const config = baseConfig();
			config.remotes.work = {
				...config.remotes.work,
				useKeychain: true,
			} as typeof config.remotes.work;
			expect(() => validateConfig(config)).not.toThrow();
		});

		test("valid config with useKeychain: false passes validation", () => {
			const config = baseConfig();
			config.remotes.work = {
				...config.remotes.work,
				useKeychain: false,
			} as typeof config.remotes.work;
			expect(() => validateConfig(config)).not.toThrow();
		});

		test("valid config without useKeychain passes validation (backward compatible)", () => {
			const config = baseConfig();
			expect(() => validateConfig(config)).not.toThrow();
		});

		test("config with useKeychain: string fails validation (wrong type)", () => {
			const config = baseConfig();
			(config.remotes.work as Record<string, unknown>).useKeychain = "yes";
			expect(() => validateConfig(config)).toThrow(ConfigValidationError);
		});

		test("config with useKeychain: number fails validation (wrong type)", () => {
			const config = baseConfig();
			(config.remotes.work as Record<string, unknown>).useKeychain = 1;
			expect(() => validateConfig(config)).toThrow(ConfigValidationError);
		});
	});
});
