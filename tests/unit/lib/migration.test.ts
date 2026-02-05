// tests/unit/lib/migration.test.ts
import { describe, expect, test } from "bun:test";
import { migrateConfig, needsMigration } from "@lib/migration.ts";
import type { DevboxConfig } from "@typedefs/index.ts";

describe("config migration", () => {
	describe("needsMigration", () => {
		test("returns true for old single-remote config", () => {
			const oldConfig = {
				remote: { host: "my-server", base_path: "~/code" },
				editor: "cursor",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
			};
			expect(needsMigration(oldConfig)).toBe(true);
		});

		test("returns false for new multi-remote config", () => {
			const newConfig = {
				editor: "cursor",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				remotes: {
					"my-server": { host: "my-server", user: "root", path: "~/code" },
				},
				projects: {},
			};
			expect(needsMigration(newConfig)).toBe(false);
		});
	});

	describe("migrateConfig", () => {
		test("migrates old config to new format", () => {
			const oldConfig: DevboxConfig = {
				remote: { host: "my-server", base_path: "~/code" },
				editor: "cursor",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: { "my-app": {} },
			};

			const result = migrateConfig(oldConfig);

			expect(result.remotes).toBeDefined();
			expect(result.remotes["my-server"]).toEqual({
				host: "my-server",
				user: undefined,
				path: "~/code",
				key: undefined,
			});
			expect(result.projects["my-app"].remote).toBe("my-server");
			expect("remote" in result).toBe(false);
		});

		test("preserves existing project settings during migration", () => {
			const oldConfig: DevboxConfig = {
				remote: { host: "my-server", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: { "my-app": { ignore: ["custom/*"], editor: "vim" } },
			};

			const result = migrateConfig(oldConfig);

			expect(result.projects["my-app"].ignore).toEqual(["custom/*"]);
			expect(result.projects["my-app"].editor).toBe("vim");
			expect(result.projects["my-app"].remote).toBe("my-server");
		});
	});
});
