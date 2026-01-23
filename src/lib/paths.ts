// src/lib/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";

export const DEVBOX_HOME =
	process.env.DEVBOX_HOME || join(homedir(), ".devbox");
export const CONFIG_PATH = join(DEVBOX_HOME, "config.yaml");
export const PROJECTS_DIR = join(DEVBOX_HOME, "projects");
export const BIN_DIR = join(DEVBOX_HOME, "bin");
export const MUTAGEN_PATH = join(BIN_DIR, "mutagen");
export const LOGS_DIR = join(DEVBOX_HOME, "logs");
