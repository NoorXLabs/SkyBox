// src/lib/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import type { DevboxConfig } from "../types/index.ts";

// Dynamic import to get fresh DEVBOX_HOME on each call
function getConfigPath(): string {
	const home =
		process.env.DEVBOX_HOME || `${require("node:os").homedir()}/.devbox`;
	return `${home}/config.yaml`;
}

export function configExists(): boolean {
	return existsSync(getConfigPath());
}

export function loadConfig(): DevboxConfig | null {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		return null;
	}

	const content = readFileSync(configPath, "utf-8");
	return parse(content) as DevboxConfig;
}

export function saveConfig(config: DevboxConfig): void {
	const configPath = getConfigPath();
	const dir = dirname(configPath);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const content = stringify(config);
	writeFileSync(configPath, content, "utf-8");
}
