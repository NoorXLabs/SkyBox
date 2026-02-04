/**
 * E2E test utilities for remote server tests.
 * Provides test context creation, cleanup, and retry mechanisms.
 */

import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import type { RemoteEntry } from "@typedefs/index.ts";
import { getTestRemoteConfig } from "./test-config.ts";

/** Options for the retry wrapper */
export interface RetryOptions {
	/** Maximum number of attempts (default: 3) */
	attempts?: number;
	/** Base delay in milliseconds between retries (default: 1000) */
	delay?: number;
	/** Called when a retry is about to happen */
	onRetry?: (error: Error, attempt: number) => void;
}

/** E2E test context with remote configuration and cleanup utilities */
export interface E2ETestContext {
	/** Unique identifier for this test run: {timestamp}-{random6chars} */
	runId: string;
	/** Test remote configuration */
	testRemote: RemoteEntry;
	/** Generated project name: test-{name}-{runId} */
	projectName: string;
	/** Remote test directory path: ~/devbox-e2e-tests/run-{runId} */
	remotePath: string;
	/** Local temporary directory for test files */
	testDir: string;
	/** Creates remote directory via SSH */
	setup: () => Promise<void>;
	/** Removes remote directory and stale locks, cleans up local test dir */
	cleanup: () => Promise<void>;
}

/**
 * Generates a unique run ID for test isolation.
 * Format: {timestamp}-{random6chars}
 */
function generateRunId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `${timestamp}-${random}`;
}

/**
 * Validates that a test name contains only safe characters.
 * Rejects names with shell metacharacters to prevent injection
 * when the name flows into remote SSH commands via path interpolation.
 *
 * @param name - Test name to validate
 * @throws Error if name contains unsafe characters
 */
function validateTestName(name: string): void {
	if (!/^[a-zA-Z0-9-]+$/.test(name)) {
		throw new Error(
			`Invalid test name "${name}": only alphanumeric characters and hyphens are allowed`,
		);
	}
}

/**
 * Creates an E2E test context with unique identifiers and cleanup utilities.
 * Sets DEVBOX_HOME to the test directory for proper config isolation.
 *
 * @param name - Test name used to generate project name (alphanumeric and hyphens only)
 * @returns E2ETestContext with setup and cleanup methods
 */
export function createE2ETestContext(name: string): E2ETestContext {
	validateTestName(name);
	// runId is internally generated from Date.now() and Math.random().toString(36),
	// producing only digits, lowercase letters, and a hyphen — safe for shell interpolation.
	const runId = generateRunId();
	const testRemote = getTestRemoteConfig();
	const projectName = `test-${name}-${runId}`;
	const remotePath = `~/devbox-e2e-tests/run-${runId}`;
	const testDir = join(tmpdir(), `devbox-e2e-${runId}`);

	// Store original DEVBOX_HOME for restoration
	const originalDevboxHome = process.env.DEVBOX_HOME;

	return {
		runId,
		testRemote,
		projectName,
		remotePath,
		testDir,

		async setup(): Promise<void> {
			// Create local test directory
			mkdirSync(testDir, { recursive: true });

			// Set DEVBOX_HOME for test isolation
			process.env.DEVBOX_HOME = testDir;

			// Create remote test directory
			const host = testRemote.user
				? `${testRemote.user}@${testRemote.host}`
				: testRemote.host;

			const result = await runRemoteCommand(
				host,
				`mkdir -p ${escapeShellArg(remotePath)}`,
				testRemote.key,
			);

			if (!result.success) {
				throw new Error(`Failed to create remote directory: ${result.error}`);
			}
		},

		async cleanup(): Promise<void> {
			// Clean up remote test directory
			await cleanupRemoteTestDir(runId, testRemote);

			// Clean up stale test locks
			await cleanupStaleLocks(testRemote);

			// Clean up local test directory
			rmSync(testDir, { recursive: true, force: true });

			// Restore original DEVBOX_HOME
			if (originalDevboxHome) {
				process.env.DEVBOX_HOME = originalDevboxHome;
			} else {
				delete process.env.DEVBOX_HOME;
			}
		},
	};
}

/**
 * Retry wrapper for flaky operations with exponential backoff.
 *
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all attempts fail
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const { attempts = 3, delay = 1000, onRetry } = options;

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < attempts) {
				onRetry?.(lastError, attempt);
				// Exponential backoff: delay * attempt
				const backoffDelay = delay * attempt;
				await new Promise((resolve) => setTimeout(resolve, backoffDelay));
			}
		}
	}

	throw lastError;
}

/**
 * Removes the test directory on the remote server.
 *
 * @param runId - The test run ID used to identify the directory
 * @param remote - Remote server configuration
 */
export async function cleanupRemoteTestDir(
	runId: string,
	remote: RemoteEntry,
): Promise<void> {
	const remotePath = `~/devbox-e2e-tests/run-${runId}`;
	const host = remote.user ? `${remote.user}@${remote.host}` : remote.host;

	await runRemoteCommand(
		host,
		`rm -rf ${escapeShellArg(remotePath)}`,
		remote.key,
	);
}

/**
 * Finds and deletes test-* locks on the remote server.
 * Locks matching the pattern test-* in ~/.devbox-locks/ are removed.
 *
 * @param remote - Remote server configuration
 */
export async function cleanupStaleLocks(remote: RemoteEntry): Promise<void> {
	const host = remote.user ? `${remote.user}@${remote.host}` : remote.host;

	// Find and delete test-* locks
	await runRemoteCommand(
		host,
		"rm -f ~/.devbox-locks/test-*.lock 2>/dev/null || true",
		remote.key,
	);
}

/**
 * Wrapper around runRemoteCommand for test convenience.
 * Constructs the SSH host string from the remote configuration.
 *
 * @param remote - Remote server configuration
 * @param command - Command to execute on the remote server
 * @returns Command result with success status, stdout, and error
 */
export async function runTestRemoteCommand(
	remote: RemoteEntry,
	command: string,
): Promise<{ success: boolean; stdout?: string; error?: string }> {
	const host = remote.user ? `${remote.user}@${remote.host}` : remote.host;
	return runRemoteCommand(host, command, remote.key);
}
