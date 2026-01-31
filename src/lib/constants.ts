/**
 * @file constants.ts
 * @description Shared constants used across the codebase.
 */

import type { InstallMethod } from "../types/index.ts";

/**
 * Docker label key used to identify devcontainers.
 * This label is set automatically by devcontainer-cli when starting a container.
 * The value is the absolute path to the local project folder.
 */
export const DOCKER_LABEL_KEY = "devcontainer.local_folder";

/**
 * Directory name for lock files on remote server.
 */
export const LOCKS_DIR_NAME = ".devbox-locks";

/**
 * Config filename.
 */
export const CONFIG_FILENAME = "config.yaml";

/**
 * Default editor preference.
 */
export const DEFAULT_EDITOR = "cursor";

/**
 * Pinned Mutagen version for binary downloads.
 * @see https://github.com/mutagen-io/mutagen/releases
 */
export const MUTAGEN_VERSION = "0.17.5";

/**
 * How DevBox was installed. Set at build time via DEVBOX_INSTALL_METHOD env var.
 * Falls back to "source" for local development.
 */
export const INSTALL_METHOD: InstallMethod =
	(process.env.DEVBOX_INSTALL_METHOD as InstallMethod) || "source";

/**
 * GitHub repo coordinates for update checks.
 */
export const GITHUB_OWNER = "NoorChasib";
export const GITHUB_REPO = "DevBox";

/**
 * Exit code when user presses Ctrl+C.
 */
export const CTRL_C_EXIT_CODE = 130;
