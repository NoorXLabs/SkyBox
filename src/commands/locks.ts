// src/commands/locks.ts

import { getRemoteHost, selectRemote } from "@commands/remote.ts";
import { configExists, loadConfig } from "@lib/config.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { createLockRemoteInfo, getAllLockStatuses } from "@lib/lock.ts";
import { error, header, info, spinner } from "@lib/ui.ts";
import type { LockStatus } from "@typedefs/index.ts";
import chalk from "chalk";

function formatLockRow(project: string, status: LockStatus): string {
	if (!status.locked) {
		return `  ${project.padEnd(30)}  ${chalk.dim("unlocked")}`;
	}
	if (status.ownedByMe) {
		return `  ${project.padEnd(30)}  ${chalk.yellow("locked (you)")}  ${chalk.dim(status.info.timestamp)}`;
	}
	return `  ${project.padEnd(30)}  ${chalk.red(`locked (${status.info.machine})`)}  ${chalk.dim(status.info.timestamp)}`;
}

export async function locksCommand(): Promise<void> {
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);
	const remoteInfo = createLockRemoteInfo(remote);

	const spin = spinner(`Checking locks on ${remoteName}...`);

	try {
		const statuses = await getAllLockStatuses(remoteInfo);
		spin.stop();

		if (statuses.size === 0) {
			console.log();
			console.log("No lock files found on remote.");
			info("Locks are created when someone runs 'devbox up'.");
			return;
		}

		header(`Locks on ${host}:`);
		console.log();
		console.log(
			chalk.dim(`  ${"PROJECT".padEnd(30)}  ${"STATUS".padEnd(25)}  SINCE`),
		);

		// Show locked projects first, then unlocked
		const locked: [string, LockStatus][] = [];
		const unlocked: [string, LockStatus][] = [];
		for (const [project, status] of statuses) {
			if (status.locked) {
				locked.push([project, status]);
			} else {
				unlocked.push([project, status]);
			}
		}

		for (const [project, status] of [...locked, ...unlocked]) {
			console.log(formatLockRow(project, status));
		}
		console.log();
	} catch (err: unknown) {
		spin.fail("Failed to connect to remote");
		error(getErrorMessage(err) || "Check your SSH config.");
		process.exit(1);
	}
}
