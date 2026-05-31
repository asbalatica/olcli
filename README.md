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

## License

MIT. Original license notices from `aloth/olcli` are preserved.
