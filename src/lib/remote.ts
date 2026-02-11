// operations for interacting with remote servers.

import { escapeRemotePath } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { validateRemoteProjectPath } from "@lib/validation.ts";

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
