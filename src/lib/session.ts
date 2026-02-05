/** Local session management for multi-machine conflict detection. */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { hostname, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import { SESSION_FILE, SESSION_TTL_MS } from "@lib/constants.ts";
import type { SessionConflictResult, SessionInfo } from "@typedefs/index.ts";

export type { SessionConflictResult, SessionInfo };

/**
 * Returns the machine name (hostname) for session identification.
 */
export function getMachineName(): string {
	return hostname();
}

/**
 * Get the session file path for a project.
 * @param projectPath - Absolute path to the project directory
 * @returns Absolute path to the session lock file
 */
export function getSessionFilePath(projectPath: string): string {
	return join(projectPath, SESSION_FILE);
}

/**
 * Read and parse the session file for a project.
 * Returns null if the file doesn't exist, is invalid, or has expired.
 * @param projectPath - Absolute path to the project directory
 */
export function readSession(projectPath: string): SessionInfo | null {
	const sessionPath = getSessionFilePath(projectPath);

	if (!existsSync(sessionPath)) {
		return null;
	}

	try {
		const content = readFileSync(sessionPath, "utf-8");
		const session: SessionInfo = JSON.parse(content);

		// Validate required fields
		if (
			!session.machine ||
			!session.user ||
			!session.timestamp ||
			typeof session.pid !== "number" ||
			!session.expires
		) {
			return null;
		}

		// Check if session has expired
		if (new Date(session.expires).getTime() < Date.now()) {
			return null;
		}

		return session;
	} catch {
		// Invalid JSON or read error - treat as no session
		return null;
	}
}

/**
 * Write a session file for the current machine.
 * Creates the .skybox directory if it doesn't exist.
 * Uses atomic write (write to temp file, then rename) to prevent corruption.
 * @param projectPath - Absolute path to the project directory
 */
export function writeSession(projectPath: string): void {
	const sessionPath = getSessionFilePath(projectPath);
	const sessionDir = dirname(sessionPath);

	// Ensure .skybox directory exists
	if (!existsSync(sessionDir)) {
		mkdirSync(sessionDir, { recursive: true });
	}

	const session: SessionInfo = {
		machine: getMachineName(),
		user: userInfo().username,
		timestamp: new Date().toISOString(),
		pid: process.pid,
		expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
	};

	// Atomic write: write to temp file in same directory, then rename
	const tempPath = join(
		sessionDir,
		`.${basename(sessionPath)}.tmp.${process.pid}`,
	);
	writeFileSync(tempPath, JSON.stringify(session, null, 2), "utf-8");
	renameSync(tempPath, sessionPath);
}

/**
 * Delete the session file for a project.
 * Silently succeeds if the file doesn't exist.
 * @param projectPath - Absolute path to the project directory
 */
export function deleteSession(projectPath: string): void {
	const sessionPath = getSessionFilePath(projectPath);

	if (existsSync(sessionPath)) {
		try {
			unlinkSync(sessionPath);
		} catch {
			// Ignore errors - file may have been deleted by another process
		}
	}
}

/**
 * Check if a different machine has an active session for this project.
 * @param projectPath - Absolute path to the project directory
 * @returns Conflict status and existing session info if applicable
 */
export function checkSessionConflict(
	projectPath: string,
): SessionConflictResult {
	const session = readSession(projectPath);

	if (!session) {
		return { hasConflict: false };
	}

	const currentMachine = getMachineName();

	if (session.machine === currentMachine) {
		// Same machine - no conflict
		return { hasConflict: false };
	}

	// Different machine has an active session
	return { hasConflict: true, existingSession: session };
}
