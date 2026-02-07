/** SSH operations: parse config, test connections, run remote commands. */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SSH_KEYWORDS, SSH_TIMEOUT_MS } from "@lib/constants.ts";
import { getErrorMessage, getExecaErrorMessage } from "@lib/errors.ts";
import { validateSSHField, validateSSHHost } from "@lib/validation.ts";
import type { SSHConfigEntry, SSHHost } from "@typedefs/index.ts";
import { execa } from "execa";

const getSSHDir = (): string => {
	const home = process.env.HOME || homedir();
	return join(home, ".ssh");
};

/**
 * Sanitize SSH error messages for user display.
 * Removes authentication details and host-specific info.
 * @internal Exported for testing
 */
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

/** Validate host and return error response if invalid, or null if valid. */
const assertValidHost = (
	host: string,
): { success: false; error: string } | null => {
	const check = validateSSHHost(host);
	if (!check.valid) {
		return { success: false, error: check.error };
	}
	return null;
};

export const testConnection = async (
	host: string,
	identityFile?: string,
): Promise<{ success: boolean; error?: string }> => {
	const hostError = assertValidHost(host);
	if (hostError) return hostError;
	try {
		const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5"];
		if (identityFile) {
			args.push("-i", identityFile);
		}
		args.push("--", host, "echo", "ok");
		await execa("ssh", args, { timeout: SSH_TIMEOUT_MS });
		return { success: true };
	} catch (error: unknown) {
		return {
			success: false,
			error: sanitizeSshError(getExecaErrorMessage(error)),
		};
	}
};

export const copyKey = async (
	host: string,
	keyPath: string,
): Promise<{ success: boolean; error?: string }> => {
	const hostError = assertValidHost(host);
	if (hostError) return hostError;
	try {
		await execa("ssh-copy-id", ["-i", keyPath, "--", host], {
			stdio: "inherit",
		});
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: sanitizeSshError(getErrorMessage(error)) };
	}
};

export const runRemoteCommand = async (
	host: string,
	command: string,
	identityFile?: string,
): Promise<{ success: boolean; stdout?: string; error?: string }> => {
	const hostError = assertValidHost(host);
	if (hostError) return hostError;
	try {
		const args: string[] = [];
		if (identityFile) {
			args.push("-i", identityFile);
		}
		args.push("--", host, command);
		const result = await execa("ssh", args);
		return { success: true, stdout: result.stdout };
	} catch (error: unknown) {
		return {
			success: false,
			error: sanitizeSshError(getExecaErrorMessage(error)),
		};
	}
};

/**
 * Copy files via SCP with argument injection prevention.
 * Uses "--" separator to prevent source/destination being interpreted as options.
 */
export const secureScp = async (
	source: string,
	destination: string,
): Promise<void> => {
	await execa("scp", ["--", source, destination]);
};

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
