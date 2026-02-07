/** Centralized path computation for SkyBox directories and binaries. */
import { homedir } from "node:os";
import { join } from "node:path";
import {
	AUTO_UP_LOG_FILE,
	BIN_DIR_NAME,
	CONFIG_FILENAME,
	LOGS_DIR_NAME,
	MUTAGEN_BINARY_NAME,
	MUTAGEN_VERSION_FILE,
	PROJECTS_DIR_NAME,
	SKYBOX_HOME_DIR,
	TEMPLATES_DIR_NAME,
	UPDATE_CHECK_FILE,
} from "@lib/constants.ts";

/**
 * Get the SkyBox home directory.
 * Returns fresh value on each call to support dynamic SKYBOX_HOME changes (e.g., in tests).
 */
export const getSkyboxHome = (): string => {
	return process.env.SKYBOX_HOME || join(homedir(), SKYBOX_HOME_DIR);
};

/**
 * Get the path to the config file.
 */
export const getConfigPath = (): string => {
	return join(getSkyboxHome(), CONFIG_FILENAME);
};

/**
 * Get the path to the projects directory.
 */
export const getProjectsDir = (): string => {
	return join(getSkyboxHome(), PROJECTS_DIR_NAME);
};

/**
 * Get the path to the bin directory.
 */
export const getBinDir = (): string => {
	return join(getSkyboxHome(), BIN_DIR_NAME);
};

/**
 * Get the path to the Mutagen binary.
 */
export const getMutagenPath = (): string => {
	return join(getBinDir(), MUTAGEN_BINARY_NAME);
};

/**
 * Get the path to the logs directory.
 */
export const getLogsDir = (): string => {
	return join(getSkyboxHome(), LOGS_DIR_NAME);
};

/**
 * Get the path to the user templates directory.
 */
export const getUserTemplatesDir = (): string => {
	return join(getSkyboxHome(), TEMPLATES_DIR_NAME);
};

/**
 * Get the path to the update check metadata file.
 */
export const getUpdateCheckPath = (): string => {
	return join(getSkyboxHome(), UPDATE_CHECK_FILE);
};

/**
 * Get the path to the file that records the extracted Mutagen version.
 * Used to detect when SkyBox is updated and Mutagen needs re-extraction.
 */
export const getMutagenVersionPath = (): string => {
	return join(getBinDir(), MUTAGEN_VERSION_FILE);
};

/**
 * Get the path to the auto-up log file.
 * Used by shell hooks to log auto-start operations.
 */
export const getAutoUpLogPath = (): string => {
	return join(getLogsDir(), AUTO_UP_LOG_FILE);
};
