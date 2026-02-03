/** Multi-machine lock system using atomic remote file operations. */

import { hostname, userInfo } from "node:os";
import { LOCK_TTL_MS, LOCKS_DIR_NAME } from "@lib/constants.ts";
import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import type {
	LockInfo,
	LockReleaseResult,
	LockStatus,
	RemoteEntry,
} from "@typedefs/index.ts";
import chalk from "chalk";

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
	return `${basePath}/${LOCKS_DIR_NAME}/${project}.lock`;
}

/**
 * Get the locks directory path on the remote machine.
 */
function getLocksDir(basePath: string): string {
	return `${basePath}/${LOCKS_DIR_NAME}`;
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

		// Check if lock has expired
		if (info.expires && new Date(info.expires).getTime() < Date.now()) {
			return { locked: false };
		}

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
		expires: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
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
	const atomicCreateCommand = `mkdir -p ${escapeShellArg(locksDir)} && (set -C; echo ${escapeShellArg(jsonBase64)} | base64 -d > ${escapeShellArg(lockPath)}) 2>/dev/null`;
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
		const updateCommand = `echo ${escapeShellArg(jsonBase64)} | base64 -d > ${escapeShellArg(lockPath)}`;
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
 * Force-acquire a lock by directly overwriting the lock file.
 * Used for lock takeover — skips noclobber to atomically replace any existing lock.
 */
export async function forceLock(
	project: string,
	remoteInfo: LockRemoteInfo,
): Promise<{ success: boolean; error?: string }> {
	const lockInfo = createLockInfo();
	const lockPath = getLockPath(project, remoteInfo.basePath);
	const locksDir = getLocksDir(remoteInfo.basePath);
	const json = JSON.stringify(lockInfo);
	const jsonBase64 = Buffer.from(json).toString("base64");

	// Direct overwrite — no noclobber, no ownership check
	const command = `mkdir -p ${escapeShellArg(locksDir)} && echo ${escapeShellArg(jsonBase64)} | base64 -d > ${escapeShellArg(lockPath)}`;
	const result = await runRemoteCommand(remoteInfo.host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to force lock" };
	}

	return { success: true };
}

/**
 * Release the lock for the specified project.
 * Only deletes the lock file if the current machine owns it.
 * If another machine owns the lock (e.g., after a takeover), skips deletion.
 */
export async function releaseLock(
	project: string,
	remoteInfo: LockRemoteInfo,
): Promise<LockReleaseResult> {
	// Check ownership before releasing
	const status = await getLockStatus(project, remoteInfo);

	if (status.locked && !status.ownedByMe) {
		// Lock was taken over by another machine — don't delete it
		return { success: true, skipped: true };
	}

	const lockPath = getLockPath(project, remoteInfo.basePath);
	const command = `rm -f ${escapeShellArg(lockPath)}`;

	const result = await runRemoteCommand(remoteInfo.host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to release lock" };
	}

	return { success: true };
}

/**
 * Fetch lock statuses for all projects on a remote in a single SSH call.
 * Returns a Map of project name -> LockStatus.
 */
export async function getAllLockStatuses(
	remoteInfo: LockRemoteInfo,
): Promise<Map<string, LockStatus>> {
	const locksDir = getLocksDir(remoteInfo.basePath);
	// Check if locks directory exists first, then iterate over .lock files
	// This handles shells with different glob behavior (nullglob, failglob)
	const command = `[ -d ${escapeShellArg(locksDir)} ] && for f in ${escapeShellArg(locksDir)}/*.lock; do [ -f "$f" ] && echo "$(basename "$f")\t$(cat "$f")"; done 2>/dev/null`;

	const result = await runRemoteCommand(remoteInfo.host, command);
	const statuses = new Map<string, LockStatus>();

	if (!result.success || !result.stdout?.trim()) {
		return statuses;
	}

	const currentMachine = getMachineName();

	for (const line of result.stdout.trim().split("\n")) {
		const tabIndex = line.indexOf("\t");
		if (tabIndex === -1) continue;

		const filename = line.substring(0, tabIndex);
		const jsonStr = line.substring(tabIndex + 1);

		// Strip .lock extension to get project name
		const project = filename.replace(/\.lock$/, "");

		try {
			const info: LockInfo = JSON.parse(jsonStr);

			// Check expiry
			if (info.expires && new Date(info.expires).getTime() < Date.now()) {
				statuses.set(project, { locked: false });
				continue;
			}

			const ownedByMe = info.machine === currentMachine;
			statuses.set(project, { locked: true, ownedByMe, info });
		} catch {
			statuses.set(project, { locked: false });
		}
	}

	return statuses;
}

/**
 * Format a lock status for display in terminal output.
 * Shared by browse and locks commands to ensure consistent formatting.
 */
export function formatLockStatus(status: LockStatus | undefined): string {
	if (!status || !status.locked) {
		return chalk.dim("unlocked");
	}
	if (status.ownedByMe) {
		return chalk.yellow("locked (you)");
	}
	return chalk.red(`locked (${status.info.machine})`);
}
