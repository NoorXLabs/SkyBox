/** Devcontainer template definitions and generation. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Template } from "../types/index.ts";

// Common features for all templates
const COMMON_FEATURES = {
	"ghcr.io/devcontainers/features/common-utils:2": {
		configureZshAsDefaultShell: true,
	},
	"ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
		moby: false,
	},
	"ghcr.io/devcontainers/features/git:1": {},
};

// Mounts for SSH passthrough
const COMMON_MOUNTS = [
	"source=$" + "{localEnv:HOME}/.ssh,target=/var/ssh-config,type=bind,readonly",
];

// SSH symlink setup (runs after container starts)
const SSH_SYMLINK_COMMAND =
	"[ ! -L $HOME/.ssh ] && rm -rf $HOME/.ssh && ln -s /var/ssh-config $HOME/.ssh || true";

// Common VS Code settings for all templates
const COMMON_VSCODE_SETTINGS = {
	"terminal.integrated.defaultProfile.linux": "zsh",
};

// Template configs without workspace settings (added dynamically based on project)
// All templates include: DooD, SSH passthrough, zsh
export const TEMPLATES: Template[] = [
	{
		id: "node",
		name: "Node.js",
		description: "Node.js 20 with npm/yarn + Docker support",
		config: {
			name: "Node.js",
			image: "mcr.microsoft.com/devcontainers/javascript-node:20",
			postCreateCommand: "[ -f package.json ] && npm install || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: ["dbaeumer.vscode-eslint"],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
	{
		id: "python",
		name: "Python",
		description: "Python 3.12 with pip/venv + Docker support",
		config: {
			name: "Python",
			image: "mcr.microsoft.com/devcontainers/python:3.12",
			postCreateCommand:
				"[ -f requirements.txt ] && pip install -r requirements.txt || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: ["ms-python.python"],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
	{
		id: "go",
		name: "Go",
		description: "Go 1.22 + Docker support",
		config: {
			name: "Go",
			image: "mcr.microsoft.com/devcontainers/go:1.22",
			postCreateCommand: "[ -f go.mod ] && go mod download || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: ["golang.go"],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
	{
		id: "generic",
		name: "Generic",
		description: "Debian with basic dev tools + Docker support",
		config: {
			name: "Development",
			image: "mcr.microsoft.com/devcontainers/base:debian",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: [],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
];

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
		workspaceFolder: `/workspaces/${name}`,
		workspaceMount: `source=\${localWorkspaceFolder},target=/workspaces/${name},type=bind,consistency=cached`,
	};

	const devcontainerDir = join(projectPath, ".devcontainer");
	mkdirSync(devcontainerDir, { recursive: true });

	const configPath = join(devcontainerDir, "devcontainer.json");
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
