import { info } from "@lib/ui.ts";
import inquirer from "inquirer";

interface OfferStartContainerOptions {
	projectName: string;
	defaultStart: boolean;
	onStart: (projectName: string) => Promise<void>;
	onDeclineMessages?: string[];
}

// offer to start a project's dev container and handle shared prompt messaging
export const offerStartContainer = async (
	options: OfferStartContainerOptions,
): Promise<boolean> => {
	const { projectName, defaultStart, onStart, onDeclineMessages } = options;

	console.log();
	const { startContainer } = await inquirer.prompt([
		{
			type: "confirm",
			name: "startContainer",
			message: "Start dev container now?",
			default: defaultStart,
		},
	]);

	if (startContainer) {
		await onStart(projectName);
		return true;
	}

	const fallbackMessage = `Run 'skybox up ${projectName}' when ready to start working.`;
	for (const message of onDeclineMessages || [fallbackMessage]) {
		info(message);
	}

	return false;
};
