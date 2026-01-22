// src/index.ts
import { program } from "commander";
import { initCommand } from "./commands/init";
import { browseCommand } from "./commands/browse";
import { listCommand } from "./commands/list";
import { cloneCommand } from "./commands/clone";
import { pushCommand } from "./commands/push";
import { upCommand } from "./commands/up";
import { downCommand } from "./commands/down";
import { editorCommand } from "./commands/editor";
import { statusCommand } from "./commands/status";

program
	.name("devbox")
	.description("Local-first dev containers with remote sync")
	.version("0.1.0");

program
	.command("init")
	.description("Interactive setup wizard")
	.action(initCommand);

program
	.command("browse")
	.description("List projects on remote server")
	.action(browseCommand);

program.command("list").description("List local projects").action(listCommand);

program
	.command("clone <project>")
	.description("Clone remote project locally")
	.action(cloneCommand);

program
	.command("push <path> [name]")
	.description("Push local project to remote")
	.action(pushCommand);

program
  .command("up [project]")
  .description("Start a development container")
  .option("-e, --editor", "Open in editor after start")
  .option("-a, --attach", "Attach to shell after start")
  .option("-r, --rebuild", "Force container rebuild")
  .option("--no-prompt", "Non-interactive mode")
  .option("-v, --verbose", "Show detailed output")
  .action(upCommand);

program
  .command("down [project]")
  .description("Stop a development container")
  .option("-c, --cleanup", "Remove container and volumes")
  .option("-f, --force", "Force stop even on errors")
  .option("--no-prompt", "Non-interactive mode")
  .action(downCommand);

program
  .command("editor")
  .description("Change default editor")
  .action(editorCommand);

program
  .command("status [project]")
  .description("Show project status")
  .action(statusCommand);

program.parse();
