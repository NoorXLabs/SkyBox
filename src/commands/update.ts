import { MUTAGEN_VERSION } from "@lib/constants.ts";
import { downloadMutagen, getInstalledMutagenVersion } from "@lib/download.ts";
import { getErrorMessage } from "@lib/errors.ts";
import {
	ensureMutagenExtracted,
	needsMutagenExtraction,
} from "@lib/mutagen-extract.ts";
import { info, spinner, success } from "@lib/ui.ts";

export async function updateCommand(): Promise<void> {
	info("Checking for updates...\n");

	const installedVersion = await getInstalledMutagenVersion();
	const targetVersion = MUTAGEN_VERSION;

	if (installedVersion === targetVersion && !needsMutagenExtraction()) {
		success(`Mutagen is up to date (v${targetVersion}).`);
		return;
	}

	if (installedVersion) {
		info(`Mutagen: v${installedVersion} → v${targetVersion}`);
	} else {
		info("Mutagen not installed. Installing...");
	}

	const s = spinner("Installing Mutagen...");

	// Try bundled extraction first, fall back to download
	const extractResult = await ensureMutagenExtracted((progress) => {
		s.text = progress;
	});

	if (extractResult.success) {
		s.succeed(`Mutagen updated to v${targetVersion}.`);
		return;
	}

	// Fallback: download from GitHub
	s.text = "Downloading Mutagen...";
	try {
		const result = await downloadMutagen((progress) => {
			s.text = `Downloading Mutagen... ${progress}`;
		});
		if (result.success) {
			s.succeed(`Mutagen updated to v${targetVersion}.`);
		} else {
			s.fail(`Update failed: ${result.error}`);
		}
	} catch (err) {
		s.fail(`Update failed: ${getErrorMessage(err)}`);
	}
}
