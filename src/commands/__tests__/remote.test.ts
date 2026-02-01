// src/commands/__tests__/remote.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	addRemoteDirect,
	parseRemoteString,
	removeRemote,
	renameRemote,
} from "@commands/remote.ts";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { loadConfig, saveConfig } from "@lib/config.ts";

describe("remote command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("remote");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("parseRemoteString", () => {
		test("parses valid user@host:path format", async () => {
			const result = parseRemoteString("root@192.168.1.100:~/code");
			expect(result).not.toBeNull();
			expect(result?.user).toBe("root");
			expect(result?.host).toBe("192.168.1.100");
			expect(result?.path).toBe("~/code");
		});

		test("parses hostname with domain", async () => {
			const result = parseRemoteString(
				"dev@server.example.com:/home/dev/projects",
			);
			expect(result).not.toBeNull();
			expect(result?.user).toBe("dev");
			expect(result?.host).toBe("server.example.com");
			expect(result?.path).toBe("/home/dev/projects");
		});

		test("handles complex paths", async () => {
			const result = parseRemoteString("admin@myserver:/var/www/html/projects");
			expect(result).not.toBeNull();
			expect(result?.user).toBe("admin");
			expect(result?.host).toBe("myserver");
			expect(result?.path).toBe("/var/www/html/projects");
		});

		test("returns null for invalid format - missing @", async () => {
			const result = parseRemoteString("root192.168.1.100:~/code");
			expect(result).toBeNull();
		});

		test("returns null for invalid format - missing :", async () => {
			const result = parseRemoteString("root@192.168.1.100/code");
			expect(result).toBeNull();
		});

		test("returns null for invalid format - missing path", async () => {
			const result = parseRemoteString("root@192.168.1.100:");
			expect(result).toBeNull();
		});

		test("returns null for empty string", async () => {
			const result = parseRemoteString("");
			expect(result).toBeNull();
		});
	});

	describe("addRemoteDirect", () => {
		test("adds remote to config", async () => {
			const result = await addRemoteDirect(
				"myserver",
				"root@192.168.1.100:~/code",
			);

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();

			const config = loadConfig();
			expect(config).not.toBeNull();
			expect(config?.remotes.myserver).toBeDefined();
			expect(config?.remotes.myserver.host).toBe("192.168.1.100");
			expect(config?.remotes.myserver.user).toBe("root");
			expect(config?.remotes.myserver.path).toBe("~/code");
			expect(config?.remotes.myserver.key).toBeUndefined();
		});

		test("adds remote with custom key", async () => {
			const result = await addRemoteDirect(
				"workserver",
				"dev@work.example.com:/home/dev/projects",
				{ key: "~/.ssh/work_key" },
			);

			expect(result.success).toBe(true);

			const config = loadConfig();
			expect(config?.remotes.workserver.key).toBe("~/.ssh/work_key");
		});

		test("rejects duplicate remote name", async () => {
			// Add first remote
			const result1 = await addRemoteDirect(
				"myserver",
				"root@192.168.1.100:~/code",
			);
			expect(result1.success).toBe(true);

			// Try to add duplicate
			const result2 = await addRemoteDirect(
				"myserver",
				"admin@192.168.1.200:~/projects",
			);
			expect(result2.success).toBe(false);
			expect(result2.error).toBe('Remote "myserver" already exists');
		});

		test("rejects invalid remote format", async () => {
			const result = await addRemoteDirect("bad", "invalid-format");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Invalid remote format");
		});

		test("creates config if none exists", async () => {
			// Ensure no config exists
			expect(loadConfig()).toBeNull();

			const result = await addRemoteDirect("newserver", "root@host:~/code");

			expect(result.success).toBe(true);

			const config = loadConfig();
			expect(config).not.toBeNull();
			expect(config?.remotes.newserver).toBeDefined();
			expect(config?.editor).toBe("cursor");
		});

		test("preserves existing remotes when adding new", async () => {
			// Add first remote
			await addRemoteDirect("server1", "user1@host1:~/code1");

			// Add second remote
			await addRemoteDirect("server2", "user2@host2:~/code2");

			const config = loadConfig();
			expect(config).not.toBeNull();
			expect(Object.keys(config?.remotes ?? {})).toHaveLength(2);
			expect(config?.remotes.server1).toBeDefined();
			expect(config?.remotes.server2).toBeDefined();
		});
	});

	describe("removeRemote", () => {
		test("removes remote from config", async () => {
			// Add remote first
			await addRemoteDirect("toremove", "root@host:~/code");

			// Mock inquirer to auto-confirm (since no projects use this remote)
			// For this test, no projects reference the remote so no prompt needed

			await removeRemote("toremove");

			const config = loadConfig();
			expect(config?.remotes.toremove).toBeUndefined();
		});

		test("handles non-existent remote", async () => {
			// Create a config with one remote
			await addRemoteDirect("existing", "root@host:~/code");

			// Try to remove non-existent remote (should just show error, not throw)
			await removeRemote("nonexistent");

			// Existing remote should still be there
			const config = loadConfig();
			expect(config?.remotes.existing).toBeDefined();
		});
	});

	describe("renameRemote", () => {
		test("renames remote and preserves config", async () => {
			// Add remote first
			await addRemoteDirect("oldname", "root@192.168.1.100:~/code");

			await renameRemote("oldname", "newname");

			const config = loadConfig();
			expect(config?.remotes.oldname).toBeUndefined();
			expect(config?.remotes.newname).toBeDefined();
			expect(config?.remotes.newname.host).toBe("192.168.1.100");
			expect(config?.remotes.newname.user).toBe("root");
			expect(config?.remotes.newname.path).toBe("~/code");
		});

		test("updates project references on rename", async () => {
			// Add remote first
			await addRemoteDirect("oldserver", "root@host:~/code");

			// Add a project that references this remote
			const config = loadConfig();
			if (!config) throw new Error("Config should exist");
			config.projects["my-project"] = { remote: "oldserver" };
			saveConfig(config);

			await renameRemote("oldserver", "newserver");

			const updatedConfig = loadConfig();
			expect(updatedConfig?.projects["my-project"].remote).toBe("newserver");
		});

		test("handles non-existent old name", async () => {
			// Create a config with one remote
			await addRemoteDirect("existing", "root@host:~/code");

			// Try to rename non-existent remote (should just show error, not throw)
			await renameRemote("nonexistent", "newname");

			// Existing remote should still be there unchanged
			const config = loadConfig();
			expect(config?.remotes.existing).toBeDefined();
			expect(config?.remotes.newname).toBeUndefined();
		});

		test("rejects rename to existing name", async () => {
			// Add two remotes
			await addRemoteDirect("remote1", "root@host1:~/code");
			await addRemoteDirect("remote2", "root@host2:~/code");

			// Try to rename remote1 to remote2 (should fail)
			await renameRemote("remote1", "remote2");

			// Both should still exist with original names
			const config = loadConfig();
			expect(config?.remotes.remote1).toBeDefined();
			expect(config?.remotes.remote2).toBeDefined();
			expect(config?.remotes.remote1.host).toBe("host1");
		});
	});
});
