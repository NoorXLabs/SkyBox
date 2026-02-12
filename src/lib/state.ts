// unified project state management.
// consolidates ownership and session data into a single .skybox/state.lock file.

import { createHmac } from "node:crypto";
import { chmodSync, existsSync, readFileSync, rmSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { join } from "node:path";
import { writeFileAtomic } from "@lib/atomic-write.ts";
import {
	SESSION_FILE_MODE,
	SESSION_HMAC_KEY,
	SESSION_TTL_MS,
	STATE_FILE,
} from "@lib/constants.ts";
import { escapeRemotePath, escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { validateRemotePath } from "@lib/validation.ts";
import type {
	OwnershipInfo,
	OwnershipStatus,
	SessionConflictResult,
	SessionInfo,
	SetOwnershipResult,
} from "@typedefs/index.ts";

export type { SessionConflictResult, SessionInfo };

// ── State file I/O ──

// shape of the .skybox/state.lock file.
interface StateFile {
	ownership?: OwnershipInfo;
	session?: SessionInfo;
}

// read and parse the state file for a project.
// returns an empty object if the file doesn't exist or is invalid.
const readStateFile = (projectPath: string): StateFile => {
	const filePath = join(projectPath, STATE_FILE);
	if (!existsSync(filePath)) {
		return {};
	}
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch {
		return {};
	}
};

// write a section into the state file using read-merge-write.
// creates the file if it doesn't exist, merges into existing if it does.
const writeStateSection = <K extends keyof StateFile>(
	projectPath: string,
	section: K,
	data: StateFile[K],
): void => {
	const state = readStateFile(projectPath);
	state[section] = data;
	const filePath = join(projectPath, STATE_FILE);
	writeFileAtomic(filePath, JSON.stringify(state, null, 2));
};

// remove a section from the state file.
// deletes the file entirely if no sections remain.
const removeStateSection = (
	projectPath: string,
	section: keyof StateFile,
): void => {
	const filePath = join(projectPath, STATE_FILE);
	if (!existsSync(filePath)) {
		return;
	}

	const state = readStateFile(projectPath);
	delete state[section];

	if (Object.keys(state).length === 0) {
		try {
			rmSync(filePath, { force: true });
		} catch {
			// ignore cleanup errors
		}
	} else {
		writeFileAtomic(filePath, JSON.stringify(state, null, 2));
	}
};

// ── Ownership ──

// parse ownership info from JSON string.
// returns null if invalid or incomplete.
export const parseOwnershipInfo = (json: string): OwnershipInfo | null => {
	try {
		const data = JSON.parse(json);
		// support both the old top-level format and the new nested format
		const ownership = data.ownership ?? data;
		if (
			typeof ownership.owner === "string" &&
			typeof ownership.created === "string" &&
			typeof ownership.machine === "string"
		) {
			return {
				owner: ownership.owner,
				created: ownership.created,
				machine: ownership.machine,
			};
		}
		return null;
	} catch {
		return null;
	}
};

// create ownership info for the current user.
// NOTE: Uses the local OS username (userInfo().username), not the SSH remote user.
// this means ownership is tied to the local account name, which works well when:
// - Same user uses consistent local username across machines
// - SSH user differs from local user (e.g., deploy@server) but local user is consistent
// limitation: If two different people have the same local username on different
// machines, they would both be considered "owners". This is a known trade-off
// for simplicity in typical single-user scenarios.
export const createOwnershipInfo = (): OwnershipInfo => {
	return {
		owner: userInfo().username,
		created: new Date().toISOString(),
		machine: hostname(),
	};
};

// check if the current user is the owner.
// compares local OS username against the stored owner field.
// see createOwnershipInfo() for username semantics.
export const isOwner = (info: OwnershipInfo): boolean => {
	return info.owner === userInfo().username;
};

// read the ownership section from the remote state file.
export const getOwnershipStatus = async (
	host: string,
	projectPath: string,
): Promise<OwnershipStatus> => {
	const pathCheck = validateRemotePath(projectPath);
	if (!pathCheck.valid) {
		return { hasOwner: false };
	}
	const stateFile = `${projectPath}/${STATE_FILE}`;
	const command = `cat ${escapeRemotePath(stateFile)} 2>/dev/null`;

	const result = await runRemoteCommand(host, command);

	if (!result.success || !result.stdout?.trim()) {
		return { hasOwner: false };
	}

	const info = parseOwnershipInfo(result.stdout);
	if (!info) {
		return { hasOwner: false };
	}

	return {
		hasOwner: true,
		isOwner: isOwner(info),
		info,
	};
};

// write ownership data to the remote state file using read-merge-write.
export const setOwnership = async (
	host: string,
	projectPath: string,
): Promise<SetOwnershipResult> => {
	const pathCheck = validateRemotePath(projectPath);
	if (!pathCheck.valid) {
		return { success: false, error: pathCheck.error };
	}
	const info = createOwnershipInfo();
	const stateFile = `${projectPath}/${STATE_FILE}`;

	// Read existing state from remote (may contain session data from sync)
	const readCommand = `cat ${escapeRemotePath(stateFile)} 2>/dev/null`;
	const existing = await runRemoteCommand(host, readCommand);

	let state: StateFile = {};
	if (existing.success && existing.stdout?.trim()) {
		try {
			state = JSON.parse(existing.stdout);
		} catch {
			// invalid JSON, start fresh
		}
	}

	state.ownership = info;
	const json = JSON.stringify(state, null, 2);
	const jsonBase64 = Buffer.from(json).toString("base64");

	// Ensure .skybox directory exists and write state file
	const mkdirCommand = `mkdir -p ${escapeRemotePath(`${projectPath}/.skybox`)}`;
	const writeCommand = `echo ${escapeShellArg(jsonBase64)} | base64 -d > ${escapeRemotePath(stateFile)}`;
	const result = await runRemoteCommand(
		host,
		`${mkdirCommand} && ${writeCommand}`,
	);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to set ownership" };
	}

	return { success: true };
};

// check if user is authorized to perform a write operation on a project.
// returns true if: no ownership data exists OR current user is the owner.
export const checkWriteAuthorization = async (
	host: string,
	projectPath: string,
): Promise<{
	authorized: boolean;
	error?: string;
	ownerInfo?: OwnershipInfo;
}> => {
	const status = await getOwnershipStatus(host, projectPath);

	if (!status.hasOwner) {
		return { authorized: true };
	}

	if (status.isOwner) {
		return { authorized: true };
	}

	return {
		authorized: false,
		error: `Project owned by '${status.info.owner}' (created on ${status.info.machine})`,
		ownerInfo: status.info,
	};
};

// ── Session ──

// returns the machine name (hostname) for session identification.
export const getMachineName = (): string => {
	return hostname();
};

// get the state file path for a project.
export const getStateFilePath = (projectPath: string): string => {
	return join(projectPath, STATE_FILE);
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

// read and parse the session data from the state file.
// returns null if the file doesn't exist, session is missing/invalid, expired, or fails integrity check.
export const readSession = (projectPath: string): SessionInfo | null => {
	const state = readStateFile(projectPath);
	const session = state.session;

	if (!session) {
		return null;
	}

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
};

// write a session to the state file for the current machine.
// uses read-merge-write to preserve ownership data.
export const writeSession = (projectPath: string): void => {
	const session: SessionInfo = {
		machine: getMachineName(),
		user: userInfo().username,
		timestamp: new Date().toISOString(),
		pid: process.pid,
		expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
	};

	// Compute integrity hash before writing
	session.hash = computeSessionHash(session);

	writeStateSection(projectPath, "session", session);

	// Set read-only to prevent accidental edits.
	// writeFileAtomic uses rename, which bypasses target permissions on POSIX,
	// so subsequent writes/deletes still work despite the read-only mode.
	const filePath = join(projectPath, STATE_FILE);
	chmodSync(filePath, SESSION_FILE_MODE);
};

// remove the session section from the state file.
// preserves ownership data if present.
export const deleteSession = (projectPath: string): void => {
	removeStateSection(projectPath, "session");
};

// check if a different machine has an active session for this project.
export const checkSessionConflict = (
	projectPath: string,
): SessionConflictResult => {
	const session = readSession(projectPath);

	if (!session) {
		return { hasConflict: false };
	}

	const currentMachine = getMachineName();

	if (session.machine === currentMachine) {
		return { hasConflict: false };
	}

	return { hasConflict: true, existingSession: session };
};
