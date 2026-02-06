/**
 * E2E test utilities for remote server tests.
 * Provides test context creation, cleanup, and retry mechanisms.
 */

import { expect } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { getTestRemoteConfig } from "@tests/e2e/helpers/test-config.ts";
import type { RemoteEntry } from "@typedefs/index.ts";
import { execa } from "execa";

/**
 * Escapes a shell argument, handling tilde-prefixed paths correctly.
 * Standard escapeShellArg wraps in single quotes, which prevents bash
 * tilde expansion. This helper splits off the leading ~/ and uses $HOME
 * expansion instead, keeping the rest properly escaped.
 *
 * @param arg - The argument to escape
 * @returns Shell-safe string with tilde resolved to "$HOME"
 */
export function escapeShellPath(arg: string): string {
	if (arg.startsWith("~/")) {
		// Use "$HOME" (double-quoted to handle spaces) + escaped remainder
		return `"$HOME"/${escapeShellArg(arg.slice(2))}`;
	}
	return escapeShellArg(arg);
}

/** Options for the retry wrapper */
export interface RetryOptions {
	/** Maximum number of attempts (default: 3) */
	attempts?: number;
	/** Base delay in milliseconds between retries (default: 1000) */
	delay?: number;
	/** Called when a retry is about to happen */
	onRetry?: (error: Error, attempt: number) => void;
}

export interface RemoteCommandResult {
	success: boolean;
	stdout?: string;
	error?: string;
}

/** E2E test context with remote configuration and cleanup utilities */
export interface E2ETestContext {
	/** Unique identifier for this test run: {timestamp}-{random6chars} */
	runId: string;
	/** Test remote configuration */
	testRemote: RemoteEntry;
	/** Generated project name: test-{name}-{runId} */
	projectName: string;
	/** Remote test directory path: ~/skybox-e2e-tests/run-{runId} */
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
 * Returns the SSH host string from a remote entry.
 */
function getRemoteHost(remote: RemoteEntry): string {
	return remote.user ? `${remote.user}@${remote.host}` : remote.host;
}

/**
 * Creates an E2E test context with unique identifiers and cleanup utilities.
 * Sets SKYBOX_HOME to the test directory for proper config isolation.
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
	const remotePath = `~/skybox-e2e-tests/run-${runId}`;
	const testDir = join(tmpdir(), `skybox-e2e-${runId}`);

	// Store original SKYBOX_HOME for restoration
	const originalSkyboxHome = process.env.SKYBOX_HOME;

	return {
		runId,
		testRemote,
		projectName,
		remotePath,
		testDir,

		async setup(): Promise<void> {
			// Create local test directory
			mkdirSync(testDir, { recursive: true });

			// Set SKYBOX_HOME for test isolation
			process.env.SKYBOX_HOME = testDir;

			// Create remote test directory
			const host = getRemoteHost(testRemote);

			const result = await runRemoteCommand(
				host,
				`mkdir -p ${escapeShellPath(remotePath)}`,
				testRemote.key,
			);

			if (!result.success) {
				throw new Error(`Failed to create remote directory: ${result.error}`);
			}
		},

		async cleanup(): Promise<void> {
			// Each step is independent — a failure in one should not skip the rest
			try {
				await cleanupRemoteTestDir(runId, testRemote);
			} catch {
				// SSH failure during remote dir cleanup — continue with remaining steps
			}

			try {
				await cleanupStaleLocks(testRemote);
			} catch {
				// SSH failure during lock cleanup — continue
			}

			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Local cleanup failure — continue
			}

			// Restore original SKYBOX_HOME
			if (originalSkyboxHome) {
				process.env.SKYBOX_HOME = originalSkyboxHome;
			} else {
				delete process.env.SKYBOX_HOME;
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
 * Syncs files from local to remote over rsync with retry support.
 *
 * @param remote - Remote server configuration
 * @param localSource - Local rsync source path
 * @param remoteDestination - Remote destination path (without host prefix)
 * @param options - Optional rsync flags and retry overrides
 */
export async function rsyncToRemote(
	remote: RemoteEntry,
	localSource: string,
	remoteDestination: string,
	options: { delete?: boolean; retry?: RetryOptions } = {},
): Promise<void> {
	const args = ["-az", ...getRsyncSshArgs(remote)];
	if (options.delete) {
		args.push("--delete");
	}
	args.push(localSource, `${getRemoteHost(remote)}:${remoteDestination}`);
	await withRetry(() => execa("rsync", args), options.retry);
}

/**
 * Syncs files from remote to local over rsync with retry support.
 *
 * @param remote - Remote server configuration
 * @param remoteSource - Remote source path (without host prefix)
 * @param localDestination - Local rsync destination path
 * @param options - Optional retry overrides
 */
export async function rsyncFromRemote(
	remote: RemoteEntry,
	remoteSource: string,
	localDestination: string,
	options: { retry?: RetryOptions } = {},
): Promise<void> {
	await withRetry(
		() =>
			execa("rsync", [
				"-az",
				...getRsyncSshArgs(remote),
				`${getRemoteHost(remote)}:${remoteSource}`,
				localDestination,
			]),
		options.retry,
	);
}

/**
 * Asserts that a remote command succeeded and returns trimmed stdout.
 *
 * @param result - Result from runRemoteCommand/runTestRemoteCommand
 * @returns Trimmed stdout text (empty string if undefined)
 */
export function expectRemoteCommandSuccess(
	result: RemoteCommandResult,
): string {
	expect(result.success).toBe(true);
	return result.stdout?.trim() ?? "";
}

/**
 * Returns rsync SSH arguments for a remote config.
 */
function getRsyncSshArgs(remote: RemoteEntry): string[] {
	return remote.key ? ["-e", `ssh -i ${remote.key}`] : [];
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
	const remotePath = `~/skybox-e2e-tests/run-${runId}`;
	const host = getRemoteHost(remote);

	await runRemoteCommand(
		host,
		`rm -rf ${escapeShellPath(remotePath)}`,
		remote.key,
	);
}

/**
 * Finds and deletes test-* locks on the remote server.
 * Locks matching the pattern test-* in ~/.skybox-locks/ are removed.
 *
 * @param remote - Remote server configuration
 */
export async function cleanupStaleLocks(remote: RemoteEntry): Promise<void> {
	const host = getRemoteHost(remote);

	// Find and delete test-* locks
	await runRemoteCommand(
		host,
		"rm -f ~/.skybox-locks/test-*.lock 2>/dev/null || true",
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
): Promise<RemoteCommandResult> {
	const host = getRemoteHost(remote);
	return runRemoteCommand(host, command, remote.key);
}
