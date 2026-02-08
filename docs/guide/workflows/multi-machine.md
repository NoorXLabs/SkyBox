# Multi-Machine Workflow

This guide covers working with SkyBox across multiple machines, such as a laptop and desktop. Sessions prevent sync conflicts when you switch between machines.

## How Sessions Prevent Sync Conflicts

When you run `skybox up`, SkyBox creates a session file that records which machine is actively working on the project. This file lives at:

```
<project>/.skybox/session.lock
```

Because this file is inside your project directory, Mutagen syncs it to your remote server and to any other machines syncing the same project. This means:

- When you start working on your laptop, your desktop sees the session file within seconds
- When you later sit down at your desktop, SkyBox warns you that the project is active elsewhere
- You can choose to continue anyway or go back to the original machine first

Sessions exist to protect you from sync conflicts, not to block you. If you know the other machine is idle (you just forgot to stop it), continuing is safe.

## Common Scenarios

### Forgot to Stop on Another Machine

You were working on your laptop, closed the lid, and now you are at your desktop:

```bash
skybox up my-project
```

```
This project is running on 'macbook-pro'.
? Continue anyway? (y/N)
```

If you choose yes:
- SkyBox creates a new session for your current machine
- The session file syncs to the laptop
- If you later return to the laptop and run a SkyBox command, it will see the session changed

This is safe as long as you are not actively editing on both machines simultaneously.

### Intentional Switching Between Machines

When you finish work on one machine, stop the project cleanly:

```bash
# On your laptop when leaving
skybox down my-project
```

This removes the session file. Then on your other machine:

```bash
# On your desktop when arriving
skybox up my-project
```

No warning appears because no active session exists.

### Working on the Same Machine

If you run `skybox up` on the same machine where the session is already active, SkyBox recognizes this and updates the session timestamp. No warning appears.

## Checking Session Status

Use `skybox status` to see if a session is active and where:

```bash
skybox status my-project
```

The output includes a Session section:

```
Session
  Status:     active here
  Machine:    macbook-pro
  User:       alice
  Started:    2026-02-04T10:30:00Z
```

If no session is active, you will see:

```
Session
  Status:     none
```

### Quick Status Check

To see all projects at once:

```bash
skybox status
```

The table shows session status for each project.

## Session Expiry

Sessions expire after 24 hours. This handles cases where a machine crashed or lost network connectivity before running `skybox down`. Expired sessions are treated as inactive.

## What Sessions Are NOT

Sessions are a personal safety feature for one person working across multiple computers. They are not a team collaboration tool.

**For team collaboration, use Git.**

- Multiple team members should each have their own remote folder or remote server
- Use branches and pull requests to coordinate code changes
- SkyBox remotes are for offloading disk space, not sharing workspaces

If two people try to work on the same SkyBox project simultaneously, you will have sync conflicts regardless of sessions. Sessions only help when one person forgets to stop on another machine.

## Session File Details

The session file contains:

<!--@include: ../../snippets/session-file-format.md-->

- **machine**: Hostname of the machine that started the session
- **user**: Username who started it
- **timestamp**: When the session started
- **pid**: Process ID (used to detect stale sessions on the same machine)
- **expires**: When the session automatically expires (24 hours from start)

## Next Steps

- [Daily Development](/guide/workflows/daily-development) - Day-to-day workflow patterns
- [New Project Setup](/guide/workflows/new-project) - Creating and cloning projects
