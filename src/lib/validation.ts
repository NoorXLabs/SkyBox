/** Input validation utilities: path safety, traversal prevention. */

import type { ValidationResult } from "@typedefs/index.ts";

export function isPathTraversal(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments.some((s) => s === "..");
}

export function validatePath(path: string): ValidationResult {
	if (!path || path.trim() === "") {
		return { valid: false, error: "Path cannot be empty" };
	}
	if (path.startsWith("/")) {
		return { valid: false, error: "Path cannot be absolute" };
	}
	if (isPathTraversal(path)) {
		return { valid: false, error: "Path contains path traversal sequences" };
	}
	return { valid: true };
}

/**
 * Validate a remote path for shell safety.
 * Allows absolute paths (/...) and tilde paths (~/...).
 * Blocks shell metacharacters that could enable command injection.
 */
export function validateRemotePath(path: string): ValidationResult {
	if (!path || path.trim() === "") {
		return { valid: false, error: "Remote path cannot be empty" };
	}

	// Check for command substitution: $(...), ${...}, or `...`
	if (/\$[({]/.test(path) || /`/.test(path)) {
		return {
			valid: false,
			error:
				// biome-ignore lint/suspicious/noTemplateCurlyInString: literal error message describing ${} syntax
				"Remote path cannot contain command substitution ($(), ${}, or backticks)",
		};
	}

	// Check for shell metacharacters that enable command chaining
	// ; | & are command separators/chaining
	// \n \r can break out of commands
	const dangerousChars = /[;|&\n\r]/;
	if (dangerousChars.test(path)) {
		return {
			valid: false,
			error:
				"Remote path cannot contain shell metacharacters (;|&) or line breaks",
		};
	}

	return { valid: true };
}

/**
 * Validate that a project name is safe for use in remote path construction.
 * Rejects names that could escape the parent directory via traversal.
 */
export function validateRemoteProjectPath(project: string): ValidationResult {
	if (!project || project.trim() === "") {
		return { valid: false, error: "Project name cannot be empty" };
	}
	if (project.includes("..")) {
		return {
			valid: false,
			error: "Project name cannot contain path traversal sequences",
		};
	}
	if (project.includes("/") || project.includes("\\")) {
		return {
			valid: false,
			error: "Project name cannot contain path separators",
		};
	}
	if (project.startsWith("-")) {
		return { valid: false, error: "Project name cannot start with a dash" };
	}
	return { valid: true };
}

/**
 * Validate an SSH config field value (hostname, username, friendly name).
 * Blocks newlines and characters that could inject SSH config directives.
 */
export function validateSSHField(
	value: string,
	fieldName: string,
): ValidationResult {
	if (!value || value.trim() === "") {
		return { valid: false, error: `${fieldName} cannot be empty` };
	}
	if (/[\n\r]/.test(value)) {
		return { valid: false, error: `${fieldName} cannot contain newlines` };
	}
	if (!/^[a-zA-Z0-9@._~:\-/]+$/.test(value)) {
		return { valid: false, error: `${fieldName} contains invalid characters` };
	}
	return { valid: true };
}

/**
 * Validate an SSH host string against option injection.
 * Rejects hosts that start with '-' (which SSH would interpret as options),
 * hosts with whitespace, and hosts with control characters.
 */
export function validateSSHHost(host: string): ValidationResult {
	if (!host || host.trim() === "") {
		return { valid: false, error: "SSH host cannot be empty" };
	}
	if (host.startsWith("-")) {
		return {
			valid: false,
			error: "SSH host cannot start with a dash (potential option injection)",
		};
	}
	// \s covers spaces, tabs, \n, \r, and other Unicode whitespace
	if (/\s/.test(host)) {
		return {
			valid: false,
			error: "SSH host cannot contain whitespace or newlines",
		};
	}
	// Control chars (\x00-\x1f) minus the whitespace chars already caught above, plus DEL (\x7f)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters to reject unsafe SSH hosts
	if (/[\x00-\x08\x0e-\x1f\x7f]/.test(host)) {
		return {
			valid: false,
			error: "SSH host cannot contain control characters",
		};
	}
	return { valid: true };
}

/** Create an inquirer validator for SSH config fields. */
export function sshFieldValidator(
	fieldName: string,
): (input: string) => true | string {
	return (input: string) => {
		const result = validateSSHField(input, fieldName);
		return result.valid ? true : result.error;
	};
}

/** Adapt any ValidationResult function into an inquirer validate callback. */
export function toInquirerValidator(
	validatorFn: (input: string) => ValidationResult,
): (input: string) => true | string {
	return (input: string) => {
		const result = validatorFn(input);
		return result.valid ? true : result.error;
	};
}
