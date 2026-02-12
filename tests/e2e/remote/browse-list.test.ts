import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	createE2ETestContext,
	type E2ETestContext,
	escapeShellPath,
	expectRemoteCommandSuccess,
	runTestRemoteCommand,
} from "@tests/e2e/helpers/e2e-test-utils.ts";
import { isE2EConfigured } from "@tests/e2e/helpers/test-config.ts";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("browse and list remote projects", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = createE2ETestContext("browse");
		await ctx.setup();

		// Create some test project directories on remote
		const setupResult = await runTestRemoteCommand(
			ctx.testRemote,
			`mkdir -p ${escapeShellPath(`${ctx.remotePath}/project-a`)} ${escapeShellPath(`${ctx.remotePath}/project-b`)}`,
		);
		expectRemoteCommandSuccess(setupResult);
	});

	afterAll(async () => {
		await ctx.cleanup();
	});

	test("can list directories in remote path", async () => {
		const result = await runTestRemoteCommand(
			ctx.testRemote,
			`ls -1 ${escapeShellPath(ctx.remotePath)}`,
		);
		const output = expectRemoteCommandSuccess(result);

		const projects = output.split("\n").filter(Boolean);
		expect(projects).toContain("project-a");
		expect(projects).toContain("project-b");
	}, 30000);
});
