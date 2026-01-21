// src/lib/container.ts
import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";

export enum ContainerStatus {
  Running = "running",
  NotRunning = "not_running",
  Error = "error",
}

export async function getContainerStatus(projectPath: string): Promise<ContainerStatus> {
  try {
    const result = await execa("docker", [
      "ps",
      "--filter", `label=devcontainer.local_folder=${projectPath}`,
      "--format", "{{.Status}}",
    ]);

    if (result.stdout.trim()) {
      return ContainerStatus.Running;
    }
    return ContainerStatus.NotRunning;
  } catch {
    return ContainerStatus.Error;
  }
}

export interface ContainerResult {
  success: boolean;
  error?: string;
}

export async function startContainer(
  projectPath: string,
  options?: { rebuild?: boolean }
): Promise<ContainerResult> {
  const args = ["up", "--workspace-folder", projectPath];

  if (options?.rebuild) {
    args.push("--rebuild-if-exists");
  }

  try {
    await execa("devcontainer", args, { stdio: "inherit" });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function stopContainer(projectPath: string): Promise<ContainerResult> {
  try {
    // Get container ID
    const result = await execa("docker", [
      "ps",
      "-q",
      "--filter", `label=devcontainer.local_folder=${projectPath}`,
    ]);

    const containerId = result.stdout.trim();
    if (!containerId) {
      return { success: true }; // Already stopped
    }

    await execa("docker", ["stop", containerId]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export const SUPPORTED_EDITORS = [
  { id: "code", name: "VS Code" },
  { id: "cursor", name: "Cursor" },
  { id: "code-insiders", name: "VS Code Insiders" },
] as const;

export type EditorId = typeof SUPPORTED_EDITORS[number]["id"] | string;

export async function openInEditor(
  projectPath: string,
  editor: EditorId
): Promise<ContainerResult> {
  try {
    // Try devcontainer open first (works with VS Code)
    if (editor === "code" || editor === "code-insiders") {
      await execa("devcontainer", ["open", "--workspace-folder", projectPath]);
    } else {
      // Direct editor command for others
      await execa(editor, [projectPath]);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function attachToShell(projectPath: string): Promise<ContainerResult> {
  try {
    await execa("devcontainer", ["exec", "--workspace-folder", projectPath, "/bin/bash"], {
      stdio: "inherit",
    });
    return { success: true };
  } catch (err: any) {
    // Exit code 130 is normal Ctrl+C exit
    if (err.exitCode === 130) {
      return { success: true };
    }
    return { success: false, error: err.stderr || err.message };
  }
}

export function hasDevcontainerConfig(projectPath: string): boolean {
  const configPath = join(projectPath, ".devcontainer", "devcontainer.json");
  const altConfigPath = join(projectPath, ".devcontainer.json");
  return existsSync(configPath) || existsSync(altConfigPath);
}
