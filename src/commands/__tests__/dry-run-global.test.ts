import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";

const cwd = "/Users/noorchasib/conductor/workspaces/DevBox/dhaka-v1";

describe("global --dry-run option", () => {
	test("--dry-run flag is accepted by CLI", () => {
		const output = execSync("bun run src/index.ts --help", {
			encoding: "utf-8",
			cwd,
		});
		expect(output).toContain("--dry-run");
		expect(output).toContain("Preview commands without executing them");
	});

	test("--dry-run is not rejected as unknown option", () => {
		// Run a command that will fail for config reasons, but NOT for "unknown option"
		try {
			execSync(
				"bun run src/index.ts up test-project --dry-run --no-prompt 2>&1",
				{
					encoding: "utf-8",
					cwd,
				},
			);
		} catch (err: unknown) {
			const output = (err as { stdout?: string; stderr?: string }).stdout ?? "";
			const stderr = (err as { stdout?: string; stderr?: string }).stderr ?? "";
			expect(output + stderr).not.toContain("unknown option");
		}
	});
});
