import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createE2ETestContext,
	type E2ETestContext,
	escapeShellPath,
	expectRemoteCommandSuccess,
	rsyncFromRemote,
	rsyncToRemote,
	runTestRemoteCommand,
} from "@tests/e2e/helpers/e2e-test-utils.ts";
import { isE2EConfigured } from "@tests/e2e/helpers/test-config.ts";
import {
	createTestConfig,
	writeTestConfig,
} from "@tests/helpers/test-utils.ts";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("rsync push and clone workflow", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = createE2ETestContext("push-clone");
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

		await rsyncToRemote(
			ctx.testRemote,
			`${localProjectDir}/`,
			`${ctx.remotePath}/${ctx.projectName}`,
			{ delete: true },
		);

		// Verify file exists on remote
		const result = await runTestRemoteCommand(
			ctx.testRemote,
			`cat ${escapeShellPath(`${ctx.remotePath}/${ctx.projectName}/marker.txt`)}`,
		);
		expect(expectRemoteCommandSuccess(result)).toBe("test-content-from-e2e");

		// Clone to different local path
		const cloneDir = join(ctx.testDir, "cloned-project");
		mkdirSync(cloneDir, { recursive: true });

		await rsyncFromRemote(
			ctx.testRemote,
			`${ctx.remotePath}/${ctx.projectName}/`,
			cloneDir,
		);

		// Verify clone succeeded
		const clonedContent = readFileSync(join(cloneDir, "marker.txt"), "utf-8");
		expect(clonedContent).toBe("test-content-from-e2e");
	}, 60000); // 60 second timeout for remote operations
});
