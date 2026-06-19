# olcli fork

A focused fork of [`aloth/olcli`](https://github.com/aloth/olcli) for using
one CLI with multiple Overleaf-compatible servers.

## Added features

- `-p, --profile <name>` selects a server profile.
- `create <name>` creates a blank project.
- `open [project]` opens a project in your browser.
- `pull`, `push`, and `clone` can copy projects between profiles.
- Saved cookies are encrypted.

## Build

```bash
npm install
npm run build
npm install -g .
olcli --help
```

## Profiles

```bash
olcli profiles add <profile> <base-url> --session-cookie-name <cookie-name>
olcli auth -p <profile>
olcli list -p <profile>
```

You can still pass a cookie directly with `--cookie "<session-cookie-value>"`.

Profile commands:

```bash
olcli profiles list
olcli profiles show <profile>
olcli profiles use <profile>
olcli profiles remove <profile>
olcli logout -p <profile>
olcli logout --all
```

## Local auth

Use `.olauth` when you want credentials saved in the current directory instead
of the global config:

```bash
olcli auth -p <profile> --save-local
olcli auth -p <profile>
```

If no credential is saved yet, `auth` asks for the session cookie with hidden
terminal input. If a credential is already saved, `auth` verifies it.

`logout` clears only the selected profile's credential. Use `logout --all` only
when you want to remove all stored configuration.

Encryption:

- Windows uses DPAPI automatically.
- Linux/macOS ask you to set an `olcli` auth secret the first time encrypted auth is saved.
  Later commands ask for the same secret to decrypt saved cookies.

## Create and open

```bash
olcli create "Sample" -p <profile>
olcli open "Sample" -p <profile>
olcli open "Sample" -p <profile> --print-url
```

`open` uses `cmd /c start` on Windows, `open` on macOS, and `xdg-open` on Linux.

## Pull, push, sync

Normal project workflow:

```bash
olcli pull "Sample" sample -p <profile>
cd sample
olcli push
olcli sync
```

After `pull`, `.olcli.json` records the profile, so later `push` and `sync`
from that directory use the same profile.

Between profiles:

```bash
olcli pull <source-project> <target-project> --from <source-profile> --to <target-profile>
olcli pull <source-project> <target-project> --from <source-profile> --to <target-profile> --dry-run
olcli push <source-project> <target-project> --from <source-profile> --to <target-profile>
```

The target project must already exist. Existing target files are not overwritten
unless you pass `--force`; deleting target-only files requires both
`--delete-missing` and `--force`.

## Clone

```bash
olcli clone "Sample" --from <source-profile> --to <target-profile>
olcli clone "Sample" --from <source-profile> --to <target-profile> --name "Sample Copy"
olcli clone "Sample" --from <source-profile> --to <target-profile> --dry-run
```

`clone` creates a new target project and uploads the source files. It does not
overwrite or delete existing projects.

## Global options

These flags work with **every** command and may be placed before or after the command name:

| Flag | Description |
|------|-------------|
| `--verbose` | Print every HTTP request, status, content-type, and (on errors) a response-body snippet to stderr. Useful for debugging failed compiles, 404s on `pdf`/`output`, auth issues, or unexpected upload behavior. |
| `--base-url <url>` | Override the Overleaf instance base URL (also `OVERLEAF_BASE_URL` env var or `olcli config set-url`). |
| `--cookie-name <name>` | Override the session cookie name (default `overleaf_session2`; older instances use `overleaf.sid`). |

Examples:

```bash
olcli --verbose pdf                    # see every request the compile makes
olcli pdf --verbose                    # same thing, flag after command
olcli --verbose sync                   # debug a sync that's misbehaving
olcli --verbose upload figures/a.png   # confirm the file is placed in figures/
```

## Use Cases

### Local Editing with Overleaf Compilation

Work offline in your favorite editor, push when ready, compile remotely:

```bash
olcli pull "Research Paper"
cd Research_Paper
vim introduction.tex
git commit -am "Update intro"
olcli push
olcli pdf
```

### Git Version Control + Overleaf

Keep your LaTeX project in Git while using Overleaf's compiler:

```bash
olcli pull "My Thesis" thesis
cd thesis
git init
git add .
git commit -m "Initial import from Overleaf"

# Daily workflow
vim chapters/methods.tex
git commit -am "Draft methods section"
olcli sync  # Sync with Overleaf
olcli pdf
```

### Automated Workflows

Integrate Overleaf compilation into CI/CD:

```bash
#!/bin/bash
olcli auth --cookie "$OVERLEAF_SESSION"
olcli pull "Automated Report"
./generate-data.py > tables/results.tex
olcli push
olcli pdf -o report-$(date +%Y-%m-%d).pdf
```

### arXiv Submissions

Download the `.bbl` file for arXiv submissions:

```bash
olcli output bbl --project "My Paper"
# Downloads: bbl
```

List all available compile output files:

```bash
olcli output --list
# Available output files:
#   aux          output.aux
#   bbl          output.bbl
#   blg          output.blg
#   log          output.log
#   ...
```

## Sync Behavior

### Pull
- Downloads all files from Overleaf
- **Skips** local files modified after last pull (won't overwrite your changes)
- Use `--force` to overwrite local changes

### Push
- Uploads files modified after last pull
- Preserves nested folder structure when uploading
- Filters out LaTeX build artifacts and OS noise (see [Ignoring files](#ignoring-files))
- Use `--all` to upload all files
- Use `--dry-run` to preview changes
- Use `--show-ignored` to see what was filtered out

### Sync
- Pulls remote changes
- Preserves local modifications (local wins if newer)
- Pushes local changes to remote
- **Propagates local deletions to the remote** — if you delete a file locally, it's deleted on Overleaf on the next sync. Use `--no-delete` to opt out.
- Filters out LaTeX build artifacts and OS noise
- Use `--verbose` to see detailed file operations (see [Global options](#global-options))
- Use `--dry-run` to preview without applying

#### How deletion propagation works

On every sync, `olcli` records a manifest of remote files in `.olcli.json`. The next sync compares the manifest against your local working tree:

- File missing locally **and** still present on remote → deleted on Overleaf
- File new locally → uploaded
- File modified locally after last pull → uploaded (local wins)
- File only on remote → downloaded

First-time syncs skip the deletion phase (no manifest exists yet to distinguish "never had it" from "deleted it").

## Ignoring files

`olcli` automatically filters local files through a layered ignore list before uploading. This keeps LaTeX build artifacts (from local `pdflatex`/`latexmk` runs) and OS noise out of your Overleaf project.

### Three layers

| Layer | File | Purpose |
|---|---|---|
| 1 | (built-in) | LaTeX intermediates (`.aux`, `.bbl`, `.log`, `.fls`, `.synctex.gz`, beamer/biber/glossaries/minted), OS noise (`.DS_Store`, `Thumbs.db`, `*.swp`), common build dirs (`build/`, `out/`, `_minted-*/`). Always on; opt out with `--no-default-ignore`. |
| 2 | `.olignore` | Project-level patterns, gitignore syntax. Commit alongside your `.tex` sources. |
| 3 | `.olignore.local` | Machine-specific patterns. Add to `.gitignore`. |

Later layers override earlier ones, just like git. Negation (`!important.aux`) is supported.

### Special PDF rule

`X.pdf` is ignored only if a same-named `X.tex` (or `.ltx`) exists in the same folder. So `thesis.pdf` next to `thesis.tex` is filtered, but a hand-uploaded `figures/diagram.pdf` still syncs.

### Example `.olignore`

```gitignore
# Drafts that should never reach Overleaf
*.draft.tex
notes/
chapters/scratch/

# But keep this one auxiliary file
!important.aux
```

### Inspecting and overriding

```bash
olcli ignored                  # list patterns currently in effect
olcli push --show-ignored      # see what was skipped on this run
olcli sync --no-default-ignore # only .olignore applies
olcli sync --no-ignore         # escape hatch — upload everything
```

## Configuration

Credentials are stored in (checked in order):

1. `OVERLEAF_SESSION` environment variable
2. `.olauth` file in current directory
3. Global config: `~/.config/olcli-nodejs/config.json` (macOS/Linux)

### .olauth File

For project-specific credentials, create `.olauth` in your project directory:

```
s%3AyourSessionCookieValue...
```

### Self-hosted Overleaf / ShareLaTeX

You can point `olcli` at a self-hosted instance and override the session cookie name. Both flags are documented under [Global options](#global-options) and can be combined with any command.

```bash
olcli --base-url https://latex.example.org list
olcli --base-url https://latex.example.org --cookie-name overleaf.sid whoami
```

Persist these settings in `olcli` config so you don't have to repeat them:

```bash
olcli config set-url https://latex.example.org
olcli config set-cookie-name overleaf.sid
```

## Examples

### Work on a thesis

```bash
# Initial setup
olcli pull "PhD Thesis" thesis
cd thesis

# Daily workflow
vim chapters/introduction.tex
olcli sync
olcli pdf -o draft.pdf
```

### Quick PDF download

```bash
olcli pdf "Conference Paper" -o paper.pdf
```

### Download a single file

```bash
olcli download main.tex "My Project"
```

### Upload figures

```bash
cd my-project
olcli upload figures/diagram.png
```

### Backup all projects

```bash
for proj in $(olcli list --json | jq -r '.[].name'); do
  olcli zip "$proj" -o "backups/${proj}.zip"
done
```

### Prepare for arXiv

```bash
cd my-paper
olcli output bbl -o main.bbl
olcli zip -o arxiv-submission.zip
```

## Programmatic Usage (Library API)

`@aloth/olcli` exposes `OverleafClient` and all public interfaces as a proper library so you can use it in your own scripts, tools, and AI agents.

### Install

```bash
npm install @aloth/olcli
```

### Basic example

```ts
import { OverleafClient } from '@aloth/olcli';

// Create a client from an Overleaf session cookie
const client = await OverleafClient.fromSessionCookie(cookie);

// List all projects
const projects = await client.listProjects();
console.log(projects);

// Get detailed info (file tree) for a project
const info = await client.getProjectInfo(projectId);

// Download project as a zip buffer
const zipBuf = await client.downloadProject(projectId);

// Compile and download PDF
const pdfBuf = await client.downloadPdf(projectId);

// Upload a file
import { readFileSync } from 'node:fs';
await client.uploadFile(projectId, null, 'main.tex', readFileSync('main.tex'));

// List review comments
const comments = await client.listComments(projectId, { status: 'open' });
```

### Available exports

```ts
import {
  // Core client
  OverleafClient,

  // Types / interfaces
  Project, ProjectInfo, FolderEntry, DocEntry, FileEntry,
  CommentMessage, ProjectComment, CommentContext, CommentStatus,
  ListCommentsOptions, AddCommentOptions, Credentials,

  // Configuration utilities
  getBaseUrl, setBaseUrl, getSessionCookie, setSessionCookie,
  getSessionCookieName, setSessionCookieName, getCsrf, setCsrf,
  getLastProject, setLastProject, clearConfig, getConfigPath, saveOlAuth,

  // Ignore utilities
  DEFAULT_IGNORE_PATTERNS, loadIgnore, shouldIgnore, buildTexSiblingSet,
  IgnoreContext, LoadIgnoreOptions,
} from '@aloth/olcli';
```

---

## MCP Server

`@aloth/olcli` ships an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server so AI assistants like **Claude Desktop**, **Cursor**, and **Windsurf** can interact with your Overleaf projects directly.

### MCP tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all Overleaf projects |
| `get_project_info` | Get file tree and metadata for a project |
| `pull_project` | Download and extract a project to a local directory |
| `push_file` | Upload a local file to a project |
| `compile` | Compile a project and get the PDF URL |
| `download_pdf` | Compile a project and save the PDF locally |
| `list_comments` | List review comments (filter: all / open / resolved) |
| `get_entities` | Get a flat list of all files in a project |
| `download_file` | Download a specific file by its remote path |
| `add_comment` | Add a review comment to a document |
| `resolve_comment` | Mark a comment thread as resolved |
| `delete_entity` | Delete a file or document by path |
| `rename_entity` | Rename a file or document |
| `compile_with_outputs` | Compile and return all output files (PDF, BBL, logs…) |

### Authentication

The MCP server reads your session cookie in this order:

1. **`OVERLEAF_SESSION` environment variable** — set in your MCP config (recommended)
2. **`.olauth` file in cwd** — written by `olcli auth`
3. **Stored config** — written by `olcli auth`

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "overleaf": {
      "command": "npx",
      "args": ["-y", "@aloth/olcli-mcp"],
      "env": {
        "OVERLEAF_SESSION": "<your-overleaf-session-cookie>"
      }
    }
  }
}
```

Or if you have olcli installed globally (`npm install -g @aloth/olcli`):

```json
{
  "mcpServers": {
    "overleaf": {
      "command": "olcli-mcp",
      "env": {
        "OVERLEAF_SESSION": "<your-overleaf-session-cookie>"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json` or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "overleaf": {
      "command": "npx",
      "args": ["-y", "@aloth/olcli-mcp"],
      "env": {
        "OVERLEAF_SESSION": "<your-overleaf-session-cookie>"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "overleaf": {
      "command": "npx",
      "args": ["-y", "@aloth/olcli-mcp"],
      "env": {
        "OVERLEAF_SESSION": "<your-overleaf-session-cookie>"
      }
    }
  }
}
```

### Getting your session cookie

1. Open Overleaf in your browser and log in
2. Open DevTools → Application (Chrome) or Storage (Firefox) → Cookies
3. Find `overleaf_session2` (or `sharelatex.sid` for self-hosted)
4. Copy the value — that's your `OVERLEAF_SESSION`

Or run `olcli auth` and then the MCP server will pick it up automatically.

### Self-hosted Overleaf

Set `OVERLEAF_BASE_URL` in your MCP env:

```json
"env": {
  "OVERLEAF_SESSION": "<cookie>",
  "OVERLEAF_BASE_URL": "https://overleaf.yourcompany.com"
}
```

---

## Troubleshooting

### Session expired

If you get authentication errors, your session cookie may have expired. Get a fresh one from the browser and run `olcli auth` again.

### Compilation fails

Check the Overleaf web editor for detailed error logs. Common issues:
- Missing packages
- Syntax errors in `.tex` files
- Missing bibliography files

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT. Original license notices from `aloth/olcli` are preserved.
