// error handling utilities: safe message extraction and type guards.
import type { ExecaLikeError } from "@typedefs/index.ts";

// safely extract an error message from an unknown error type.
// use this in catch blocks for general errors.
// @example
// ```ts
// try { await riskyOp(); }
// catch (err) { error(getErrorMessage(err)); }
// ```
export const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown error";
};

// safely extract an error message from execa errors.
// prefers stderr over message since command errors often have more detail there.
// @example
// ```ts
// try { await execa("docker", ["ps"]); }
// catch (err) { error(getExecaErrorMessage(err)); }
// ```
export const getExecaErrorMessage = (error: unknown): string => {
	if (error && typeof error === "object") {
		if ("stderr" in error && typeof error.stderr === "string" && error.stderr) {
			return error.stderr;
		}
		if ("message" in error && typeof error.message === "string") {
			return error.message;
		}
	}
	return "Unknown error";
};

// type guard to check if an error is an execa-like error.
// narrows the type for safe property access.
// accepts both Error instances and plain objects with execa-like properties.
// @example
// ```ts
// if (isExecaError(err)) { console.log(err.stderr); }
// ```
export const isExecaError = (error: unknown): error is ExecaLikeError => {
	return (
		error !== null &&
		typeof error === "object" &&
		("exitCode" in error || "stderr" in error || "command" in error)
	);
};

// check if an error has a specific exit code (for execa errors).
// uses type guard for proper type narrowing.
export const hasExitCode = (error: unknown, code: number): boolean => {
	return isExecaError(error) && error.exitCode === code;
};
