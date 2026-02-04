// tests/unit/lib/config.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	configExists,
	getRemote,
	listRemotes,
	loadConfig,
	saveConfig,
} from "@lib/config.ts";
import { ConfigValidationError, validateConfig } from "@lib/config-schema.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("config", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("config");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("configExists returns false when no config", async () => {
		expect(configExists()).toBe(false);
	});

	test("loadConfig returns null when no config", async () => {
		expect(loadConfig()).toBeNull();
	});

	test("saveConfig creates config file with V2 format", async () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: ["node_modules"] },
			remotes: {
				myserver: {
					host: "myserver",
					path: "~/code",
				},
			},
			projects: {},
		};

		saveConfig(config);

		expect(configExists()).toBe(true);
		const loaded = loadConfig();
		expect(loaded?.remotes.myserver.host).toBe("myserver");
		expect(loaded?.editor).toBe("cursor");
	});

	test("auto-migrates old config format on load", async () => {
		const oldConfig = `
remote:
  host: my-server
  base_path: ~/code
editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
projects:
  my-app: {}
`;
		writeFileSync(join(ctx.testDir, "config.yaml"), oldConfig);

		const config = loadConfig();

		expect(config).not.toBeNull();
		expect(config?.remotes).toBeDefined();
		expect(config?.remotes["my-server"]).toBeDefined();
		expect(config?.remotes["my-server"].host).toBe("my-server");
		expect(config?.remotes["my-server"].path).toBe("~/code");
		expect("remote" in (config ?? {})).toBe(false);
		// Check that projects got updated with remote reference
		expect(config?.projects["my-app"]).toBeDefined();
		expect(config?.projects["my-app"].remote).toBe("my-server");
	});

	test("does not re-migrate already migrated config", async () => {
		const v2Config = `
editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes:
  my-server:
    host: my-server
    user: null
    path: ~/code
    key: null
projects:
  my-app:
    remote: my-server
`;
		writeFileSync(join(ctx.testDir, "config.yaml"), v2Config);

		const config = loadConfig();

		expect(config).not.toBeNull();
		expect(config?.remotes).toBeDefined();
		expect(config?.remotes["my-server"]).toBeDefined();
		expect(config?.remotes["my-server"].host).toBe("my-server");
	});

	test("getRemote returns remote by name", async () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {
				"work-server": {
					host: "192.168.1.100",
					user: "dev",
					path: "/home/dev/projects",
					key: "~/.ssh/work_key",
				},
				"personal-server": {
					host: "my-nas.local",
					path: "~/code",
				},
			},
			projects: {},
		};

		saveConfig(config);

		const workRemote = getRemote("work-server");
		expect(workRemote).not.toBeNull();
		expect(workRemote?.host).toBe("192.168.1.100");
		expect(workRemote?.user).toBe("dev");
		expect(workRemote?.path).toBe("/home/dev/projects");

		const personalRemote = getRemote("personal-server");
		expect(personalRemote).not.toBeNull();
		expect(personalRemote?.host).toBe("my-nas.local");
		expect(personalRemote?.user).toBeUndefined();

		const nonexistent = getRemote("nonexistent");
		expect(nonexistent).toBeNull();
	});

	test("getRemote returns null when no config", async () => {
		expect(getRemote("any")).toBeNull();
	});

	test("listRemotes returns all remotes with names", async () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {
				"work-server": {
					host: "192.168.1.100",
					user: "dev",
					path: "/home/dev/projects",
				},
				"personal-server": {
					host: "my-nas.local",
					path: "~/code",
				},
			},
			projects: {},
		};

		saveConfig(config);

		const remotes = listRemotes();
		expect(remotes).toHaveLength(2);

		const workRemote = remotes.find((r) => r.name === "work-server");
		expect(workRemote).toBeDefined();
		expect(workRemote?.host).toBe("192.168.1.100");
		expect(workRemote?.user).toBe("dev");

		const personalRemote = remotes.find((r) => r.name === "personal-server");
		expect(personalRemote).toBeDefined();
		expect(personalRemote?.host).toBe("my-nas.local");
	});

	test("listRemotes returns empty array when no config", async () => {
		expect(listRemotes()).toEqual([]);
	});

	test("listRemotes returns empty array when no remotes", async () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {},
			projects: {},
		};

		saveConfig(config);
		expect(listRemotes()).toEqual([]);
	});

	test("throws on invalid YAML", () => {
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			"invalid: yaml: [broken: {nope",
		);
		expect(() => loadConfig()).toThrow();
	});
});

