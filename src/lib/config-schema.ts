// runtime schema validation for SkyBox config.

import { VALID_SYNC_MODES } from "@lib/constants.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";

export class ConfigValidationError extends Error {
	constructor(field: string, message: string) {
		super(`Invalid config: ${field} - ${message}`);
		this.name = "ConfigValidationError";
	}
}

// validate a config object at runtime.
// throws ConfigValidationError if invalid.
export function validateConfig(
	config: unknown,
): asserts config is SkyboxConfigV2 {
	if (typeof config !== "object" || config === null) {
		throw new ConfigValidationError("root", "Config must be an object");
	}

	const c = config as Record<string, unknown>;

	// Validate editor (any non-empty string is allowed for custom editors)
	if (c.editor !== undefined) {
		if (typeof c.editor !== "string") {
			throw new ConfigValidationError("editor", "Must be a string");
		}
	}

	// Validate defaults
	if (c.defaults !== undefined) {
		if (typeof c.defaults !== "object" || c.defaults === null) {
			throw new ConfigValidationError("defaults", "Must be an object");
		}
		const defaults = c.defaults as Record<string, unknown>;

		if (defaults.sync_mode !== undefined) {
			if (
				typeof defaults.sync_mode !== "string" ||
				!VALID_SYNC_MODES.includes(defaults.sync_mode)
			) {
				throw new ConfigValidationError(
					"defaults.sync_mode",
					`Must be one of: ${VALID_SYNC_MODES.join(", ")}`,
				);
			}
		}

		if (defaults.ignore !== undefined && !Array.isArray(defaults.ignore)) {
			throw new ConfigValidationError("defaults.ignore", "Must be an array");
		}
	}

	// Validate remotes
	if (c.remotes !== undefined) {
		if (typeof c.remotes !== "object" || c.remotes === null) {
			throw new ConfigValidationError("remotes", "Must be an object");
		}

		for (const [name, remote] of Object.entries(c.remotes)) {
			if (typeof remote !== "object" || remote === null) {
				throw new ConfigValidationError(`remotes.${name}`, "Must be an object");
			}
			const r = remote as Record<string, unknown>;

			if (typeof r.host !== "string" || r.host.trim() === "") {
				throw new ConfigValidationError(
					`remotes.${name}`,
					"Must have a valid host",
				);
			}
		}
	}

	// Validate projects
	if (c.projects !== undefined) {
		if (typeof c.projects !== "object" || c.projects === null) {
			throw new ConfigValidationError("projects", "Must be an object");
		}
	}
}
