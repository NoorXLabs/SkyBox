import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const COMMANDS_DIR = join(process.cwd(), "src", "commands");
const ENCRYPTION_SETUP_ASSIGNMENT =
	/\.encryption\s*=\s*\{\s*enabled:\s*true,\s*salt\s*,?\s*\}/gs;
const ONE_SHOT_CREATION_PROMPT =
	/password(?:Prompt)?\s*\(\s*\{\s*message:\s*"Enter encryption passphrase:"/s;

interface EncryptionSetupSite {
	file: string;
	content: string;
	matches: RegExpMatchArray[];
}

const getEncryptionSetupSites = (): EncryptionSetupSite[] => {
	const commandFiles = readdirSync(COMMANDS_DIR)
		.filter((file) => file.endsWith(".ts"))
		.map((file) => join(COMMANDS_DIR, file));

	const sites: EncryptionSetupSite[] = [];
	for (const file of commandFiles) {
		const content = readFileSync(file, "utf8");
		const matches = [...content.matchAll(ENCRYPTION_SETUP_ASSIGNMENT)];
		if (matches.length > 0) {
			sites.push({ file, content, matches });
		}
	}

	return sites;
};

describe("encryption setup passphrase confirmation", () => {
	test("all encryption setup flows use promptPassphraseWithConfirmation", () => {
		const setupSites = getEncryptionSetupSites();
		expect(setupSites.length).toBeGreaterThan(0);

		const setupFiles = setupSites.map((site) => site.file);
		expect(setupFiles).toEqual(
			expect.arrayContaining([
				join(COMMANDS_DIR, "encrypt.ts"),
				join(COMMANDS_DIR, "new.ts"),
			]),
		);

		for (const site of setupSites) {
			for (const match of site.matches) {
				const start = Math.max(0, (match.index ?? 0) - 1200);
				const end = Math.min(
					site.content.length,
					(match.index ?? 0) + match[0].length + 200,
				);
				const setupWindow = site.content.slice(start, end);
				expect(setupWindow).toContain("promptPassphraseWithConfirmation(");
			}
		}
	});

	test("encryption setup flows do not use one-shot passphrase creation prompts", () => {
		const setupSites = getEncryptionSetupSites();
		expect(setupSites.length).toBeGreaterThan(0);

		for (const site of setupSites) {
			for (const match of site.matches) {
				const start = Math.max(0, (match.index ?? 0) - 1200);
				const end = Math.min(
					site.content.length,
					(match.index ?? 0) + match[0].length + 200,
				);
				const setupWindow = site.content.slice(start, end);
				expect(setupWindow).not.toMatch(ONE_SHOT_CREATION_PROMPT);
			}
		}
	});
});
