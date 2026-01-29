/** Mutagen sync session management: create, pause, resume, terminate. */
import { join } from "node:path";
import { execa } from "execa";
import type { SyncStatus, SyncStatusValue } from "../types/index.ts";
import { getExecaErrorMessage } from "./errors.ts";
import { getMutagenPath } from "./paths.ts";

/**
 * Generate a sanitized Mutagen session name from a project name.
 * Mutagen session names should contain only alphanumeric characters, hyphens, and underscores.
 */
export function sessionName(project: string): string {
	// Sanitize: lowercase, replace problematic characters with hyphens, collapse multiple hyphens
	const sanitized = project
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

	return `devbox-${sanitized || "project"}`;
}

/** Standard result type for Mutagen operations */
type MutagenResult = { success: boolean; error?: string };

/** Execute a Mutagen command and return a standardized result */
async function executeMutagenCommand(args: string[]): Promise<MutagenResult> {
	try {
		await execa(getMutagenPath(), args);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

export async function createSyncSession(
	project: string,
	localPath: string,
	remoteHost: string,
	remotePath: string,
	ignores: string[],
): Promise<MutagenResult> {
	const name = sessionName(project);
	const beta = `${remoteHost}:${remotePath}`;

	const args = [
		"sync",
		"create",
		localPath,
		beta,
		"--name",
		name,
		"--sync-mode",
		"two-way-resolved",
	];

	// Add ignore patterns
	for (const pattern of ignores) {
		args.push("--ignore", pattern);
	}

	return executeMutagenCommand(args);
}

export async function getSyncStatus(project: string): Promise<SyncStatus> {
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
}

export async function waitForSync(
	project: string,
	onProgress?: (message: string) => void,
): Promise<MutagenResult> {
	const name = sessionName(project);
	onProgress?.("Waiting for sync to complete...");
	const result = await executeMutagenCommand(["sync", "flush", name]);
	if (result.success) {
		onProgress?.("Sync complete");
	}
	return result;
}

export async function pauseSync(project: string): Promise<MutagenResult> {
	const name = sessionName(project);
	return executeMutagenCommand(["sync", "pause", name]);
}

export async function resumeSync(project: string): Promise<MutagenResult> {
	const name = sessionName(project);
	return executeMutagenCommand(["sync", "resume", name]);
}

export async function terminateSession(
	project: string,
): Promise<MutagenResult> {
	const name = sessionName(project);
	return executeMutagenCommand(["sync", "terminate", name]);
}

/**
 * Generate a sanitized Mutagen session name for a selective sync subpath.
 */
export function selectiveSessionName(project: string, subpath: string): string {
	const sanitizedProject = project
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	const sanitizedPath = subpath
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return `devbox-${sanitizedProject || "project"}-${sanitizedPath || "path"}`;
}

/**
 * Terminate selective sync sessions for specific subpaths.
 */
export async function terminateSelectiveSyncSessions(
	project: string,
	syncPaths: string[],
): Promise<void> {
	for (const subpath of syncPaths) {
		const name = selectiveSessionName(project, subpath);
		await executeMutagenCommand(["sync", "terminate", name]);
	}
}

/**
 * Create multiple Mutagen sync sessions for selective subdirectory sync.
 */
export async function createSelectiveSyncSessions(
	project: string,
	localPath: string,
	remoteHost: string,
	remotePath: string,
	syncPaths: string[],
	ignores: string[],
): Promise<MutagenResult> {
	for (const subpath of syncPaths) {
		const name = selectiveSessionName(project, subpath);
		const localSubpath = join(localPath, subpath);
		const remoteSubpath = `${remotePath}/${subpath}`;

		const result = await executeMutagenCommand([
			"sync",
			"create",
			localSubpath,
			`${remoteHost}:${remoteSubpath}`,
			"--name",
			name,
			"--sync-mode",
			"two-way-resolved",
			...ignores.flatMap((i) => ["--ignore", i]),
		]);

		if (!result.success) {
			return result;
		}
	}
	return { success: true };
}
