// src/lib/__tests__/errors.test.ts
import { describe, expect, test } from "bun:test";
import {
	getErrorMessage,
	getExecaErrorMessage,
	hasExitCode,
	isExecaError,
} from "../errors.ts";

describe("getErrorMessage", () => {
	test("extracts message from Error instance", () => {
		const err = new Error("Something went wrong");
		expect(getErrorMessage(err)).toBe("Something went wrong");
	});

	test("returns string directly", () => {
		expect(getErrorMessage("Direct error string")).toBe("Direct error string");
	});

	test("returns Unknown error for null", () => {
		expect(getErrorMessage(null)).toBe("Unknown error");
	});

	test("returns Unknown error for undefined", () => {
		expect(getErrorMessage(undefined)).toBe("Unknown error");
	});

	test("returns Unknown error for number", () => {
		expect(getErrorMessage(42)).toBe("Unknown error");
	});

	test("returns Unknown error for object without message", () => {
		expect(getErrorMessage({ code: 1 })).toBe("Unknown error");
	});
});

describe("getExecaErrorMessage", () => {
	test("prefers stderr over message", () => {
		const err = { stderr: "Command failed", message: "Error" };
		expect(getExecaErrorMessage(err)).toBe("Command failed");
	});

	test("falls back to message if no stderr", () => {
		const err = { message: "Error occurred" };
		expect(getExecaErrorMessage(err)).toBe("Error occurred");
	});

	test("falls back to message if stderr is empty", () => {
		const err = { stderr: "", message: "Error occurred" };
		expect(getExecaErrorMessage(err)).toBe("Error occurred");
	});

	test("returns Unknown error for null", () => {
		expect(getExecaErrorMessage(null)).toBe("Unknown error");
	});

	test("returns Unknown error for object without stderr or message", () => {
		expect(getExecaErrorMessage({ code: 1 })).toBe("Unknown error");
	});

	test("handles Error instance", () => {
		const err = new Error("Standard error");
		expect(getExecaErrorMessage(err)).toBe("Standard error");
	});
});

describe("hasExitCode", () => {
	test("returns true when exit code matches", () => {
		const err = { exitCode: 130 };
		expect(hasExitCode(err, 130)).toBe(true);
	});

	test("returns false when exit code does not match", () => {
		const err = { exitCode: 1 };
		expect(hasExitCode(err, 130)).toBe(false);
	});

	test("returns false for null", () => {
		expect(hasExitCode(null, 130)).toBe(false);
	});

	test("returns false for object without exitCode", () => {
		expect(hasExitCode({ code: 130 }, 130)).toBe(false);
	});

	test("returns false for non-object", () => {
		expect(hasExitCode("error", 130)).toBe(false);
	});
});

describe("isExecaError", () => {
	test("returns true for object with exitCode", () => {
		expect(isExecaError({ exitCode: 1 })).toBe(true);
	});

	test("returns true for object with stderr", () => {
		expect(isExecaError({ stderr: "fail" })).toBe(true);
	});

	test("returns true for object with command", () => {
		expect(isExecaError({ command: "ls" })).toBe(true);
	});

	test("returns false for null", () => {
		expect(isExecaError(null)).toBe(false);
	});

	test("returns false for undefined", () => {
		expect(isExecaError(undefined)).toBe(false);
	});

	test("returns false for string", () => {
		expect(isExecaError("error")).toBe(false);
	});

	test("returns false for number", () => {
		expect(isExecaError(42)).toBe(false);
	});

	test("returns false for plain object without execa properties", () => {
		expect(isExecaError({ foo: "bar" })).toBe(false);
	});

	test("returns true for Error with exitCode", () => {
		const err = Object.assign(new Error("fail"), { exitCode: 1 });
		expect(isExecaError(err)).toBe(true);
	});
});

describe("error edge cases", () => {
	test("getExecaErrorMessage returns Unknown error for undefined", () => {
		expect(getExecaErrorMessage(undefined)).toBe("Unknown error");
	});

	test("getExecaErrorMessage returns Unknown error for number", () => {
		expect(getExecaErrorMessage(42)).toBe("Unknown error");
	});

	test("getExecaErrorMessage returns Unknown error for string", () => {
		expect(getExecaErrorMessage("just a string")).toBe("Unknown error");
	});
});
