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
	test("installShutdownHandlers registers SIGHUP handler", () => {
		const initialListeners = process.listenerCount("SIGHUP");
		installShutdownHandlers();
		expect(process.listenerCount("SIGHUP")).toBeGreaterThan(initialListeners);
	});
});
