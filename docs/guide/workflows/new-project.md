# Creating a New Project

This guide walks through creating projects with DevBox, whether starting from scratch or bringing an existing codebase.

## Prerequisites

Before creating projects, ensure DevBox is configured:

```bash
devbox init
```

This sets up your remote server connection and preferred editor.

## Option 1: Push an Existing Project

The most common workflow is pushing a local project to DevBox for containerized development.

### Step 1: Push Your Project

```bash
devbox push ./my-project
```

Or specify a custom name:

```bash
devbox push ./my-project my-app
```

### Step 2: What Happens

1. **Git Check** - DevBox verifies the project is a git repository (offers to initialize if not)
2. **Remote Creation** - Creates the project directory on your remote server
3. **Local Copy** - Copies files to `~/.devbox/Projects/<project-name>`
4. **Sync Setup** - Establishes two-way sync with Mutagen
5. **Initial Sync** - Waits for all files to sync to remote

### Step 3: Start Development

After push completes, start the container:

```bash
devbox up my-project
```

## Option 2: Clone from Remote

If a project already exists on your remote server (perhaps pushed by a teammate), clone it locally.

### Step 1: Browse Available Projects

```bash
devbox browse
```

This shows all projects in your remote code directory:

```
Remote projects (myserver:~/code):

  backend-api
    Branch: main

  frontend-app
    Branch: feature/auth
```

### Step 2: Clone the Project

```bash
devbox clone backend-api
```

### Step 3: What Happens

1. **Remote Check** - Verifies the project exists on remote
2. **Local Directory** - Creates `~/.devbox/Projects/backend-api`
3. **Sync Session** - Creates Mutagen sync session
4. **Initial Sync** - Downloads all files from remote
5. **Optional Start** - Prompts to start the dev container

## Option 3: Create a New Project with `devbox new`

The `devbox new` command creates a project on the remote server from scratch, with full template selection:

```bash
devbox new my-app
```

DevBox walks you through the full setup:

1. **Creates the project** on the remote server
2. **Prompts for template selection** (see below)
3. **Generates devcontainer configuration**
4. **Sets up sync** and optionally starts the container

This is the recommended way to start a brand new project.

## Option 4: Start from a Template (Existing Directory)

When pushing a project that has no `devcontainer.json`, DevBox automatically offers template selection during `devbox up`.

### Step 1: Create Project Directory

```bash
mkdir ~/code/new-app
cd ~/code/new-app
git init
```

### Step 2: Push to DevBox

```bash
devbox push .
```

### Step 3: Start and Select Template

```bash
devbox up new-app
```

DevBox detects no `devcontainer.json` and offers templates:

```
No devcontainer.json found
? Would you like to create a devcontainer.json from a template? (Y/n)
? Select a template:
  1) Node.js - Node.js (latest) with npm/yarn + Docker support
  2) Python - Python (latest) with pip/venv + Docker support
  3) Go - Go (latest) + Docker support
  4) Generic - Debian with basic dev tools + Docker support
```

### Available Templates

| Template | Base Image | Includes |
|----------|-----------|----------|
| **Node.js** | Node (latest) | npm, yarn, ESLint extension |
| **Python** | Python (latest) | pip, venv, Python extension |
| **Go** | Go (latest) | Go tools, Go extension |
| **Generic** | Debian | Basic dev tools |

You can also use a **custom template** by providing a git URL:

```
? Select a template:
  1) Node.js
  2) Python
  3) Go
  4) Generic
  5) Custom (git URL)
```

When selecting "Custom", provide a git repository URL containing a `.devcontainer/devcontainer.json`:

```
? Git URL: https://github.com/my-org/custom-devcontainer.git
```

All built-in templates include:
- Docker-outside-of-Docker (run containers from inside)
- SSH passthrough (your keys work inside the container)
- Zsh as default shell
- Git pre-installed

### Step 4: Template Creates Configuration

DevBox creates `.devcontainer/devcontainer.json`:

```json
{
  "name": "Node.js",
  "image": "mcr.microsoft.com/devcontainers/base:debian",
  "workspaceFolder": "/workspaces/new-app",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {},
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  }
}
```

This configuration is automatically committed to git.

## Customizing devcontainer.json

After DevBox creates the initial configuration, you can customize it:

### Add More Extensions

```json
{
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss"
      ]
    }
  }
}
```

### Add Environment Variables

```json
{
  "containerEnv": {
    "NODE_ENV": "development",
    "DATABASE_URL": "postgres://localhost:5432/mydb"
  }
}
```

### Add Services with Docker Compose

For more complex setups (databases, caches), create `.devcontainer/docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ..:/workspaces/my-app:cached

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: dev
```

Update `devcontainer.json`:

```json
{
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspaces/my-app"
}
```

## Project Structure After Setup

After creating a project, your file structure looks like:

```
~/.devbox/
  projects/
    my-project/           # Local synced copy
      .devcontainer/
        devcontainer.json
      .git/
      src/
      package.json

Remote (your-server:~/code/):
  my-project/             # Remote backup copy
    .devcontainer/
      devcontainer.json
    .git/
    src/
    package.json
```

## Verifying Setup

Check your project status:

```bash
devbox status my-project
```

Output shows:

```
Project: my-project
--------------------------------------------------

Container
  Status:     running
  Image:      mcr.microsoft.com/devcontainers/base:debian
  Uptime:     2 hours

Sync
  Status:     syncing
  Session:    devbox-my-project
  Pending:    0 files

Git
  Branch:     main
  Status:     clean

Lock
  Status:     locked (this machine)
```

## Next Steps

- [Daily Development](/guide/workflows/daily-development) - Learn the day-to-day workflow
- [Team Sharing](/guide/workflows/team-sharing) - Share projects with teammates
