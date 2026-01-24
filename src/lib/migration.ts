// src/lib/migration.ts
import type {
	DevboxConfig,
	DevboxConfigV2,
	RemoteEntry,
} from "../types/index.ts";

/**
 * Check if config needs migration from old single-remote format
 */
export function needsMigration(config: unknown): boolean {
	if (!config || typeof config !== "object") return false;
	const c = config as Record<string, unknown>;
	// Old format has `remote` object, new format has `remotes` map
	return "remote" in c && !("remotes" in c);
}

/**
 * Migrate old single-remote config to new multi-remote format
 */
export function migrateConfig(oldConfig: DevboxConfig): DevboxConfigV2 {
	const remoteName = oldConfig.remote.host;

	const newRemote: RemoteEntry = {
		host: oldConfig.remote.host,
		user: null, // Will use SSH config
		path: oldConfig.remote.base_path,
		key: null, // Will use SSH config
	};

	// Update all projects to reference the migrated remote
	const migratedProjects: Record<
		string,
		{ remote: string; ignore?: string[]; editor?: string }
	> = {};
	for (const [name, project] of Object.entries(oldConfig.projects)) {
		migratedProjects[name] = {
			...project,
			remote: remoteName,
		};
	}

	// Return new format without the old `remote` field
	return {
		editor: oldConfig.editor,
		defaults: oldConfig.defaults,
		remotes: { [remoteName]: newRemote },
		projects: migratedProjects,
		templates: oldConfig.templates,
	};
}
