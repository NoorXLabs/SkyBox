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
import {
	createTestConfig,
	writeTestConfig,
} from "@tests/helpers/test-utils.ts";
import { execa } from "execa";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("rsync push and clone workflow", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = await createE2ETestContext("push-clone");
		await ctx.setup();

		// Write config with test remote
		const config = createTestConfig({
			remotes: {
				e2e: {
					host: ctx.testRemote.host,
					user: ctx.testRemote.user,
					path: ctx.remotePath,
					key: ctx.testRemote.key,
				},
			},
			projects: {
				[ctx.projectName]: { remote: "e2e" },
			},
		});
		writeTestConfig(ctx.testDir, config);
	});

	afterAll(async () => {
		await ctx.cleanup();
	});

	test("rsync project to remote, then rsync it back", async () => {
		// Create local project with a marker file
		const localProjectDir = join(ctx.testDir, "Projects", ctx.projectName);
		mkdirSync(localProjectDir, { recursive: true });
		writeFileSync(join(localProjectDir, "marker.txt"), "test-content-from-e2e");

		const rsyncSshArgs = ctx.testRemote.key
			? ["-e", `ssh -i ${ctx.testRemote.key}`]
			: [];

		// Push to remote using rsync (what devbox push does internally)
		await withRetry(async () => {
			const remotePath = `${ctx.testRemote.user}@${ctx.testRemote.host}:${ctx.remotePath}/${ctx.projectName}`;
			await execa("rsync", [
				"-az",
				...rsyncSshArgs,
				"--delete",
				`${localProjectDir}/`,
				remotePath,
			]);
		});

		// Verify file exists on remote
		const result = await runTestRemoteCommand(
			ctx.testRemote,
			`cat ${escapeShellArg(`${ctx.remotePath}/${ctx.projectName}/marker.txt`)}`,
		);
		expect(result.success).toBe(true);
		expect(result.stdout?.trim()).toBe("test-content-from-e2e");

		// Clone to different local path
		const cloneDir = join(ctx.testDir, "cloned-project");
		mkdirSync(cloneDir, { recursive: true });

		await withRetry(async () => {
			const remotePath = `${ctx.testRemote.user}@${ctx.testRemote.host}:${ctx.remotePath}/${ctx.projectName}/`;
			await execa("rsync", ["-az", ...rsyncSshArgs, remotePath, cloneDir]);
		});

		// Verify clone succeeded
		const clonedContent = readFileSync(join(cloneDir, "marker.txt"), "utf-8");
		expect(clonedContent).toBe("test-content-from-e2e");
	}, 60000); // 60 second timeout for remote operations
});
