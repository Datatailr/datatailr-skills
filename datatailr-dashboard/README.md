<!--
Copyright (c) 2026 Datatailr Inc.

Licensed under the MIT License. See the 'LICENSE' file distributed
with this package for the full license text.

SPDX-License-Identifier: MIT
-->

# Datatailr dashboard for Claude Code

This Claude Code plugin draws a live Datatailr platform dashboard in a pane of
the Claude desktop app. It reads the platform through the same login that the
`datatailr` CLI uses. The platform access rules decide what you see. The plugin
has no rules of its own.

The plugin adds the `/dt` slash command and the `open_pane` tool. Use `/dt` to
open the pane. Use `/dt refresh` to read the data again.

## What the pane shows

The pane has eight sections:

- **Overview.** Six tiles (running now, failed in 24 hours, completed in 24
  hours, building, broken builds, running nodes), a timeline of the runs of the
  last 24 hours, and a "Needs attention" list. A press on a tile opens Compute
  Processes: the running and failed tiles open the Runs tab with that filter,
  the completed tile opens the Runs tab, and the building and broken builds
  tiles open the default tab. The nodes tile opens Nodes. A press on a run, a
  job or a node in the list opens its page, and a press on a budget opens Cost
  and budgets.
- **Compute Processes.** Tabs for Runs, Workflows, Apps, Services and Excel add-ins,
  with filters, a name search and 50 rows on each page. A press on a row opens
  a detail page with the facts, the error, the recent runs, the log (the build
  log, for a job whose last build failed), a link to the same item in the web
  GUI, and the safe actions (see below).
- **Nodes.** Each node with its environment, class, type, state, CPU and memory
  use, and price per hour. A node page lists the runs on the node and its tags.
- **User Manager.** Users with their groups and state, and groups with their
  members. Read-only.
- **KV and Secrets.** Variables with their values, and secrets without values.
  A key page shows its access list. The pane never shows a secret value.
- **Cost and budgets.** Spend this month and in the last 30 days, a daily chart,
  spend by owner, environment or job type, and the budgets with their use. Only
  an admin can see the spend. Other users see the budgets.
- **Launcher and workstations.** Open links for apps, services and Excel
  add-ins. Workstations with their running copies and IDE and Jupyter links.
- **Blob storage.** The folders and files of the `<prefix>user-data` bucket,
  with a preview of a text file of at most 64 KB. Read-only.

The pane follows the light or dark theme of the app. In the terminal, the same
pane draws without the timeline chart.

## Requirements

- A local Claude Code session, in the desktop app (the Code tab) or in the
  terminal. A pane needs a local session.
- A session of the `datatailr` CLI, to watch an installation. The pane reads
  the platform with the session that `datatailr login` saves in
  `~/.dt/remote_client/remote_client.cfg`. The pane needs no CLI for this. A
  login from a virtual environment is enough.
- The `datatailr` CLI, to log in from the pane. Install it with
  `pip install datatailr`. A pick in the switcher, "Add installation" and "Log
  in again" run the CLI. For them, the plugin looks for the CLI in the folders
  of the `PATH` of the Claude process, then in the venv that the
  `datatailr-skills` plugin installs at session start,
  `~/.claude/plugins/data/datatailr-skills-datatailr/venv`, then in
  `~/.datatailr/venv`. If it is somewhere else, set the `cliPath` option. The
  plugin is tested on macOS and Linux. On Windows, it looks for `datatailr.exe`
  in the `Scripts` folders of those places, and reads your home folder from
  `USERPROFILE` when `HOME` is not set. If the plugin
  finds no CLI for a login, the pane tells you how to install it. It says so
  where you asked for the login: in the switcher, or under the bar that says
  your session ended. With no session and no CLI, the pane only tells you how
  to install it.
- A Datatailr installation and an account on it.
- Claude Code 2.1.299 or later.

## Install

In Claude Code 2.1.299 or later, run
`/plugin install datatailr-dashboard --marketplace Datatailr/datatailr-skills`.
The command follows the development `main` branch of the marketplace
repository. The skills plugin, `datatailr-skills`, installs the same way and
gives Claude the `datatailr-connect` skill for the first login.

## Installations

The pane connects to one installation at a time. Each installation is one env
file in `~/.datatailr/installations/`. The file name without `.env` is the name
of the installation. For example, `prod.env` is the installation `prod`.

```
DATATAILR_BASE_URL=https://app.example.datatailr.com
DATATAILR_USER_NAME=jane
DATATAILR_USER_PASSWORD=...
```

These are the variables that `datatailr login` reads. Only `DATATAILR_BASE_URL`
is required. The file accepts `KEY=VALUE` lines, an `export ` prefix, quoted
values and `#` comments.

Before you put a password in a file, run `chmod 600` on it, so that only you
can read it:

```bash
chmod 600 ~/.datatailr/installations/*.env
```

