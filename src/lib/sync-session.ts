import {
	createSelectiveSyncSessions,
	createSyncSession,
} from "@lib/mutagen.ts";

export interface CreateProjectSyncSessionOptions {
	project: string;
	localPath: string;
	remoteHost: string;
	remotePath: string;
	ignores: string[];
	syncPaths?: string[];
}

export const createProjectSyncSession = async (
	options: CreateProjectSyncSessionOptions,
): Promise<{ success: boolean; error?: string }> => {
	const { project, localPath, remoteHost, remotePath, ignores, syncPaths } =
		options;

	if (syncPaths && syncPaths.length > 0) {
		return createSelectiveSyncSessions(
			project,
			localPath,
			remoteHost,
			remotePath,
			syncPaths,
			ignores,
		);
	}

	return createSyncSession(project, localPath, remoteHost, remotePath, ignores);
};
