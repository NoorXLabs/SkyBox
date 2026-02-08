import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decryptFile, encryptFile } from "@lib/encryption.ts";
import { escapeRemotePath, escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand, secureScp } from "@lib/ssh.ts";

export interface RemoteArchiveTarget {
	project: string;
	host: string;
	remotePath: string;
	archiveName: string;
	remoteArchivePath: string;
}

export interface RemoteArchiveResult {
	success: boolean;
	error?: string;
	cleanupWarning?: boolean;
}

interface ArchiveTempPaths {
	tempDir: string;
	localTarPath: string;
	localEncPath: string;
}

// run archive operations with a shared temp directory layout and guaranteed cleanup
const withArchiveTempPaths = async <T>(
	fn: (paths: ArchiveTempPaths) => Promise<T>,
): Promise<T> => {
	const tempDir = mkdtempSync(join(tmpdir(), "skybox-"));
	const localTarPath = join(tempDir, "archive.tar");
	const localEncPath = join(tempDir, "archive.tar.enc");

	try {
		return await fn({ tempDir, localTarPath, localEncPath });
	} finally {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {}
	}
};

// create remote archive target
export const createRemoteArchiveTarget = (
	project: string,
	host: string,
	remotePath: string,
): RemoteArchiveTarget => {
	const archiveName = `${project}.tar.enc`;
	return {
		project,
		host,
		remotePath,
		archiveName,
		remoteArchivePath: `${remotePath}/${archiveName}`,
	};
};

// remote archive exists
export const remoteArchiveExists = async (
	target: RemoteArchiveTarget,
): Promise<boolean> => {
	const checkResult = await runRemoteCommand(
		target.host,
		`test -f ${escapeShellArg(target.remoteArchivePath)} && echo "EXISTS" || echo "NOT_FOUND"`,
	);
	return checkResult.success && checkResult.stdout?.includes("EXISTS") === true;
};

// decrypt remote archive
export const decryptRemoteArchive = async (
	target: RemoteArchiveTarget,
	key: Buffer,
	onProgress?: (message: string) => void,
): Promise<RemoteArchiveResult> => {
	const remoteTarName = `${target.project}.tar`;
	const remoteTarPath = `${target.remotePath}/${remoteTarName}`;

	return withArchiveTempPaths(async ({ localEncPath, localTarPath }) => {
		onProgress?.("Downloading encrypted archive...");
		await secureScp(`${target.host}:${target.remoteArchivePath}`, localEncPath);

		onProgress?.("Decrypting...");
		decryptFile(localEncPath, localTarPath, key);

		onProgress?.("Uploading decrypted files...");
		await secureScp(localTarPath, `${target.host}:${remoteTarPath}`);

		onProgress?.("Extracting...");
		const extractResult = await runRemoteCommand(
			target.host,
			`cd ${escapeShellArg(target.remotePath)} && tar xf ${escapeShellArg(remoteTarName)} && rm -f ${escapeShellArg(remoteTarName)} ${escapeShellArg(target.archiveName)}`,
		);

		if (!extractResult.success) {
			return {
				success: false,
				error: extractResult.error || "Unknown error",
			};
		}

		return { success: true };
	});
};

// encrypt remote archive
export const encryptRemoteArchive = async (
	target: RemoteArchiveTarget,
	key: Buffer,
	onProgress?: (message: string) => void,
): Promise<RemoteArchiveResult> => {
	const remoteTarName = `${target.project}.tar`;
	const remoteTarPath = `${target.remotePath}/${remoteTarName}`;

	return withArchiveTempPaths(async ({ localTarPath, localEncPath }) => {
		onProgress?.("Creating archive on remote...");
		const tarResult = await runRemoteCommand(
			target.host,
			`cd ${escapeRemotePath(target.remotePath)} && tar cf ${escapeShellArg(remoteTarName)} --exclude=${escapeShellArg(target.archiveName)} --exclude=${escapeShellArg(remoteTarName)} -C ${escapeRemotePath(target.remotePath)} .`,
		);

		if (!tarResult.success) {
			return {
				success: false,
				error: tarResult.error || "Unknown error",
			};
		}

		onProgress?.("Downloading archive...");
		await secureScp(`${target.host}:${remoteTarPath}`, localTarPath);

		onProgress?.("Encrypting...");
		encryptFile(localTarPath, localEncPath, key);

		onProgress?.("Uploading encrypted archive...");
		await secureScp(localEncPath, `${target.host}:${target.remoteArchivePath}`);

		onProgress?.("Cleaning up remote...");
		const cleanResult = await runRemoteCommand(
			target.host,
			`rm -f ${escapeRemotePath(remoteTarPath)} && find ${escapeRemotePath(target.remotePath)} -mindepth 1 -not -name ${escapeShellArg(target.archiveName)} -depth -delete 2>/dev/null; true`,
		);

		return {
			success: true,
			cleanupWarning: !cleanResult.success,
		};
	});
};
