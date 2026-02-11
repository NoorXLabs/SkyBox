// tests/unit/lib/ssh-agent.test.ts
// Tests for SSH agent functions (passphrase-protected key support).
// Uses a separate file to avoid execa mock contamination (see CLAUDE.md).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Generate a real passwordless ed25519 key for testing.
// Uses execFileSync to avoid shell injection.
const generateTestKey = (dir: string, name: string): string => {
	const keyPath = join(dir, name);
	execFileSync("ssh-keygen", ["-t", "ed25519", "-f", keyPath, "-N", "", "-q"], {
		stdio: "pipe",
	});
	return keyPath;
};

// Generate a passphrase-protected ed25519 key for testing.
const generateProtectedTestKey = (
	dir: string,
	name: string,
	passphrase: string,
): string => {
	const keyPath = join(dir, name);
	execFileSync(
		"ssh-keygen",
		["-t", "ed25519", "-f", keyPath, "-N", passphrase, "-q"],
		{ stdio: "pipe" },
	);
	return keyPath;
};

// Check if ssh-keygen is available for real key tests
let sshKeygenAvailable = false;
try {
	execFileSync("ssh-keygen", ["-h"], { stdio: "pipe" });
	sshKeygenAvailable = true;
} catch {
	// ssh-keygen might return non-zero for -h but still be available
	try {
		execFileSync("which", ["ssh-keygen"], { stdio: "pipe" });
		sshKeygenAvailable = true;
	} catch {
		// truly not available
	}
}

// Check if ssh-agent is running for agent tests
let sshAgentAvailable = false;
try {
	execFileSync("ssh-add", ["-l"], { stdio: "pipe" });
	sshAgentAvailable = true;
} catch (err: unknown) {
	// Exit code 1 = agent running but no keys (still available)
	// Exit code 2 = no agent
	const e = err as { status?: number };
	sshAgentAvailable = e.status === 1;
}

