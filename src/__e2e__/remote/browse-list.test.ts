import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	createE2ETestContext,
	type E2ETestContext,
	runTestRemoteCommand,
} from "../helpers/e2e-test-utils.ts";
import { isE2EConfigured } from "../helpers/test-config.ts";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("browse and list remote projects", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = await createE2ETestContext("browse");
		await ctx.setup();

		// Create some test project directories on remote
		await runTestRemoteCommand(
			ctx.testRemote,
			`mkdir -p ${ctx.remotePath}/project-a ${ctx.remotePath}/project-b`,
		);
	});

	afterAll(async () => {
		await ctx.cleanup();
	});

	test("can list directories in remote path", async () => {
		const { stdout } = await runTestRemoteCommand(
			ctx.testRemote,
			`ls -1 ${ctx.remotePath}`,
		);

		const projects = stdout?.trim().split("\n").filter(Boolean) ?? [];
		expect(projects).toContain("project-a");
		expect(projects).toContain("project-b");
	}, 30000);
});
