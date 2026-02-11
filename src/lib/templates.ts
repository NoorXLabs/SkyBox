// devcontainer template definitions and generation.
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
import { launchFileInEditor } from "@lib/editor-launch.ts";
import { getUserTemplatesDir } from "@lib/paths.ts";
import { error, info, success, warn } from "@lib/ui.ts";
import type {
	DevcontainerConfig,
	TemplateSelection,
	UserLocalTemplate,
	ValidationResult,
} from "@typedefs/index.ts";
import { execa } from "execa";

export interface TemplateSelectorOptions {
	// show "Enter git URL" option in the selector. Default: true
	allowGitUrl?: boolean;
	// show "Create new template" option in the selector. Default: true
	allowCreateTemplate?: boolean;
}

// build devcontainer config from template
export const buildDevcontainerConfigFromTemplate = (
	projectPath: string,
	templateId: string,
	projectName?: string,
): DevcontainerConfig => {
	const template = TEMPLATES.find((t) => t.id === templateId);
	if (!template) {
		throw new Error(`Unknown template: ${templateId}`);
	}

	// Use provided name or extract from path
	const name = projectName || basename(projectPath) || "workspace";

	// Build config with workspace settings
	return {
		...template.config,
		workspaceFolder: `${WORKSPACE_PATH_PREFIX}/${name}`,
		workspaceMount: `source=\${localWorkspaceFolder},target=${WORKSPACE_PATH_PREFIX}/${name},type=bind,consistency=cached`,
	};
};

// write a DevcontainerConfig to a project's .devcontainer/devcontainer.json.
export const writeDevcontainerConfig = (
	projectPath: string,
	config: DevcontainerConfig,
): void => {
	const devcontainerDir = join(projectPath, DEVCONTAINER_DIR_NAME);
	mkdirSync(devcontainerDir, { recursive: true });
	const configPath = join(devcontainerDir, DEVCONTAINER_CONFIG_NAME);
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
};

// validate a parsed devcontainer config has required fields.
export const validateTemplate = (config: unknown): ValidationResult => {
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
};

// load user templates from ~/.skybox/templates/*.json.
export const loadUserTemplates = (): UserLocalTemplate[] => {
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
				error: validation.valid ? undefined : validation.error,
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
};

// scaffold a new user template file with required fields pre-filled.
export const scaffoldTemplate = (name: string): string => {
	// Validate template name at sink to prevent path traversal
	if (
		!name ||
		/[/\\]/.test(name) ||
		name.includes("..") ||
		name.startsWith("-")
	) {
		throw new Error(`Invalid template name: ${name}`);
	}

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
};

// run the "Create new template" sub-flow: name prompt, scaffold, edit prompt.
// returns the file path of the created template.
const createNewTemplateFlow = async (): Promise<void> => {
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
		const openResult = await launchFileInEditor(editorCmd, filePath);
		if (!openResult.success) {
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
};

// unified template selector used by all commands.
// shows built-in templates and user local templates, with optional sections
// (for example, git URL and create-template actions) controlled by options.
// returns a TemplateSelection or null if cancelled.
type TemplateChoiceItem =
	| { name: string; value: string; disabled?: string }
	| InstanceType<typeof Separator>;

type TemplateChoiceResult = TemplateSelection | "continue";

const buildBuiltInTemplateChoices = (): TemplateChoiceItem[] => {
	return [
		new Separator("── Built-in ──"),
		...TEMPLATES.map((template) => ({
			name: `${template.name} — ${template.description}`,
			value: `builtin:${template.id}`,
		})),
	];
};

const buildOtherTemplateChoices = (
	allowGitUrl: boolean,
): TemplateChoiceItem[] => {
	if (!allowGitUrl) {
		return [];
	}

	return [
		new Separator("── Other ──"),
		{ name: "Enter git URL", value: "git-url" },
	];
};

const buildUserTemplateChoices = (
	userTemplates: UserLocalTemplate[],
	allowCreateTemplate: boolean,
): TemplateChoiceItem[] => {
	const choices: TemplateChoiceItem[] = [new Separator("── Your Templates ──")];

	for (const template of userTemplates) {
		if (template.valid) {
			choices.push({
				name: template.name,
				value: `user:${template.name}`,
			});
		} else {
			choices.push({
				name: `${template.name} ⚠ ${template.error}`,
				value: `user-invalid:${template.name}`,
			});
		}
	}

	if (allowCreateTemplate) {
		choices.push({ name: "Create new template", value: "create-new" });
	}

	return choices;
};

const resolveTemplateChoice = async (
	choice: string,
	userTemplates: UserLocalTemplate[],
	options: { allowGitUrl: boolean; allowCreateTemplate: boolean },
): Promise<TemplateChoiceResult> => {
	if (options.allowGitUrl && choice === "git-url") {
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

	if (options.allowCreateTemplate && choice === "create-new") {
		await createNewTemplateFlow();
		return "continue";
	}

	if (choice.startsWith("user-invalid:")) {
		const name = choice.replace("user-invalid:", "");
		const template = userTemplates.find((item) => item.name === name);
		error(`Template "${name}" is invalid: ${template?.error}`);
		info("Fix the template file and try again.");
		return "continue";
	}

	if (choice.startsWith("builtin:")) {
		const id = choice.replace("builtin:", "");
		const template = TEMPLATES.find((item) => item.id === id);
		if (!template) {
			error("Template not found");
			return "continue";
		}
		return { source: "builtin", config: template.config };
	}

	if (choice.startsWith("user:")) {
		const name = choice.replace("user:", "");
		const template = userTemplates.find((item) => item.name === name);
		if (!template) {
			error("Template was deleted. Please select another.");
			return "continue";
		}
		return { source: "user", config: template.config };
	}

	error("Invalid template selection");
	return "continue";
};

export const selectTemplate = async (
	options: TemplateSelectorOptions = {},
): Promise<TemplateSelection | null> => {
	const { allowGitUrl = true, allowCreateTemplate = true } = options;

	try {
		while (true) {
			const userTemplates = loadUserTemplates();
			const choices: TemplateChoiceItem[] = [
				...buildBuiltInTemplateChoices(),
				...buildOtherTemplateChoices(allowGitUrl),
				...buildUserTemplateChoices(userTemplates, allowCreateTemplate),
			];

			const choice = await select({
				message: "Select a template:",
				choices,
				loop: false,
			});
			const result = await resolveTemplateChoice(choice, userTemplates, {
				allowGitUrl,
				allowCreateTemplate,
			});
			if (result === "continue") continue;
			return result;
		}
	} catch {
		// User cancelled with Ctrl+C
		return null;
	}
};
