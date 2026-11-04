---
name: datatailr-connect
description: Start here for any Datatailr task when the environment is not set up or you are not logged in. Creates a project folder and a virtualenv, installs the datatailr SDK, logs in to the user's Datatailr installation with a browser approval (device login), and then hands over to the other datatailr skills. Use it when the user mentions Datatailr and no dt command works yet, or asks to connect, log in, set up or get started with Datatailr. Do not use it for work inside an installation that is already connected.
---

# Connect to Datatailr

This skill sets up a project, installs the Datatailr SDK and logs in to the user's Datatailr installation. It does not build or deploy anything. When it is done, step 4 hands over to the other `datatailr` skills. Follow the steps in order, because later steps depend on earlier ones.

All commands in this skill are bash commands. Claude Cowork runs them in its Linux virtual machine on every host, Windows included, so use them as written there. In Claude Code on Windows, run them with the Bash tool, which uses Git Bash, and not with the PowerShell tool. The one difference there is the venv layout. A venv created on Windows keeps its programs in `.venv/Scripts`, so read `.venv/Scripts` wherever this skill says `.venv/bin`.

Authentication uses **device login**. You start the login, the user approves it in their browser, and the CLI saves the session. You never see, ask for, or store a password.

## 0. Create an isolated project directory

Do the whole task in a fresh, writable subdirectory. Never work in the workspace root, because it can be read-only (for example `.agents` mounted read-only in some sessions).

```bash
mkdir -p ./datatailr-project-<short-descriptive-name>
cd ./datatailr-project-<short-descriptive-name>
```

Keep the virtualenv and the generated code here, so the task is self-contained and can be repeated.

## 1. Create a project-local virtual environment and install `datatailr`

```bash
python -m venv .venv
.venv/bin/python -m pip install --upgrade datatailr
```

If `python` does not exist, use `python3` for the first command.

Keep the venv inside the project directory (`.venv`), not system-wide.

The shell does not keep an activated venv or an exported `PATH` between commands. Do not activate the venv. Run `.venv/bin/python` and `.venv/bin/dt` by their path in every command. You can also put the venv's `bin` directory on `PATH` at the start of each command that needs `dt`:

```bash
export PATH="$(pwd)/.venv/bin:$PATH"
```

## 2. Install the Datatailr agent skills

If the `datatailr-*` skills are already available to you, skip this step.

Otherwise, from inside the project directory, run:

```bash
.venv/bin/python -m datatailr setup-skills --force
```

The command installs the `datatailr-*` skills into `./.agents/skills`, which Codex, Cursor and Copilot read, and links them from `./.claude/skills` for Claude Code. On Windows without Developer Mode it copies them into `.claude\skills` instead and says so.

## 3. Log in with device login

Find the installation URL. Use the one the user gave. If there is none, use `$DATATAILR_BASE_URL` if it is set. Otherwise ask the user. The URL is not a secret.

Then check whether the user is already logged in to that installation. The CLI keeps its session in `~/.dt/remote_client/remote_client.cfg`. That file holds the session token, so never print it. Read the URL alone with:

```bash
.venv/bin/python -c 'import json, os; print(json.load(open(os.path.expanduser("~/.dt/remote_client/remote_client.cfg"))).get("base_url", ""))'
```

Compare it with the URL you found. Ignore a trailing slash and the case of the host. If the user gave no scheme, add `https://` to the URL you found, because the CLI saves the URL with it. If the file is missing or the URLs differ, continue with the login.

If the URLs match, install the CLI without a login. `.venv/bin/dt` exists only after a login or `setup-cli`, so in a new project the next check cannot work without this command:

```bash
.venv/bin/python -m datatailr setup-cli --no-login
```

Then run the check. It keeps the user list out of the conversation:

```bash
.venv/bin/dt user ls > /dev/null && echo logged-in
```

If it prints `logged-in`, the user is logged in to that installation, so skip the rest of this step. If it fails, continue with the login.

**The whole login happens in ONE response.** If your turn ends, background processes stop. If you end your turn after you share the link, the approval reaches nothing and the login silently fails.

Start the login **in the background**. It blocks while it polls for approval, for up to 15 minutes:

```bash
DATATAILR_BASE_URL="<base-url>" .venv/bin/python -m datatailr login --device --url "<base-url>" > .dt-login.log 2>&1 &
```

The SDK lets `DATATAILR_BASE_URL` override `--url`. A URL that the user exported in the shell can send the login to another installation. So the command sets the variable to the right URL.

Then, without ending the turn:

1. Read `.dt-login.log` until it shows the line after `Open this URL in your browser to log in:`.
2. Give that URL to the user and ask them to open it and approve. If the user is not signed in to Datatailr, the page asks them to sign in first.
3. Keep polling the log in the same response until the command finishes. Success prints `Logged in as <user>` followed by `Installed remote dt CLI to: ...`. Device login installs the `dt` CLI too, so there is no separate `setup-cli` step.
4. After `Logged in as`, rerun the `base_url` one-liner and make sure that it prints the URL from the first paragraph. Compare the two URLs in the same way as above. If it does not, tell the user and stop.

Do not fall back to username and password login. Do not ask the user for their password. If the approval link expires or the approval fails, start the login again and share the new link.

Never print the session token or the contents of `~/.dt/remote_client/remote_client.cfg`.

## 4. Hand over

To build or deploy something, read the [`datatailr`](../../skills/datatailr/SKILL.md) skill and follow the skill it names. To look at jobs, runs or logs, read [`datatailr-job-observability`](../../skills/datatailr-job-observability/SKILL.md).

In every later command, keep using `.venv/bin/python` and `.venv/bin/dt`. A command that runs the Python SDK, such as a deploy script, also needs the venv's `bin` directory on `PATH`. Put it there in that same command, because the SDK starts `dt` by name:

```bash
PATH="$(pwd)/.venv/bin:$PATH" .venv/bin/python deploy.py
```

The skills you hand over to also run `dt` and `python`.

If the `datatailr-dashboard` plugin is installed, give the user the absolute path `<project>/.venv/bin/datatailr`. Use the absolute path of the project directory from step 0. On Windows the path is `<project>\.venv\Scripts\datatailr.exe`, with the `.exe` suffix, because the plugin checks the exact path. Tell them to set it as the plugin's `cliPath` option with `claude plugin configure datatailr-dashboard`, and then to type `/dt` to open the pane. Without it the pane cannot find the CLI, because the venv is not on the `PATH` of the Claude process.

## Troubleshooting

- **`setup-skills` fails with a permissions error**: make sure that you are inside the project subdirectory from step 0, not the workspace root.
- **`login: error: unrecognized arguments: --device`**: the installed `datatailr` predates device login. Run `.venv/bin/python -m pip install --upgrade datatailr`. If that does not help, tell the user their package version does not support device login yet.
- **"Datatailr base URL is required for device login"**: pass `--url` or set `DATATAILR_BASE_URL`.
- **"Device authorization request expired" or "timed out"**: the user did not approve within 15 minutes. Start the login again and share the new link.
- **"Native dt CLI detected on this system"**: you are running inside Datatailr, where `dt` is already installed and the remote CLI is not needed. Continue with the native `dt`.
- **A `dt` command fails with "Not authenticated or session expired"**: the session expired. Repeat step 3.
