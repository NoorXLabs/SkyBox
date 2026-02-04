/**
 * Graceful shutdown and cleanup handler management.
 *
 * Ensures resources are released even on unexpected exit.
 */

type CleanupHandler = () => void | Promise<void>;

const cleanupHandlers: CleanupHandler[] = [];
let cleanupRan = false;

/** Timeout for async cleanup handlers (ms) */
const CLEANUP_TIMEOUT_MS = 3000;

/**
 * Register a cleanup handler to run on process exit.
 * Handlers run in reverse order (LIFO).
 */
export function registerCleanupHandler(handler: CleanupHandler): void {
	cleanupHandlers.push(handler);
}

/**
 * Run all registered cleanup handlers.
 * Handlers are run in reverse order and only once.
 * Async handlers are given a brief timeout to complete.
 */
export function runCleanupHandlers(): void {
	if (cleanupRan) return;
	cleanupRan = true;

	// Run in reverse order (most recent first)
	for (let i = cleanupHandlers.length - 1; i >= 0; i--) {
		try {
			const handler = cleanupHandlers[i];
			const result = handler();
			// If handler returns a promise, race with timeout
			if (result instanceof Promise) {
				const timeout = new Promise<void>((resolve) =>
					setTimeout(resolve, CLEANUP_TIMEOUT_MS),
				);
				Promise.race([result, timeout]).catch(() => {});
			}
		} catch {
			// Continue running other handlers even if one fails
		}
	}
}

/**
 * Reset cleanup handlers (for testing).
 */
export function resetCleanupHandlers(): void {
	cleanupHandlers.length = 0;
	cleanupRan = false;
}

/**
 * Install process exit handlers.
 * Should be called once at startup.
 */
export function installShutdownHandlers(): void {
	// Handle normal exit
	process.on("exit", () => {
		runCleanupHandlers();
	});

	// Handle SIGINT (Ctrl+C)
	process.on("SIGINT", () => {
		runCleanupHandlers();
		process.exit(130);
	});

	// Handle SIGTERM
	process.on("SIGTERM", () => {
		runCleanupHandlers();
		process.exit(143);
	});

	// Handle SIGHUP (terminal hangup, SSH disconnect)
	process.on("SIGHUP", () => {
		runCleanupHandlers();
		process.exit(129);
	});

	// Handle uncaught exceptions
	process.on("uncaughtException", (err) => {
		console.error("Uncaught exception:", err.message);
		runCleanupHandlers();
		process.exit(1);
	});
}
