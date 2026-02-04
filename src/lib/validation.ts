/** Input validation utilities: path safety, traversal prevention. */

export function isPathTraversal(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments.some((s) => s === "..");
}

export function validatePath(
	path: string,
): { valid: true } | { valid: false; error: string } {
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
export function validateRemotePath(
	path: string,
): { valid: true } | { valid: false; error: string } {
	if (!path || path.trim() === "") {
		return { valid: false, error: "Remote path cannot be empty" };
	}

	// Check for command substitution: $(...) or `...`
	if (/\$\(/.test(path) || /`/.test(path)) {
		return {
			valid: false,
			error:
				"Remote path cannot contain command substitution ($() or backticks)",
		};
	}

	// Check for shell metacharacters that enable command chaining
	// ; | & are command separators/chaining
	// \n \r can break out of commands
	const dangerousChars = /[;|&\n\r]/;
	if (dangerousChars.test(path)) {
		return {
			valid: false,
			error: "Remote path cannot contain shell metacharacters (;|&)",
		};
	}

	return { valid: true };
}
