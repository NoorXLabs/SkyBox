// src/lib/projectTemplates.ts

import type { BuiltInTemplate, UserTemplate } from "../types/index.ts";
import { loadConfig } from "./config.ts";

// Built-in project templates - git repos with starter projects
// TODO: Replace with your actual template repo URLs
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
	{
		id: "node",
		name: "Node.js",
		url: "https://github.com/devbox-templates/node-starter",
	},
	{
		id: "bun",
		name: "Bun",
		url: "https://github.com/devbox-templates/bun-starter",
	},
	{
		id: "python",
		name: "Python",
		url: "https://github.com/devbox-templates/python-starter",
	},
	{
		id: "go",
		name: "Go",
		url: "https://github.com/devbox-templates/go-starter",
	},
];

export function getBuiltInTemplates(): BuiltInTemplate[] {
	return BUILT_IN_TEMPLATES;
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
	builtIn: BuiltInTemplate[];
	user: UserTemplate[];
} {
	return {
		builtIn: getBuiltInTemplates(),
		user: getUserTemplates(),
	};
}

export function validateProjectName(name: string): {
	valid: boolean;
	error?: string;
} {
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
