import { describe, expect, test } from "bun:test";
import { selectiveSessionName, sessionName } from "@lib/mutagen.ts";

describe("selective sync session naming", () => {
	test("sessionName produces valid name for project", () => {
		const name = sessionName("my-project");
		expect(name).toBe("skybox-my-project");
	});

	test("selective session name includes subpath", () => {
		const name = selectiveSessionName("my-project", "packages/frontend");
		expect(name).toBe("skybox-my-project-packages-frontend");
	});

	test("selective session name sanitizes special characters", () => {
		const name = selectiveSessionName("My Project!", "src/app (v2)");
		expect(name).toBe("skybox-my-project-src-app-v2");
	});
});
