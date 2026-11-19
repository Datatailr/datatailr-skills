---
name: datatailr-connect
description: Start here for any Datatailr task when you are not logged in or no dt command works yet. Logs in to the user's Datatailr installation with a browser approval (device login), with the datatailr SDK that the plugin's session hook installed, or installs the SDK in a project virtualenv when no hook ran. Then hands over to the other datatailr skills. Use it when the user mentions Datatailr and no dt command works yet, or asks to connect, log in, set up or get started with Datatailr. Do not use it for work inside an installation that is already connected.
---

# Connect to Datatailr

This skill makes sure that the Datatailr SDK is available and logs in to the user's Datatailr installation. It does not build or deploy anything. When it is done, step 5 hands over to the other `datatailr` skills. Follow the steps in order, because later steps depend on earlier ones.

Authentication uses **device login**. You start the login, the user approves it in their browser, and the CLI saves the session. You never see, ask for, or store a password.

All commands in this skill are bash commands. Claude Cowork runs them in its Linux virtual machine on every host, Windows included, so use them as written there. In Claude Code on Windows, run them with the Bash tool, which uses Git Bash, and not with the PowerShell tool. The one difference there is the venv layout. A venv created on Windows keeps its programs in `.venv/Scripts`, so read `.venv/Scripts` wherever this skill says `.venv/bin`.

## 0. Find the SDK

At the start of every session, the hook of this plugin installs the `datatailr` SDK once, into the plugin's data folder. It puts that folder on the `PATH` of every bash command. It also adds a line that starts with `Datatailr:` to the session context. That line names the folder and says whether a CLI login is saved. Check that the SDK is on the `PATH`:

```bash
command -v datatailr dt
```

If it prints two paths, the SDK is ready: skip step 2, and run `datatailr`, `dt` and `python` by name in every later command. If it prints nothing but the context names a folder, the shell did not load the session environment. Then put the folder at the start of `PATH` in each command, for example `PATH="<folder>:$PATH" dt user ls`. If there is no such line in the context, or it says that the install failed, do step 2.

## 1. Create an isolated project directory

Do the whole task in a fresh, writable subdirectory. Never work in the workspace root, because it can be read-only (for example `.agents` mounted read-only in some sessions).

```bash
mkdir -p ./datatailr-project-<short-descriptive-name>
cd ./datatailr-project-<short-descriptive-name>
```

Keep the generated code here, so the task is self-contained and can be repeated.

## 2. Install the SDK in a project venv, only when step 0 found none

```bash
python -m venv .venv
.venv/bin/python -m pip install --upgrade datatailr
.venv/bin/python -m datatailr setup-cli --no-login
```

If `python` does not exist, use `python3` for the first command. The last command writes `.venv/bin/dt`.

Keep the venv inside the project directory (`.venv`), not system-wide. The shell does not keep an activated venv or an exported `PATH` between commands. Do not activate the venv. In every later command of this skill, replace `datatailr` with `.venv/bin/python -m datatailr`, `dt` with `.venv/bin/dt` and `python` with `.venv/bin/python`. You can also put the venv's `bin` directory on `PATH` at the start of each command that needs `dt`:

```bash
export PATH="$(pwd)/.venv/bin:$PATH"
```

## 3. Install the Datatailr agent skills

With this plugin, the `datatailr-*` skills are already available to you, so skip this step. If they are not, run this from inside the project directory:

```bash
datatailr setup-skills --force
```

The command installs the `datatailr-*` skills into `./.agents/skills`, which Codex, Cursor and Copilot read, and links them from `./.claude/skills` for Claude Code. On Windows without Developer Mode it copies them into `.claude\skills` instead and says so.

## 4. Log in with device login

Find the installation URL. Use the one the user gave. If there is none, use `$DATATAILR_BASE_URL` if it is set. Otherwise ask the user. The URL is not a secret.

Then check whether the user is already logged in to that installation. The CLI keeps its session in `~/.dt/remote_client/remote_client.cfg`. That file holds the session token, so never print it. Read the URL alone with:

