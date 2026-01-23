// src/lib/mutagen.ts
import { execa } from "execa";
import type { SyncStatus } from "../types/index.ts";
import { getExecaErrorMessage } from "./errors.ts";
import { MUTAGEN_PATH } from "./paths.ts";

export function sessionName(project: string): string {
	return `devbox-${project}`;
}

export async function createSyncSession(
	project: string,
	localPath: string,
	remoteHost: string,
	remotePath: string,
	ignores: string[],
): Promise<{ success: boolean; error?: string }> {
	const name = sessionName(project);
	const alpha = localPath;
	const beta = `${remoteHost}:${remotePath}`;

	const args = [
		"sync",
		"create",
		alpha,
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

	try {
		await execa(MUTAGEN_PATH, args);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

export async function getSyncStatus(project: string): Promise<SyncStatus> {
	const name = sessionName(project);

	try {
		// List session by name directly
		const result = await execa(MUTAGEN_PATH, ["sync", "list", name]);

		if (
			!result.stdout ||
			result.stdout.includes("No synchronization sessions found")
		) {
			return { exists: false, paused: false, status: "none" };
		}

		// Check for paused status - mutagen shows "[Paused]" in status line
		const paused = result.stdout.includes("[Paused]");
		const status = paused ? "paused" : "syncing";

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
): Promise<{ success: boolean; error?: string }> {
	const name = sessionName(project);

	try {
		onProgress?.("Waiting for sync to complete...");
		await execa(MUTAGEN_PATH, ["sync", "flush", name]);
		onProgress?.("Sync complete");
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

export async function pauseSync(
	project: string,
): Promise<{ success: boolean; error?: string }> {
	const name = sessionName(project);

	try {
		await execa(MUTAGEN_PATH, ["sync", "pause", name]);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

export async function resumeSync(
	project: string,
): Promise<{ success: boolean; error?: string }> {
	const name = sessionName(project);

	try {
		await execa(MUTAGEN_PATH, ["sync", "resume", name]);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}

export async function terminateSession(
	project: string,
): Promise<{ success: boolean; error?: string }> {
	const name = sessionName(project);

	try {
		await execa(MUTAGEN_PATH, ["sync", "terminate", name]);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getExecaErrorMessage(error) };
	}
}
