// src/lib/__tests__/test-utils.ts
// Shared utilities for test skip logic

import { execa } from "execa";

/**
 * Check if execa module is mocked by another test file.
 * When mocked, execa won't execute real commands properly.
 */
export const isExecaMocked = async (): Promise<boolean> => {
	try {
		const result = await execa("echo", ["test"]);
		return (
			typeof result?.stdout !== "string" || result.stdout.trim() !== "test"
		);
	} catch {
		return true;
	}
};

/**
 * Check if Docker is available on the system.
 */
export const isDockerAvailable = async (): Promise<boolean> => {
	try {
		const result = await execa("docker", ["info"], { timeout: 5000 });
		return result.exitCode === 0;
	} catch {
		return false;
	}
};
