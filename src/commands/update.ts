// self-update command: checks for newer SkyBox version and updates in place for direct downloads.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	accessSync,
	chmodSync,
	copyFileSync,
	constants as fsConstants,
	renameSync,
	unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { confirm } from "@inquirer/prompts";
import { GITHUB_OWNER, GITHUB_REPO, INSTALL_METHOD } from "@lib/constants.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { error, info, spinner, success, warn } from "@lib/ui.ts";
import {
	fetchLatestVersions,
	getUpgradeCommand,
	isNewerVersion,
	saveUpdateCheckMetadata,
} from "@lib/update-check.ts";
import pkg from "../../package.json";

// get the expected binary asset name for the current platform.
const getBinaryAssetName = (): string => {
	const os = process.platform === "darwin" ? "darwin" : "linux";
	const cpu = process.arch === "arm64" ? "arm64" : "x64";
	return `skybox-${os}-${cpu}`;
};

// verify write access to the binary's directory and the binary itself.
const checkPermissions = (binaryDir: string, currentBinary: string): void => {
	try {
		accessSync(binaryDir, fsConstants.W_OK);
	} catch {
		error(
			`Cannot update: permission denied for ${binaryDir}. Try running with sudo.`,
		);
		process.exit(1);
	}
	try {
		accessSync(currentBinary, fsConstants.W_OK);
	} catch {
		error(
			`Cannot update: permission denied for ${currentBinary}. Try running with sudo.`,
		);
		process.exit(1);
	}
};

