import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	installShutdownHandlers,
	registerCleanupHandler,
	resetCleanupHandlers,
	runCleanupHandlers,
} from "@lib/shutdown.ts";

describe("shutdown handlers", () => {
	beforeEach(() => {
		resetCleanupHandlers();
	});

	afterEach(() => {
		resetCleanupHandlers();
	});

	test("registerCleanupHandler adds handler", async () => {
		let called = false;
		registerCleanupHandler(() => {
			called = true;
		});

		await runCleanupHandlers();
		expect(called).toBe(true);
	});

	test("cleanup handlers run in reverse order", async () => {
		const order: number[] = [];
		registerCleanupHandler(() => {
			order.push(1);
		});
		registerCleanupHandler(() => {
			order.push(2);
		});
		registerCleanupHandler(() => {
			order.push(3);
		});

		await runCleanupHandlers();
		expect(order).toEqual([3, 2, 1]);
	});

	test("cleanup handlers only run once", async () => {
		let count = 0;
		registerCleanupHandler(() => {
			count++;
		});

		await runCleanupHandlers();
		await runCleanupHandlers();
		expect(count).toBe(1);
	});

	test("handlers run even if one throws", async () => {
		let handler2Called = false;
		registerCleanupHandler(() => {
			throw new Error("Handler 1 error");
		});
		registerCleanupHandler(() => {
			handler2Called = true;
		});

		await runCleanupHandlers();
		expect(handler2Called).toBe(true);
	});

	test("async handlers complete before runCleanupHandlers resolves", async () => {
		let asyncHandlerCompleted = false;

		registerCleanupHandler(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			asyncHandlerCompleted = true;
		});

		await runCleanupHandlers();

		// After awaiting, the async handler should have fully completed
		expect(asyncHandlerCompleted).toBe(true);
	});

	test("async handlers time out after CLEANUP_TIMEOUT_MS", async () => {
		let asyncHandlerCompleted = false;

		// Register a handler that takes longer than the timeout
		registerCleanupHandler(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10_000));
			asyncHandlerCompleted = true;
		});

		const start = Date.now();
		await runCleanupHandlers();
		const elapsed = Date.now() - start;

		// Should have timed out, not waited 10 seconds
		expect(elapsed).toBeLessThan(5000);
		expect(asyncHandlerCompleted).toBe(false);
	});
});

describe("signal handling", () => {
	// Track listeners added during test for cleanup
	let initialSIGHUP: number;
	let initialSIGINT: number;
	let initialSIGTERM: number;
	let initialExit: number;
	let initialUncaughtException: number;

	beforeEach(() => {
		resetCleanupHandlers();
		initialSIGHUP = process.listenerCount("SIGHUP");
		initialSIGINT = process.listenerCount("SIGINT");
		initialSIGTERM = process.listenerCount("SIGTERM");
		initialExit = process.listenerCount("exit");
		initialUncaughtException = process.listenerCount("uncaughtException");
	});

	afterEach(() => {
		// Remove any listeners added during the test to prevent leaks
		const signals = ["SIGHUP", "SIGINT", "SIGTERM"] as const;
		for (const signal of signals) {
			const listeners = process.listeners(signal);
			const initialCount =
				signal === "SIGHUP"
					? initialSIGHUP
					: signal === "SIGINT"
						? initialSIGINT
						: initialSIGTERM;
			// Remove listeners added during test (keep original ones)
			while (process.listenerCount(signal) > initialCount) {
				const lastListener = listeners.pop();
				if (lastListener) process.off(signal, lastListener);
			}
		}
		// Clean up exit and uncaughtException listeners
		while (process.listenerCount("exit") > initialExit) {
			const listeners = process.listeners("exit");
			const lastListener = listeners.pop();
			if (lastListener)
				process.off("exit", lastListener as NodeJS.ExitListener);
		}
		while (
			process.listenerCount("uncaughtException") > initialUncaughtException
		) {
			const listeners = process.listeners("uncaughtException");
			const lastListener = listeners.pop();
			if (lastListener)
				process.off(
					"uncaughtException",
					lastListener as NodeJS.UncaughtExceptionListener,
				);
		}
		resetCleanupHandlers();
	});

	test("installShutdownHandlers registers SIGHUP handler", () => {
		installShutdownHandlers();
		expect(process.listenerCount("SIGHUP")).toBeGreaterThan(initialSIGHUP);
	});

	test("installShutdownHandlers is idempotent - no duplicate listeners", () => {
		installShutdownHandlers();
		const countAfterFirst = process.listenerCount("SIGHUP");

		installShutdownHandlers();
		const countAfterSecond = process.listenerCount("SIGHUP");

		expect(countAfterSecond).toBe(countAfterFirst);
	});

	test("installShutdownHandlers registers all signal handlers", () => {
		installShutdownHandlers();
		expect(process.listenerCount("SIGINT")).toBeGreaterThan(initialSIGINT);
		expect(process.listenerCount("SIGTERM")).toBeGreaterThan(initialSIGTERM);
		expect(process.listenerCount("SIGHUP")).toBeGreaterThan(initialSIGHUP);
		expect(process.listenerCount("exit")).toBeGreaterThan(initialExit);
		expect(process.listenerCount("uncaughtException")).toBeGreaterThan(
			initialUncaughtException,
		);
	});
});
