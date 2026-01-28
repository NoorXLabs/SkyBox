// src/lib/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import type {
	DevboxConfig,
	DevboxConfigV2,
	RemoteEntry,
} from "../types/index.ts";
import { migrateConfig, needsMigration } from "./migration.ts";
import { getConfigPath } from "./paths.ts";

export function configExists(): boolean {
	return existsSync(getConfigPath());
}

export function loadConfig(): DevboxConfigV2 | null {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		return null;
	}

	const content = readFileSync(configPath, "utf-8");
	const rawConfig = parse(content);

	// Auto-migrate old format
	if (needsMigration(rawConfig)) {
		const migrated = migrateConfig(rawConfig as DevboxConfig);
		saveConfig(migrated);
		// Note: don't call info() here as it may not be available in tests
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
