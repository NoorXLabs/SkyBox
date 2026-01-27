// src/lib/lock.ts

import { hostname, userInfo } from "node:os";
import type { LockInfo, LockStatus, RemoteEntry } from "../types/index.ts";
import { escapeShellArg } from "./shell.ts";
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
	const command = `cat ${escapeShellArg(lockPath)} 2>/dev/null`;

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
 *
 * Uses atomic test-and-set to prevent TOCTOU race conditions:
 * - First attempts atomic creation with shell's noclobber mode (set -C)
 * - If file exists, checks ownership and updates if we own it
 */
export async function acquireLock(
	project: string,
	remoteInfo: LockRemoteInfo,
): Promise<{ success: boolean; error?: string; existingLock?: LockInfo }> {
	const lockInfo = createLockInfo();
	const lockPath = getLockPath(project, remoteInfo.basePath);
	const locksDir = getLocksDir(remoteInfo.basePath);
	const json = JSON.stringify(lockInfo);
	const jsonBase64 = Buffer.from(json).toString("base64");

	// Attempt atomic lock creation using noclobber mode (set -C)
	// This fails if the file already exists, preventing TOCTOU races
	const atomicCreateCommand = `mkdir -p ${escapeShellArg(locksDir)} && (set -C; echo '${jsonBase64}' | base64 -d > ${escapeShellArg(lockPath)}) 2>/dev/null`;
	const createResult = await runRemoteCommand(
		remoteInfo.host,
		atomicCreateCommand,
	);

	if (createResult.success) {
		// Lock acquired atomically
		return { success: true };
	}

	// Atomic creation failed - lock file likely exists
	// Check if we already own it
	const status = await getLockStatus(project, remoteInfo);

	if (!status.locked) {
		// Lock file existed but is now gone or invalid - retry once
		const retryResult = await runRemoteCommand(
			remoteInfo.host,
			atomicCreateCommand,
		);
		if (retryResult.success) {
			return { success: true };
		}
		// Still failing, report error
		return {
			success: false,
			error: "Failed to acquire lock (concurrent access detected)",
		};
	}

	if (status.ownedByMe) {
		// We own the lock - update timestamp (non-atomic is fine here)
		const updateCommand = `echo '${jsonBase64}' | base64 -d > ${escapeShellArg(lockPath)}`;
		const updateResult = await runRemoteCommand(remoteInfo.host, updateCommand);

		if (!updateResult.success) {
			return {
				success: false,
				error: updateResult.error || "Failed to update lock",
			};
		}

		return { success: true };
	}

	// Locked by different machine
	return {
		success: false,
		error: `Project is locked by ${status.info?.machine} (${status.info?.user})`,
		existingLock: status.info,
	};
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
	const command = `rm -f ${escapeShellArg(lockPath)}`;

	const result = await runRemoteCommand(remoteInfo.host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to release lock" };
	}

	return { success: true };
}
