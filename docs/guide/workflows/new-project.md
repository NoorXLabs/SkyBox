# Creating a New Project

This guide walks through creating projects with SkyBox, whether starting from scratch or bringing an existing codebase.

## Prerequisites

Before creating projects, ensure SkyBox is configured:

```bash
skybox init
```

This sets up your remote server connection and preferred editor.

## Option 1: Push an Existing Project

The most common workflow is pushing a local project to SkyBox for containerized development.

### Step 1: Push Your Project

```bash
skybox push ./my-project
```

Or specify a custom name:

```bash
skybox push ./my-project my-app
```

### Step 2: What Happens

1. **Git Check** - SkyBox verifies the project is a git repository (offers to initialize if not)
2. **Remote Creation** - Creates the project directory on your remote server
3. **Local Copy** - Copies files to `~/.skybox/Projects/<project-name>`
4. **Sync Setup** - Establishes two-way sync with Mutagen
5. **Initial Sync** - Waits for all files to sync to remote

### Step 3: Start Development

After push completes, start the container:

```bash
skybox up my-project
```

## Option 2: Clone from Remote

If a project already exists on your remote server (perhaps pushed from another machine), clone it locally.

### Step 1: Browse Available Projects

```bash
skybox browse
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
skybox clone backend-api
```

### Step 3: What Happens

1. **Remote Check** - Verifies the project exists on remote
2. **Local Directory** - Creates `~/.skybox/Projects/backend-api`
3. **[Sync](/guide/concepts#sync) Session** - Creates Mutagen sync session
4. **Initial Sync** - Downloads all files from remote
5. **Optional Start** - Prompts to start the dev container

## Option 3: Create a New Project with `skybox new`

The `skybox new` command creates a project on the remote server from scratch, with full template selection:

```bash
skybox new my-app
```

SkyBox walks you through the full setup:

1. **Creates the project** on the remote server
2. **Prompts for template selection** (see below)
3. **Generates devcontainer configuration**
4. **Sets up sync** and optionally starts the container

This is the recommended way to start a brand new project.

## Option 4: Start from a Template (Existing Directory)

When pushing a project that has no `devcontainer.json`, SkyBox automatically offers template selection during `skybox up`.

### Step 1: Create Project Directory

```bash
mkdir ~/code/new-app
cd ~/code/new-app
git init
```

### Step 2: Push to SkyBox

```bash
skybox push .
```

### Step 3: Start and Select Template

```bash
skybox up new-app
```

SkyBox detects no `devcontainer.json` and offers templates:

<!--@include: ../../snippets/template-selector-up.md-->

### Available Templates

<!--@include: ../../snippets/templates-table.md-->

You can also use a **custom template** by providing a git URL. In the template selector, choose "Enter git URL" under the "Other" section:

<!--@include: ../../snippets/template-selector-full.md-->

When selecting "Enter git URL", provide a git repository URL:

```
? Git repository URL: https://github.com/my-org/custom-devcontainer.git
```

All built-in templates include these common features:

<!--@include: ../../snippets/common-template-features.md-->

### Step 4: Template Creates Configuration

SkyBox creates `.devcontainer/devcontainer.json`:

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

After SkyBox creates the initial configuration, you can customize it:

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
~/.skybox/
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
skybox status my-project
```

Output shows:

<!--@include: ../../snippets/status-detailed.md-->

## Next Steps

- [Daily Development](/guide/workflows/daily-development) - Learn the day-to-day workflow
- [Multi-Machine Workflow](/guide/workflows/multi-machine) - Working across multiple computers
