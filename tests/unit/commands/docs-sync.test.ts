import { describe, expect, test } from "bun:test";

describe("command docs sync", () => {
	test("generated command docs are up to date", () => {
		const result = Bun.spawnSync(
			["bun", "run", "scripts/sync-command-reference.ts", "--check"],
			{
				cwd: process.cwd(),
			},
		);

		const output = result.stdout.toString() + result.stderr.toString();
		expect(result.exitCode).toBe(0);
		expect(output).toContain("Command reference is up to date.");
	});
});
