// src/lib/templates.ts
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export interface Template {
  id: string;
  name: string;
  description: string;
  config: object;
}

// Template configs without workspace settings (added dynamically based on project)
// All templates include Docker-outside-of-Docker (DooD) support via socket mount
export const TEMPLATES: Template[] = [
  {
    id: "node",
    name: "Node.js",
    description: "Node.js 20 with npm/yarn + Docker support",
    config: {
      name: "Node.js",
      image: "mcr.microsoft.com/devcontainers/javascript-node:20",
      postCreateCommand: "[ -f package.json ] && npm install || true",
      features: {
        "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
          "moby": false
        },
      },
      customizations: {
        vscode: {
          extensions: ["dbaeumer.vscode-eslint"],
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
      postCreateCommand: "[ -f requirements.txt ] && pip install -r requirements.txt || true",
      features: {
        "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
          "moby": false
        },
      },
      customizations: {
        vscode: {
          extensions: ["ms-python.python"],
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
      features: {
        "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
          "moby": false
        },
      },
      customizations: {
        vscode: {
          extensions: ["golang.go"],
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
      features: {
        "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
          "moby": false
        },
      },
      customizations: {
        vscode: {
          extensions: [],
        },
      },
    },
  },
];

export function createDevcontainerConfig(
  projectPath: string,
  templateId: string,
  projectName?: string
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
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
