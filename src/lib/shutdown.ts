// graceful shutdown and cleanup handler management.
// ensures resources are released even on unexpected exit.

type CleanupHandler = () => void | Promise<void>;

const cleanupHandlers: CleanupHandler[] = [];
let cleanupRan = false;
let installed = false;

// timeout for async cleanup handlers (ms)
const CLEANUP_TIMEOUT_MS = 3000;

// get cleanup handlers in reverse
const getCleanupHandlersInReverse = (): CleanupHandler[] => {
	return [...cleanupHandlers].reverse();
};

// register a cleanup handler to run on process exit.
// handlers run in reverse order (LIFO).
export const registerCleanupHandler = (handler: CleanupHandler): void => {
	cleanupHandlers.push(handler);
};

// run all registered cleanup handlers.
// handlers are run in reverse order and only once.
// returns a promise that resolves when all handlers (including async ones)
// have completed or timed out.
export const runCleanupHandlers = async (): Promise<void> => {
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
};

// reset cleanup handlers (for testing).
export const resetCleanupHandlers = (): void => {
	cleanupHandlers.length = 0;
	cleanupRan = false;
	installed = false;
};

// install process exit handlers.
// should be called once at startup. Subsequent calls are no-ops.
export const installShutdownHandlers = (): void => {
	if (installed) return;
	installed = true;

	// handle signal
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
};
