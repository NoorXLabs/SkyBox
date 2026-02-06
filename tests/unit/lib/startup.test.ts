import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const mockExecaSync = mock(() => ({ stdout: "", stderr: "", exitCode: 0 }));
mock.module("execa", () => ({ execaSync: mockExecaSync }));

import { runStartupChecks } from "@lib/startup.ts";

const originalConsoleLog = console.log;

describe("runStartupChecks", () => {
	let consoleLogMock: ReturnType<typeof mock>;

	beforeEach(() => {
		mockExecaSync.mockReset();
		consoleLogMock = mock(() => {});
		console.log = consoleLogMock as typeof console.log;
	});

	afterEach(() => {
		console.log = originalConsoleLog;
	});

	test("returns true when Docker is installed and running", () => {
		const result = runStartupChecks();

		expect(result).toBe(true);
		expect(mockExecaSync).toHaveBeenNthCalledWith(1, "docker", ["--version"], {
			stdio: "pipe",
		});
		expect(mockExecaSync).toHaveBeenNthCalledWith(2, "docker", ["info"], {
			stdio: "pipe",
		});
		expect(consoleLogMock.mock.calls).toHaveLength(0);
	});

	test("returns false when Docker is not installed", () => {
		mockExecaSync.mockImplementationOnce(() => {
			throw new Error("docker not found");
		});

		const result = runStartupChecks();

		expect(result).toBe(false);
		expect(mockExecaSync).toHaveBeenCalledTimes(1);
		expect(consoleLogMock.mock.calls.length).toBeGreaterThan(0);
	});

	test("returns false when Docker daemon is not running", () => {
		mockExecaSync.mockImplementationOnce(() => ({
			stdout: "Docker version 0.0.0",
			stderr: "",
			exitCode: 0,
		}));
		mockExecaSync.mockImplementationOnce(() => {
			throw new Error("Cannot connect to the Docker daemon");
		});

		const result = runStartupChecks();

		expect(result).toBe(false);
		expect(mockExecaSync).toHaveBeenCalledTimes(2);
		expect(consoleLogMock.mock.calls.length).toBeGreaterThan(0);
	});
});
