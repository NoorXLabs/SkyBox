import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import {
	INSTALL_METHOD,
	RYBBIT_API_KEY,
	RYBBIT_SITE_ID,
	RYBBIT_URL,
	TELEMETRY_TIMEOUT_MS,
} from "@lib/constants.ts";
import { getInstalledMarkerPath, getSkyboxHome } from "@lib/paths.ts";
import type { InstalledMarker } from "@typedefs/index.ts";

// check if first-run telemetry should fire.
// returns false if marker exists, telemetry is disabled, or Rybbit env vars are unset.
export const shouldTrackInstall = (): boolean => {
	if (process.env.SKYBOX_TELEMETRY === "0") return false;
	if (
		!process.env.RYBBIT_URL ||
		!process.env.RYBBIT_SITE_ID ||
		!process.env.RYBBIT_API_KEY
	)
		return false;
	return !existsSync(getInstalledMarkerPath());
};

// send first-run telemetry event to Rybbit and write the marker file.
// fire-and-forget — errors are silently swallowed.
// the marker is ALWAYS written (even if the HTTP call fails) to prevent
// repeated attempts on every invocation.
export const trackInstall = (version: string): void => {
	const platformStr = `${platform()}-${arch()}`;

	// Write marker FIRST (before async work) to guarantee single execution
	const marker: InstalledMarker = {
		version,
		installedAt: new Date().toISOString(),
		installMethod: INSTALL_METHOD,
		platform: platformStr,
	};

	try {
		const skyboxHome = getSkyboxHome();
		if (!existsSync(skyboxHome)) {
			mkdirSync(skyboxHome, { recursive: true });
		}
		writeFileSync(getInstalledMarkerPath(), JSON.stringify(marker, null, "\t"));
	} catch {
		// If we can't write the marker, bail out entirely.
		// Don't send telemetry if we can't prevent future sends.
		return;
	}

	// Fire-and-forget HTTP call — no await, no .catch visible to caller
	const payload = {
		site_id: RYBBIT_SITE_ID,
		type: "custom_event",
		pathname: "/install",
		event_name: "skybox",
		properties: JSON.stringify({
			platform: platformStr,
			version,
			method: INSTALL_METHOD,
		}),
	};

	fetch(RYBBIT_URL, {
		method: "POST",
		signal: AbortSignal.timeout(TELEMETRY_TIMEOUT_MS),
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${RYBBIT_API_KEY}`,
		},
		body: JSON.stringify(payload),
	}).catch(() => {
		// Silently swallow — marker already written, won't retry
	});
};
