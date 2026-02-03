# Team Sharing Workflow

This guide covers how multiple developers can work on the same projects using a shared remote server.

## Shared Remote Architecture

DevBox uses a shared remote server as the central hub for project storage:

```
                    Remote Server (your-server:~/code)
                    +----------------------------------+
                    |  backend-api/                    |
                    |  frontend-app/                   |
                    |  shared-lib/                     |
                    |  .devbox-locks/                  |
                    +----------------------------------+
                           ^           ^
                           |           |
                    +------+           +------+
                    |                         |
            Alice's Mac                 Bob's Linux
            (local copy)                (local copy)
```

Key principles:
- Each developer has their own local copy synced to their machine
- The remote holds the canonical version
- Locks prevent simultaneous editing by multiple people
- Changes sync to remote automatically

## Setting Up a Shared Server

### Step 1: Server Requirements

The remote server needs:
- SSH access for all team members
- Shared code directory (e.g., `/home/team/code` or `~/code`)
- Write permissions for all team members

### Step 2: Each Developer Runs Init

Each team member configures DevBox to point to the same server:

```bash
devbox init
```

```
? Select SSH host:
  1) team-server (dev.company.com)
  + Add new server

? Remote code directory: ~/code
```

All team members should use the same:
- SSH host
- Base path (remote code directory)

## Sharing a New Project

### Alice Creates the Project

```bash
# Alice pushes her local project
devbox push ./backend-api
```

This:
1. Creates `~/code/backend-api` on the remote
2. Syncs all files to the remote
3. Registers the project in Alice's local DevBox config

### Bob Clones the Project

```bash
# Bob sees Alice's project
devbox browse
```

```
Remote projects (team-server:~/code):

  backend-api
    Branch: main
```

```bash
# Bob clones it locally
devbox clone backend-api
```

This:
1. Creates `~/.devbox/Projects/backend-api` on Bob's machine
2. Downloads all files from remote
3. Sets up sync session

## Coordinating Work with Locks

### How Locks Work

When Alice runs `devbox up backend-api`:

1. DevBox checks `.devbox-locks/backend-api.lock` on remote
2. Creates lock file with her machine info:
   ```json
   {
     "machine": "alices-macbook",
     "user": "alice",
     "timestamp": "2024-01-15T09:00:00Z",
     "pid": 12345
   }
   ```
3. Alice can now work safely

### When Bob Tries to Work

If Bob runs `devbox up backend-api` while Alice has the lock:

```
Project locked by 'alices-macbook' since 2024-01-15T09:00:00Z
? Take over lock anyway? (y/N)
```

Bob has options:
- **Wait** - Ask Alice when she'll be done
- **Take Over** - Force acquire the lock (Alice loses her lock)

### Lock Takeover

If Bob takes over:

```
? Take over lock anyway? Yes
Lock acquired (forced takeover)
```

Alice's next `devbox down` will skip lock release and warn "Lock owned by another machine — skipping release". Her next `devbox up` will show "Project locked by Bob's machine" and offer a takeover prompt.

### Releasing Locks

Alice releases her lock when she runs:

```bash
devbox down backend-api
```

This:
1. Flushes pending changes to remote
2. Stops the container
3. Deletes the lock file

## Communication Patterns

### Check Who Has the Lock

```bash
devbox status backend-api
```

```
Lock
  Status:     locked (alices-macbook)
  Machine:    alices-macbook
  User:       alice
  Timestamp:  2024-01-15T09:00:00Z
```

### Quick Status Check

```bash
devbox status
```

The LOCK column shows current status:
```
  NAME          CONTAINER  SYNC      BRANCH   LOCK                  LAST ACTIVE
  backend-api   stopped    paused    main     locked (alices-macbook) 2 hours ago
  frontend-app  stopped    paused    develop  unlocked              3 days ago
```

### Cross-Project Lock Overview

See all locks across projects on a remote:

```bash
devbox locks
```

```
Locks on team-server:

  PROJECT                         STATUS                     SINCE
  backend-api                     locked (alices-macbook)    2024-01-15T09:00:00Z
  frontend-app                    unlocked
```

The `devbox browse` command also shows a LOCK column for each remote project.

## Working on Different Projects

The simplest collaboration pattern: each developer works on different projects.

```bash
# Alice works on backend
devbox up backend-api

# Bob works on frontend
devbox up frontend-app
```

No lock conflicts since they're different projects.

## Handoff Workflow

When developers need to pass work between each other:

### Alice Finishes Her Work

```bash
# Commit changes
git add .
git commit -m "Add user authentication"

# Stop and release lock
devbox down backend-api
```

### Bob Picks Up

