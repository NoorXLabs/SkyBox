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

	test("registerCleanupHandler adds handler", () => {
		let called = false;
		registerCleanupHandler(() => {
			called = true;
		});

		runCleanupHandlers();
		expect(called).toBe(true);
	});

	test("cleanup handlers run in reverse order", () => {
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

		runCleanupHandlers();
		expect(order).toEqual([3, 2, 1]);
	});

	test("cleanup handlers only run once", () => {
		let count = 0;
		registerCleanupHandler(() => {
			count++;
		});

		runCleanupHandlers();
		runCleanupHandlers();
		expect(count).toBe(1);
	});

	test("handlers run even if one throws", () => {
		let handler2Called = false;
		registerCleanupHandler(() => {
			throw new Error("Handler 1 error");
		});
		registerCleanupHandler(() => {
			handler2Called = true;
		});

		runCleanupHandlers();
		expect(handler2Called).toBe(true);
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
	});

	test("installShutdownHandlers registers SIGHUP handler", () => {
		installShutdownHandlers();
		expect(process.listenerCount("SIGHUP")).toBeGreaterThan(initialSIGHUP);
	});
});
