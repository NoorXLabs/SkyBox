// SSH operations: parse config, test connections, run remote commands.

import { execFile as execFileCb, spawnSync } from "node:child_process";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	SSH_ADD_TIMEOUT_MS,
	SSH_KEYGEN_TIMEOUT_MS,
	SSH_KEYWORDS,
	SSH_TIMEOUT_MS,
} from "@lib/constants.ts";
import { getErrorMessage, getExecaErrorMessage } from "@lib/errors.ts";
import { info } from "@lib/ui.ts";
import { validateSSHField, validateSSHHost } from "@lib/validation.ts";
import type { RemoteEntry, SSHConfigEntry, SSHHost } from "@typedefs/index.ts";
import { execa } from "execa";

// get SSH dir
const getSSHDir = (): string => {
	const home = process.env.HOME || homedir();
	return join(home, ".ssh");
};

// sanitize SSH error messages for user display.
// removes authentication details and host-specific info.
// @internal Exported for testing
export const sanitizeSshError = (error: string): string => {
	let sanitized = error;

	// Remove private key paths
	sanitized = sanitized.replace(
		/identity file[^,\n]*/gi,
		"identity file [REDACTED]",
	);

	// Remove specific host fingerprints
	sanitized = sanitized.replace(
		/[A-Fa-f0-9]{2}(:[A-Fa-f0-9]{2}){15,}/g,
		"[FINGERPRINT]",
	);

	// Remove usernames from error if embedded
	sanitized = sanitized.replace(/user(name)?[=:\s]+\S+/gi, "user=[REDACTED]");

	// Generic auth failure message
	if (
		sanitized.includes("Permission denied") ||
		sanitized.toLowerCase().includes("authentication")
	) {
		return "SSH authentication failed. Check your SSH key and remote configuration.";
	}

	return sanitized;
};

// parse SSH config
export const parseSSHConfig = (): SSHHost[] => {
	const configPath = join(getSSHDir(), "config");

	if (!existsSync(configPath)) {
		return [];
	}

	const content = readFileSync(configPath, "utf-8");
	const hosts: SSHHost[] = [];
	let currentHost: SSHHost | null = null;

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		const lower = trimmed.toLowerCase();

		if (lower.startsWith(SSH_KEYWORDS.HOST.prefix) && !trimmed.includes("*")) {
			if (currentHost) {
				hosts.push(currentHost);
			}
			currentHost = { name: trimmed.slice(SSH_KEYWORDS.HOST.length).trim() };
		} else if (currentHost) {
			if (lower.startsWith(SSH_KEYWORDS.HOSTNAME.prefix)) {
				currentHost.hostname = trimmed
					.slice(SSH_KEYWORDS.HOSTNAME.length)
					.trim();
			} else if (lower.startsWith(SSH_KEYWORDS.USER.prefix)) {
				currentHost.user = trimmed.slice(SSH_KEYWORDS.USER.length).trim();
			} else if (lower.startsWith(SSH_KEYWORDS.PORT.prefix)) {
				currentHost.port = parseInt(
					trimmed.slice(SSH_KEYWORDS.PORT.length).trim(),
					10,
				);
			} else if (lower.startsWith(SSH_KEYWORDS.IDENTITY_FILE.prefix)) {
				currentHost.identityFile = trimmed
					.slice(SSH_KEYWORDS.IDENTITY_FILE.length)
					.trim();
			}
		}
	}

	if (currentHost) {
		hosts.push(currentHost);
	}

	return hosts;
};

// find SSH keys
export const findSSHKeys = (): string[] => {
	const sshDir = getSSHDir();

	if (!existsSync(sshDir)) {
		return [];
	}

	const keyPatterns = ["id_ed25519", "id_rsa", "id_ecdsa", "id_dsa"];
	const keys: string[] = [];

	try {
		const files = readdirSync(sshDir);
		for (const pattern of keyPatterns) {
			if (files.includes(pattern)) {
				keys.push(join(sshDir, pattern));
			}
		}
	} catch {
		return [];
	}

	return keys;
};

// validate host and return error response if invalid, or null if valid.
const assertValidHost = (
	host: string,
): { success: false; error: string } | null => {
	const check = validateSSHHost(host);
	if (!check.valid) {
		return { success: false, error: check.error };
	}
	return null;
};

