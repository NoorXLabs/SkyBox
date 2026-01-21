// src/lib/ssh.ts
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execa } from "execa";
import type { SSHHost } from "../types";

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

export async function testConnection(host: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execa("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, "echo", "ok"]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.stderr || error.message };
  }
}

export async function copyKey(host: string, keyPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execa("ssh-copy-id", ["-i", keyPath, host], { stdio: "inherit" });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function runRemoteCommand(
  host: string,
  command: string
): Promise<{ success: boolean; stdout?: string; error?: string }> {
  try {
    const result = await execa("ssh", [host, command]);
    return { success: true, stdout: result.stdout };
  } catch (error: any) {
    return { success: false, error: error.stderr || error.message };
  }
}
