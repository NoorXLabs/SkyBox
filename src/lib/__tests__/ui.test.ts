import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { dryRun } from "@lib/ui.ts";

describe("dryRun output helper", () => {
	let output: string[];
	const originalLog = console.log;

	beforeEach(() => {
		output = [];
		console.log = (...args: unknown[]) => {
			output.push(args.map(String).join(" "));
		};
	});

	afterEach(() => {
		console.log = originalLog;
	});

	test("prints message with [dry-run] prefix", () => {
		dryRun("Would start container at /path/to/project");
		expect(output.length).toBe(1);
		expect(output[0]).toContain("[dry-run]");
		expect(output[0]).toContain("Would start container at /path/to/project");
	});
});