const runValidatedSsh = async (
	host: string,
	execute: () => Promise<void>,
	formatError: (error: unknown) => string,
): Promise<{ success: boolean; error?: string }> => {
	const hostError = assertValidHost(host);
	if (hostError) return hostError;

	try {
		await execute();
		return { success: true };
	} catch (error: unknown) {
		return {
			success: false,
			error: sanitizeSshError(formatError(error)),
		};
	}
};

const runValidatedSshWithStdout = async <T>(
	host: string,
	execute: () => Promise<T>,
	formatError: (error: unknown) => string,
): Promise<{ success: boolean; stdout?: T; error?: string }> => {
	const hostError = assertValidHost(host);
	if (hostError) return hostError;

	try {
		const output = await execute();
		return { success: true, stdout: output };
	} catch (error: unknown) {
		return {
			success: false,
			error: sanitizeSshError(formatError(error)),
		};
	}
};

// test connection
export const testConnection = async (
	host: string,
	identityFile?: string,
): Promise<{ success: boolean; error?: string }> => {
	return runValidatedSsh(
		host,
		async () => {
			const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5"];
			if (identityFile) {
				args.push("-i", identityFile);
			}
			args.push("--", host, "echo", "ok");
			await execa("ssh", args, { timeout: SSH_TIMEOUT_MS });
		},
		getExecaErrorMessage,
	);
};

// copy key
export const copyKey = async (
	host: string,
	keyPath: string,
): Promise<{ success: boolean; error?: string }> => {
	return runValidatedSsh(
		host,
		async () => {
			await execa("ssh-copy-id", ["-i", keyPath, "--", host], {
				stdio: "inherit",
			});
		},
		getErrorMessage,
	);
};

// run remote command
export const runRemoteCommand = async (
	host: string,
	command: string,
	identityFile?: string,
): Promise<{ success: boolean; stdout?: string; error?: string }> => {
	return runValidatedSshWithStdout(
		host,
		async () => {
			const args: string[] = [];
			if (identityFile) {
				args.push("-i", identityFile);
			}
			args.push("--", host, command);
			const result = await execa("ssh", args);
			return result.stdout;
		},
		getExecaErrorMessage,
	);
};

// copy files via SCP with argument injection prevention.
// uses "--" separator to prevent source/destination being interpreted as options.
export const secureScp = async (
	source: string,
	destination: string,
): Promise<void> => {
	await execa("scp", ["--", source, destination]);
};

