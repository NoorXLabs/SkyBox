import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runCli = (...args: string[]) => {
	const skyboxHome = mkdtempSync(join(tmpdir(), "skybox-help-test-"));

	try {
		// Keep update checks local and cached so help tests do not depend on network.
		writeFileSync(
			join(skyboxHome, ".update-check.json"),
			JSON.stringify({
				lastCheck: new Date().toISOString(),
				latestVersion: null,
				latestStableVersion: null,
			}),
		);

		const result = Bun.spawnSync(["bun", "run", "src/index.ts", ...args], {
			cwd: process.cwd(),
			env: {
				...process.env,
				SKYBOX_HOME: skyboxHome,
			},
		});

		return {
			exitCode: result.exitCode,
			output: result.stdout.toString() + result.stderr.toString(),
		};
	} finally {
		rmSync(skyboxHome, { recursive: true, force: true });
	}
};

describe("help output", () => {
	test("root help includes command summaries and docs link", () => {
		const result = runCli("--help");
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("Commands:");
		expect(result.output).toContain("init");
		expect(result.output).toContain("Interactive setup wizard");
		expect(result.output).toContain("Quick start:");
		expect(result.output).toContain(
			"skybox clone <project>          Clone a project locally",
		);
		expect(result.output).toContain("Full docs: https://skybox.noorxlabs.com");
	});

	test("browse help includes detailed context and examples", () => {
		const result = runCli("help", "browse");
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("list available projects");
		expect(result.output).toContain("current git branch");
		expect(result.output).toContain("Examples:");
		expect(result.output).toContain("skybox browse");
		expect(result.output).toContain(
			"Use this before 'skybox clone' to discover remote project names.",
		);
	});

	test("up help includes practical examples and notes", () => {
		const result = runCli("help", "up");
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain(
			"Use --rebuild after devcontainer changes.",
		);
		expect(result.output).toContain("skybox up my-api --no-prompt");
		expect(result.output).toContain("Start all local projects");
	});
});
