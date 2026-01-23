// src/lib/lock.ts

import { hostname, userInfo } from "node:os";
import type { DevboxConfig, LockInfo, LockStatus } from "../types/index.ts";
import { runRemoteCommand } from "./ssh.ts";

/**
 * Returns the machine name (hostname) for lock identification.
 */
export function getMachineName(): string {
	return hostname();
}

/**
 * Get the lock file path on the remote machine.
 */
function getLockPath(project: string, basePath: string): string {
	return `${basePath}/.devbox-locks/${project}.lock`;
}

/**
 * Get the locks directory path on the remote machine.
 */
function getLocksDir(basePath: string): string {
	return `${basePath}/.devbox-locks`;
}

/**
 * Read lock file from remote and return the lock status.
 */
export async function getLockStatus(
	project: string,
	config: DevboxConfig,
): Promise<LockStatus> {
	const lockPath = getLockPath(project, config.remote.base_path);
	const command = `cat ${lockPath} 2>/dev/null`;

	const result = await runRemoteCommand(config.remote.host, command);

	if (!result.success || !result.stdout || result.stdout.trim() === "") {
		return { locked: false };
	}

	try {
		const info: LockInfo = JSON.parse(result.stdout);
		const currentMachine = getMachineName();
		const ownedByMe = info.machine === currentMachine;

		return { locked: true, ownedByMe, info };
	} catch {
		// Invalid JSON in lock file, treat as unlocked
		return { locked: false };
	}
}

/**
 * Create lock info for the current machine.
 */
function createLockInfo(): LockInfo {
	return {
		machine: getMachineName(),
		user: userInfo().username,
		timestamp: new Date().toISOString(),
		pid: process.pid,
	};
}

/**
 * Acquire a lock for the specified project.
 * Returns success if no lock exists or if the current machine already owns the lock.
 * Fails if another machine holds the lock.
 */
export async function acquireLock(
	project: string,
	config: DevboxConfig,
): Promise<{ success: boolean; error?: string; existingLock?: LockInfo }> {
	// Check for existing lock
	const status = await getLockStatus(project, config);

	if (status.locked) {
		if (status.ownedByMe) {
			// Update timestamp on existing lock
			const lockInfo = createLockInfo();
			const lockPath = getLockPath(project, config.remote.base_path);
			const locksDir = getLocksDir(config.remote.base_path);
			const json = JSON.stringify(lockInfo);

			const command = `mkdir -p ${locksDir} && echo '${json}' > ${lockPath}`;
			const result = await runRemoteCommand(config.remote.host, command);

			if (!result.success) {
				return {
					success: false,
					error: result.error || "Failed to update lock",
				};
			}

			return { success: true };
		}
		// Locked by different machine
		return {
			success: false,
			error: `Project is locked by ${status.info.machine} (${status.info.user})`,
			existingLock: status.info,
		};
	}

	// No existing lock, create new one
	const lockInfo = createLockInfo();
	const lockPath = getLockPath(project, config.remote.base_path);
	const locksDir = getLocksDir(config.remote.base_path);
	const json = JSON.stringify(lockInfo);

	const command = `mkdir -p ${locksDir} && echo '${json}' > ${lockPath}`;
	const result = await runRemoteCommand(config.remote.host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to create lock" };
	}

	return { success: true };
}

/**
 * Release the lock for the specified project.
 * Deletes the lock file on the remote machine.
 */
export async function releaseLock(
	project: string,
	config: DevboxConfig,
): Promise<{ success: boolean; error?: string }> {
	const lockPath = getLockPath(project, config.remote.base_path);
	const command = `rm -f ${lockPath}`;

	const result = await runRemoteCommand(config.remote.host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to release lock" };
	}

	return { success: true };
}
