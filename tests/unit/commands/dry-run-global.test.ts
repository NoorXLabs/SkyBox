import { describe, expect, test } from "bun:test";

describe("global --dry-run option", () => {
	test("--dry-run flag is accepted by CLI", () => {
		const result = Bun.spawnSync(["bun", "run", "src/index.ts", "--help"], {
			cwd: process.cwd(),
		});
		const output = result.stdout.toString();
		expect(output).toContain("--dry-run");
		expect(output).toContain("Preview commands without executing them");
		expect(output).toContain("Full docs: https://skybox.noorxlabs.com");
	});

	test("--dry-run is not rejected as unknown option", () => {
		const result = Bun.spawnSync(
			[
				"bun",
				"run",
				"src/index.ts",
				"up",
				"test-project",
				"--dry-run",
				"--no-prompt",
			],
			{ cwd: process.cwd() },
		);
		const output = result.stdout.toString() + result.stderr.toString();
		expect(output).not.toContain("unknown option");
	});
});