// download and parse checksums.txt from the release. returns null on failure.
const fetchExpectedChecksum = async (
	targetVersion: string,
	assetName: string,
): Promise<string | null> => {
	const checksumUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${targetVersion}/checksums.txt`;
	try {
		const response = await fetch(checksumUrl, {
			headers: { "User-Agent": "SkyBox-CLI" },
			signal: AbortSignal.timeout(15000),
		});
		if (!response.ok) return null;

		const text = await response.text();
		for (const line of text.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			// format: "<hash>  <filename>" (two spaces)
			const match = trimmed.match(/^([a-f0-9]{64})\s+(.+)$/);
			if (match && match[2] === assetName) {
				return match[1];
			}
		}
		return null;
	} catch {
		return null;
	}
};

// compute SHA-256 hash of a file.
const computeFileHash = async (filePath: string): Promise<string> => {
	const file = Bun.file(filePath);
	const buffer = await file.arrayBuffer();
	const hash = createHash("sha256");
	hash.update(Buffer.from(buffer));
	return hash.digest("hex");
};

// remove macOS quarantine attribute from a file (no-op on other platforms).
const removeQuarantine = (filePath: string): void => {
	if (process.platform !== "darwin") return;
	try {
		execFileSync("xattr", ["-d", "com.apple.quarantine", filePath], {
			stdio: "pipe",
		});
	} catch {
		// attribute may not exist, that's fine
	}
};

// run the new binary with --version and verify it reports the expected version.
const verifyBinary = (binaryPath: string, expectedVersion: string): boolean => {
	try {
		const output = execFileSync(binaryPath, ["--version"], {
			encoding: "utf-8",
			timeout: 5000,
		});
		// version output may include prefix like "skybox/0.8.0" or just "0.8.0"
		return output.trim().includes(expectedVersion);
	} catch {
		return false;
	}
};

// download the new binary and replace the current one with safety checks.
const selfUpdate = async (targetVersion: string): Promise<void> => {
	const assetName = getBinaryAssetName();
	const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${targetVersion}/${assetName}`;

	const currentBinary = process.execPath;
	const binaryDir = dirname(currentBinary);
	const tempPath = join(binaryDir, `.skybox-update-${Date.now()}`);
	const backupPath = join(binaryDir, ".skybox-backup");

	// Step 1: Permission pre-check
	checkPermissions(binaryDir, currentBinary);

	const s = spinner("Fetching release checksums...");

	// Step 2: Download checksums.txt (warn on failure, don't block)
	const expectedHash = await fetchExpectedChecksum(targetVersion, assetName);
	if (!expectedHash) {
		s.stop();
		warn(
			"Checksum file not available for this release. Skipping integrity verification.",
		);
		s.start(`Downloading SkyBox v${targetVersion}...`);
	} else {
		s.text = `Downloading SkyBox v${targetVersion}...`;
	}

	try {
		// Step 3: Download new binary to temp file
		const response = await fetch(downloadUrl, {
			headers: { "User-Agent": "SkyBox-CLI" },
			signal: AbortSignal.timeout(60000),
		});

		if (!response.ok) {
			s.fail(`Download failed: HTTP ${response.status}`);
			error(
				`Could not download ${assetName} from GitHub Releases. Check https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${targetVersion}`,
			);
			process.exit(1);
		}

		const body = await response.arrayBuffer();
		await Bun.write(tempPath, body);

		// Step 4: Verify SHA-256 checksum
		if (expectedHash) {
			s.text = "Verifying checksum...";
			const actualHash = await computeFileHash(tempPath);
			if (actualHash !== expectedHash) {
				unlinkSync(tempPath);
				s.fail("Checksum verification failed.");
				error(
					"The downloaded binary does not match the expected checksum. The download may be corrupted.",
				);
				process.exit(1);
			}
		}

		// Step 5: chmod
		chmodSync(tempPath, 0o755);

		// Step 6: Remove macOS quarantine attribute
		removeQuarantine(tempPath);

		s.text = "Installing...";

		// Step 7: Remove stale backup from a previous update, then backup current binary
		try {
			unlinkSync(backupPath);
		} catch {
			// no stale backup, that's fine
		}
		copyFileSync(currentBinary, backupPath);

		// Step 8: Atomic replace — rename temp over current binary
		renameSync(tempPath, currentBinary);

		// Step 9: Post-update version verification
		s.text = "Verifying update...";
		const verified = verifyBinary(currentBinary, targetVersion);

		if (!verified) {
			// Rollback: restore from backup
			renameSync(backupPath, currentBinary);
			s.fail("Update verification failed.");
			error(
				`The new binary did not report version ${targetVersion}. Restored previous version.`,
			);
			process.exit(1);
		}

		// Step 10: Success — clean up backup
		try {
			unlinkSync(backupPath);
		} catch {
			// backup cleanup is best-effort
		}

		s.succeed(`SkyBox updated to v${targetVersion} (verified).`);
	} catch (err) {
		// Clean up temp file on failure
		try {
			unlinkSync(tempPath);
		} catch {
			// temp file may not exist
		}
		// Restore backup if it exists
		try {
			accessSync(backupPath, fsConstants.F_OK);
			renameSync(backupPath, currentBinary);
			warn("Restored previous binary from backup.");
		} catch {
			// no backup to restore
		}
		s.fail(`Update failed: ${getErrorMessage(err)}`);
		process.exit(1);
	}
};

// check for updates and either self-update or show upgrade instructions.
export const updateCommand = async (): Promise<void> => {
	const currentVersion: string = pkg.version;
	const isBeta = currentVersion.includes("-");

	info("Checking for updates...\n");

	// Always fetch fresh (bypass 24h cache)
	const versions = await fetchLatestVersions();
	if (!versions) {
		error("Could not check for updates. Check your internet connection.");
		process.exit(1);
	}

	saveUpdateCheckMetadata(versions.latest, versions.latestStable);

	const targetVersion = isBeta ? versions.latest : versions.latestStable;

	if (!targetVersion || !isNewerVersion(targetVersion, currentVersion)) {
		success(
			`No update available. You are on the latest version (${currentVersion}).`,
		);
		return;
	}

	info(`Update available: ${currentVersion} → ${targetVersion}\n`);

	if (INSTALL_METHOD === "github-release") {
		const shouldUpdate = await confirm({
			message: "Would you like to update now?",
			default: true,
		});

		if (shouldUpdate) {
			await selfUpdate(targetVersion);
		}
	} else {
		const cmd = getUpgradeCommand(INSTALL_METHOD);
		info(`Run: ${cmd}`);
	}
};
