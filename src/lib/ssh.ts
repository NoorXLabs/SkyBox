// src/lib/ssh.ts

import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import type { SSHHost } from "../types/index.ts";

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

		if (trimmed.toLowerCase().startsWith("host ") && !trimmed.includes("*")) {
			if (currentHost) {
				hosts.push(currentHost);
			}
			currentHost = { name: trimmed.slice(5).trim() };
		} else if (currentHost) {
			const lower = trimmed.toLowerCase();
			if (lower.startsWith("hostname ")) {
				currentHost.hostname = trimmed.slice(9).trim();
			} else if (lower.startsWith("user ")) {
				currentHost.user = trimmed.slice(5).trim();
			} else if (lower.startsWith("port ")) {
				currentHost.port = parseInt(trimmed.slice(5).trim(), 10);
			} else if (lower.startsWith("identityfile ")) {
				currentHost.identityFile = trimmed.slice(13).trim();
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
		await execa("ssh", args);
		return { success: true };
	} catch (error: any) {
		return { success: false, error: error.stderr || error.message };
	}
}

export async function copyKey(
	host: string,
	keyPath: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await execa("ssh-copy-id", ["-i", keyPath, host], { stdio: "inherit" });
		return { success: true };
	} catch (error: any) {
		return { success: false, error: error.message };
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
	} catch (error: any) {
		return { success: false, error: error.stderr || error.message };
	}
}

export interface SSHConfigEntry {
	name: string;
	hostname: string;
	user: string;
	identityFile: string;
	port?: number;
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
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}
