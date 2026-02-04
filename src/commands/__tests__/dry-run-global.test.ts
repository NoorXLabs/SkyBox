import { describe, expect, test } from "bun:test";

describe("global --dry-run option", () => {
	test("--dry-run flag is accepted by CLI", async () => {
		const { execSync } = await import("node:child_process");
		const output = execSync("bun run src/index.ts --help", {
			encoding: "utf-8",
			cwd: "/Users/noorchasib/conductor/workspaces/DevBox/dhaka-v1",
		});
		expect(output).toContain("--dry-run");
		expect(output).toContain("Preview commands without executing them");
	});
});
