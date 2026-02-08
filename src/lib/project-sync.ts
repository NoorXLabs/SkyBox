import { saveConfig } from "@lib/config.ts";
import { waitForSync } from "@lib/mutagen.ts";
import { createProjectSyncSession } from "@lib/sync-session.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";

interface FinalizeProjectSyncOptions {
	projectName: string;
	localPath: string;
	remoteHost: string;
	remotePath: string;
	ignores: string[];
	syncPaths?: string[];
	config: SkyboxConfigV2;
	remoteName: string;
	onProgress?: (message: string) => void;
}

type SyncFailureStage = "create" | "sync";

export type FinalizeProjectSyncResult =
	| { success: true }
	| { success: false; stage: SyncFailureStage; error: string };

// create a project sync session, wait for initial flush, and register the project in config
export const finalizeProjectSync = async (
	options: FinalizeProjectSyncOptions,
): Promise<FinalizeProjectSyncResult> => {
	const {
		projectName,
		localPath,
		remoteHost,
		remotePath,
		ignores,
		syncPaths,
		config,
		remoteName,
		onProgress,
	} = options;

	const createResult = await createProjectSyncSession({
		project: projectName,
		localPath,
		remoteHost,
		remotePath,
		ignores,
		syncPaths,
	});

	if (!createResult.success) {
		return {
			success: false,
			stage: "create",
			error: createResult.error || "Failed to create sync session",
		};
	}

	const syncResult = await waitForSync(projectName, onProgress);
	if (!syncResult.success) {
		return {
			success: false,
			stage: "sync",
			error: syncResult.error || "Sync failed",
		};
	}

	config.projects[projectName] = { remote: remoteName };
	saveConfig(config);

	return { success: true };
};
