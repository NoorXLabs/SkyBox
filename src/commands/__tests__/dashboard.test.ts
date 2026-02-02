import { describe, expect, test } from "bun:test";

describe("dashboard", () => {
	test("dashboardCommand should be a function", async () => {
		const { dashboardCommand } = await import("@commands/dashboard.tsx");
		expect(typeof dashboardCommand).toBe("function");
	});
});
