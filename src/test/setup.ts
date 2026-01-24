// src/test/setup.ts
// Test setup that runs before all tests via bunfig.toml preload

import { mock } from "bun:test";

// Create a properly typed mock for execa
export const mockExeca = mock(() =>
	Promise.resolve({ stdout: "", stderr: "", exitCode: 0 }),
);

// Mock execa globally before any test imports it
mock.module("execa", () => ({
	execa: mockExeca,
}));

// Create mock for runRemoteCommand (used by lock tests)
export const mockRunRemoteCommand = mock(
	(
		_host: string,
		_command: string,
	): Promise<{ success: boolean; stdout?: string; error?: string }> =>
		Promise.resolve({ success: true, stdout: "" }),
);

// Import original ssh module exports to re-export
import * as originalSsh from "../lib/ssh.ts";

// Mock ssh module with runRemoteCommand mocked but other functions preserved
mock.module("../lib/ssh.ts", () => ({
	...originalSsh,
	runRemoteCommand: mockRunRemoteCommand,
}));
