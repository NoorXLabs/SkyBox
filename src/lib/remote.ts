/**
 * @file remote.ts
 * @description Operations for interacting with remote servers.
 */

import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";

/**
 * Check if a project directory exists on the remote server.
 */
export async function checkRemoteProjectExists(
	host: string,
	basePath: string,
	project: string,
): Promise<boolean> {
	const fullPath = `${basePath}/${project}`;
	const result = await runRemoteCommand(
		host,
		`test -d ${escapeShellArg(fullPath)} && echo "EXISTS" || echo "NOT_FOUND"`,
	);
	return result.stdout?.includes("EXISTS") ?? false;
}
