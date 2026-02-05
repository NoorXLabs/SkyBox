/** YAML config file operations: load, save, query remotes and projects. */
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { validateConfig } from "@lib/config-schema.ts";
import { migrateConfig, needsMigration } from "@lib/migration.ts";
import { getConfigPath } from "@lib/paths.ts";
import type {
	RemoteEntry,
	SkyboxConfig,
	SkyboxConfigV2,
} from "@typedefs/index.ts";
import { parse, stringify } from "yaml";

/**
 * Sanitize a path for error messages.
 * Replaces home directory with ~ for privacy.
 */
function sanitizePath(filePath: string): string {
	const home = homedir();
	if (filePath.startsWith(home)) {
		return `~${filePath.slice(home.length)}`;
	}
	return filePath;
}

export function configExists(): boolean {
	return existsSync(getConfigPath());
}

export function loadConfig(): SkyboxConfigV2 | null {
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
}

export function saveConfig(config: SkyboxConfigV2): void {
	const configPath = getConfigPath();
	const dir = dirname(configPath);

	// Create directory with secure permissions
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const content = stringify(config);

	// Atomic write: create temp file with secure permissions, then rename
	// This eliminates the race condition window where config could be readable
	const tempPath = `${configPath}.tmp.${process.pid}`;

	try {
		// Write to temp file with secure permissions from the start
		writeFileSync(tempPath, content, { encoding: "utf-8", mode: 0o600 });

		// Atomic rename to final location (rename is atomic on POSIX systems)
		renameSync(tempPath, configPath);
	} catch (err) {
		// Clean up temp file on error
		try {
			unlinkSync(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw err;
	}
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
	config: SkyboxConfigV2,
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
