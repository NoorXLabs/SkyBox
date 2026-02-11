import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
} from "@lib/constants.ts";
import { escapeRemotePath, escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";

// write devcontainer.json to a remote project directory over SSH.
export const pushDevcontainerJsonToRemote = async (
	host: string,
	remoteProjectPath: string,
	devcontainerJson: string,
	identityFile?: string,
): Promise<{ success: boolean; stdout?: string; error?: string }> => {
	const encoded = Buffer.from(devcontainerJson).toString("base64");
	const remoteDevcontainerDir = `${remoteProjectPath}/${DEVCONTAINER_DIR_NAME}`;
	const remoteConfigPath = `${remoteDevcontainerDir}/${DEVCONTAINER_CONFIG_NAME}`;
	const command = `mkdir -p ${escapeRemotePath(remoteDevcontainerDir)} && echo ${escapeShellArg(encoded)} | base64 -d > ${escapeRemotePath(remoteConfigPath)}`;
	return runRemoteCommand(host, command, identityFile);
};
