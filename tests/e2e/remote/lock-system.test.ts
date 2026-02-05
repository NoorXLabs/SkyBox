import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { hostname } from "node:os";
import { escapeShellArg } from "@lib/shell.ts";
import {
	createE2ETestContext,
	type E2ETestContext,
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
		await runTestRemoteCommand(
			ctx.testRemote,
			`mkdir -p ~/.devbox-locks && echo "${encodedContent}" | base64 -d > ${escapeShellArg(lockPath)}`,
		);

		// Verify lock exists
		const { stdout: lockExists } = await runTestRemoteCommand(
			ctx.testRemote,
			`test -f ${escapeShellArg(lockPath)} && echo "exists" || echo "missing"`,
		);
		expect(lockExists?.trim()).toBe("exists");

		// Remove lock
		await runTestRemoteCommand(
			ctx.testRemote,
			`rm -f ${escapeShellArg(lockPath)}`,
		);

		// Verify lock removed
		const { stdout: lockRemoved } = await runTestRemoteCommand(
			ctx.testRemote,
			`test -f ${escapeShellArg(lockPath)} && echo "exists" || echo "missing"`,
		);
		expect(lockRemoved?.trim()).toBe("missing");
	}, 30000);
});
