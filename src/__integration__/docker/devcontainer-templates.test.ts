import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import {
	createTestConfig,
	createTestRemote,
	writeTestConfig,
} from "@lib/__tests__/test-utils.ts";
import { TEMPLATES } from "@lib/constants.ts";
import { execa } from "execa";
import {
	cleanupTestContainers,
	createDockerTestContext,
	createMinimalDevcontainer,
	type DockerTestContext,
	getContainerIdByProjectPath,
	isDevcontainerCliAvailable,
	isDockerAvailable,
	waitForContainer,
} from "../helpers/docker-test-utils.ts";

const dockerAvailable = await isDockerAvailable();
const devcontainerAvailable = await isDevcontainerCliAvailable();

describe.skipIf(!dockerAvailable || !devcontainerAvailable)(
	"devcontainer templates",
	() => {
		// Global cleanup after all template tests
		afterAll(async () => {
			await cleanupTestContainers();
		});

		// Test each template boots successfully
		for (const template of TEMPLATES) {
			describe(template.name, () => {
				let ctx: DockerTestContext;

				beforeEach(() => {
					ctx = createDockerTestContext(`template-${template.id}`);
					const config = createTestConfig({
						remotes: { test: createTestRemote("test") },
						projects: { [ctx.projectName]: { remote: "test" } },
					});
					writeTestConfig(ctx.testDir, config);
					createMinimalDevcontainer(ctx.projectDir, template.id);
				});

				afterEach(async () => {
					await ctx.cleanup();
				});

				test(`${template.id} template boots successfully`, async () => {
					await execa("devcontainer", [
						"up",
						"--workspace-folder",
						ctx.projectDir,
					]);
					await waitForContainer(ctx.normalizedProjectDir);

					// Verify container is running by finding it via label
					const containerId = await getContainerIdByProjectPath(
						ctx.normalizedProjectDir,
					);
					expect(containerId).not.toBeNull();

					const result = await execa("docker", [
						"inspect",
						"-f",
						"{{.State.Running}}",
						containerId as string,
					]);
					expect(result.stdout.trim()).toBe("true");
				}, 120000); // 2 minute timeout for template tests (image pulls)
			});
		}
	},
);
