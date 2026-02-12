// centralized path computation for SkyBox directories and binaries.
import { realpathSync } from "node:fs";
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

// get the SkyBox home directory.
// returns fresh value on each call to support dynamic SKYBOX_HOME changes (e.g., in tests).
export const getSkyboxHome = (): string => {
	return process.env.SKYBOX_HOME || join(homedir(), SKYBOX_HOME_DIR);
};

// get the path to the config file.
export const getConfigPath = (): string => {
	return join(getSkyboxHome(), CONFIG_FILENAME);
};

// get the path to the projects directory.
export const getProjectsDir = (): string => {
	return join(getSkyboxHome(), PROJECTS_DIR_NAME);
};

// get the path to the bin directory.
export const getBinDir = (): string => {
	return join(getSkyboxHome(), BIN_DIR_NAME);
};

// get the path to the Mutagen binary.
export const getMutagenPath = (): string => {
	return join(getBinDir(), MUTAGEN_BINARY_NAME);
};

// get the path to the logs directory.
export const getLogsDir = (): string => {
	return join(getSkyboxHome(), LOGS_DIR_NAME);
};

// get the path to the user templates directory.
export const getUserTemplatesDir = (): string => {
	return join(getSkyboxHome(), TEMPLATES_DIR_NAME);
};

// get the path to the update check metadata file.
export const getUpdateCheckPath = (): string => {
	return join(getSkyboxHome(), UPDATE_CHECK_FILE);
};

// get the path to the file that records the extracted Mutagen version.
// used to detect when SkyBox is updated and Mutagen needs re-extraction.
export const getMutagenVersionPath = (): string => {
	return join(getBinDir(), MUTAGEN_VERSION_FILE);
};

// get the path to the auto-up log file.
// used by shell hooks to log auto-start operations.
export const getAutoUpLogPath = (): string => {
	return join(getLogsDir(), AUTO_UP_LOG_FILE);
};

// resolve a path to its real location, falling back to the original path on error.
export const safeRealpathSync = (path: string): string => {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
};

// replace the user's home directory with ~ for display purposes.
export const replaceHomedir = (str: string): string => {
	const home = homedir();
	if (str.includes(home)) {
		return str.replaceAll(home, "~");
	}
	return str;
};
