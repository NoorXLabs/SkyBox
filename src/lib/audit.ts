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

/** Audit log entry structure */
export interface AuditEntry {
	timestamp: string;
	action: string;
	user: string;
	machine: string;
	details: Record<string, unknown>;
}

/** Cached audit enabled state (can be overridden for testing). */
let auditEnabledOverride: boolean | null = null;

/**
 * Check if audit logging is enabled.
 * Checks env var on each call to support dynamic configuration.
 */
function isAuditEnabled(): boolean {
	if (auditEnabledOverride !== null) {
		return auditEnabledOverride;
	}
	return process.env.SKYBOX_AUDIT === "1";
}

/**
 * Enable or disable audit logging (for testing).
 * Pass null to restore default behavior (check env var).
 */
export function setAuditEnabled(enabled: boolean | null): void {
	auditEnabledOverride = enabled;
}

/**
 * Get the audit log file path.
 */
export function getAuditLogPath(): string {
	return join(getSkyboxHome(), "audit.log");
}

/**
 * Sanitize audit log details to prevent sensitive data leakage.
 * Replaces home directory paths with ~ and redacts credential patterns.
 */
function sanitizeDetails(
	details: Record<string, unknown>,
): Record<string, unknown> {
	const home = homedir();
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(details)) {
		if (typeof value === "string") {
			let clean = value;
			if (home && clean.includes(home)) {
				clean = clean.replaceAll(home, "~");
			}
			// Redact credential-like patterns
			clean = clean.replace(/password[=:]\S+/gi, "password=[REDACTED]");
			clean = clean.replace(/token[=:]\S+/gi, "token=[REDACTED]");
			sanitized[key] = clean;
		} else {
			sanitized[key] = value;
		}
	}
	return sanitized;
}

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
export function logAuditEvent(
	action: string,
	details: Record<string, unknown>,
): void {
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

	// Rotate log if it exceeds size threshold
	if (existsSync(logPath)) {
		try {
			const stats = statSync(logPath);
			if (stats.size > AUDIT_LOG_MAX_BYTES) {
				const rotatedPath = `${logPath}.${new Date().toISOString().replace(/[:.]/g, "-")}`;
				renameSync(logPath, rotatedPath);
			}
		} catch {}
	}

	// Append JSON line
	const line = `${JSON.stringify(entry)}\n`;
	appendFileSync(logPath, line, { encoding: "utf-8", mode: 0o600 });
}

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
