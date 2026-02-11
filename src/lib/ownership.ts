// resource ownership verification for remote projects.

import { hostname, userInfo } from "node:os";
import { OWNERSHIP_FILE_NAME } from "@lib/constants.ts";
import { escapeRemotePath, escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { validateRemotePath } from "@lib/validation.ts";
import type {
	OwnershipInfo,
	OwnershipStatus,
	SetOwnershipResult,
} from "@typedefs/index.ts";

// parse ownership info from JSON string.
// returns null if invalid or incomplete.
export const parseOwnershipInfo = (json: string): OwnershipInfo | null => {
	try {
		const data = JSON.parse(json);
		if (
			typeof data.owner === "string" &&
			typeof data.created === "string" &&
			typeof data.machine === "string"
		) {
			return {
				owner: data.owner,
				created: data.created,
				machine: data.machine,
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

// read the .skybox-owner file from a remote project status for a project on the remote.
export const getOwnershipStatus = async (
	host: string,
	projectPath: string,
): Promise<OwnershipStatus> => {
	const pathCheck = validateRemotePath(projectPath);
	if (!pathCheck.valid) {
		return { hasOwner: false };
	}
	const ownershipFile = `${projectPath}/${OWNERSHIP_FILE_NAME}`;
	const command = `cat ${escapeRemotePath(ownershipFile)} 2>/dev/null`;

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

// write a .skybox-owner file to a remote project for a project on the remote.
// creates the .skybox-owner file with current user's info.
export const setOwnership = async (
	host: string,
	projectPath: string,
): Promise<SetOwnershipResult> => {
	const pathCheck = validateRemotePath(projectPath);
	if (!pathCheck.valid) {
		return { success: false, error: pathCheck.error };
	}
	const info = createOwnershipInfo();
	const json = JSON.stringify(info, null, 2);
	const ownershipFile = `${projectPath}/${OWNERSHIP_FILE_NAME}`;

	// Encode as base64 for safe shell transport (like lock.ts)
	const jsonBase64 = Buffer.from(json).toString("base64");

	// Write ownership file using base64 decode (avoids shell escaping issues)
	const command = `echo ${escapeShellArg(jsonBase64)} | base64 -d > ${escapeRemotePath(ownershipFile)}`;
	const result = await runRemoteCommand(host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to set ownership" };
	}

	return { success: true };
};

// check if user is authorized to perform a write operation on a project.
// returns true if: no ownership file exists OR current user is the owner.
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
		// No ownership file — backward compatible, allow access
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