- If the file has a user name and a password, the plugin runs `datatailr
  login` with them. It gives the values to the CLI in the environment of the
  process and never in its arguments. If that login fails, for example because
  the installation needs MFA, the plugin uses the browser login and tells you
  why. It does not do this when the user name or password is wrong, or when the
  CLI cannot run.
- If the file has no password, the plugin runs `datatailr login --device`. The
  pane shows an "Open in browser" link. Approve the login in the browser. The
  code of the login expires after 15 minutes. To stop the browser login, press
  "Cancel". The pane then goes back to the installation before it, if the CLI
  still has its session.

The pane never asks for a password.

## First start

If there is no env file and no CLI session, the pane shows one input for the
URL of your installation. If there is also no CLI, the pane tells you how to
install it instead. Type the URL and press Enter. The plugin then does these
steps:

1. It saves an env file with only `DATATAILR_BASE_URL`, named after the host.
2. It starts the browser login and shows the link.
3. After you approve the login, it loads the dashboard.

The file is named after the host. If a file of that name exists for the same
address, the plugin logs in to it. If it names another address, for example
`http://` where you typed `https://`, the pane says so and writes nothing. Edit
the file, or type the address it names.

To log in without the browser next time, add `DATATAILR_USER_NAME` and
`DATATAILR_USER_PASSWORD` to that file, then run `chmod 600` on it.

The pane does not open by itself after you install the plugin. Type `/dt`. At
the start of a session, the pane opens again only if it was open at the end of
the last session.

## Switch installation

The switcher is the dim text in the top right corner, for example `prod ▾`. It
opens a short list with your installations, "Add installation" and "Log in
again". A pick runs the login of that installation and then loads its data.
A pick during a browser login stops that login and starts the new one.
A switch closes the page that is open, because a run or a job of one
installation means nothing on another.

The plugin follows the CLI. If you run `datatailr login` for another
installation in a terminal, the pane moves to it within about 30 seconds, and
closes the page that is open. Until then, the pane sends no request, because
the CLI is on another installation than the pane shows. If that installation
has no env file, the switcher shows its host name. The pane reads the session
file of the CLI, not the CLI itself. So this also works with a CLI that is not
on the `PATH` of Claude, for example one in a virtual environment.

If the platform ends your session, the pane keeps the old data and shows "Your
session ended" with a "Log in again" button. Until you log in again, a detail
page shows no Start, Stop or Rerun button. If the plugin finds no CLI when you
press the button, the bar tells you how to install it. You can also log in
from a terminal. The pane then follows the new session within about 30
seconds.

## Options

The plugin has three options. Set them in the plugin configuration of Claude
Code.

| Option             | Default                       | Meaning                                                                      |
|--------------------|-------------------------------|------------------------------------------------------------------------------|
| `installationsDir` | `~/.datatailr/installations`  | Folder with one env file for each Datatailr installation                     |
| `cliPath`          | empty                         | Path to the `datatailr` CLI. Empty means search `PATH`, then the known venvs |
| `shareContext`     | `true`                        | Let Claude see a short summary of what the pane shows                        |

The plugin runs the CLI only for a login from the pane. If you set `cliPath`,
the plugin uses only that path and does not search `PATH` or the venvs.

## Commands

| Command        | What it does                                                          |
|----------------|-----------------------------------------------------------------------|
| `/dt`          | Opens the pane, or brings it to the front.                            |
| `/dt refresh`  | Opens the pane and reads the summary and the open section again.      |

You can also ask Claude to open the dashboard. Claude then calls the `open_pane`
tool. In the pane, the refresh button (hotkey `r`) does the same as `/dt refresh`.
The pane refreshes by itself while you look at it: the summary every 30 seconds
and the open section every 10 to 60 seconds, depending on the section. It loads
nothing while the pane is hidden.

## Safe actions

Each action asks first. When you press the button, a bar
asks the question, for example "Stop fx-risk in dev?", with "Yes, stop" and
"Cancel". Nothing runs until you press the yes. After the call, the same bar
shows the result for 5 seconds.

A question belongs to the installation that the pane shows when you press the
button. A switch to another installation takes the question away. The yes acts
only on that installation, and does nothing when the CLI is on another one.

| Action | Where                                                                   |
|--------|-------------------------------------------------------------------------|
| Stop   | A running run, or a job with a running run                              |
| Start  | The job page of a stopped app, service or Excel add-in, or of one whose last run failed. A workflow page shows `ready` and has no Start. |
| Rerun  | A failed workflow run                                                   |
| Drain, Stop draining | A node page. Only an admin can drain a node.              |
| Start, Stop | A workstation page: Start for the workstation, Stop for a running copy. |

Delete, promote, modify and version changes are not in the pane. Use the link
to the web GUI or "Ask Claude" for them.

## Claude features

- **Ask Claude.** On the page of a run or a job, this puts a ready prompt in the
  message box. If you already typed text there, the prompt goes after your text
  as a new paragraph, and your text stays. Nothing is sent until you send it.
  The prompt asks Claude to investigate with the `dt` CLI and to change nothing
  without asking you.
