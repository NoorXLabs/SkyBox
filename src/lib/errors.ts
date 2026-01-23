// src/lib/errors.ts

/**
 * Safely extract an error message from an unknown error type.
 * Use this in catch blocks for general errors.
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown error";
}

/**
 * Safely extract an error message from execa errors.
 * Prefers stderr over message since command errors often have more detail there.
 */
export function getExecaErrorMessage(error: unknown): string {
	if (error && typeof error === "object") {
		if ("stderr" in error && typeof error.stderr === "string" && error.stderr) {
			return error.stderr;
		}
		if ("message" in error && typeof error.message === "string") {
			return error.message;
		}
	}
	return "Unknown error";
}

/**
 * Check if an error has a specific exit code (for execa errors).
 */
export function hasExitCode(error: unknown, code: number): boolean {
	return (
		error !== null &&
		typeof error === "object" &&
		"exitCode" in error &&
		error.exitCode === code
	);
}
