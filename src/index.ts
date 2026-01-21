// src/index.ts
import { program } from "commander";
import { initCommand } from "./commands/init";

program
  .name("devbox")
  .description("Local-first dev containers with remote sync")
  .version("0.1.0");

program
  .command("init")
  .description("Interactive setup wizard")
  .action(initCommand);

program.parse();