// write SSH config entry
export const writeSSHConfigEntry = (
	entry: SSHConfigEntry,
): {
	success: boolean;
	error?: string;
} => {
	const configPath = join(getSSHDir(), "config");

	// Check if entry already exists
	const existingHosts = parseSSHConfig();
	const existingHost = existingHosts.find(
		(h) => h.name.toLowerCase() === entry.name.toLowerCase(),
	);

	if (existingHost) {
		return {
			success: false,
			error: `Host "${entry.name}" already exists in SSH config`,
		};
	}

	// Validate all fields before writing to SSH config
	for (const [field, value] of Object.entries({
		name: entry.name,
		hostname: entry.hostname,
		user: entry.user,
		identityFile: entry.identityFile,
	})) {
		if (value) {
			const result = validateSSHField(value, field);
			if (!result.valid) {
				return { success: false, error: result.error };
			}
		}
	}

	// Validate port range if specified
	if (entry.port !== undefined && (entry.port < 1 || entry.port > 65535)) {
		return { success: false, error: "Port must be between 1 and 65535" };
	}

	// Build the config entry
	const configEntry = `
Host ${entry.name}
  HostName ${entry.hostname}
  User ${entry.user}
  IdentityFile ${entry.identityFile}${entry.port ? `\n  Port ${entry.port}` : ""}
`;

	try {
		// Ensure .ssh directory exists
		const sshDir = getSSHDir();
		if (!existsSync(sshDir)) {
			mkdirSync(sshDir, { mode: 0o700 });
		}

		// Append to config file
		appendFileSync(configPath, configEntry, { mode: 0o600 });
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
};

// SSH agent functions for passphrase-protected key support.
// Uses node:child_process instead of execa to avoid mock contamination in tests
// (see CLAUDE.md "mock.module('execa') is global in bun test").

const execFile = promisify(execFileCb);

// check if a key file requires a passphrase to use.
// runs ssh-keygen -y with an empty passphrase — exits non-zero if protected.
export const isKeyPassphraseProtected = async (
	keyPath: string,
): Promise<boolean> => {
	try {
		await execFile("ssh-keygen", ["-y", "-P", "", "-f", keyPath], {
			timeout: SSH_KEYGEN_TIMEOUT_MS,
		});
		return false; // Empty passphrase succeeded — key is not protected
	} catch {
		// Non-zero exit means either passphrase-protected or invalid key.
		// If the file doesn't exist, return false (let downstream catch it).
		if (!existsSync(keyPath)) return false;
		return true;
	}
};

// get the fingerprint of an SSH key file.
// returns the fingerprint hash string, or null on error.
export const getKeyFingerprint = async (
	keyPath: string,
): Promise<string | null> => {
	try {
		const result = await execFile("ssh-keygen", ["-lf", keyPath], {
			timeout: SSH_KEYGEN_TIMEOUT_MS,
		});
		// Output format: "256 SHA256:abc123... comment (ED25519)"
		const parts = result.stdout.trim().split(/\s+/);
		return parts.length >= 2 ? parts[1] : null;
	} catch {
		return null;
	}
};

// check if a key's fingerprint is already loaded in the SSH agent.
export const isKeyInAgent = async (keyPath: string): Promise<boolean> => {
	const fingerprint = await getKeyFingerprint(keyPath);
	if (!fingerprint) return false;

	try {
		const result = await execFile("ssh-add", ["-l"], {
			timeout: SSH_KEYGEN_TIMEOUT_MS,
		});
		return result.stdout.includes(fingerprint);
	} catch {
		// Exit code 1 = no keys, exit code 2 = no agent
		return false;
	}
};

// add a key to the SSH agent with stdio: "inherit" so user can type passphrase.
// uses spawnSync from node:child_process for interactive passphrase entry.
export const addKeyToAgent = (
	keyPath: string,
	useKeychain?: boolean,
): { success: boolean; error?: string } => {
	const args: string[] = [];
	if (useKeychain && process.platform === "darwin") {
		args.push("--apple-use-keychain");
	}
	args.push(keyPath);

	try {
		const result = spawnSync("ssh-add", args, {
			stdio: "inherit",
			timeout: SSH_ADD_TIMEOUT_MS,
		});
		if (result.status === 0) {
			return { success: true };
		}
		return {
			success: false,
			error: result.error ? getErrorMessage(result.error) : "ssh-add failed",
		};
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
};

// check whether an SSH agent is running.
// returns true if ssh-add -l exits with 0 or 1 (agent running), false for exit code 2 (no agent).
export const isAgentRunning = async (): Promise<boolean> => {
	try {
		await execFile("ssh-add", ["-l"], { timeout: SSH_KEYGEN_TIMEOUT_MS });
		return true; // Exit code 0: agent running with keys
	} catch (err: unknown) {
		// Exit code 1 = agent running but no keys (still available)
		// Exit code 2 = no agent running
		const e = err as { code?: number };
		return e.code === 1;
	}
};

// ensure a passphrase-protected key is loaded in the SSH agent.
// returns true immediately for passwordless keys or keys already in the agent.
export const ensureKeyInAgent = async (
	keyPath: string,
	useKeychain?: boolean,
): Promise<boolean> => {
	// Passwordless keys don't need agent loading
	const isProtected = await isKeyPassphraseProtected(keyPath);
	if (!isProtected) return true;

	// Already loaded in agent — nothing to do
	if (await isKeyInAgent(keyPath)) return true;

	// Check that an agent is actually running before attempting ssh-add
	const agentRunning = await isAgentRunning();
	if (!agentRunning) {
		info("No ssh-agent detected. Start one with: eval $(ssh-agent)");
		return false;
	}

	// Need to add to agent
	info("SSH key requires passphrase. Loading into ssh-agent...");
	const result = addKeyToAgent(keyPath, useKeychain);
	if (!result.success) {
		return false;
	}

	// Verify it was actually added
	return isKeyInAgent(keyPath);
};

// higher-level guard that commands call before SSH operations.
// takes a RemoteEntry and ensures its key (if any) is in the agent.
export const ensureRemoteKeyReady = async (
	remote: RemoteEntry,
): Promise<boolean> => {
	if (!remote.key) return true; // using SSH config defaults
	return ensureKeyInAgent(remote.key, remote.useKeychain);
};
