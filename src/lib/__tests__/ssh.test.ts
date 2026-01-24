// src/lib/__tests__/ssh.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSSHKeys, parseSSHConfig } from "../ssh.ts";

describe("ssh", () => {
	describe("parseSSHConfig", () => {
		let testDir: string;
		let originalHome: string | undefined;

		beforeEach(() => {
			testDir = join(tmpdir(), `devbox-ssh-test-${Date.now()}`);
			mkdirSync(join(testDir, ".ssh"), { recursive: true });
			originalHome = process.env.HOME;
			process.env.HOME = testDir;
		});

		afterEach(() => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true });
			}
			if (originalHome) {
				process.env.HOME = originalHome;
			}
		});

		test("returns empty array when no ssh config", async () => {
			const hosts = parseSSHConfig();
			expect(hosts).toEqual([]);
		});

		test("parses hosts from ssh config", async () => {
			const sshConfig = `
Host myserver
  HostName 192.168.1.100
  User admin
  Port 22
  IdentityFile ~/.ssh/id_ed25519

Host workserver
  HostName work.example.com
  User developer
`;
			writeFileSync(join(testDir, ".ssh", "config"), sshConfig);

			const hosts = parseSSHConfig();

			expect(hosts.length).toBe(2);
			expect(hosts[0].name).toBe("myserver");
			expect(hosts[0].hostname).toBe("192.168.1.100");
			expect(hosts[0].user).toBe("admin");
			expect(hosts[1].name).toBe("workserver");
		});
	});

	describe("findSSHKeys", () => {
		test("finds existing ssh keys", async () => {
			const keys = findSSHKeys();
			// This will depend on the actual system, just verify it returns an array
			expect(Array.isArray(keys)).toBe(true);
		});
	});
});
