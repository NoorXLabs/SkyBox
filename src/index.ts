// src/index.ts
import { program } from "commander";
import { initCommand } from "./commands/init";
import { browseCommand } from "./commands/browse";
import { listCommand } from "./commands/list";
import { cloneCommand } from "./commands/clone";
import { pushCommand } from "./commands/push";

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

program
  .command("list")
  .description("List local projects")
  .action(listCommand);

program
  .command("clone <project>")
  .description("Clone remote project locally")
  .action(cloneCommand);

program
  .command("push <path> [name]")
  .description("Push local project to remote")
  .action(pushCommand);

program.parse();
