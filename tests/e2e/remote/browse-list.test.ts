import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { escapeShellArg } from "@lib/shell.ts";
import {
	createE2ETestContext,
	type E2ETestContext,
	runTestRemoteCommand,
} from "@tests/e2e/helpers/e2e-test-utils.ts";
import { isE2EConfigured } from "@tests/e2e/helpers/test-config.ts";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("browse and list remote projects", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = await createE2ETestContext("browse");
		await ctx.setup();

		// Create some test project directories on remote
		const setupResult = await runTestRemoteCommand(
			ctx.testRemote,
			`mkdir -p ${escapeShellArg(`${ctx.remotePath}/project-a`)} ${escapeShellArg(`${ctx.remotePath}/project-b`)}`,
		);
		expect(setupResult.success).toBe(true);
	});

	afterAll(async () => {
		await ctx.cleanup();
	});

	test("can list directories in remote path", async () => {
		const result = await runTestRemoteCommand(
			ctx.testRemote,
			`ls -1 ${escapeShellArg(ctx.remotePath)}`,
		);
		expect(result.success).toBe(true);

		const projects = result.stdout?.trim().split("\n").filter(Boolean) ?? [];
		expect(projects).toContain("project-a");
		expect(projects).toContain("project-b");
	}, 30000);
});