describe("config error paths", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("config-errors");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("loadConfig on malformed YAML throws with config path", () => {
		writeFileSync(join(ctx.testDir, "config.yaml"), ":\n  - :\n    bad:: [}{");
		expect(() => loadConfig()).toThrow(/Failed to parse config file/);
	});

	test("loadConfig on empty config file throws validation error", () => {
		writeFileSync(join(ctx.testDir, "config.yaml"), "");
		// Empty YAML parses to null, which fails validation
		expect(() => loadConfig()).toThrow(/Invalid config/);
	});

	test("saveConfig creates parent directories if missing", () => {
		const nestedDir = join(ctx.testDir, "nested", "deep");
		process.env.DEVBOX_HOME = nestedDir;

		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {},
			projects: {},
		};

		// Should not throw even though nested/deep doesn't exist
		saveConfig(config);
		expect(configExists()).toBe(true);
	});

	test("getRemote returns null for nonexistent remote with config present", () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {
				existing: { host: "example.com", path: "~/code" },
			},
			projects: {},
		};
		saveConfig(config);

		expect(getRemote("nonexistent")).toBeNull();
	});
});

describe("config file permissions", () => {
	let ctx: TestContext;
	let originalEnv: string | undefined;

	beforeEach(() => {
		ctx = createTestContext("config-permissions");
		originalEnv = process.env.DEVBOX_HOME;
	});

	afterEach(() => {
		// Restore env before cleanup since cleanup also restores it
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		}
		ctx.cleanup();
	});

	test("saveConfig creates directory with mode 0o700", () => {
		// Point DEVBOX_HOME to a non-existent subdirectory so saveConfig creates it
		const newDir = join(ctx.testDir, "new-devbox-home");
		process.env.DEVBOX_HOME = newDir;

		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {},
			projects: {},
		};

		saveConfig(config);

		const stats = statSync(newDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});

	test("saveConfig creates config file with mode 0o600", () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {},
			projects: {},
		};

		saveConfig(config);

		const configPath = join(ctx.testDir, "config.yaml");
		const stats = statSync(configPath);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o600);
	});
});

describe("config schema validation edge cases", () => {
	test("rejects config with non-string editor", () => {
		const invalidConfig = {
			editor: 123,
			remotes: {},
			projects: {},
		};

		expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		expect(() => validateConfig(invalidConfig)).toThrow("editor");
	});

	test("rejects config with invalid remote structure (not an object)", () => {
		const invalidConfig = {
			editor: "cursor",
			remotes: { work: "not-an-object" },
			projects: {},
		};

		expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		expect(() => validateConfig(invalidConfig)).toThrow("remotes.work");
	});

	test("rejects config with remote missing host and path", () => {
		const invalidConfig = {
			editor: "cursor",
			remotes: { work: { user: "deploy" } },
			projects: {},
		};

		expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		expect(() => validateConfig(invalidConfig)).toThrow("host or path");
	});

	test("rejects config with invalid sync_mode", () => {
		const invalidConfig = {
			editor: "cursor",
			defaults: { sync_mode: "invalid-mode" },
			remotes: {},
			projects: {},
		};

		expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		expect(() => validateConfig(invalidConfig)).toThrow("sync_mode");
	});

	test("rejects config with non-array ignore", () => {
		const invalidConfig = {
			editor: "cursor",
			defaults: { ignore: "should-be-array" },
			remotes: {},
			projects: {},
		};

		expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		expect(() => validateConfig(invalidConfig)).toThrow("ignore");
	});

	test("accepts valid minimal config", () => {
		const validConfig = {
			remotes: {},
			projects: {},
		};

		expect(() => validateConfig(validConfig)).not.toThrow();
	});

	test("accepts valid complete config", () => {
		const validConfig = {
			editor: "cursor",
			defaults: {
				sync_mode: "two-way-resolved",
				ignore: [".git", "node_modules"],
			},
			remotes: {
				work: { host: "server.example.com", path: "~/code" },
			},
			projects: {
				myapp: { remote: "work" },
			},
		};

		expect(() => validateConfig(validConfig)).not.toThrow();
	});
});
