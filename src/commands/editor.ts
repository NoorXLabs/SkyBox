// src/commands/editor.ts
import inquirer from "inquirer";
import { loadConfig, configExists, saveConfig } from "../lib/config";
import { SUPPORTED_EDITORS } from "../lib/container";
import { success, error, info, header } from "../lib/ui";

export async function editorCommand(): Promise<void> {
  if (!configExists()) {
    error("devbox not configured. Run 'devbox init' first.");
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    error("Failed to load config.");
    process.exit(1);
  }

  const currentEditor = config.editor || "not set";
  header("Editor Configuration");
  info(`Current default: ${currentEditor}`);
  console.log();

  const choices = SUPPORTED_EDITORS.map((e) => ({
    name: e.id === config.editor ? `${e.name} (current)` : e.name,
    value: e.id,
  }));
  choices.push({ name: "Other (specify command)", value: "other" });

  const { selectedEditor } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedEditor",
      message: "Select default editor:",
      choices,
    },
  ]);

  let editor = selectedEditor;

  if (selectedEditor === "other") {
    const { customEditor } = await inquirer.prompt([
      {
        type: "input",
        name: "customEditor",
        message: "Enter editor command:",
      },
    ]);
    editor = customEditor;
  }

  if (editor === config.editor) {
    info("Editor unchanged.");
    return;
  }

  config.editor = editor;
  saveConfig(config);
  success(`Default editor updated to ${editor}.`);
}
