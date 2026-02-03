/** Centralized path computation for DevBox directories and binaries. */
import { homedir } from "node:os";
import { join } from "node:path";
import {
	AUTO_UP_LOG_FILE,
	BIN_DIR_NAME,
	CONFIG_FILENAME,
	DEVBOX_HOME_DIR,
	LOGS_DIR_NAME,
	MUTAGEN_BINARY_NAME,
	MUTAGEN_VERSION_FILE,
	PROJECTS_DIR_NAME,
	TEMPLATES_DIR_NAME,
	UPDATE_CHECK_FILE,
} from "@lib/constants.ts";

/**
 * Get the DevBox home directory.
 * Returns fresh value on each call to support dynamic DEVBOX_HOME changes (e.g., in tests).
 */
export function getDevboxHome(): string {
	return process.env.DEVBOX_HOME || join(homedir(), DEVBOX_HOME_DIR);
}

/**
 * Get the path to the config file.
 */
export function getConfigPath(): string {
	return join(getDevboxHome(), CONFIG_FILENAME);
}

/**
 * Get the path to the projects directory.
 */
export function getProjectsDir(): string {
	return join(getDevboxHome(), PROJECTS_DIR_NAME);
}

/**
 * Get the path to the bin directory.
 */
export function getBinDir(): string {
	return join(getDevboxHome(), BIN_DIR_NAME);
}

/**
 * Get the path to the Mutagen binary.
 */
export function getMutagenPath(): string {
	return join(getBinDir(), MUTAGEN_BINARY_NAME);
}

/**
 * Get the path to the logs directory.
 */
export function getLogsDir(): string {
	return join(getDevboxHome(), LOGS_DIR_NAME);
}

/**
 * Get the path to the user templates directory.
 */
export function getUserTemplatesDir(): string {
	return join(getDevboxHome(), TEMPLATES_DIR_NAME);
}

/**
 * Get the path to the update check metadata file.
 */
export function getUpdateCheckPath(): string {
	return join(getDevboxHome(), UPDATE_CHECK_FILE);
}

/**
 * Get the path to the file that records the extracted Mutagen version.
 * Used to detect when DevBox is updated and Mutagen needs re-extraction.
 */
export function getMutagenVersionPath(): string {
	return join(getBinDir(), MUTAGEN_VERSION_FILE);
}

/**
 * Get the path to the auto-up log file.
 * Used by shell hooks to log auto-start operations.
 */
export function getAutoUpLogPath(): string {
	return join(getLogsDir(), AUTO_UP_LOG_FILE);
}
