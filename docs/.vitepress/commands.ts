/**
 * Single source of truth for the reference command list.
 * Used by both the sidebar (config.ts) and the commands overview page.
 */
export interface CommandEntry {
  /** Display name, e.g. "devbox init" */
  text: string;
  /** Link path, e.g. "/reference/init" */
  link: string;
  /** Short description for the overview table */
  description: string;
}

export const commands: CommandEntry[] = [
  { text: "devbox init", link: "/reference/init", description: "Interactive setup wizard" },
  { text: "devbox new", link: "/reference/new", description: "Create new project on remote" },
  { text: "devbox clone", link: "/reference/clone", description: "Clone remote project locally" },
  { text: "devbox push", link: "/reference/push", description: "Push local project to remote" },
  { text: "devbox up", link: "/reference/up", description: "Start a development container" },
  { text: "devbox down", link: "/reference/down", description: "Stop a development container" },
  { text: "devbox shell", link: "/reference/shell", description: "Access shell inside container" },
  { text: "devbox open", link: "/reference/open", description: "Open editor/shell for running container" },
  { text: "devbox status", link: "/reference/status", description: "Show project status" },
  { text: "devbox dashboard", link: "/reference/dashboard", description: "Full-screen status dashboard" },
  { text: "devbox browse", link: "/reference/browse", description: "List projects on remote server" },
  { text: "devbox list", link: "/reference/list", description: "List local projects" },
  { text: "devbox rm", link: "/reference/rm", description: "Remove project locally (keeps remote)" },
  { text: "devbox editor", link: "/reference/editor", description: "Change default editor" },
  { text: "devbox config", link: "/reference/config", description: "View/modify configuration" },
  { text: "devbox remote", link: "/reference/remote", description: "Manage remote servers" },
  { text: "devbox doctor", link: "/reference/doctor", description: "Diagnose common issues" },
  { text: "devbox logs", link: "/reference/logs", description: "Show container or sync logs" },
  { text: "devbox encrypt", link: "/reference/encryption", description: "Manage project encryption" },
  { text: "devbox update", link: "/reference/update", description: "Update Mutagen binary" },
];
