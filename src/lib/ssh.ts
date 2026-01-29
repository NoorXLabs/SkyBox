/** SSH operations: parse config, test connections, run remote commands. */

import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import type { SSHConfigEntry, SSHHost } from "../types/index.ts";
import { getErrorMessage, getExecaErrorMessage } from "./errors.ts";

/** SSH config keyword prefixes with their lengths for parsing */
const SSH_KEYWORDS = {
	HOST: { prefix: "host ", length: 5 },
	HOSTNAME: { prefix: "hostname ", length: 9 },
	USER: { prefix: "user ", length: 5 },
	PORT: { prefix: "port ", length: 5 },
	IDENTITY_FILE: { prefix: "identityfile ", length: 13 },
} as const;

/** Default timeout for SSH operations in milliseconds */
const SSH_TIMEOUT_MS = 10_000;

function getSSHDir(): string {
	const home = process.env.HOME || homedir();
	return join(home, ".ssh");
}

export function parseSSHConfig(): SSHHost[] {
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
}

export function findSSHKeys(): string[] {
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
}

export async function testConnection(
	host: string,
	identityFile?: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5"];
		if (identityFile) {
			args.push("-i", identityFile);
		}
		args.push(host, "echo", "ok");
		await execa("ssh", args, { timeout: SSH_TIMEOUT_MS });
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

export async function copyKey(
	host: string,
	keyPath: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await execa("ssh-copy-id", ["-i", keyPath, host], { stdio: "inherit" });
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
}

export async function runRemoteCommand(
	host: string,
	command: string,
	identityFile?: string,
): Promise<{ success: boolean; stdout?: string; error?: string }> {
	try {
		const args: string[] = [];
		if (identityFile) {
			args.push("-i", identityFile);
		}
		args.push(host, command);
		const result = await execa("ssh", args);
		return { success: true, stdout: result.stdout };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

export function writeSSHConfigEntry(entry: SSHConfigEntry): {
	success: boolean;
	error?: string;
} {
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
			const { mkdirSync } = require("node:fs");
			mkdirSync(sshDir, { mode: 0o700 });
		}

		// Append to config file
		appendFileSync(configPath, configEntry, { mode: 0o600 });
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
}
