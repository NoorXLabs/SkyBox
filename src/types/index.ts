// src/types/index.ts

export interface SSHHost {
  name: string;
  hostname?: string;
  user?: string;
  port?: number;
  identityFile?: string;
}

export interface RemoteConfig {
  host: string;
  base_path: string;
}

export interface SyncDefaults {
  sync_mode: string;
  ignore: string[];
}

export interface ProjectConfig {
  remote?: string;
  ignore?: string[];
  editor?: string;
}

export interface DevboxConfig {
  remote: RemoteConfig;
  editor: string;
  defaults: SyncDefaults;
  projects: Record<string, ProjectConfig>;
}

export const DEFAULT_IGNORE = [
  ".git/index.lock",
  ".git/*.lock",
  ".git/hooks/*",
  "node_modules",
  "venv",
  ".venv",
  "__pycache__",
  "*.pyc",
  ".devbox-local",
  "dist",
  "build",
  ".next",
  "target",
  "vendor",
];
