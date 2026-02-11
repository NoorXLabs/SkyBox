/**
 * E2E test configuration utilities.
 * Returns test remote configuration from environment variables.
 */

import type { RemoteEntry } from "@typedefs/index.ts";

/**
 * Returns test remote configuration from environment variables.
 * Uses sensible defaults for local testing when environment is not fully configured.
 */
export const getTestRemoteConfig = (): RemoteEntry => {
	return {
		host: process.env.E2E_HOST || "localhost",
		user: process.env.E2E_USER || "test",
		path: process.env.E2E_PATH || "~/skybox-e2e-tests",
		key: process.env.E2E_SSH_KEY_PATH,
	};
};

/**
 * Check if E2E tests can run (environment configured).
 * Both E2E_HOST and E2E_USER must be set for tests to execute.
 */
export const isE2EConfigured = (): boolean => {
	return !!(process.env.E2E_HOST && process.env.E2E_USER);
};
