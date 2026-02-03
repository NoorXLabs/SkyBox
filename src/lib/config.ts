/** YAML config file operations: load, save, query remotes and projects. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { migrateConfig, needsMigration } from "@lib/migration.ts";
import { getConfigPath } from "@lib/paths.ts";
import type {
	DevboxConfig,
	DevboxConfigV2,
	RemoteEntry,
} from "@typedefs/index.ts";
import { parse, stringify } from "yaml";

export function configExists(): boolean {
	return existsSync(getConfigPath());
}

export function loadConfig(): DevboxConfigV2 | null {
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
		throw new Error(`Failed to parse config file at ${configPath}: ${message}`);
	}

	// Auto-migrate old format
	if (needsMigration(rawConfig)) {
		const migrated = migrateConfig(rawConfig as DevboxConfig);
		saveConfig(migrated);
		console.error(
			"\x1b[33m[devbox]\x1b[0m Config auto-migrated from V1 to V2 format.",
		);
		return migrated;
	}

	return rawConfig as DevboxConfigV2;
}

export function saveConfig(config: DevboxConfigV2): void {
	const configPath = getConfigPath();
	const dir = dirname(configPath);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const content = stringify(config);
	writeFileSync(configPath, content, "utf-8");
}

/**
 * Get a specific remote by name
 */
export function getRemote(name: string): RemoteEntry | null {
	const config = loadConfig();
	if (!config?.remotes?.[name]) {
		return null;
	}
	return config.remotes[name];
}

/**
 * List all configured remotes
 */
export function listRemotes(): Array<{ name: string } & RemoteEntry> {
	const config = loadConfig();
	if (!config?.remotes) {
		return [];
	}
	return Object.entries(config.remotes).map(([name, remote]) => ({
		name,
		...remote,
	}));
}

/**
 * Check if auto-up is enabled for a project.
 * Resolution order:
 * 1. Per-project auto_up setting (if set)
 * 2. Global defaults.auto_up setting (if set)
 * 3. Default: false (opt-in feature)
 */
export function isAutoUpEnabled(
	projectName: string,
	config: DevboxConfigV2,
): boolean {
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
}
