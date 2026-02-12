// operations for interacting with remote servers.

import { escapeRemotePath, escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { warn } from "@lib/ui.ts";
import {
	validateRemotePath,
	validateRemoteProjectPath,
} from "@lib/validation.ts";

// run a remote shell test (-d/-f) for a path and return whether it exists.
export const runRemotePathTest = async (
	host: string,
	path: string,
	testFlag: "-d" | "-f",
): Promise<boolean> => {
	const result = await runRemoteCommand(
		host,
		`test ${testFlag} ${escapeRemotePath(path)} && echo "EXISTS" || echo "NOT_FOUND"`,
	);
	return result.success && result.stdout?.includes("EXISTS") === true;
};

// ensure .skybox/* is listed in the project's .gitignore on the remote.
// creates .gitignore if it doesn't exist, or appends the entry if missing.
// non-fatal: logs a warning on failure but never throws.
export const ensureGitignoreSkybox = async (
	host: string,
	projectPath: string,
): Promise<{
	success: boolean;
	action?: "created" | "appended" | "exists";
}> => {
	const pathCheck = validateRemotePath(projectPath);
	if (!pathCheck.valid) {
		warn("Could not update .gitignore on remote: invalid path");
		return { success: false };
	}

	const gitignorePath = `${projectPath}/.gitignore`;
	const escapedPath = escapeRemotePath(gitignorePath);
	const entry = ".skybox";
	const block = `# SkyBox local state\n${entry}`;
	const escapedEntry = escapeShellArg(entry);
	const escapedBlock = escapeShellArg(block);

	// Single SSH command: check if .gitignore exists and if entry is present,
	// then create or append as needed.
	const script = [
		`if [ -f ${escapedPath} ]; then`,
		`  if grep -qxF ${escapedEntry} ${escapedPath}; then`,
		`    echo "EXISTS"`,
		`  else`,
		`    if [ -n "$(tail -c1 ${escapedPath})" ]; then printf '\\n' >> ${escapedPath}; fi`,
		`    printf '\\n%s\\n' ${escapedBlock} >> ${escapedPath}`,
		`    echo "APPENDED"`,
		`  fi`,
		`else`,
		`  printf '%s\\n' ${escapedBlock} > ${escapedPath}`,
		`  echo "CREATED"`,
		`fi`,
	].join("\n");

	try {
		const result = await runRemoteCommand(host, script);

		if (!result.success) {
			warn("Could not update .gitignore on remote");
			return { success: false };
		}

		const output = result.stdout?.trim();
		if (output === "EXISTS") {
			return { success: true, action: "exists" };
		}
		if (output === "APPENDED") {
			return { success: true, action: "appended" };
		}
		if (output === "CREATED") {
			return { success: true, action: "created" };
		}

		return { success: true };
	} catch {
		warn("Could not update .gitignore on remote");
		return { success: false };
	}
};

// check if a project directory exists on the remote server.
export const checkRemoteProjectExists = async (
	host: string,
	basePath: string,
	project: string,
): Promise<boolean> => {
	const pathCheck = validateRemoteProjectPath(project);
	if (!pathCheck.valid) {
		return false;
	}
	const fullPath = `${basePath}/${project}`;
	return runRemotePathTest(host, fullPath, "-d");
};
