import {
	downloadMutagen,
	getInstalledMutagenVersion,
	MUTAGEN_VERSION,
} from "../lib/download.ts";
import { getErrorMessage } from "../lib/errors.ts";
import { info, spinner, success } from "../lib/ui.ts";

export async function updateCommand(): Promise<void> {
	info("Checking for updates...\n");

	const installedVersion = await getInstalledMutagenVersion();
	const targetVersion = MUTAGEN_VERSION;

	if (!installedVersion) {
		info("Mutagen not installed. Installing...");
	} else if (installedVersion === targetVersion) {
		success(`Mutagen is up to date (v${targetVersion}).`);
		return;
	} else {
		info(`Mutagen: v${installedVersion} → v${targetVersion}`);
	}

	const s = spinner("Downloading Mutagen...");
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
