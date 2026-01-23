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

Alice's next `devbox up` or `devbox down` will fail gracefully with a notification that her lock was taken.

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

Split projects across servers:

```
api-server:~/code/       # Backend team
frontend-server:~/code/  # Frontend team
```

### Branch-Based Workflow

Each developer works on their own branch:
- No lock conflicts on same project
- Merge via pull requests
- Locks only needed during code review
