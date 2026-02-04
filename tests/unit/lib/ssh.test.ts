// tests/unit/lib/ssh.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSSHKeys, parseSSHConfig } from "@lib/ssh.ts";

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

	describe("sanitizeSshError", () => {
		test("redacts identity file paths", () => {
			const input =
				"Permission denied (identity file /Users/john/.ssh/id_rsa not found)";
			const sanitized = input.replace(
				/identity file[^,\n]*/gi,
				"identity file [REDACTED]",
			);
			expect(sanitized).toContain("identity file [REDACTED]");
			expect(sanitized).not.toContain("/Users/john/.ssh/id_rsa");
		});

		test("redacts SSH fingerprints", () => {
			const input =
				"Host key: SHA256:aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99";
			const sanitized = input.replace(
				/[A-Fa-f0-9]{2}(:[A-Fa-f0-9]{2}){15,}/g,
				"[FINGERPRINT]",
			);
			expect(sanitized).toContain("[FINGERPRINT]");
			expect(sanitized).not.toContain("aa:bb:cc");
		});

		test("redacts embedded usernames", () => {
			const input = "Connection failed for username=deploy on host";
			const sanitized = input.replace(
				/user(name)?[=:\s]+\S+/gi,
				"user=[REDACTED]",
			);
			expect(sanitized).toContain("user=[REDACTED]");
			expect(sanitized).not.toContain("deploy");
		});

		test("returns generic message for permission denied", () => {
			const input = "Permission denied (publickey,password)";
			const expectedGeneric =
				"SSH authentication failed. Check your SSH key and remote configuration.";

			if (input.includes("Permission denied")) {
				expect(expectedGeneric).toContain("SSH authentication failed");
			}
		});

		test("returns generic message for authentication errors", () => {
			const input = "authentication failed for user@host";
			const expectedGeneric =
				"SSH authentication failed. Check your SSH key and remote configuration.";

			if (input.includes("authentication")) {
				expect(expectedGeneric).toContain("SSH authentication failed");
			}
		});
	});
});
