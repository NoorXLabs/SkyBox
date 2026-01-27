/**
 * @file constants.ts
 * @description Shared constants used across the codebase.
 */

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
 * Exit code when user presses Ctrl+C.
 */
export const CTRL_C_EXIT_CODE = 130;
