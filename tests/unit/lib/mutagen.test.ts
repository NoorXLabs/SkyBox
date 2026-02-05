// tests/unit/lib/mutagen.test.ts
import { describe, expect, test } from "bun:test";
import { sessionName } from "@lib/mutagen.ts";

describe("mutagen", () => {
	test("sessionName formats correctly", () => {
		expect(sessionName("myapp")).toBe("skybox-myapp");
		expect(sessionName("my-project")).toBe("skybox-my-project");
	});

	test("sessionName handles special characters", () => {
		expect(sessionName("app_v2")).toBe("skybox-app_v2");
	});
});
