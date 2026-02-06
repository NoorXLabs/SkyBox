/**
 * Graceful shutdown and cleanup handler management.
 *
 * Ensures resources are released even on unexpected exit.
 */

type CleanupHandler = () => void | Promise<void>;

const cleanupHandlers: CleanupHandler[] = [];
let cleanupRan = false;
let installed = false;

/** Timeout for async cleanup handlers (ms) */
const CLEANUP_TIMEOUT_MS = 3000;

function getCleanupHandlersInReverse(): CleanupHandler[] {
	return [...cleanupHandlers].reverse();
}

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
 *
 * Returns a promise that resolves when all handlers (including async ones)
 * have completed or timed out.
 */
export async function runCleanupHandlers(): Promise<void> {
	if (cleanupRan) return;
	cleanupRan = true;

	for (const handler of getCleanupHandlersInReverse()) {
		try {
			const result = handler();
			// If handler returns a promise, race with timeout
			if (result instanceof Promise) {
				const timeout = new Promise<void>((resolve) =>
					setTimeout(resolve, CLEANUP_TIMEOUT_MS),
				);
				await Promise.race([result, timeout]).catch(() => {});
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
	installed = false;
}

/**
 * Install process exit handlers.
 * Should be called once at startup. Subsequent calls are no-ops.
 */
export function installShutdownHandlers(): void {
	if (installed) return;
	installed = true;

	const handleSignal = (_signal: string, code: number) => {
		runCleanupHandlers()
			.then(() => process.exit(code))
			.catch(() => process.exit(code));
	};

	// Handle normal exit
	process.on("exit", () => {
		// exit handler must be synchronous - best-effort only
		if (!cleanupRan) {
			cleanupRan = true;
			for (const handler of getCleanupHandlersInReverse()) {
				try {
					handler();
				} catch {
					// Continue running other handlers even if one fails
				}
			}
		}
	});

	// Handle SIGINT (Ctrl+C)
	process.on("SIGINT", () => handleSignal("SIGINT", 130));

	// Handle SIGTERM
	process.on("SIGTERM", () => handleSignal("SIGTERM", 143));

	// Handle SIGHUP (terminal hangup, SSH disconnect)
	process.on("SIGHUP", () => handleSignal("SIGHUP", 129));

	// Handle uncaught exceptions
	process.on("uncaughtException", (err) => {
		console.error("Uncaught exception:", err.message);
		runCleanupHandlers()
			.then(() => process.exit(1))
			.catch(() => process.exit(1));
	});
}
