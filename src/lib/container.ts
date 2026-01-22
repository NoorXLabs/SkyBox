// src/lib/container.ts
import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";

export enum ContainerStatus {
  Running = "running",
  Stopped = "stopped",
  NotFound = "not_found",
  Error = "error",
}

export interface ContainerResult {
  success: boolean;
  error?: string;
  containerId?: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
}

// Get container status for a local project
export async function getContainerStatus(projectPath: string): Promise<ContainerStatus> {
  try {
    const result = await execa("docker", [
      "ps",
      "-a",
      "--filter", `label=devcontainer.local_folder=${projectPath}`,
      "--format", "{{.Status}}",
    ]);

    const status = result.stdout.trim();
    if (!status) {
      return ContainerStatus.NotFound;
    }
    if (status.toLowerCase().startsWith("up")) {
      return ContainerStatus.Running;
    }
    return ContainerStatus.Stopped;
  } catch {
    return ContainerStatus.Error;
  }
}

// Get container info for a local project
export async function getContainerInfo(projectPath: string): Promise<ContainerInfo | null> {
  try {
    const result = await execa("docker", [
      "ps",
      "-a",
      "--filter", `label=devcontainer.local_folder=${projectPath}`,
      "--format", "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
    ]);

    const line = result.stdout.trim();
    if (!line) return null;

    const [id, name, status, image] = line.split("\t");
    return { id, name, status, image };
  } catch {
    return null;
  }
}

// Start a devcontainer locally
export async function startContainer(
  projectPath: string,
  options?: { rebuild?: boolean }
): Promise<ContainerResult> {
  const args = ["up", "--workspace-folder", projectPath];

  if (options?.rebuild) {
    args.push("--rebuild-if-exists");
  }

  try {
    const result = await execa("devcontainer", args, { stdio: "inherit" });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

// Stop a devcontainer
export async function stopContainer(projectPath: string): Promise<ContainerResult> {
  try {
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
    return { success: true, containerId };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

// Remove a devcontainer and its volumes
export async function removeContainer(
  projectPath: string,
  options?: { removeVolumes?: boolean }
): Promise<ContainerResult> {
  try {
    // Get container ID
    const result = await execa("docker", [
      "ps",
      "-a",
      "-q",
      "--filter", `label=devcontainer.local_folder=${projectPath}`,
    ]);

    const containerId = result.stdout.trim();
    if (!containerId) {
      return { success: true }; // No container to remove
    }

    // Stop if running
    await execa("docker", ["stop", containerId]).catch(() => {});

    // Remove container
    const removeArgs = ["rm", containerId];
    if (options?.removeVolumes) {
      removeArgs.push("-v");
    }
    await execa("docker", removeArgs);

    return { success: true, containerId };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

// Get all devbox-related containers
export async function listDevboxContainers(): Promise<ContainerInfo[]> {
  try {
    const result = await execa("docker", [
      "ps",
      "-a",
      "--filter", "label=devcontainer.local_folder",
      "--format", "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}",
    ]);

    if (!result.stdout.trim()) return [];

    return result.stdout.trim().split("\n").map((line) => {
      const [id, name, status, image] = line.split("\t");
      return { id, name, status, image };
    });
  } catch {
    return [];
  }
}

export const SUPPORTED_EDITORS = [
  { id: "cursor", name: "Cursor" },
  { id: "code", name: "VS Code" },
  { id: "code-insiders", name: "VS Code Insiders" },
] as const;

export type EditorId = typeof SUPPORTED_EDITORS[number]["id"] | string;

// Open project in editor with devcontainer
export async function openInEditor(
  projectPath: string,
  editor: EditorId
): Promise<ContainerResult> {
  try {
    // Get the container ID for this project
    const containerResult = await execa("docker", [
      "ps",
      "-q",
      "--filter", `label=devcontainer.local_folder=${projectPath}`,
    ]);

    const containerId = containerResult.stdout.trim();
    if (!containerId) {
      return { success: false, error: "Container not running. Run 'devbox up' first." };
    }

    // Get the workspace folder from devcontainer.json or use default
    const projectName = projectPath.split("/").pop();
    const workspaceFolder = `/workspaces/${projectName}`;

    // Build the devcontainer URI - hex encode the project path
    const hexPath = Buffer.from(projectPath).toString("hex");
    const devcontainerUri = `vscode-remote://dev-container+${hexPath}${workspaceFolder}`;

    // Use the editor to open the devcontainer URI
    if (editor === "cursor" || editor === "code" || editor === "code-insiders") {
      await execa(editor, ["--folder-uri", devcontainerUri]);
    } else {
      // Fallback: just open the folder directly
      await execa(editor, [projectPath]);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

// Attach to shell inside devcontainer
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

// Check if devcontainer.json exists locally
export function hasLocalDevcontainerConfig(projectPath: string): boolean {
  const configPath = join(projectPath, ".devcontainer", "devcontainer.json");
  const altConfigPath = join(projectPath, ".devcontainer.json");
  return existsSync(configPath) || existsSync(altConfigPath);
}
