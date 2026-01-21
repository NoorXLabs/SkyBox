// src/lib/templates.ts
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export interface Template {
  id: string;
  name: string;
  description: string;
  config: object;
}

export const TEMPLATES: Template[] = [
  {
    id: "node",
    name: "Node.js",
    description: "Node.js 20 with npm/yarn",
    config: {
      name: "Node.js",
      image: "mcr.microsoft.com/devcontainers/javascript-node:20",
      postCreateCommand: "npm install",
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
    description: "Python 3.12 with pip/venv",
    config: {
      name: "Python",
      image: "mcr.microsoft.com/devcontainers/python:3.12",
      postCreateCommand: "pip install -r requirements.txt || true",
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
    description: "Go 1.22",
    config: {
      name: "Go",
      image: "mcr.microsoft.com/devcontainers/go:1.22",
      postCreateCommand: "go mod download || true",
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
    description: "Debian with basic dev tools",
    config: {
      name: "Development",
      image: "mcr.microsoft.com/devcontainers/base:debian",
      customizations: {
        vscode: {
          extensions: [],
        },
      },
    },
  },
];

export function createDevcontainerConfig(projectPath: string, templateId: string): void {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  const devcontainerDir = join(projectPath, ".devcontainer");
  mkdirSync(devcontainerDir, { recursive: true });

  const configPath = join(devcontainerDir, "devcontainer.json");
  writeFileSync(configPath, JSON.stringify(template.config, null, 2) + "\n");
}
