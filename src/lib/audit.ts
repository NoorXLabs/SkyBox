/**
 * Audit logging for security-sensitive operations.
 *
 * Writes JSON Lines format to ~/.skybox/audit.log.
 * Enabled via SKYBOX_AUDIT=1 environment variable.
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	statSync,
} from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { AUDIT_LOG_MAX_BYTES } from "@lib/constants.ts";
import { getSkyboxHome } from "@lib/paths.ts";
import type { AuditEntry } from "@typedefs/index.ts";

/** Cached audit enabled state (can be overridden for testing). */
let auditEnabledOverride: boolean | null = null;

/**
 * Check if audit logging is enabled.
 * Checks env var on each call to support dynamic configuration.
 */
const isAuditEnabled = (): boolean => {
	if (auditEnabledOverride !== null) {
		return auditEnabledOverride;
	}
	return process.env.SKYBOX_AUDIT === "1";
};

/**
 * Enable or disable audit logging (for testing).
 * Pass null to restore default behavior (check env var).
 */
export const setAuditEnabled = (enabled: boolean | null): void => {
	auditEnabledOverride = enabled;
};

/**
 * Get the audit log file path.
 */
export const getAuditLogPath = (): string => {
	return join(getSkyboxHome(), "audit.log");
};

/**
 * Sanitize audit log details to prevent sensitive data leakage.
 * Replaces home directory paths with ~ and redacts credential patterns.
 *
 * NOTE: Only sanitizes top-level string values. Nested objects are passed
 * through as-is. Callers should ensure sensitive data is in top-level fields.
 */
const sanitizeDetails = (
	details: Record<string, unknown>,
): Record<string, unknown> => {
	const home = homedir();
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(details)) {
		if (typeof value === "string") {
			let clean = value;
			if (home && clean.includes(home)) {
				clean = clean.replaceAll(home, "~");
			}
			// Redact credential-like patterns
			clean = clean.replace(
				/(?:password|token|secret|api_?key|auth(?:orization)?)[=:]\S+/gi,
				(match) => `${match.split(/[=:]/)[0]}=[REDACTED]`,
			);
			sanitized[key] = clean;
		} else {
			sanitized[key] = value;
		}
	}
	return sanitized;
};

/**
 * Log a security-relevant event.
 *
 * NOTE: Uses synchronous file append for simplicity and guaranteed ordering.
 * For high-frequency audit scenarios, consider external log aggregation.
 * The audit log should be rotated periodically to prevent unbounded growth.
 *
 * @param action - The action being performed (e.g., "clone", "push", "rm")
 * @param details - Additional context for the action
 */
export const logAuditEvent = (
	action: string,
	details: Record<string, unknown>,
): void => {
	if (!isAuditEnabled()) return;

	const entry: AuditEntry = {
		timestamp: new Date().toISOString(),
		action,
		user: userInfo().username,
		machine: hostname(),
		details: sanitizeDetails(details),
	};

	const logPath = getAuditLogPath();
	const logDir = dirname(logPath);

	// Ensure directory exists with secure permissions
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true, mode: 0o700 });
	}

	// Rotate log if it exceeds size threshold.
	// Note: slight TOCTOU race with concurrent processes; second rename fails
	// silently which is acceptable — both processes will create a new log file.
	try {
		const stats = statSync(logPath);
		if (stats.size > AUDIT_LOG_MAX_BYTES) {
			const rotatedPath = `${logPath}.${new Date().toISOString().replace(/[:.]/g, "-")}`;
			renameSync(logPath, rotatedPath);
		}
	} catch {}

	// Append JSON line
	const line = `${JSON.stringify(entry)}\n`;
	appendFileSync(logPath, line, { encoding: "utf-8", mode: 0o600 });
};

/**
 * Common audit actions.
 */
export const AuditActions = {
	CLONE_START: "clone:start",
	CLONE_SUCCESS: "clone:success",
	CLONE_FAIL: "clone:fail",
	PUSH_START: "push:start",
	PUSH_SUCCESS: "push:success",
	PUSH_FAIL: "push:fail",
	RM_LOCAL: "rm:local",
	RM_REMOTE: "rm:remote",
	RM_FAIL: "rm:fail",
	UP_START: "up:start",
	UP_SUCCESS: "up:success",
	DOWN: "down",
	FORCE_LOCK: "lock:force",
	CONFIG_CHANGE: "config:change",
	AUTH_DENIED: "auth:denied",
} as const;
