// src/index.ts
import { program } from "commander";
import pkg from "../package.json";
import { browseCommand } from "./commands/browse.ts";
import { cloneCommand } from "./commands/clone.ts";
import { downCommand } from "./commands/down.ts";
import { editorCommand } from "./commands/editor.ts";
import { initCommand } from "./commands/init.ts";
import { listCommand } from "./commands/list.ts";
import { pushCommand } from "./commands/push.ts";
import { rmCommand } from "./commands/rm.ts";
import { shellCommand } from "./commands/shell.ts";
import { statusCommand } from "./commands/status.ts";
import { upCommand } from "./commands/up.ts";

program
	.name("devbox")
	.description("Local-first dev containers with remote sync")
	.version(pkg.version, "-v, --version");

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
	.option("--verbose", "Show detailed output")
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

program
	.command("rm <project>")
	.description("Remove project locally (keeps remote)")
	.option("-f, --force", "Skip confirmation prompt")
	.action(rmCommand);

program
	.command("shell <project>")
	.description("Enter container shell")
	.option("-c, --command <cmd>", "Run a single command and exit")
	.action(shellCommand);

program.parse();
