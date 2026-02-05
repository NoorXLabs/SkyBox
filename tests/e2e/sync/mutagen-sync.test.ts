import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escapeShellArg } from "@lib/shell.ts";
import {
	createE2ETestContext,
	type E2ETestContext,
	runTestRemoteCommand,
	withRetry,
} from "@tests/e2e/helpers/e2e-test-utils.ts";
import { isE2EConfigured } from "@tests/e2e/helpers/test-config.ts";
import { execa } from "execa";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("file synchronization", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = await createE2ETestContext("sync");
		await ctx.setup();
	});

	afterAll(async () => {
		await ctx.cleanup();
	});

	test("files can be synced to remote and back", async () => {
		// Create local file
		const localDir = join(ctx.testDir, "sync-test");
		mkdirSync(localDir, { recursive: true });
		writeFileSync(join(localDir, "sync-marker.txt"), "synced-content");

		const rsyncSshArgs = ctx.testRemote.key
			? ["-e", `ssh -i ${ctx.testRemote.key}`]
			: [];

		// Sync to remote using rsync
		const remotePath = `${ctx.testRemote.user}@${ctx.testRemote.host}:${ctx.remotePath}/sync-test`;
		await withRetry(() =>
			execa("rsync", ["-az", ...rsyncSshArgs, `${localDir}/`, remotePath]),
		);

		// Verify on remote
		const { stdout } = await runTestRemoteCommand(
			ctx.testRemote,
			`cat ${escapeShellArg(`${ctx.remotePath}/sync-test/sync-marker.txt`)}`,
		);
		expect(stdout?.trim()).toBe("synced-content");

		// Modify on remote
		await runTestRemoteCommand(
			ctx.testRemote,
			`echo "modified-on-remote" > ${escapeShellArg(`${ctx.remotePath}/sync-test/sync-marker.txt`)}`,
		);

		// Sync back
		const pullDir = join(ctx.testDir, "sync-pulled");
		mkdirSync(pullDir, { recursive: true });
		await withRetry(() =>
			execa("rsync", ["-az", ...rsyncSshArgs, `${remotePath}/`, pullDir]),
		);

		// Verify modification synced
		const pulledContent = readFileSync(
			join(pullDir, "sync-marker.txt"),
			"utf-8",
		);
		expect(pulledContent.trim()).toBe("modified-on-remote");
	}, 60000);
});
