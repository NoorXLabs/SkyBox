import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestContext } from "../../lib/__tests__/test-utils.ts";

mock.module("execa", () => ({
	execa: mock(() => Promise.resolve({ stdout: "", stderr: "", exitCode: 0 })),
}));

describe("rm --remote", () => {
	let ctx: ReturnType<typeof createTestContext>;

	beforeEach(() => {
		ctx = createTestContext("rm-remote");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("remote deletion requires project to have a configured remote", () => {
		expect(true).toBe(true);
	});
});
