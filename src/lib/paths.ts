/** Centralized path computation for DevBox directories and binaries. */
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Get the DevBox home directory.
 * Returns fresh value on each call to support dynamic DEVBOX_HOME changes (e.g., in tests).
 */
export function getDevboxHome(): string {
	return process.env.DEVBOX_HOME || join(homedir(), ".devbox");
}

/**
 * Get the path to the config file.
 */
export function getConfigPath(): string {
	return join(getDevboxHome(), "config.yaml");
}

/**
 * Get the path to the projects directory.
 */
export function getProjectsDir(): string {
	return join(getDevboxHome(), "Projects");
}

/**
 * Get the path to the bin directory.
 */
export function getBinDir(): string {
	return join(getDevboxHome(), "bin");
}

/**
 * Get the path to the Mutagen binary.
 */
export function getMutagenPath(): string {
	return join(getBinDir(), "mutagen");
}

/**
 * Get the path to the logs directory.
 */
export function getLogsDir(): string {
	return join(getDevboxHome(), "logs");
}

/**
 * Get the path to the user templates directory.
 */
export function getUserTemplatesDir(): string {
	return join(getDevboxHome(), "templates");
}

/**
 * Get the path to the update check metadata file.
 */
export function getUpdateCheckPath(): string {
	return join(getDevboxHome(), ".update-check.json");
}

/**
 * Get the path to the file that records the extracted Mutagen version.
 * Used to detect when DevBox is updated and Mutagen needs re-extraction.
 */
export function getMutagenVersionPath(): string {
	return join(getBinDir(), ".mutagen-version");
}
