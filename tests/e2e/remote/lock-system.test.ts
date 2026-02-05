import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { hostname } from "node:os";
import {
	createE2ETestContext,
	type E2ETestContext,
	escapeShellPath,
	runTestRemoteCommand,
} from "@tests/e2e/helpers/e2e-test-utils.ts";
import { isE2EConfigured } from "@tests/e2e/helpers/test-config.ts";

const e2eConfigured = isE2EConfigured();

describe.skipIf(!e2eConfigured)("lock system", () => {
	let ctx: E2ETestContext;

	beforeAll(async () => {
		ctx = await createE2ETestContext("locks");
		await ctx.setup();
	});

	afterAll(async () => {
		await ctx.cleanup();
	});

	test("can create and remove lock file on remote", async () => {
		const lockPath = `~/.devbox-locks/${ctx.projectName}.lock`;
		const machine = hostname();
		const lockContent = JSON.stringify({
			machine,
			user: ctx.testRemote.user,
			timestamp: new Date().toISOString(),
			pid: process.pid,
		});

		// Create lock using base64 encoding to avoid shell injection issues
		const encodedContent = Buffer.from(lockContent).toString("base64");
		const createResult = await runTestRemoteCommand(
			ctx.testRemote,
			`mkdir -p ~/.devbox-locks && echo "${encodedContent}" | base64 -d > ${escapeShellPath(lockPath)}`,
		);
		expect(createResult.success).toBe(true);

		// Verify lock exists
		const verifyResult = await runTestRemoteCommand(
			ctx.testRemote,
			`test -f ${escapeShellPath(lockPath)} && echo "exists" || echo "missing"`,
		);
		expect(verifyResult.success).toBe(true);
		expect(verifyResult.stdout?.trim()).toBe("exists");

		// Remove lock
		const removeResult = await runTestRemoteCommand(
			ctx.testRemote,
			`rm -f ${escapeShellPath(lockPath)}`,
		);
		expect(removeResult.success).toBe(true);

		// Verify lock removed
		const verifyRemovedResult = await runTestRemoteCommand(
			ctx.testRemote,
			`test -f ${escapeShellPath(lockPath)} && echo "exists" || echo "missing"`,
		);
		expect(verifyRemovedResult.success).toBe(true);
		expect(verifyRemovedResult.stdout?.trim()).toBe("missing");
	}, 30000);
});
