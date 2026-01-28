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
 * Type for execa-like errors with common properties.
 */
export interface ExecaLikeError {
	exitCode?: number;
	stderr?: string;
	stdout?: string;
	command?: string;
	message?: string;
}

/**
 * Type guard to check if an error is an execa-like error.
 * Narrows the type for safe property access.
 * Accepts both Error instances and plain objects with execa-like properties.
 */
export function isExecaError(error: unknown): error is ExecaLikeError {
	return (
		error !== null &&
		typeof error === "object" &&
		("exitCode" in error || "stderr" in error || "command" in error)
	);
}

/**
 * Check if an error has a specific exit code (for execa errors).
 * Uses type guard for proper type narrowing.
 */
export function hasExitCode(error: unknown, code: number): boolean {
	return isExecaError(error) && error.exitCode === code;
}
