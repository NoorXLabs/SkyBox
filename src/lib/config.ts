// YAML config file operations: load, save, query remotes and projects.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { writeFileAtomic } from "@lib/atomic-write.ts";
import { validateConfig } from "@lib/config-schema.ts";
import { migrateConfig, needsMigration } from "@lib/migration.ts";
import { getConfigPath } from "@lib/paths.ts";
import { error } from "@lib/ui.ts";
import type {
	RemoteEntry,
	SkyboxConfig,
	SkyboxConfigV2,
} from "@typedefs/index.ts";
import { parse, stringify } from "yaml";

// sanitize a path for error messages.
// replaces home directory with ~ for privacy.
const sanitizePath = (filePath: string): string => {
	const home = homedir();
	if (filePath.startsWith(home)) {
		return `~${filePath.slice(home.length)}`;
	}
	return filePath;
};

// create the default config shape used when no config file exists yet.
export const createDefaultConfig = (): SkyboxConfigV2 => {
	return {
		editor: "cursor",
		defaults: {
			sync_mode: "two-way-resolved",
			ignore: [],
		},
		remotes: {},
		projects: {},
	};
};

// check if the SkyBox config file exists on disk
export const configExists = (): boolean => {
	return existsSync(getConfigPath());
};

// load and parse the SkyBox config from disk
export const loadConfig = (): SkyboxConfigV2 | null => {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		return null;
	}

	const content = readFileSync(configPath, "utf-8");

	let rawConfig: unknown;
	try {
		rawConfig = parse(content);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Failed to parse config file at ${sanitizePath(configPath)}: ${message}`,
		);
	}

	// Auto-migrate old format
	if (needsMigration(rawConfig)) {
		const migrated = migrateConfig(rawConfig as SkyboxConfig);
		saveConfig(migrated);
		console.error(
			"\x1b[33m[skybox]\x1b[0m Config auto-migrated from V1 to V2 format.",
		);
		return migrated;
	}

	// Validate config schema at runtime
	validateConfig(rawConfig);

	return rawConfig;
};

// load config or exit if SkyBox is not configured.
// combines the common configExists() + loadConfig() pattern.
export const requireConfig = (): SkyboxConfigV2 => {
	const config = loadConfig();
	if (!config) {
		error("SkyBox is not configured. Run 'skybox init' first.");
		process.exit(1);
	}
	return config;
};

// write the SkyBox config to disk as YAML
export const saveConfig = (config: SkyboxConfigV2): void => {
	const configPath = getConfigPath();
	const content = stringify(config);
	writeFileAtomic(configPath, content, { dirMode: 0o700, fileMode: 0o600 });
};

// get a specific remote by name
export const getRemote = (name: string): RemoteEntry | null => {
	const config = loadConfig();
	if (!config?.remotes?.[name]) {
		return null;
	}
	return config.remotes[name];
};

// list all configured remotes
export const listRemotes = (): Array<{ name: string } & RemoteEntry> => {
	const config = loadConfig();
	if (!config?.remotes) {
		return [];
	}
	return Object.entries(config.remotes).map(([name, remote]) => ({
		name,
		...remote,
	}));
};

// check if auto-up is enabled for a project.
// resolution order:
// 1. Per-project auto_up setting (if set)
// 2. Global defaults.auto_up setting (if set)
// 3. Default: false (opt-in feature)
export const isAutoUpEnabled = (
	projectName: string,
	config: SkyboxConfigV2,
): boolean => {
	// Check per-project setting first
	const projectConfig = config.projects[projectName];
	if (projectConfig?.auto_up !== undefined) {
		return projectConfig.auto_up;
	}

	// Fall back to global defaults
	if (config.defaults?.auto_up !== undefined) {
		return config.defaults.auto_up;
	}

	// Default to false (opt-in)
	return false;
};