describe("ssh-agent functions", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-ssh-agent-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("isKeyPassphraseProtected", () => {
		test.skipIf(!sshKeygenAvailable)(
			"returns false for a passwordless key",
			async () => {
				const { isKeyPassphraseProtected } = await import("@lib/ssh.ts");
				const keyPath = generateTestKey(testDir, "test_key");
				const result = await isKeyPassphraseProtected(keyPath);
				expect(result).toBe(false);
			},
		);

		test("returns false when key file doesn't exist", async () => {
			const { isKeyPassphraseProtected } = await import("@lib/ssh.ts");
			const result = await isKeyPassphraseProtected(
				join(testDir, "nonexistent_key"),
			);
			expect(result).toBe(false);
		});

		test.skipIf(!sshKeygenAvailable)(
			"returns true for a passphrase-protected key",
			async () => {
				const { isKeyPassphraseProtected } = await import("@lib/ssh.ts");
				const keyPath = generateProtectedTestKey(
					testDir,
					"protected_key",
					"testpassphrase",
				);
				const result = await isKeyPassphraseProtected(keyPath);
				expect(result).toBe(true);
			},
		);
	});

	describe("getKeyFingerprint", () => {
		test.skipIf(!sshKeygenAvailable)(
			"returns fingerprint string for valid key",
			async () => {
				const { getKeyFingerprint } = await import("@lib/ssh.ts");
				const keyPath = generateTestKey(testDir, "fp_key");
				const fingerprint = await getKeyFingerprint(keyPath);
				expect(fingerprint).not.toBeNull();
				expect(fingerprint).toContain("SHA256:");
			},
		);

		test("returns null for missing key file", async () => {
			const { getKeyFingerprint } = await import("@lib/ssh.ts");
			const fingerprint = await getKeyFingerprint(join(testDir, "nonexistent"));
			expect(fingerprint).toBeNull();
		});

		test("returns null for invalid key file", async () => {
			const { getKeyFingerprint } = await import("@lib/ssh.ts");
			const invalidPath = join(testDir, "invalid_key");
			writeFileSync(invalidPath, "not a real key");
			const fingerprint = await getKeyFingerprint(invalidPath);
			expect(fingerprint).toBeNull();
		});

		test.skipIf(!sshKeygenAvailable)(
			"parses fingerprint correctly from ssh-keygen output format",
			async () => {
				const { getKeyFingerprint } = await import("@lib/ssh.ts");
				const keyPath = generateTestKey(testDir, "parse_key");
				const fingerprint = await getKeyFingerprint(keyPath);
				expect(fingerprint).not.toBeNull();
				// SHA256 fingerprints start with "SHA256:" followed by base64
				expect(fingerprint).toMatch(/^SHA256:[A-Za-z0-9+/=]+$/);
			},
		);
	});

	describe("isKeyInAgent", () => {
		test("returns false for nonexistent key", async () => {
			const { isKeyInAgent } = await import("@lib/ssh.ts");
			const result = await isKeyInAgent(join(testDir, "nonexistent"));
			expect(result).toBe(false);
		});

		test.skipIf(!sshKeygenAvailable)(
			"returns false for key not loaded in agent",
			async () => {
				const { isKeyInAgent } = await import("@lib/ssh.ts");
				// Generate a fresh key that's definitely not in the agent
				const keyPath = generateTestKey(testDir, "unloaded_key");
				const result = await isKeyInAgent(keyPath);
				expect(result).toBe(false);
			},
		);
	});

	describe("addKeyToAgent", () => {
		test.skipIf(!sshKeygenAvailable || !sshAgentAvailable)(
			"successfully adds a passwordless key to agent",
			async () => {
				const { addKeyToAgent } = await import("@lib/ssh.ts");
				const keyPath = generateTestKey(testDir, "agent_key");
				const result = addKeyToAgent(keyPath);
				expect(result.success).toBe(true);

				// Clean up: remove from agent
				try {
					execFileSync("ssh-add", ["-d", keyPath], { stdio: "pipe" });
				} catch {
					// Ignore cleanup failures
				}
			},
		);

		test("returns failure for nonexistent key", async () => {
			const { addKeyToAgent } = await import("@lib/ssh.ts");
			const result = addKeyToAgent(join(testDir, "nonexistent_key"));
			expect(result.success).toBe(false);
		});
	});

	describe("isAgentRunning", () => {
		test("returns a boolean", async () => {
			const { isAgentRunning } = await import("@lib/ssh.ts");
			const result = await isAgentRunning();
			expect(typeof result).toBe("boolean");
		});

		test.skipIf(!sshAgentAvailable)(
			"returns true when agent is running",
			async () => {
				const { isAgentRunning } = await import("@lib/ssh.ts");
				const result = await isAgentRunning();
				expect(result).toBe(true);
			},
		);
	});

	describe("ensureKeyInAgent", () => {
		test.skipIf(!sshKeygenAvailable)(
			"returns true immediately for passwordless key",
			async () => {
				const { ensureKeyInAgent } = await import("@lib/ssh.ts");
				const keyPath = generateTestKey(testDir, "nopass_key");
				const result = await ensureKeyInAgent(keyPath);
				expect(result).toBe(true);
			},
		);

		test("returns true for nonexistent key (not passphrase-protected)", async () => {
			const { ensureKeyInAgent } = await import("@lib/ssh.ts");
			const result = await ensureKeyInAgent(join(testDir, "nonexistent"));
			expect(result).toBe(true);
		});
	});

	describe("ensureRemoteKeyReady", () => {
		test("returns true when no key configured on remote", async () => {
			const { ensureRemoteKeyReady } = await import("@lib/ssh.ts");
			const result = await ensureRemoteKeyReady({
				host: "test-host",
				path: "~/code",
			});
			expect(result).toBe(true);
		});

		test.skipIf(!sshKeygenAvailable)(
			"calls ensureKeyInAgent when key is configured",
			async () => {
				const { ensureRemoteKeyReady } = await import("@lib/ssh.ts");
				const keyPath = generateTestKey(testDir, "remote_key");
				const result = await ensureRemoteKeyReady({
					host: "test-host",
					path: "~/code",
					key: keyPath,
				});
				// Passwordless key → ensureKeyInAgent returns true immediately
				expect(result).toBe(true);
			},
		);

		test.skipIf(!sshKeygenAvailable)(
			"passes useKeychain from remote entry",
			async () => {
				const { ensureRemoteKeyReady } = await import("@lib/ssh.ts");
				const keyPath = generateTestKey(testDir, "kc_key");
				const result = await ensureRemoteKeyReady({
					host: "test-host",
					path: "~/code",
					key: keyPath,
					useKeychain: true,
				});
				// Passwordless key → returns true regardless of useKeychain
				expect(result).toBe(true);
			},
		);
	});
});