- **Explain.** On the page of a run or a job that has an error or a failed state,
  this asks a small model (`haiku`) for a short likely cause and one next step.
  It shows once the log of the page has loaded. It calls the model only when
  you press it. It sends the facts of the item, the error and the last 60
  lines of the log of the page, which is the build log for a job whose last
  build failed. Before it sends them, it removes common
  secret patterns (tokens, cookies, passwords in URLs, flags and `key=value`
  pairs). It cannot recognise every secret. The same item in the same state
  costs nothing a second time. For a job, a new run, a new version or a new
  build is a new state. "Continue in chat" puts the answer in the message box.
- **Context.** While the pane is shown and the session is connected, the next
  message you type carries a short block about what the pane shows: the
  installation, the section and its page. It adds the block when the
  installation, the page or what the page says changed since the last block,
  for example when a run failed. The block has at most 1,500 characters and no
  log line. What it quotes from a job (an error) is one line, labeled as job
  output. The plugin removes common secret patterns here too. A dim line at
  the bottom of a detail page says what Claude can see. To turn the context
  off, set `shareContext` to `false`.

The pane never draws a secret value. The password of an installation stays in
its env file and in the environment of the login process. The session token
stays in the CLI file `~/.dt/remote_client/remote_client.cfg`. The plugin does
not copy it.

## What the plugin reads, runs, sends and writes

This section is for the reviewer of the Claude plugin directory, and for
anyone who wants to know what the hooks module does.

The hooks module registers five hooks:

- `session.start` registers the `/dt` command and the `open_pane` tool. Then
  it reads the saved state, creates the HTTP client and starts the scheduler
  that refreshes the data.
- `command.run` for `/dt` opens the pane. `/dt refresh` reads the data again.
- `tool.call` for the plugin's own tool, `mcp__datatailr-dashboard__open_pane`,
  opens the pane and answers the call itself with a short text. It stands in
  for no other tool.
- `ui.render` draws the pane.
- `prompt.submit` adds the context block of the previous section to a message
  you type. It does so only when the pane is shown and the context option is
  on. It changes nothing else in the message, and it passes every other prompt
  through as it is.

What it reads:

- The CLI session file, `~/.dt/remote_client/remote_client.cfg`: the URL of
  the installation and the session token. The token goes only in the `Cookie`
  header of the requests to that installation.
- The env files of the installations folder, `~/.datatailr/installations` by
  default: the URL, the user name and the password of each installation. The
  password goes only in the environment of the login process for that
  installation.
- The environment variables `HOME`, `USERPROFILE`, `OS`, `PATH` and
  `CLAUDE_CONFIG_DIR`, to find your home folder and the CLI.

The token and the password that the plugin reads belong to the installation
it sends them to, and to nothing else.

What it runs: only the `datatailr` CLI, from the `cliPath` option, from the
`PATH` of Claude, or from the venv of the skills plugin. It runs
`datatailr login` for a password login and `datatailr login --device` for a
device login, each with the URL of the installation. It runs no other program
and no shell.

What it sends, and where:

- HTTP requests to the API of the installation that the session file names,
  `<base_url>/api/<command>/<subcommand>`, with the session token as a cookie.
  The hosts are the installations you logged in to. It contacts no other host.
- Explain sends the scrubbed facts, the error and the last 60 lines of the log
  of one item to the `haiku` model through Claude Code. It does so only when
  you press it.
- Ask Claude and Continue in chat put a text in your message box. Nothing is
  sent until you send it.

What it writes:

- The env file of an installation that you add from the switcher, in the
  installations folder.
- Its own state in Claude Code: the route, the session, the loaded data, the
  explanation cache, the log view and the context record. No secret goes in
  there.
- Two values in the plugin store: the last route, and whether the pane was
  open.
- A text in your message box, when you press Ask Claude or Continue in chat.

It writes no build, start-up, settings or instructions file.

The `types` field of the manifest names `types/index.d.ts`, the contract of
the plugin's state, which `claude plugin validate` reads. Claude Code ignores
the field when it loads the plugin.

## Local development

To load the plugin from a folder, follow these steps:

1. Add the folder that holds this file to the `env` block of
   `~/.claude/settings.json`. Replace `<this folder>` with its path:

   ```json
   "env": {
     "CLAUDE_CODE_PLUGIN_DIRS": "<this folder>",
     "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
   }
   ```

2. Start a new Claude Code session. A session that the desktop app hosts loads
   the plugin only when the session starts.
3. Type `/dt` to open the pane.

`CLAUDE_CODE_PLUGIN_DIR_WATCH=1` reloads the plugin when a file in the folder
changes. If a change in `src/` has no effect, start a new session.

The tests, `tsconfig.json` and the design documents are in the Datatailr sonic
repository. The published plugin does not carry them.

## License

MIT. See `LICENSE`.