```bash
python -c 'import json, os; print(json.load(open(os.path.expanduser("~/.dt/remote_client/remote_client.cfg"))).get("base_url", ""))'
```

Compare it with the URL you found. Ignore a trailing slash and the case of the host. If the user gave no scheme, add `https://` to the URL you found, because the CLI saves the URL with it. If the file is missing or the URLs differ, continue with the login.

If the URLs match, run the check. It keeps the user list out of the conversation:

```bash
dt user ls > /dev/null && echo logged-in
```

If it prints `logged-in`, the user is logged in to that installation, so skip the rest of this step. If it fails, continue with the login.

**The whole login happens in ONE response.** If your turn ends, background processes stop. If you end your turn after you share the link, the approval reaches nothing and the login silently fails.

Start the login **in the background**. It blocks while it polls for approval, for up to 15 minutes:

```bash
DATATAILR_BASE_URL="<base-url>" datatailr login --device --url "<base-url>" > .dt-login.log 2>&1 &
```

The SDK lets `DATATAILR_BASE_URL` override `--url`. A URL that the user exported in the shell can send the login to another installation. So the command sets the variable to the right URL.

Then, without ending the turn:

1. Read `.dt-login.log` until it shows the line after `Open this URL in your browser to log in:`.
2. Give that URL to the user and ask them to open it and approve. If the user is not signed in to Datatailr, the page asks them to sign in first.
3. Keep polling the log in the same response until the command finishes. Success prints `Logged in as <user>` followed by `Installed remote dt CLI to: ...`. Device login writes the `dt` CLI too.
4. After `Logged in as`, rerun the `base_url` one-liner and make sure that it prints the URL from the first paragraph. Compare the two URLs in the same way as above. If it does not, tell the user and stop.

Do not fall back to username and password login. Do not ask the user for their password. If the approval link expires or the approval fails, start the login again and share the new link.

Never print the session token or the contents of `~/.dt/remote_client/remote_client.cfg`.

## 5. Hand over

To build or deploy something, read the [`datatailr`](../../skills/datatailr/SKILL.md) skill and follow the skill it names. To look at jobs, runs or logs, read [`datatailr-job-observability`](../../skills/datatailr-job-observability/SKILL.md).

The skills you hand over to run `dt` and `python`, and a deploy script starts `dt` by name. With the SDK from step 0, both work as they are. With a project venv from step 2, keep using `.venv/bin/python` and `.venv/bin/dt`, and put the venv's `bin` directory on `PATH` in the same command:

```bash
PATH="$(pwd)/.venv/bin:$PATH" .venv/bin/python deploy.py
```

If the `datatailr-dashboard` plugin is installed, it finds the SDK from step 0 on its own, and `/dt` opens the pane. With a project venv from step 2, give the user the absolute path `<project>/.venv/bin/datatailr` instead. Use the absolute path of the project directory from step 1. On Windows the path is `<project>\.venv\Scripts\datatailr.exe`, with the `.exe` suffix, because the plugin checks the exact path. Tell them to set it as the plugin's `cliPath` option with `claude plugin configure datatailr-dashboard`.

## Troubleshooting

- **`datatailr: command not found` although the context names a folder**: the shell did not load the session environment. Put the folder at the start of `PATH` in each command, as step 0 says.
- **`setup-skills` fails with a permissions error**: make sure that you are inside the project subdirectory from step 1, not the workspace root.
- **`login: error: unrecognized arguments: --device`**: the installed `datatailr` predates device login. Run `python -m pip install --upgrade datatailr` with the Python of the SDK. If that does not help, tell the user their package version does not support device login yet.
- **"Datatailr base URL is required for device login"**: pass `--url` or set `DATATAILR_BASE_URL`.
- **"Device authorization request expired" or "timed out"**: the user did not approve within 15 minutes. Start the login again and share the new link.
- **"Native dt CLI detected on this system"**: you are running inside Datatailr, where `dt` is already installed and the remote CLI is not needed. Continue with the native `dt`.
- **A `dt` command fails with "Not authenticated or session expired"**: the session expired. Repeat step 4.
