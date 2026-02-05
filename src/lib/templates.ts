/** Devcontainer template definitions and generation. */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { input, Separator, select } from "@inquirer/prompts";
import { loadConfig } from "@lib/config.ts";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
	TEMPLATES,
	WORKSPACE_PATH_PREFIX,
} from "@lib/constants.ts";
import { getUserTemplatesDir } from "@lib/paths.ts";
import { error, info, success, warn } from "@lib/ui.ts";
import type {
	DevcontainerConfig,
	TemplateSelection,
	UserLocalTemplate,
} from "@typedefs/index.ts";
import { execa } from "execa";

export function createDevcontainerConfig(
	projectPath: string,
	templateId: string,
	projectName?: string,
): void {
	const template = TEMPLATES.find((t) => t.id === templateId);
	if (!template) {
		throw new Error(`Unknown template: ${templateId}`);
	}

	// Use provided name or extract from path
	const name = projectName || projectPath.split("/").pop() || "workspace";

	// Build config with workspace settings
	const config = {
		...template.config,
		workspaceFolder: `${WORKSPACE_PATH_PREFIX}/${name}`,
		workspaceMount: `source=\${localWorkspaceFolder},target=${WORKSPACE_PATH_PREFIX}/${name},type=bind,consistency=cached`,
	};

	const devcontainerDir = join(projectPath, DEVCONTAINER_DIR_NAME);
	mkdirSync(devcontainerDir, { recursive: true });

	const configPath = join(devcontainerDir, DEVCONTAINER_CONFIG_NAME);
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Write a DevcontainerConfig to a project's .devcontainer/devcontainer.json.
 */
export function writeDevcontainerConfig(
	projectPath: string,
	config: DevcontainerConfig,
): void {
	const devcontainerDir = join(projectPath, DEVCONTAINER_DIR_NAME);
	mkdirSync(devcontainerDir, { recursive: true });
	const configPath = join(devcontainerDir, DEVCONTAINER_CONFIG_NAME);
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Validate a parsed devcontainer config has required fields.
 */
export function validateTemplate(config: unknown): {
	valid: boolean;
	error?: string;
} {
	if (typeof config !== "object" || config === null) {
		return { valid: false, error: "not a JSON object" };
	}
	const obj = config as Record<string, unknown>;
	if (!obj.workspaceFolder) {
		return { valid: false, error: "missing workspaceFolder" };
	}
	if (!obj.workspaceMount) {
		return { valid: false, error: "missing workspaceMount" };
	}
	return { valid: true };
}

/**
 * Load user templates from ~/.skybox/templates/*.json.
 */
export function loadUserTemplates(): UserLocalTemplate[] {
	const dir = getUserTemplatesDir();
	if (!existsSync(dir)) {
		return [];
	}

	const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
	const templates: UserLocalTemplate[] = [];

	for (const file of files) {
		const name = basename(file, ".json");
		const filePath = join(dir, file);
		try {
			const raw = readFileSync(filePath, "utf-8");
			const parsed = JSON.parse(raw) as DevcontainerConfig;
			const validation = validateTemplate(parsed);
			templates.push({
				name,
				config: parsed,
				valid: validation.valid,
				error: validation.error,
			});
		} catch {
			templates.push({
				name,
				config: {} as DevcontainerConfig,
				valid: false,
				error: "invalid JSON",
			});
		}
	}

	return templates;
}

/**
 * Scaffold a new user template file with required fields pre-filled.
 */
export function scaffoldTemplate(name: string): string {
	const dir = getUserTemplatesDir();
	mkdirSync(dir, { recursive: true });

	const config = {
		name,
		image: "mcr.microsoft.com/devcontainers/base:debian",
		// biome-ignore lint/suspicious/noTemplateCurlyInString: devcontainer variable placeholders
		workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
		workspaceMount:
			// biome-ignore lint/suspicious/noTemplateCurlyInString: devcontainer variable placeholders
			"source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",
		postCreateCommand: "",
		postStartCommand: "",
		features: {},
		customizations: {
			vscode: {
				extensions: [],
				settings: {},
			},
		},
	};

	const filePath = join(dir, `${name}.json`);
	writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
	return filePath;
}

/**
 * Run the "Create new template" sub-flow: name prompt, scaffold, edit prompt.
 * Returns the file path of the created template.
 */
async function createNewTemplateFlow(): Promise<void> {
	const existingTemplates = loadUserTemplates();
	const existingNames = new Set(existingTemplates.map((t) => t.name));

	const name = await input({
		message: "Template name:",
		validate: (val: string) => {
			if (!val.trim()) return "Name cannot be empty";
			if (/[^a-zA-Z0-9_-]/.test(val))
				return "Only letters, numbers, hyphens, and underscores allowed";
			if (existingNames.has(val)) return `Template "${val}" already exists`;
			return true;
		},
	});

	const filePath = scaffoldTemplate(name);
	success(`Created template: ${filePath}`);

	const editChoice = await select({
		message: "How would you like to edit this template?",
		choices: [
			{ name: "Open in editor", value: "editor" },
			{ name: "Edit in terminal", value: "terminal" },
			{ name: "Skip — edit later", value: "skip" },
		],
	});

	if (editChoice === "editor") {
		const config = loadConfig();
		const editorCmd = config?.editor || "code";
		try {
			await execa(editorCmd, [filePath]);
		} catch {
			warn(`Failed to open ${editorCmd}. Edit the file manually: ${filePath}`);
		}
	} else if (editChoice === "terminal") {
		const termEditor = process.env.EDITOR || "vi";
		try {
			await execa(termEditor, [filePath], { stdio: "inherit" });
		} catch {
			warn(`Failed to open ${termEditor}. Edit the file manually: ${filePath}`);
		}
	} else {
		info(`Edit later: ${filePath}`);
	}
}

/**
 * Unified template selector used by all commands.
 * Shows built-in templates, git URL option, and user local templates.
 * Returns a TemplateSelection or null if cancelled.
 */
export async function selectTemplate(): Promise<TemplateSelection | null> {
	try {
		while (true) {
			const userTemplates = loadUserTemplates();

			type ChoiceItem =
				| { name: string; value: string; disabled?: string }
				| InstanceType<typeof Separator>;
			const choices: ChoiceItem[] = [];

			// Built-in section
			choices.push(new Separator("── Built-in ──"));
			for (const t of TEMPLATES) {
				choices.push({
					name: `${t.name} — ${t.description}`,
					value: `builtin:${t.id}`,
				});
			}

			// Other section
			choices.push(new Separator("── Other ──"));
			choices.push({ name: "Enter git URL", value: "git-url" });

			// User templates section
			choices.push(new Separator("── Your Templates ──"));
			for (const t of userTemplates) {
				if (t.valid) {
					choices.push({ name: t.name, value: `user:${t.name}` });
				} else {
					choices.push({
						name: `${t.name} ⚠ ${t.error}`,
						value: `user-invalid:${t.name}`,
					});
				}
			}
			choices.push({ name: "Create new template", value: "create-new" });

			const choice = await select({
				message: "Select a template:",
				choices,
				loop: false,
			});

			if (choice === "git-url") {
				const url = await input({
					message: "Git repository URL:",
					validate: (val: string) => {
						if (!val.trim()) return "URL cannot be empty";
						if (!val.startsWith("https://") && !val.startsWith("git@"))
							return "URL must start with https:// or git@";
						return true;
					},
				});
				return { source: "git", url };
			}

			if (choice === "create-new") {
				await createNewTemplateFlow();
				// Loop back to selector so user can pick the new template
				continue;
			}

			if (choice.startsWith("user-invalid:")) {
				const name = choice.replace("user-invalid:", "");
				const t = userTemplates.find((u) => u.name === name);
				error(`Template "${name}" is invalid: ${t?.error}`);
				info("Fix the template file and try again.");
				// Loop back to selector
				continue;
			}

			if (choice.startsWith("builtin:")) {
				const id = choice.replace("builtin:", "");
				const template = TEMPLATES.find((t) => t.id === id);
				if (!template) {
					error("Template not found");
					continue;
				}
				return { source: "builtin", config: template.config };
			}

			if (choice.startsWith("user:")) {
				const name = choice.replace("user:", "");
				const template = userTemplates.find((t) => t.name === name);
				if (!template) {
					error("Template was deleted. Please select another.");
					continue;
				}
				return { source: "user", config: template.config };
			}
		}
	} catch {
		// User cancelled with Ctrl+C
		return null;
	}
}
