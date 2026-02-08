# Plan: First-Run Telemetry in the SkyBox Binary

## Goal

Track SkyBox installations via Rybbit analytics directly from the binary on first run, replacing the server-side tracking in the install-service. This captures all installation methods (direct download, Homebrew, build from source) uniformly.

## How It Works

```
User installs skybox (any method: brew, curl, build from source)
  → User runs any `skybox` command for the first time
  → Binary checks: does ~/.skybox/.installed exist?
  → No → fire-and-forget POST to Rybbit (version, OS, arch, install method)
       → create ~/.skybox/.installed marker with metadata
       → continue normally (zero latency impact)
  → Yes → skip telemetry, run normally
```

## Security Considerations

- **No API key in the binary.** The Rybbit `/api/track` endpoint accepts unauthenticated requests with just a site ID (same as client-side web analytics). The API key stays server-side only.
- **Embedded values are public.** The Rybbit URL and site ID will be visible if someone decompiles the binary. This is expected and acceptable — it's the same model as Google Analytics snippets embedded in web pages.
- **Opt-out respected.** `SKYBOX_TELEMETRY=0` disables all tracking. No data is sent.
- **No PII collected.** Only version, OS, architecture, and install method.

## Implementation

### Step 1: Add constants to `src/lib/constants.ts`

Add to the existing constants file, grouped under a new `// Telemetry` section:

```typescript
// Telemetry
export const RYBBIT_URL = "https://rybbit.jcjmrhjts.uk/api/track";
export const RYBBIT_SITE_ID = "ee391688f578";
export const TELEMETRY_TIMEOUT_MS = 5000;
export const INSTALLED_MARKER_FILE = ".installed";
```

### Step 2: Add types to `src/types/index.ts`

```typescript
// Telemetry types
// metadata stored in the .installed marker file
export interface InstalledMarker {
	version: string;
	installedAt: string; // ISO 8601
	installMethod: InstallMethod;
	platform: string; // e.g., "darwin-arm64"
}
```

### Step 3: Add path helper to `src/lib/paths.ts`

Add a function for the marker file path:

```typescript
export const getInstalledMarkerPath = (): string =>
	join(getSkyboxHome(), INSTALLED_MARKER_FILE);
```

Import `INSTALLED_MARKER_FILE` from constants.

### Step 4: Create `src/lib/telemetry.ts`

New file with two exported functions:

```typescript
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { getErrorMessage } from "@lib/errors.ts";
import { getInstalledMarkerPath, getSkyboxHome } from "@lib/paths.ts";
import {
	INSTALL_METHOD,
	RYBBIT_SITE_ID,
	RYBBIT_URL,
	TELEMETRY_TIMEOUT_MS,
} from "@lib/constants.ts";
import type { InstalledMarker } from "@typedefs/index.ts";
import { arch, platform } from "node:os";

// check if first-run telemetry should fire.
// returns false if marker exists or telemetry is disabled.
export const shouldTrackInstall = (): boolean => {
	if (process.env.SKYBOX_TELEMETRY === "0") return false;
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
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	}).catch(() => {
		// Silently swallow — marker already written, won't retry
	});
};
```

Key design decisions:
- **Marker written synchronously BEFORE the HTTP call.** This guarantees the event fires at most once, even if the process is killed mid-flight.
- **No `await` on `fetch`.** The promise floats — it resolves/rejects in the background. The CLI continues immediately with zero latency.
- **No API key.** Public site ID only, matching the client-side analytics model.
- **`shouldTrackInstall()` is a separate function** so it can be called cheaply (just a `stat()`) to avoid importing/running telemetry logic on every invocation.

### Step 5: Wire into `src/index.ts`

Add the telemetry check in the async IIFE, right after command parsing succeeds and before the update check. This mirrors the update-check pattern:

```typescript
import { shouldTrackInstall, trackInstall } from "@lib/telemetry.ts";

// ... existing code ...

(async () => {
	try {
		await program.parseAsync(process.argv);
	} catch (err) {
		// ... existing error handling ...
	}

	// First-run telemetry (fire-and-forget, non-blocking)
	if (shouldTrackInstall()) {
		trackInstall(pkg.version);
	}

	// ... existing update check code ...
})();
```

### Step 6: Add `SKYBOX_TELEMETRY` env var to documentation

Update `CLAUDE.md` environment variables table:

| Variable | Default | Description |
|----------|---------|-------------|
| `SKYBOX_TELEMETRY` | `1` | Set to `0` to disable first-run install tracking |

### Step 7: Add unit tests

Create `tests/unit/lib/telemetry.test.ts`:

Test cases:
1. `shouldTrackInstall()` returns `true` when no marker exists
2. `shouldTrackInstall()` returns `false` when marker exists
3. `shouldTrackInstall()` returns `false` when `SKYBOX_TELEMETRY=0`
4. `trackInstall()` writes marker file with correct metadata
5. `trackInstall()` writes marker even before HTTP completes
6. `trackInstall()` does not throw on HTTP failure
7. `trackInstall()` does not send HTTP when marker write fails

Use the standard test pattern: isolated temp dir per test, mock `SKYBOX_HOME`, cleanup in `afterEach`. For the HTTP call, use `globalThis.fetch = mock(...)` or just let it fail against a nonexistent URL (the error is swallowed).

## Data Sent to Rybbit

| Field | Value | Example |
|-------|-------|---------|
| `site_id` | Hardcoded site ID | `ee391688f578` |
| `type` | `custom_event` | |
| `pathname` | `/install` | |
| `event_name` | `skybox` | |
| `properties.platform` | `os.platform()-os.arch()` | `darwin-arm64` |
| `properties.version` | Package version | `0.7.7` |
| `properties.method` | `INSTALL_METHOD` constant | `homebrew`, `github-release`, `source` |

No IP address is sent (unlike the install-service, there's no incoming HTTP request to extract it from). Rybbit may still see the client IP from the outbound fetch, but we don't explicitly include it.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Add `RYBBIT_URL`, `RYBBIT_SITE_ID`, `TELEMETRY_TIMEOUT_MS`, `INSTALLED_MARKER_FILE` |
| `src/types/index.ts` | Add `InstalledMarker` interface |
| `src/lib/paths.ts` | Add `getInstalledMarkerPath()` |
| `src/lib/telemetry.ts` | **New file** — `shouldTrackInstall()`, `trackInstall()` |
| `src/index.ts` | Import and call telemetry in async IIFE |
| `CLAUDE.md` | Add `SKYBOX_TELEMETRY` env var |
| `tests/unit/lib/telemetry.test.ts` | **New file** — unit tests |

## Not In Scope

- **Upgrade tracking.** This only tracks first install. Tracking version upgrades is a separate concern (could use the marker file's stored version vs current version, but that's a future enhancement).
- **Usage analytics.** No per-command tracking. Just the one-time install event.
- **IP-based geolocation.** The install-service explicitly sent the client IP for Rybbit geolocation. The binary fetch will still reveal the client IP at the network level, but we don't include it in the payload. Rybbit may or may not use it — depends on their server-side behavior.
