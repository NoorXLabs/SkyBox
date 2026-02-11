import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import {
	cleanupTestContainers,
	createDockerProjectTestContext,
	type DockerTestContext,
	isDevcontainerCliAvailable,
	isDockerAvailable,
	startDockerProjectContainer,
} from "@tests/integration/helpers/docker-test-utils.ts";
import { execa } from "execa";

const dockerAvailable = await isDockerAvailable();
const devcontainerAvailable = await isDevcontainerCliAvailable();

describe.skipIf(!dockerAvailable || !devcontainerAvailable)(
	"shell entry",
	() => {
		let ctx: DockerTestContext;

		// Global cleanup after all shell entry tests
		afterAll(async () => {
			await cleanupTestContainers();
		});

		beforeEach(async () => {
			ctx = createDockerProjectTestContext("shell");
			await startDockerProjectContainer(ctx);
		});

		afterEach(async () => {
			await ctx.cleanup();
		});

		test("can execute command in running container", async () => {
			// Execute a simple command in the container
			const result = await execa("devcontainer", [
				"exec",
				"--workspace-folder",
				ctx.projectDir,
				"echo",
				"hello-from-container",
			]);

			expect(result.stdout).toContain("hello-from-container");
		}, 60000);
	},
);
