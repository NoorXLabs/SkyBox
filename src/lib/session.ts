// local session management for multi-machine conflict detection.

import { createHmac } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { hostname, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import {
	SESSION_FILE,
	SESSION_FILE_MODE,
	SESSION_HMAC_KEY,
	SESSION_TTL_MS,
} from "@lib/constants.ts";
import type { SessionConflictResult, SessionInfo } from "@typedefs/index.ts";

export type { SessionConflictResult, SessionInfo };

// returns the machine name (hostname) for session identification.
export const getMachineName = (): string => {
	return hostname();
};

// get the session file path for a project.
// @param projectPath - Absolute path to the project directory
// @returns Absolute path to the session lock file
export const getSessionFilePath = (projectPath: string): string => {
	return join(projectPath, SESSION_FILE);
};

// compute HMAC-SHA256 integrity hash for a session's data fields.
const computeSessionHash = (session: SessionInfo): string => {
	const payload = `${session.machine}:${session.user}:${session.timestamp}:${session.pid}:${session.expires}`;
	return createHmac("sha256", SESSION_HMAC_KEY).update(payload).digest("hex");
};

// verify the integrity hash on a session object.
// returns false if the hash is missing or doesn't match.
const verifySessionHash = (session: SessionInfo): boolean => {
	if (!session.hash) {
		return false;
	}
	return session.hash === computeSessionHash(session);
};

// read and parse the session file for a project.
// returns null if the file doesn't exist, is invalid, has expired, or fails integrity check.
// @param projectPath - Absolute path to the project directory
export const readSession = (projectPath: string): SessionInfo | null => {
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

		// Verify integrity hash — reject tampered files
		if (!verifySessionHash(session)) {
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
};

// write a session file for the current machine.
// creates the .skybox directory if it doesn't exist.
// uses atomic write (write to temp file, then rename) to prevent corruption.
// @param projectPath - Absolute path to the project directory
export const writeSession = (projectPath: string): void => {
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

	// Compute integrity hash before writing
	session.hash = computeSessionHash(session);

	// Atomic write: write to temp file in same directory, then rename
	const tempPath = join(
		sessionDir,
		`.${basename(sessionPath)}.tmp.${process.pid}`,
	);
	writeFileSync(tempPath, JSON.stringify(session, null, 2), "utf-8");
	renameSync(tempPath, sessionPath);

	// Set read-only to prevent accidental edits
	chmodSync(sessionPath, SESSION_FILE_MODE);
};

// delete the session file for a project.
// silently succeeds if the file doesn't exist.
// @param projectPath - Absolute path to the project directory
export const deleteSession = (projectPath: string): void => {
	const sessionPath = getSessionFilePath(projectPath);

	if (existsSync(sessionPath)) {
		try {
			unlinkSync(sessionPath);
		} catch {
			// Ignore errors - file may have been deleted by another process
		}
	}
};

// check if a different machine has an active session for this project.
// @param projectPath - Absolute path to the project directory
// @returns Conflict status and existing session info if applicable
export const checkSessionConflict = (
	projectPath: string,
): SessionConflictResult => {
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
};
