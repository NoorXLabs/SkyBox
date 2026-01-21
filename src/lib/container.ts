// src/lib/container.ts
import { execa } from "execa";

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
