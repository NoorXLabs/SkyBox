/** Mutagen sync session management: create, pause, resume, terminate. */
import { join } from "node:path";
import { getExecaErrorMessage } from "@lib/errors.ts";
import { getMutagenPath } from "@lib/paths.ts";
import type { SyncStatus, SyncStatusValue } from "@typedefs/index.ts";
import { execa } from "execa";

const sanitizeMutagenSegment = (value: string, fallback: string): string => {
	const sanitized = value
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return sanitized || fallback;
};

const buildIgnoreArgs = (ignores: string[]): string[] => {
	return ignores.flatMap((pattern) => ["--ignore", pattern]);
};

const toRemoteEndpoint = (remoteHost: string, remotePath: string): string => {
	return `${remoteHost}:${remotePath}`;
};

/**
 * Generate a sanitized Mutagen session name from a project name.
 * Mutagen session names should contain only alphanumeric characters, hyphens, and underscores.
 */
export const sessionName = (project: string): string => {
	return `skybox-${sanitizeMutagenSegment(project, "project")}`;
};

/** Standard result type for Mutagen operations */
type MutagenResult = { success: boolean; error?: string };

/** Execute a Mutagen command and return a standardized result */
const executeMutagenCommand = async (
	args: string[],
): Promise<MutagenResult> => {
	try {
		await execa(getMutagenPath(), args);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
};

const createSyncSessionByName = async (options: {
	name: string;
	localPath: string;
	remoteHost: string;
	remotePath: string;
	ignores: string[];
}): Promise<MutagenResult> => {
	const { name, localPath, remoteHost, remotePath, ignores } = options;
	return executeMutagenCommand([
		"sync",
		"create",
		localPath,
		toRemoteEndpoint(remoteHost, remotePath),
		"--name",
		name,
		"--sync-mode",
		"two-way-resolved",
		...buildIgnoreArgs(ignores),
	]);
};

export const createSyncSession = async (
	project: string,
	localPath: string,
	remoteHost: string,
	remotePath: string,
	ignores: string[],
): Promise<MutagenResult> => {
	return createSyncSessionByName({
		name: sessionName(project),
		localPath,
		remoteHost,
		remotePath,
		ignores,
	});
};

export const getSyncStatus = async (project: string): Promise<SyncStatus> => {
	const name = sessionName(project);

	try {
		// List session by name directly
		const result = await execa(getMutagenPath(), ["sync", "list", name]);

		if (
			!result.stdout ||
			result.stdout.includes("No synchronization sessions found")
		) {
			return { exists: false, paused: false, status: "none" };
		}

		// Check for paused status - mutagen shows "[Paused]" in status line
		const paused = result.stdout.includes("[Paused]");
		const status: SyncStatusValue = paused ? "paused" : "syncing";

		return { exists: true, paused, status };
	} catch (error: unknown) {
		// If session not found, mutagen exits with error
		const message = getExecaErrorMessage(error);
		if (message.includes("unable to locate")) {
			return { exists: false, paused: false, status: "none" };
		}
		return { exists: false, paused: false, status: "error" };
	}
};

export const waitForSync = async (
	project: string,
	onProgress?: (message: string) => void,
): Promise<MutagenResult> => {
	const name = sessionName(project);
	onProgress?.("Waiting for sync to complete...");
	const result = await executeMutagenCommand(["sync", "flush", name]);
	if (result.success) {
		onProgress?.("Sync complete");
	}
	return result;
};

export const pauseSync = async (project: string): Promise<MutagenResult> => {
	const name = sessionName(project);
	return executeMutagenCommand(["sync", "pause", name]);
};

export const resumeSync = async (project: string): Promise<MutagenResult> => {
	const name = sessionName(project);
	return executeMutagenCommand(["sync", "resume", name]);
};

export const terminateSession = async (
	project: string,
): Promise<MutagenResult> => {
	const name = sessionName(project);
	return executeMutagenCommand(["sync", "terminate", name]);
};

/**
 * Generate a sanitized Mutagen session name for a selective sync subpath.
 */
export const selectiveSessionName = (
	project: string,
	subpath: string,
): string => {
	const sanitizedProject = sanitizeMutagenSegment(project, "project");
	const sanitizedPath = sanitizeMutagenSegment(subpath, "path");
	return `skybox-${sanitizedProject}-${sanitizedPath}`;
};

/**
 * Terminate selective sync sessions for specific subpaths.
 */
export const terminateSelectiveSyncSessions = async (
	project: string,
	syncPaths: string[],
): Promise<void> => {
	for (const subpath of syncPaths) {
		const name = selectiveSessionName(project, subpath);
		await executeMutagenCommand(["sync", "terminate", name]);
	}
};

/**
 * Create multiple Mutagen sync sessions for selective subdirectory sync.
 */
export const createSelectiveSyncSessions = async (
	project: string,
	localPath: string,
	remoteHost: string,
	remotePath: string,
	syncPaths: string[],
	ignores: string[],
): Promise<MutagenResult> => {
	for (const subpath of syncPaths) {
		const name = selectiveSessionName(project, subpath);
		const localSubpath = join(localPath, subpath);
		const remoteSubpath = `${remotePath}/${subpath}`;
		const result = await createSyncSessionByName({
			name,
			localPath: localSubpath,
			remoteHost,
			remotePath: remoteSubpath,
			ignores,
		});

		if (!result.success) {
			return result;
		}
	}
	return { success: true };
};
