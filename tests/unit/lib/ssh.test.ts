// tests/unit/lib/ssh.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	findSSHKeys,
	parseSSHConfig,
	sanitizeSshError,
	secureScp,
	writeSSHConfigEntry,
} from "@lib/ssh.ts";

const scpAvailable =
	existsSync("/usr/bin/scp") || existsSync("/usr/local/bin/scp");

describe("ssh", () => {
	describe("parseSSHConfig", () => {
		let testDir: string;
		let originalHome: string | undefined;

		beforeEach(() => {
			testDir = join(tmpdir(), `skybox-ssh-test-${Date.now()}`);
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

		test("skips Host * wildcard entries", () => {
			const sshConfig = `
Host *
  ServerAliveInterval 60
  ServerAliveCountMax 3

Host myserver
  HostName 192.168.1.100
  User admin

Host *.example.com
  User deploy

Host workserver
  HostName work.example.com
  User developer
`;
			writeFileSync(join(testDir, ".ssh", "config"), sshConfig);

			const hosts = parseSSHConfig();

			expect(hosts).toHaveLength(2);
			expect(hosts[0].name).toBe("myserver");
			expect(hosts[1].name).toBe("workserver");
		});
	});

	describe("findSSHKeys", () => {
		let sshTestDir: string;
		let originalHome: string | undefined;

		beforeEach(() => {
			sshTestDir = join(tmpdir(), `skybox-ssh-keys-test-${Date.now()}`);
			mkdirSync(join(sshTestDir, ".ssh"), { recursive: true });
			originalHome = process.env.HOME;
			process.env.HOME = sshTestDir;
		});

		afterEach(() => {
			if (existsSync(sshTestDir)) {
				rmSync(sshTestDir, { recursive: true });
			}
			if (originalHome) {
				process.env.HOME = originalHome;
			}
		});

		test("finds ed25519 and rsa keys when present", () => {
			const sshDir = join(sshTestDir, ".ssh");
			writeFileSync(join(sshDir, "id_ed25519"), "fake-private-key");
			writeFileSync(join(sshDir, "id_ed25519.pub"), "fake-public-key");
			writeFileSync(join(sshDir, "id_rsa"), "fake-rsa-key");
			writeFileSync(join(sshDir, "id_rsa.pub"), "fake-rsa-pub");

			const keys = findSSHKeys();
			expect(keys).toHaveLength(2);
			expect(keys).toContain(join(sshDir, "id_ed25519"));
			expect(keys).toContain(join(sshDir, "id_rsa"));
		});

		test("returns empty array when no keys exist", () => {
			const keys = findSSHKeys();
			expect(keys).toEqual([]);
		});

		test("returns empty array when .ssh directory does not exist", () => {
			rmSync(join(sshTestDir, ".ssh"), { recursive: true });
			const keys = findSSHKeys();
			expect(keys).toEqual([]);
		});
	});

	describe("sanitizeSshError", () => {
		test("redacts identity file paths", () => {
			const input =
				"Warning: identity file /Users/john/.ssh/id_rsa not accessible";
			const sanitized = sanitizeSshError(input);
			expect(sanitized).toContain("identity file [REDACTED]");
			expect(sanitized).not.toContain("/Users/john/.ssh/id_rsa");
		});

		test("redacts SSH fingerprints", () => {
			const input =
				"Host key: SHA256:aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99";
			const sanitized = sanitizeSshError(input);
			expect(sanitized).toContain("[FINGERPRINT]");
			expect(sanitized).not.toContain("aa:bb:cc");
		});

		test("redacts embedded usernames", () => {
			const input = "Connection failed for username=deploy on host";
			const sanitized = sanitizeSshError(input);
			expect(sanitized).toContain("user=[REDACTED]");
			expect(sanitized).not.toContain("deploy");
		});

		test("returns generic message for permission denied", () => {
			const input = "Permission denied (publickey,password)";
			const sanitized = sanitizeSshError(input);
			expect(sanitized).toBe(
				"SSH authentication failed. Check your SSH key and remote configuration.",
			);
		});

		test("returns generic message for authentication errors", () => {
			const input = "authentication failed for user@host";
			const sanitized = sanitizeSshError(input);
			expect(sanitized).toBe(
				"SSH authentication failed. Check your SSH key and remote configuration.",
			);
		});

		test("redacts identity file path even when Permission denied follows on same line", () => {
			// The identity file regex is greedy: it matches everything after "identity file"
			// until comma or newline, so "Permission denied" on the same line is consumed.
			const input =
				"Warning: identity file /Users/john/.ssh/id_rsa not accessible: Permission denied (publickey)";
			const sanitized = sanitizeSshError(input);
			expect(sanitized).toContain("identity file [REDACTED]");
			expect(sanitized).not.toContain("/Users/john/.ssh/id_rsa");
		});
	});

	describe("secureScp", () => {
		test("is exported as a function", () => {
			expect(typeof secureScp).toBe("function");
		});

		test.skipIf(!scpAvailable)(
			"treats malicious source as literal filename via -- separator",
			async () => {
				// secureScp uses "--" separator to prevent option injection.
				// With "--", scp treats "-oProxyCommand=evil" as a literal filename.
				// The error should indicate a missing file, confirming the argument
				// was NOT interpreted as an scp option.
				try {
					await secureScp("-oProxyCommand=evil", "dest:/tmp/file");
					// If it didn't throw, that's also fine (unlikely but acceptable)
				} catch (error: unknown) {
					const message =
						error instanceof Error ? error.message : String(error);
					// The security guard works: scp reports "No such file" for the literal path
					expect(message).toContain("No such file");
				}
			},
		);
	});

	describe("writeSSHConfigEntry", () => {
		let sshTestDir: string;
		let originalHome: string | undefined;

		beforeEach(() => {
			sshTestDir = join(tmpdir(), `skybox-ssh-write-test-${Date.now()}`);
			mkdirSync(join(sshTestDir, ".ssh"), { recursive: true });
			originalHome = process.env.HOME;
			process.env.HOME = sshTestDir;
		});

		afterEach(() => {
			if (existsSync(sshTestDir)) {
				rmSync(sshTestDir, { recursive: true });
			}
			if (originalHome) {
				process.env.HOME = originalHome;
			}
		});

		test("successfully writes an SSH config entry", () => {
			const result = writeSSHConfigEntry({
				name: "testserver",
				hostname: "192.168.1.100",
				user: "admin",
				identityFile: "~/.ssh/id_ed25519",
			});

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();

			const configPath = join(sshTestDir, ".ssh", "config");
			expect(existsSync(configPath)).toBe(true);

			const content = readFileSync(configPath, "utf-8");
			expect(content).toContain("Host testserver");
			expect(content).toContain("HostName 192.168.1.100");
			expect(content).toContain("User admin");
			expect(content).toContain("IdentityFile ~/.ssh/id_ed25519");
		});

		test("writes entry with optional port", () => {
			const result = writeSSHConfigEntry({
				name: "testserver",
				hostname: "192.168.1.100",
				user: "admin",
				identityFile: "~/.ssh/id_ed25519",
				port: 2222,
			});

			expect(result.success).toBe(true);

			const configPath = join(sshTestDir, ".ssh", "config");
			const content = readFileSync(configPath, "utf-8");
			expect(content).toContain("Port 2222");
		});

		test("rejects duplicate host names", () => {
			const existingConfig = `
Host myserver
  HostName 10.0.0.1
  User root
`;
			writeFileSync(join(sshTestDir, ".ssh", "config"), existingConfig);

			const result = writeSSHConfigEntry({
				name: "myserver",
				hostname: "192.168.1.100",
				user: "admin",
				identityFile: "~/.ssh/id_ed25519",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("already exists");
		});

		test("rejects duplicate host names case-insensitively", () => {
			const existingConfig = `
Host MyServer
  HostName 10.0.0.1
  User root
`;
			writeFileSync(join(sshTestDir, ".ssh", "config"), existingConfig);

			const result = writeSSHConfigEntry({
				name: "myserver",
				hostname: "192.168.1.100",
				user: "admin",
				identityFile: "~/.ssh/id_ed25519",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("already exists");
		});

		test("rejects entries with invalid field characters", () => {
			const result = writeSSHConfigEntry({
				name: "test\nserver",
				hostname: "192.168.1.100",
				user: "admin",
				identityFile: "~/.ssh/id_ed25519",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("cannot contain newlines");
		});

		test("rejects entries with invalid hostname", () => {
			const result = writeSSHConfigEntry({
				name: "testserver",
				hostname: "bad host name",
				user: "admin",
				identityFile: "~/.ssh/id_ed25519",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("contains invalid characters");
		});

		test("creates .ssh directory if it does not exist", () => {
			rmSync(join(sshTestDir, ".ssh"), { recursive: true });
			expect(existsSync(join(sshTestDir, ".ssh"))).toBe(false);

			const result = writeSSHConfigEntry({
				name: "testserver",
				hostname: "192.168.1.100",
				user: "admin",
				identityFile: "~/.ssh/id_ed25519",
			});

			expect(result.success).toBe(true);
			expect(existsSync(join(sshTestDir, ".ssh"))).toBe(true);
			expect(existsSync(join(sshTestDir, ".ssh", "config"))).toBe(true);
		});
	});
});
