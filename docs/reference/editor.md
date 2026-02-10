---
title: skybox editor
description: Change the default editor for opening projects with skybox editor. Supports VS Code, Cursor, Zed, and custom editors.
---

# skybox editor

Change the default editor for opening projects.

## Usage

```bash
skybox editor
```

## Arguments

This command takes no arguments.

## Options

This command has no options.

## Description

The `editor` command allows you to change the default editor that SkyBox uses when opening projects with `skybox up --editor`. It runs interactively and shows your current editor setting.

### Supported Editors

SkyBox has built-in support for:

<!--@include: ../snippets/editors-list.md-->

You can also specify a custom editor command by selecting "Other (specify command)".
Custom editor values can include flags, for example:

- `code --reuse-window`
- `open -a Zed`

### How Editors Are Opened

When you run `skybox up --editor`, SkyBox launches your configured editor command directly.

- For `cursor`, `code`, and `code-insiders`, SkyBox opens the Dev Container URI with `--folder-uri`.
- For other editors, SkyBox opens the local project folder path.
- On macOS, if a built-in editor command is missing from `PATH` (for example `zed`), SkyBox automatically falls back to `open -a <App>`.

## Examples

```bash
# Change default editor
skybox editor
```

### Interactive Session

```
Editor Configuration
Current default: cursor

? Select default editor:
  1) Cursor (current)
  2) VS Code
  3) VS Code Insiders
  4) Zed
  5) Other (specify command)
Answer: 2

Default editor updated to code.
```

### Using a Custom Editor

```
? Select default editor: Other (specify command)
? Enter editor command: open -a Zed

Default editor updated to open -a Zed.
```

## Configuration

The editor setting is stored in `~/.skybox/config.yaml`. You can also set it during initial setup with `skybox init`.

## See Also

- [skybox init](/reference/init) - Initial setup (also sets editor)
- [skybox up](/reference/up) - Start container and open in editor
