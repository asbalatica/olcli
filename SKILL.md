---
name: olcli
description: Operate the olcli CLI, git remote helper, and olcli-mcp for Overleaf-compatible LaTeX projects. Use when Codex needs to install or verify olcli, authenticate profiles, list/create/open/clone projects, pull/push/sync files, compile PDFs, download outputs such as bbl/log/aux, manage review comments, configure self-hosted Overleaf or ShareLaTeX servers, inspect ignore rules, use Overleaf as a git remote, or troubleshoot olcli commands.
---

# olcli

Manage Overleaf-compatible LaTeX projects through `olcli`, `git-remote-overleaf`,
or `olcli-mcp`.

## Install This Checkout

```bash
npm install
npm run build
npm install -g .
olcli --version
olcli --help
```

This package installs `olcli`, `olcli-mcp`, and `git-remote-overleaf`.

## Safe Defaults

- Do not print or repeat session cookies. Prefer `olcli auth`'s hidden prompt.
- Use `olcli check`, `olcli whoami`, and `olcli profiles show <profile>` for diagnostics.
- Prefer `--dry-run` before writes: `push`, `sync`, `clone`, project renames, and profile-to-profile `pull/push`.
- Remember that `olcli sync` propagates local deletions to Overleaf unless `--no-delete` is used. `olcli push` only propagates them when `--delete` is passed.
- Use `--verbose` for failed auth, compile/download 404s, upload placement issues, or unexpected sync behavior.
- Use `--timeout <ms>` or `olcli config set-timeout <ms>` for slow projects or self-hosted instances.

## Profiles And Auth

```bash
olcli profiles add <profile> <base-url> --session-cookie-name <cookie-name>
olcli profiles add <profile> <base-url> --session-cookie-name <cookie-name> --default
olcli profiles list
olcli profiles show <profile>
olcli profiles use <profile>
olcli auth -p <profile>
olcli auth -p <profile> --save-local
olcli auth -p <profile> --email "you@example.com" --password "password"
olcli logout -p <profile>
olcli logout --all
```

Global flags: `-p/--profile`, `--base-url`, `--cookie-name`, `--timeout`, and `--verbose`.

## Project Workflows

```bash
olcli list
olcli info [project]
olcli create "Project Name"
olcli open [project]
olcli open [project] --print-url
olcli project rename "New Name" [project] --dry-run
olcli project rename-bulk --search "Draft" --replace "Final"
```

```bash
olcli pull "Project Name" local-dir -p <profile>
cd local-dir
olcli push --dry-run
olcli push
olcli push --delete --dry-run
olcli sync --dry-run
olcli sync --no-delete
olcli pdf -o draft.pdf
```

Inside a pulled project, `.olcli.json` lets most commands infer the project and profile.

## Cross-Profile Workflows

```bash
olcli pull <source-project> <target-project> --from <source-profile> --to <target-profile> --dry-run
olcli push <source-dir-or-project> <target-project> --from <source-profile> --to <target-profile> --dry-run
olcli clone "Source Project" --from <source-profile> --to <target-profile> --name "Copy Name" --dry-run
```

Use `--delete-missing` only when the user explicitly wants target-only files removed, and pair it with a dry run first.

## Git Remote Helper

Use Overleaf projects as native git remotes when the user wants normal commits,
diffs, branches, and `git push`/`git pull`.

```bash
git clone overleaf::https://www.overleaf.com/project/<id>
cd <project>
git add .
git commit -m "update paper"
git push
git pull
```

For self-hosted instances, use the instance project URL:

```bash
git clone overleaf::https://overleaf.example.edu/project/<id>
```

Debug with `GIT_REMOTE_OVERLEAF_DEBUG=1 git push`.

## Compile, Outputs, And Files

```bash
olcli compile [project]
olcli compile [project] -r appendix.tex
olcli pdf [project] -o draft.pdf
olcli pdf [project] -r appendix.tex
olcli output --list --project "Project Name"
olcli output bbl -o main.bbl
olcli output log -o output.log
olcli zip [project] -o project.zip
```

`-r, --resource <path>` on `compile`, `pdf`, and `output` compiles that `.tex` file as the root document.

```bash
olcli upload figures/diagram.png [project]
olcli upload /tmp/diagram.png [project] --to figures/diagram.png
olcli download main.tex [project] -o main.tex
olcli delete chapters/old.tex [project]
olcli rename old.tex new.tex [project]
olcli ignored
olcli push --show-ignored
```

A relative upload path keeps its directory part, an absolute path uses its basename,
and `--to` explicitly sets the remote path.

## Review Comments

```bash
olcli comments list [project] --status open --context 2
olcli comments add main.tex "Please clarify this claim." [project] --text "selected source text"
olcli comments add main.tex "Revise this sentence." [project] --line 42 --column 1 --length 80
olcli comments reply <threadId> "Updated the paragraph." [project]
olcli comments resolve <threadId> [project]
olcli comments reopen <threadId> [project]
olcli comments delete <threadId> [project]
```

Prefer resolving comments over permanently deleting them unless deletion is explicitly requested.

## MCP Server

`olcli-mcp` starts a stdio MCP server. Configure MCP clients to run the installed local fork:

```json
{
  "mcpServers": {
    "overleaf": {
      "command": "olcli-mcp",
      "env": {
        "OVERLEAF_SESSION": "<session-cookie>",
        "OVERLEAF_BASE_URL": "https://www.overleaf.com"
      }
    }
  }
}
```

Available MCP tools: `list_projects`, `get_project_info`, `pull_project`, `push_file`, `compile`, `download_pdf`, `list_comments`, `get_entities`, `download_file`, `add_comment`, `reply_to_comment`, `resolve_comment`, `delete_entity`, `rename_entity`, and `compile_with_outputs`.

`compile`, `download_pdf`, and `compile_with_outputs` accept an optional `resource_path` to compile a specific root document.
