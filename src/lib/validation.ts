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
