// src/lib/__tests__/mutagen.test.ts
import { describe, expect, test } from "bun:test";
import { sessionName } from "@lib/mutagen.ts";

describe("mutagen", () => {
	test("sessionName formats correctly", () => {
		expect(sessionName("myapp")).toBe("devbox-myapp");
		expect(sessionName("my-project")).toBe("devbox-my-project");
	});

	test("sessionName handles special characters", () => {
		expect(sessionName("app_v2")).toBe("devbox-app_v2");
	});
});
