# olcli fork

A focused fork of [`aloth/olcli`](https://github.com/aloth/olcli) for using one
CLI with multiple Overleaf-compatible servers, plus the latest upstream features.

[![npm version](https://img.shields.io/npm/v/@aloth/olcli.svg)](https://www.npmjs.com/package/@aloth/olcli)
[![npm downloads](https://img.shields.io/npm/dm/@aloth/olcli.svg)](https://www.npmjs.com/package/@aloth/olcli)
[![GitHub stars](https://img.shields.io/github/stars/aloth/olcli)](https://github.com/aloth/olcli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-compatible-blue)](https://agentskills.io)

## Fork additions

- `-p, --profile <name>` selects a server profile.
- `create <name>` creates a blank project.
- `open [project]` opens a project in your browser.
- `pull`, `push`, and `clone` can copy projects between profiles.
- Saved session cookies are encrypted.

## Features

- List, pull, push, and sync Overleaf projects from the terminal.
- Use Overleaf as a native git remote ([docs](docs/GIT-REMOTE.md)).
- Manage review comments, including replies.
- Filter LaTeX build artifacts with layered `.olignore` support.
- Compile PDFs and download output artifacts such as `.bbl`, `.log`, and `.aux`.
- Use password login for self-hosted instances without browser access.
- Run the MCP server for AI assistants ([docs](docs/MCP.md)).

## Installation

### Local checkout

```bash
npm install
npm run build
npm install -g .
olcli --help
```

### npm

```bash
npm install -g @aloth/olcli
```

### Homebrew

```bash
brew tap aloth/tap
brew install olcli
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

## Quick Start

### 1. Authenticate

```bash
olcli auth --cookie "your_session_cookie_value"
olcli auth --email "you@example.com" --password "your_password"
```

### 2. Pull, edit, push

```bash
olcli pull "My Thesis"
cd My_Thesis/
vim main.tex
olcli push
```

After `pull`, `.olcli.json` records the profile, so later `push` and `sync`
from that directory use the same profile.

### 3. Compile PDF

```bash
olcli pdf
```

### 4. Or use native git commands

```bash
git clone overleaf::https://www.overleaf.com/project/<id>
cd <project>
git push
```

See [Git Remote Helper docs](docs/GIT-REMOTE.md) for details.

## Profile-to-profile workflows

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

## Commands

All commands auto-detect the project when run from a synced directory (contains `.olcli.json`).

| Command | Description |
|---------|-------------|
| `olcli auth` | Set session cookie or login with email/password |
| `olcli whoami` | Check authentication status |
| `olcli logout` | Clear stored credentials |
| `olcli profiles` | Manage named server profiles |
| `olcli list` | List all projects |
| `olcli create <name>` | Create a blank project |
| `olcli open [project]` | Open a project in your browser |
| `olcli info [project]` | Show project details and file list |
| `olcli pull [project] [dir]` | Download project files to local directory |
| `olcli push [dir]` | Upload local changes to Overleaf |
| `olcli sync [dir]` | Bidirectional sync (pull + push) |
| `olcli clone <project>` | Copy a project between profiles |
| `olcli upload <file> [project]` | Upload a single file |
| `olcli download <file> [project]` | Download a single file |
| `olcli delete <file> [project]` | Delete a remote file or folder (alias: `rm`) |
| `olcli rename <old> <new> [project]` | Rename a remote file or folder (alias: `mv`) |
| `olcli compile [project]` | Trigger PDF compilation |
| `olcli pdf [project]` | Compile and download PDF |
| `olcli output [type]` | Download compile output files |
| `olcli zip [project]` | Download project as zip archive |
| `olcli comments list [project]` | List comments (`--status`, `--context`) |
| `olcli comments add <file> <msg>` | Add a comment to selected text |
| `olcli comments reply <id> <body>` | Reply to a comment thread |
| `olcli comments resolve <id>` | Resolve a comment thread |
| `olcli comments reopen <id>` | Reopen a resolved thread |
| `olcli comments delete <id>` | Delete a comment thread |
| `olcli ignored [dir]` | List ignore patterns in effect |
| `olcli config set-url <url>` | Set self-hosted base URL |
| `olcli config set-cookie-name <name>` | Set session cookie name |
| `olcli config set-timeout <ms>` | Set default HTTP timeout |
| `olcli check` | Show config paths and credential sources |

### Global Options

| Flag | Description |
|------|-------------|
| `--verbose` | Print HTTP requests and responses to stderr |
| `--base-url <url>` | Override Overleaf instance URL |
| `--cookie-name <name>` | Override session cookie name |
| `--timeout <ms>` | Override HTTP timeout (default: 10000) |

## Sync Behavior

### Pull
- Downloads all files from Overleaf
- Skips local files modified after last pull (won't overwrite your changes)
- Use `--force` to overwrite local changes

### Push
- Uploads files modified after last pull
- Preserves nested folder structure
- Filters out LaTeX build artifacts and OS noise
- Use `--all` to upload all files, `--dry-run` to preview

### Sync
- Pulls remote changes, then pushes local changes
- Local modifications win if newer
- **Propagates local deletions** — use `--no-delete` to opt out
- Use `--dry-run` to preview without applying

#### How deletion propagation works

`olcli` records a manifest of remote files in `.olcli.json`. On next sync:

- File missing locally + still on remote → deleted on Overleaf
- File new locally → uploaded
- File modified locally → uploaded (local wins)
- File only on remote → downloaded

First-time syncs skip the deletion phase (no prior manifest to compare).

## Ignoring Files

### Three layers

| Layer | Source | Purpose |
|---|---|---|
| 1 | Built-in | LaTeX intermediates, OS noise, build dirs. Always on. |
| 2 | `.olignore` | Project-level patterns (gitignore syntax). |
| 3 | `.olignore.local` | Machine-specific patterns. |

Later layers override earlier ones. Negation (`!important.aux`) is supported.

### Special PDF rule

`X.pdf` is ignored only if `X.tex` (or `.ltx`) exists in the same folder.

### Inspecting and overriding

```bash
olcli ignored                  # list patterns in effect
olcli push --show-ignored      # see what was skipped
olcli sync --no-default-ignore # only .olignore applies
olcli sync --no-ignore         # upload everything
```

## Configuration

Credentials are checked in order:

1. `OVERLEAF_SESSION` environment variable
2. `.olauth` file in current directory
3. Global config: `~/.config/olcli-nodejs/config.json`

### Self-hosted Overleaf

```bash
olcli config set-url https://latex.example.org
olcli config set-cookie-name overleaf.sid
```

Or pass per-command: `olcli --base-url https://latex.example.org list`

### Timeout

```bash
olcli config set-timeout 60000          # persist
olcli --timeout 60000 pull "Big Thesis" # one-off
export OVERLEAF_TIMEOUT=60000           # env var
```

Precedence: `--timeout` > `OVERLEAF_TIMEOUT` > config > default (10000ms).

## Examples

```bash
# Daily thesis workflow
olcli pull "PhD Thesis" thesis && cd thesis
vim chapters/methods.tex
olcli sync && olcli pdf -o draft.pdf

# Quick PDF download
olcli pdf "Conference Paper" -o paper.pdf

# Upload figures
olcli upload figures/diagram.png

# arXiv submission prep
olcli output bbl -o main.bbl
olcli zip -o arxiv-submission.zip

# Backup all projects
for proj in $(olcli list --json | jq -r '.[].name'); do
  olcli zip "$proj" -o "backups/${proj}.zip"
done
```

## Programmatic Usage (Library API)

`@aloth/olcli` exposes `OverleafClient` and all public interfaces as a library.

### Install

```bash
npm install @aloth/olcli
```

### Basic example

```ts
import { OverleafClient } from '@aloth/olcli';

const client = await OverleafClient.fromSessionCookie(cookie);

const projects = await client.listProjects();
const info = await client.getProjectInfo(projectId);
const zipBuf = await client.downloadProject(projectId);
const pdfBuf = await client.downloadPdf(projectId);

await client.uploadFile(projectId, null, 'main.tex', readFileSync('main.tex'));

const comments = await client.listComments(projectId, { status: 'open' });
```

### Available exports

```ts
import {
  OverleafClient,
  // Types
  Project, ProjectInfo, FolderEntry, DocEntry, FileEntry,
  CommentMessage, ProjectComment, CommentContext, CommentStatus,
  ListCommentsOptions, AddCommentOptions, Credentials, SessionCookiePair,
  // Config utilities
  getBaseUrl, setBaseUrl, getSessionCookie, setSessionCookie,
  getSessionCookieName, setSessionCookieName, getCsrf, setCsrf,
  getLastProject, setLastProject, clearConfig, getConfigPath, saveOlAuth,
  getTimeout, setTimeout, getPasswordCredentials, setPasswordCredentials,
  clearPasswordCredentials, type PasswordCredentials,
  // Ignore utilities
  DEFAULT_IGNORE_PATTERNS, loadIgnore, shouldIgnore, buildTexSiblingSet,
  IgnoreContext, LoadIgnoreOptions,
} from '@aloth/olcli';
```

## Further Documentation

- [MCP Server](docs/MCP.md) — AI assistant integration (Claude, Cursor, Windsurf)
- [Git Remote Helper](docs/GIT-REMOTE.md) — use Overleaf as a native git remote

## Troubleshooting

**Session expired** — Get a fresh cookie from the browser and run `olcli auth` again.

**Compilation fails** — Check the Overleaf web editor for detailed error logs (missing packages, syntax errors, missing bibliography files).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT. Original license notices from `aloth/olcli` are preserved.
