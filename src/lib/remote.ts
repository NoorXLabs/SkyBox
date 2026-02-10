// operations for interacting with remote servers.

import { escapeRemotePath } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { validateRemoteProjectPath } from "@lib/validation.ts";

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
	const result = await runRemoteCommand(
		host,
		`test -d ${escapeRemotePath(fullPath)} && echo "EXISTS" || echo "NOT_FOUND"`,
	);
	return result.stdout?.includes("EXISTS") ?? false;
};
