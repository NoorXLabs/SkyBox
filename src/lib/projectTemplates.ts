// src/lib/projectTemplates.ts
import type { BuiltInTemplate } from "../types/index.ts";

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
