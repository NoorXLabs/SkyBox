// src/lib/__tests__/config.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	configExists,
	getRemote,
	listRemotes,
	loadConfig,
	saveConfig,
} from "../config.ts";

describe("config", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
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
		writeFileSync(join(testDir, "config.yaml"), oldConfig);

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
		writeFileSync(join(testDir, "config.yaml"), v2Config);

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
});
