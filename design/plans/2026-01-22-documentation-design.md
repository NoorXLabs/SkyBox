# Design: DevBox Documentation Site

VitePress-based documentation for end users and contributors.

## Overview

- **Framework:** VitePress
- **Audience:** End users (primary) + contributors (architecture section)
- **Hosting:** Custom domain, self-hosted static files
- **Branding:** Custom color scheme, typography, hero landing page

## Site Structure

```
docs/
├── .vitepress/
│   ├── config.ts              # Site config, nav, sidebar
│   └── theme/
│       └── style.css          # Custom branding styles
├── public/
│   └── logo.svg               # Site logo
├── index.md                   # Landing page with hero
├── guide/
│   ├── index.md               # Getting Started
│   ├── installation.md        # Install DevBox
│   ├── quick-start.md         # First project in 5 minutes
│   ├── concepts.md            # Core concepts
│   └── workflows/
│       ├── new-project.md           # Creating projects
│       ├── daily-development.md     # Day-to-day usage
│       └── team-sharing.md          # Sharing with teammates
├── reference/
│   ├── index.md               # Command overview table
│   ├── init.md                # devbox init
│   ├── up.md                  # devbox up
│   ├── down.md                # devbox down
│   ├── clone.md               # devbox clone
│   ├── push.md                # devbox push
│   ├── browse.md              # devbox browse
│   ├── list.md                # devbox list
│   ├── status.md              # devbox status
│   ├── editor.md              # devbox editor
│   └── configuration.md       # Config file reference
└── architecture/
    ├── index.md               # Overview for contributors
    ├── codebase.md            # Directory structure, key files
    └── design-decisions.md    # Why things are built this way
```

**Navigation:**
- Top nav: Guide | Reference | Architecture
- Sidebar: Pages within each section

## Landing Page

Uses VitePress hero layout:

```yaml
---
layout: home
hero:
  name: DevBox
  text: Local-first dev containers
  tagline: Develop locally. Sync remotely. Stay consistent.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: GitHub
      link: https://github.com/user/devbox
features:
  - title: Local Development
    details: Work offline with fast iteration using your machine's resources
  - title: Remote Sync
    details: Push and pull projects to a remote server seamlessly
  - title: Container-Based
    details: Consistent dev environments using devcontainers
---
```

## Guide Section

### Getting Started (`guide/index.md`)
- What DevBox is and who it's for
- Prerequisites (Docker, SSH access to remote server)
- Links to installation and quick-start

### Installation (`guide/installation.md`)
- Install via npm/bun
- Verify installation
- Troubleshooting common issues

### Quick Start (`guide/quick-start.md`)
- Run `devbox init` to configure remote
- Clone existing project or create new one
- Run `devbox up` to start container
- Open in editor
- Summary: ready to develop

### Concepts (`guide/concepts.md`)
- **Projects** - What a project is, local vs remote locations
- **Containers** - How devcontainers work, role of `devcontainer.json`
- **Sync** - How Mutagen keeps local and remote in sync
- **Remote server** - What the remote is, why it exists

### Workflows
- `new-project.md` - Creating projects from scratch or templates
- `daily-development.md` - Starting, stopping, switching projects
- `team-sharing.md` - Multiple people on same remote

## Reference Section

### Command Page Template

Each command uses consistent format:

```markdown
# devbox <command>

One-line description.

## Usage

devbox <command> [arguments] [options]

## Arguments

| Argument | Description |
|----------|-------------|
| `<arg>`  | What it does |

## Options

| Option | Description |
|--------|-------------|
| `-x, --example` | What it does |

## Examples

# Common use case
devbox <command> something

# Another scenario
devbox <command> --option value

## See Also

- [Related command](/reference/other.md)
```

### Reference Index (`reference/index.md`)

Quick-reference table of all commands:

| Command | Description |
|---------|-------------|
| `init` | Interactive setup wizard |
| `browse` | List projects on remote server |
| `list` | List local projects |
| `clone` | Clone remote project locally |
| `push` | Push local project to remote |
| `up` | Start a development container |
| `down` | Stop a development container |
| `status` | Show project status |
| `editor` | Change default editor |

### Configuration (`reference/configuration.md`)
- Config file location (`~/.config/devbox/config.yaml`)
- All config options with types and defaults
- Example full config file

## Architecture Section

### Overview (`architecture/index.md`)
- High-level architecture diagram (Mermaid)
- Main components: CLI entry point, commands, lib modules
- Data flow example: how `devbox up` works end-to-end

### Codebase (`architecture/codebase.md`)

Directory structure:

```
src/
├── index.ts        # CLI entry, command registration
├── commands/       # One file per command
├── lib/            # Shared logic (container, ssh, mutagen, etc.)
└── types/          # TypeScript type definitions
```

- Key files and responsibilities
- Where to add a new command
- Where to modify core behavior

### Design Decisions (`architecture/design-decisions.md`)
- Why local-first with remote sync
- Why Mutagen for file sync
- Why devcontainers as container format
- Configuration file format choices
- Error handling approach

## Branding & Theming

Custom styles in `.vitepress/theme/style.css`:

```css
:root {
  /* Override default accent colors */
  --vp-c-brand-1: #your-color;
  --vp-c-brand-2: #your-color;
  --vp-c-brand-3: #your-color;
}
```

Custom theme setup in `.vitepress/theme/index.ts`:

```typescript
import DefaultTheme from 'vitepress/theme'
import './style.css'

export default DefaultTheme
```

## Project Setup

### Move Existing Plans

Rename `docs/plans/` to `design/plans/` to avoid conflict with VitePress docs:

```
/
├── docs/           # VitePress documentation site (new)
├── design/         # Internal design documents (moved from docs/)
│   └── plans/
└── src/
```

### Dependencies

```json
{
  "devDependencies": {
    "vitepress": "^1.x"
  }
}
```

### Scripts

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
}
```

## Deployment

1. Run `bun run docs:build`
2. Output in `docs/.vitepress/dist/`
3. Upload to hosting, point custom domain at files

## Implementation Order

1. Move `docs/plans/` to `design/plans/`
2. Create VitePress structure and config
3. Build landing page with branding
4. Write guide section (installation, quick-start, concepts)
5. Write reference section (all commands from source)
6. Write architecture section
7. Add workflow tutorials
8. Final polish and deploy
