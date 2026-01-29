# devbox editor

Change the default editor for opening projects.

## Usage

```bash
devbox editor
```

## Arguments

This command takes no arguments.

## Options

This command has no options.

## Description

The `editor` command allows you to change the default editor that DevBox uses when opening projects with `devbox up --editor`. It runs interactively and shows your current editor setting.

### Supported Editors

DevBox has built-in support for:

| Editor | Command |
|--------|---------|
| Cursor | `cursor` |
| VS Code | `code` |
| VS Code Insiders | `code-insiders` |

You can also specify a custom editor command by selecting "Other (specify command)".

### How Editors Are Opened

When you run `devbox up --editor`, DevBox uses the devcontainer CLI to open the project in your configured editor. This ensures the editor connects to the running container with proper devcontainer integration.

## Examples

```bash
# Change default editor
devbox editor
```

### Interactive Session

```
Editor Configuration
Current default: cursor

? Select default editor:
  1) Cursor (current)
  2) VS Code
  3) VS Code Insiders
  4) Other (specify command)
Answer: 2

Default editor updated to code.
```

### Using a Custom Editor

```
? Select default editor: Other (specify command)
? Enter editor command: sublime

Default editor updated to sublime.
```

## Configuration

The editor setting is stored in `~/.devbox/config.yaml`. You can also set it during initial setup with `devbox init`.

## See Also

- [devbox init](/reference/init) - Initial setup (also sets editor)
- [devbox up](/reference/up) - Start container and open in editor
