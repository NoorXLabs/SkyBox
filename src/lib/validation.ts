/** Input validation utilities: path safety, traversal prevention. */

import type { ValidationResult } from "@typedefs/index.ts";

/** Require a non-empty string; returns a validation error if empty or whitespace-only. */
const requireNonEmpty = (
	value: string | undefined | null,
	label: string,
): ValidationResult | null => {
	if (!value || value.trim() === "") {
		return { valid: false, error: `${label} cannot be empty` };
	}
	return null;
};

const validateCanonicalProjectName = (name: string): ValidationResult => {
	const empty = requireNonEmpty(name, "Project name");
	if (empty) return empty;

	if (name.startsWith("-") || name.startsWith("_")) {
		return {
			valid: false,
			error: "Project name cannot start with a hyphen or underscore",
		};
	}

	const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
	if (!validPattern.test(name)) {
		return {
			valid: false,
			error:
				"Project name must be alphanumeric and can only contain hyphens and underscores",
		};
	}

	return { valid: true };
};

export const isPathTraversal = (path: string): boolean => {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments.some((s) => s === "..");
};

export const validatePath = (path: string): ValidationResult => {
	const empty = requireNonEmpty(path, "Path");
	if (empty) return empty;
	if (path.startsWith("/")) {
		return { valid: false, error: "Path cannot be absolute" };
	}
	if (isPathTraversal(path)) {
		return { valid: false, error: "Path contains path traversal sequences" };
	}
	return { valid: true };
};

/**
 * Validate a remote path for shell safety.
 * Allows absolute paths (/...) and tilde paths (~/...).
 * Blocks shell metacharacters that could enable command injection.
 */
export const validateRemotePath = (path: string): ValidationResult => {
	const empty = requireNonEmpty(path, "Remote path");
	if (empty) return empty;

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
};

export const validateProjectName = (name: string): ValidationResult => {
	return validateCanonicalProjectName(name);
};

/**
 * Validate that a project name is safe for use in remote path construction.
 * Uses the same canonical rules as project-name validation elsewhere.
 */
export const validateRemoteProjectPath = (
	project: string,
): ValidationResult => {
	return validateCanonicalProjectName(project);
};

/**
 * Validate an SSH config field value (hostname, username, friendly name).
 * Blocks newlines and characters that could inject SSH config directives.
 */
export const validateSSHField = (
	value: string,
	fieldName: string,
): ValidationResult => {
	const empty = requireNonEmpty(value, fieldName);
	if (empty) return empty;
	if (/[\n\r]/.test(value)) {
		return { valid: false, error: `${fieldName} cannot contain newlines` };
	}
	// Intentionally excludes spaces and special characters to prevent SSH config injection.
	// Paths with spaces should use alternative quoting at the SSH config level.
	if (!/^[a-zA-Z0-9@._~:\-/]+$/.test(value)) {
		return { valid: false, error: `${fieldName} contains invalid characters` };
	}
	return { valid: true };
};

/**
 * Validate an SSH host string against option injection.
 * Rejects hosts that start with '-' (which SSH would interpret as options),
 * hosts with whitespace, and hosts with control characters.
 */
export const validateSSHHost = (host: string): ValidationResult => {
	const empty = requireNonEmpty(host, "SSH host");
	if (empty) return empty;
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
};

/** Create an inquirer validator for SSH config fields. */
export const sshFieldValidator = (
	fieldName: string,
): ((input: string) => true | string) => {
	return toInquirerValidator((input: string) =>
		validateSSHField(input, fieldName),
	);
};

/** Adapt any ValidationResult function into an inquirer validate callback. */
export const toInquirerValidator = (
	validatorFn: (input: string) => ValidationResult,
): ((input: string) => true | string) => {
	return (input: string) => {
		const result = validatorFn(input);
		return result.valid ? true : result.error;
	};
};
