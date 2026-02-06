// src/lib/projectTemplates.ts

import { loadConfig } from "@lib/config.ts";
import { TEMPLATES } from "@lib/constants.ts";
import type {
	Template,
	UserTemplate,
	ValidationResult,
} from "@typedefs/index.ts";

export function getBuiltInTemplates(): Template[] {
	return TEMPLATES;
}

export function getUserTemplates(): UserTemplate[] {
	const config = loadConfig();
	if (!config?.templates) {
		return [];
	}

	return Object.entries(config.templates).map(([name, url]) => ({
		name,
		url,
	}));
}

export function getAllTemplates(): {
	builtIn: Template[];
	user: UserTemplate[];
} {
	return {
		builtIn: getBuiltInTemplates(),
		user: getUserTemplates(),
	};
}

export function validateProjectName(name: string): ValidationResult {
	if (!name || name.trim() === "") {
		return { valid: false, error: "Project name cannot be empty" };
	}

	if (name.startsWith("-") || name.startsWith("_")) {
		return {
			valid: false,
			error: "Project name cannot start with a hyphen or underscore",
		};
	}

	// Only allow alphanumeric characters, hyphens, and underscores
	const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
	if (!validPattern.test(name)) {
		return {
			valid: false,
			error:
				"Project name must be alphanumeric and can only contain hyphens and underscores",
		};
	}

	return { valid: true };
}
