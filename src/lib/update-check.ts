// version update check: GitHub Releases API with 24h cache.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CHECK_INTERVAL_MS, GITHUB_API_URL } from "@lib/constants.ts";
import { getUpdateCheckPath } from "@lib/paths.ts";
import type { InstallMethod, UpdateCheckMetadata } from "@typedefs/index.ts";

// check if we should query GitHub for updates (24h cooldown).
export const shouldCheckForUpdate = (): boolean => {
	const metadataPath = getUpdateCheckPath();
	if (!existsSync(metadataPath)) return true;

	try {
		const raw = readFileSync(metadataPath, "utf-8");
		const metadata: UpdateCheckMetadata = JSON.parse(raw);
		const lastCheck = new Date(metadata.lastCheck).getTime();
		return Date.now() - lastCheck > CHECK_INTERVAL_MS;
	} catch {
		return true;
	}
};

// save update check results to disk.
export const saveUpdateCheckMetadata = (
	latestVersion: string | null,
	latestStableVersion: string | null,
): void => {
	const metadataPath = getUpdateCheckPath();
	const metadata: UpdateCheckMetadata = {
		lastCheck: new Date().toISOString(),
		latestVersion,
		latestStableVersion,
	};
	try {
		writeFileSync(metadataPath, JSON.stringify(metadata, null, "\t"));
	} catch {
		// Silently fail — update check is non-critical
	}
};

// compare two semver-ish version strings. Returns true if `latest` is newer than `current`.
// handles prerelease tags: 0.7.0 > 0.6.0-beta, 0.6.0 > 0.6.0-beta.
export const isNewerVersion = (latest: string, current: string): boolean => {
	// parse
	const parse = (v: string) => {
		const [core, pre] = v.split("-");
		const parts = core.split(".").map(Number);
		return { major: parts[0], minor: parts[1], patch: parts[2], pre };
	};

	const l = parse(latest);
	const c = parse(current);

	if (l.major !== c.major) return l.major > c.major;
	if (l.minor !== c.minor) return l.minor > c.minor;
	if (l.patch !== c.patch) return l.patch > c.patch;
	// Same core version: release > prerelease
	if (c.pre && !l.pre) return true;
	if (!c.pre && l.pre) return false;
	// Both prerelease or both release with same version
	return false;
};

// get the correct upgrade command for the user's install method.
export const getUpgradeCommand = (method: InstallMethod): string => {
	switch (method) {
		case "homebrew":
			return "brew upgrade skybox";
		case "github-release":
			return "skybox update";
		case "source":
			return "git pull && bun install";
	}
};

// fetch latest release versions from GitHub. Non-blocking, swallows errors.
// returns { latest, latestStable } or null on failure.
export const fetchLatestVersions = async (): Promise<{
	latest: string;
	latestStable: string | null;
} | null> => {
	try {
		const response = await fetch(GITHUB_API_URL, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "SkyBox-CLI",
			},
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) return null;

		// releases
		const releases = (await response.json()) as Array<{
			tag_name: string;
			prerelease: boolean;
			draft: boolean;
		}>;

		const nonDraft = releases.filter((r) => !r.draft);
		if (nonDraft.length === 0) return null;

		// Latest overall (including prereleases)
		const latest = nonDraft[0].tag_name.replace(/^v/, "");

		// Latest stable (non-prerelease)
		const stable = nonDraft.find((r) => !r.prerelease);
		const latestStable = stable ? stable.tag_name.replace(/^v/, "") : null;

		return { latest, latestStable };
	} catch {
		return null;
	}
};

// run the full update check flow. Call after every command.
// returns the newer version string, or null if no update available.
export const checkForUpdate = async (
	currentVersion: string,
	isBeta: boolean,
): Promise<string | null> => {
	if (!shouldCheckForUpdate()) {
		// Read cached result
		try {
			const raw = readFileSync(getUpdateCheckPath(), "utf-8");
			const metadata: UpdateCheckMetadata = JSON.parse(raw);
			const target = isBeta
				? metadata.latestVersion
				: metadata.latestStableVersion;
			if (target && isNewerVersion(target, currentVersion)) {
				return target;
			}
		} catch {
			// ignore
		}
		return null;
	}

	const versions = await fetchLatestVersions();
	if (!versions) {
		saveUpdateCheckMetadata(null, null);
		return null;
	}

	saveUpdateCheckMetadata(versions.latest, versions.latestStable);

	const target = isBeta ? versions.latest : versions.latestStable;
	if (target && isNewerVersion(target, currentVersion)) {
		return target;
	}
	return null;
};
