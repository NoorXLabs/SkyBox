/**
 * @file remote.ts
 * @description Operations for interacting with remote servers.
 */

import { runRemoteCommand } from "@lib/ssh.ts";

/**
 * Check if a project directory exists on the remote server.
 */
export async function checkRemoteProjectExists(
	host: string,
	basePath: string,
	project: string,
): Promise<boolean> {
	const result = await runRemoteCommand(
		host,
		`test -d "${basePath}/${project}" && echo "EXISTS" || echo "NOT_FOUND"`,
	);
	return result.stdout?.includes("EXISTS") ?? false;
}
