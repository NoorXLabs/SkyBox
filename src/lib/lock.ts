// src/lib/lock.ts

import { hostname, userInfo } from "node:os";
import type { LockInfo, LockStatus, RemoteEntry } from "../types/index.ts";
import { runRemoteCommand } from "./ssh.ts";

/**
 * Remote connection info needed for lock operations.
 */
export interface LockRemoteInfo {
	host: string; // SSH connection string (user@host or just host)
	basePath: string; // Base path for projects on remote
}

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
 * Create LockRemoteInfo from a RemoteEntry.
 */
export function createLockRemoteInfo(remote: RemoteEntry): LockRemoteInfo {
	const host = remote.user ? `${remote.user}@${remote.host}` : remote.host;
	return { host, basePath: remote.path };
}

/**
 * Read lock file from remote and return the lock status.
 */
export async function getLockStatus(
	project: string,
	remoteInfo: LockRemoteInfo,
): Promise<LockStatus> {
	const lockPath = getLockPath(project, remoteInfo.basePath);
	const command = `cat ${lockPath} 2>/dev/null`;

	const result = await runRemoteCommand(remoteInfo.host, command);

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
	remoteInfo: LockRemoteInfo,
): Promise<{ success: boolean; error?: string; existingLock?: LockInfo }> {
	// Check for existing lock
	const status = await getLockStatus(project, remoteInfo);

	if (status.locked) {
		if (status.ownedByMe) {
			// Update timestamp on existing lock
			const lockInfo = createLockInfo();
			const lockPath = getLockPath(project, remoteInfo.basePath);
			const locksDir = getLocksDir(remoteInfo.basePath);
			const json = JSON.stringify(lockInfo);

			const command = `mkdir -p ${locksDir} && echo '${json}' > ${lockPath}`;
			const result = await runRemoteCommand(remoteInfo.host, command);

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
	const lockPath = getLockPath(project, remoteInfo.basePath);
	const locksDir = getLocksDir(remoteInfo.basePath);
	const json = JSON.stringify(lockInfo);

	const command = `mkdir -p ${locksDir} && echo '${json}' > ${lockPath}`;
	const result = await runRemoteCommand(remoteInfo.host, command);

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
	remoteInfo: LockRemoteInfo,
): Promise<{ success: boolean; error?: string }> {
	const lockPath = getLockPath(project, remoteInfo.basePath);
	const command = `rm -f ${lockPath}`;

	const result = await runRemoteCommand(remoteInfo.host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to release lock" };
	}

	return { success: true };
}
