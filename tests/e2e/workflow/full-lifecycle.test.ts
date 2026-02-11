import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escapeShellArg } from "@lib/shell.ts";
import {
	createE2ETestContext,
	type E2ETestContext,
	expectRemoteCommandSuccess,
	rsyncToRemote,
	runTestRemoteCommand,
} from "@tests/e2e/helpers/e2e-test-utils.ts";
import { isE2EConfigured } from "@tests/e2e/helpers/test-config.ts";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("full lifecycle workflow", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = await createE2ETestContext("lifecycle");
		await ctx.setup();
	});

	afterAll(async () => {
		await ctx.cleanup();
	});

	test("complete init -> push -> verify workflow", async () => {
		// Step 1: Create a project structure locally
		const projectDir = join(ctx.testDir, "Projects", ctx.projectName);
		mkdirSync(projectDir, { recursive: true });

		// Add project files
		writeFileSync(join(projectDir, "README.md"), "# Test Project\n");
		writeFileSync(join(projectDir, "index.ts"), "console.log('hello');\n");

		// Step 2: Push to remote
		await rsyncToRemote(
			ctx.testRemote,
			`${projectDir}/`,
			`${ctx.remotePath}/${ctx.projectName}`,
			{ delete: true },
		);

		// Step 3: Verify files on remote
		const listResult = await runTestRemoteCommand(
			ctx.testRemote,
			`ls -1 ${escapeShellArg(`${ctx.remotePath}/${ctx.projectName}`)}`,
		);
		const files = expectRemoteCommandSuccess(listResult).split("\n");
		expect(files).toContain("README.md");
		expect(files).toContain("index.ts");

		// Step 4: Verify content matches
		const contentResult = await runTestRemoteCommand(
			ctx.testRemote,
			`cat ${escapeShellArg(`${ctx.remotePath}/${ctx.projectName}/index.ts`)}`,
		);
		expect(expectRemoteCommandSuccess(contentResult)).toBe(
			"console.log('hello');",
		);
	}, 60000);
});