```bash
# Clone or refresh local copy
devbox up backend-api
```

Bob now has:
- The lock
- All of Alice's changes (synced from remote)

## Code Review Workflow

### Developer Pushes Feature Branch

```bash
# Alice on feature branch
git checkout -b feature/auth
# ... make changes ...
git commit -m "Add auth"
git push origin feature/auth
```

### Reviewer Clones and Checks Out

```bash
# Bob clones the project
devbox clone backend-api
devbox up backend-api

# Inside container or editor
git fetch origin
git checkout feature/auth

# Review the code
```

### After Review

```bash
devbox down backend-api
```

Bob's review doesn't affect Alice's work since they're on different branches and Bob releases the lock when done.

## Handling Conflicts

### Sync Conflicts

Mutagen uses "two-way-resolved" mode by default, which automatically resolves most conflicts. In case of true conflicts (same file edited on both sides):

1. Mutagen creates `.conflict` backup files
2. Check the backup and manually resolve
3. Delete the `.conflict` file

### Git Conflicts

Standard git workflow applies:

```bash
git pull origin main
# Resolve conflicts in your editor
git add .
git commit -m "Merge main"
```

## Best Practices for Teams

### 1. Communicate Lock Status

Use chat/Slack to coordinate:
- "Taking backend-api for the morning"
- "Done with backend-api, lock released"

### 2. Release Locks When Done

Always run `devbox down` when stepping away:

```bash
devbox down backend-api
```

### 3. Use Feature Branches

Avoid working on the same files:

```bash
git checkout -b feature/my-work
```

### 4. Commit Frequently

Smaller commits sync faster and reduce conflict risk:

```bash
git add .
git commit -m "WIP: auth endpoint"
```

### 5. Check Status Before Starting

```bash
devbox status backend-api
```

See if someone else is working before diving in.

## Troubleshooting Team Issues

### Stale Lock After Crash

If a teammate's machine crashed without releasing the lock:

```bash
devbox up backend-api
# Take over lock when prompted
```

Or ask the teammate to:
```bash
devbox down backend-api --force
```

### Lock Expiry (TTL)

Locks automatically expire after 24 hours. If a machine crashes without running `devbox down`, the lock becomes stale and other developers can acquire it without a takeover prompt.

To check if a lock is stale, run:

```bash
devbox status backend-api
```

Expired locks are treated as unlocked — no manual intervention needed.

### Out of Sync

If your local copy seems behind:

```bash
# Check sync status
devbox status backend-api

# Force a full resync by removing and re-cloning
devbox rm backend-api
devbox clone backend-api
```

### Permission Issues

Ensure all team members have write access to the shared directory:

```bash
ssh team-server
chmod -R g+w ~/code
```

## Multi-Remote Support

DevBox supports multiple remote servers. This is useful for teams that split infrastructure by domain or environment:

```bash
# Add multiple remotes
devbox remote add backend-server deploy@backend.company.com --path ~/code
devbox remote add frontend-server deploy@frontend.company.com --path ~/code
```

Each project inherits its remote from your config. Configure the remote first with `devbox remote add`, then push:

```bash
devbox push ./backend-api
devbox push ./frontend-app
```

Team members configure the same set of remotes to access all shared projects.

## Selective Sync for Large Repos

For large repositories, selective sync avoids downloading unnecessary files:

```bash
devbox config set myproject sync_paths "src,tests,package.json"
```

Only the specified paths are synchronized. This is especially useful for monorepos where each developer works on a subset of the codebase. Paths must be relative to the project root.

## Encrypting Sensitive Configuration

For projects with sensitive configuration (API keys, credentials in devcontainer settings), use encryption:

```bash
devbox encrypt enable myproject
```

This encrypts the project's files on the remote with a passphrase. When a team member runs `devbox up`, they'll be prompted for the passphrase to decrypt. When they run `devbox down`, files are re-encrypted on the remote.

::: warning
The passphrase cannot be recovered if lost. Share it securely with team members (e.g., via a password manager).
:::

## Scaling to Larger Teams

For larger teams, consider:

### Per-Developer Remotes

Each developer gets their own remote directory:

```
team-server:
  /home/alice/code/
  /home/bob/code/
```

Pros: No lock conflicts
Cons: Need to manually share via git

### Multiple Shared Servers

Split projects across servers using multi-remote support:

```bash
devbox remote add api-server deploy@api.company.com --path ~/code
devbox remote add frontend-server deploy@fe.company.com --path ~/code
```

### Branch-Based Workflow

Each developer works on their own branch:
- No lock conflicts on same project
- Merge via pull requests
- Locks only needed during code review
