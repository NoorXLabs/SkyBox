/**
 * Single source of truth for the reference command list.
 * Used by both the sidebar (config.ts) and the commands overview page.
 */
export interface CommandEntry {
  /** Display name, e.g. "skybox init" */
  text: string;
  /** Link path, e.g. "/reference/init" */
  link: string;
  /** Short description for the overview table */
  description: string;
  /** Common usage example for quick reference */
  usage: string;
}

export const commands: CommandEntry[] = [
  { text: "skybox init", link: "/reference/init", description: "Interactive setup wizard", usage: "skybox init" },
  { text: "skybox new", link: "/reference/new", description: "Create new project on remote", usage: "skybox new my-app" },
  { text: "skybox clone", link: "/reference/clone", description: "Clone remote project locally", usage: "skybox clone my-app" },
  { text: "skybox push", link: "/reference/push", description: "Push local project to remote", usage: "skybox push ./my-app" },
  { text: "skybox up", link: "/reference/up", description: "Start a development container", usage: "skybox up my-app -e" },
  { text: "skybox down", link: "/reference/down", description: "Stop a development container", usage: "skybox down my-app" },
  { text: "skybox shell", link: "/reference/shell", description: "Access shell inside container", usage: "skybox shell my-app" },
  { text: "skybox open", link: "/reference/open", description: "Open editor/shell for running container", usage: "skybox open my-app --editor" },
  { text: "skybox status", link: "/reference/status", description: "Show project status", usage: "skybox status my-app" },
  { text: "skybox dashboard", link: "/reference/dashboard", description: "Full-screen status dashboard", usage: "skybox dashboard" },
  { text: "skybox browse", link: "/reference/browse", description: "List projects on remote server", usage: "skybox browse" },
  { text: "skybox list", link: "/reference/list", description: "List local projects", usage: "skybox list" },
  { text: "skybox rm", link: "/reference/rm", description: "Remove project locally (keeps remote)", usage: "skybox rm my-app" },
  { text: "skybox editor", link: "/reference/editor", description: "Change default editor", usage: "skybox editor" },
  { text: "skybox config", link: "/reference/config", description: "View/modify configuration", usage: "skybox config set editor code" },
  { text: "skybox remote", link: "/reference/remote", description: "Manage remote servers", usage: "skybox remote list" },
  { text: "skybox doctor", link: "/reference/doctor", description: "Diagnose common issues", usage: "skybox doctor" },
  { text: "skybox logs", link: "/reference/logs", description: "Show container or sync logs", usage: "skybox logs my-app -f" },
  { text: "skybox encrypt", link: "/reference/encryption", description: "Manage project encryption", usage: "skybox encrypt enable my-app" },
  { text: "skybox update", link: "/reference/update", description: "Check for and install SkyBox updates", usage: "skybox update" },
  { text: "skybox hook", link: "/reference/hook", description: "Shell integration for auto-starting containers", usage: "skybox hook bash" },
];
