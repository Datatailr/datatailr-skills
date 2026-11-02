---
name: datatailr-connect
description: Start here for any Datatailr task when the environment is not set up or you are not logged in. Creates a project folder and a virtualenv, installs the datatailr SDK, logs in to the user's Datatailr installation with a browser approval (device login), and then hands over to the other datatailr skills. Use it when the user mentions Datatailr and no dt command works yet, or asks to connect, log in, set up or get started with Datatailr. Do not use it for work inside an installation that is already connected.
---

# Connect to Datatailr

This skill sets up a project, installs the Datatailr SDK and logs in to the user's Datatailr installation. It does not build or deploy anything. When it is done, step 4 hands over to the other `datatailr` skills. Follow the steps in order, because later steps depend on earlier ones.

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

Keep the venv inside the project directory (`.venv`), not system-wide.

The shell does not keep an activated venv or an exported `PATH` between commands. Do not activate the venv. Run `.venv/bin/python` and `.venv/bin/dt` by their path in every command. You can also put the venv's `bin` directory on `PATH` at the start of each command that needs `dt`:

```bash
export PATH="$(pwd)/.venv/bin:$PATH"
```

## 2. Install the Datatailr agent skills

If the `datatailr-*` skills are already available to you, skip this step.

Otherwise, from inside the project directory, run:

```bash
.venv/bin/python -m datatailr setup-skills --agent <agent> --force
```

Replace `<agent>` with `claude`, `codex` or `cursor`, the agent you are running as. The command copies the `datatailr-*` skills into the skills folder of that agent.

## 3. Log in with device login

First check whether the user is already logged in. Run `.venv/bin/dt user ls`. If it prints users, the user is already logged in to their installation, so skip the rest of this step. If the command fails, or `.venv/bin/dt` does not exist, continue with the login.

Find the installation URL. Use the one the user gave. If there is none, use `$DATATAILR_BASE_URL` if it is set. Otherwise ask the user. The URL is not a secret.

**The whole login happens in ONE response.** When your turn ends, background processes stop. If you end your turn after you share the link, the approval reaches nothing and the login silently fails.

Start the login **in the background**. It blocks while it polls for approval, for up to 15 minutes:

```bash
.venv/bin/python -m datatailr login --device --url "<base-url>" > .dt-login.log 2>&1 &
```

Then, without ending the turn:

1. Read `.dt-login.log` until it shows the line after `Open this URL in your browser to log in:`.
2. Give that URL to the user and ask them to open it and approve. If the user is not signed in to Datatailr, the page asks them to sign in first.
3. Keep polling the log in the same response until the command finishes. Success prints `Logged in as <user>` followed by `Installed remote dt CLI to: ...`. Device login installs the `dt` CLI too, so there is no separate `setup-cli` step.

Do not fall back to username and password login. Do not ask the user for their password. If the approval link expires or the approval fails, start the login again and share the new link.

Never print the session token or the contents of `~/.dt/remote_client/remote_client.cfg`.

## 4. Hand over

To build or deploy something, read the [`datatailr`](../../skills/datatailr/SKILL.md) skill and follow the skill it names. To look at jobs, runs or logs, read [`datatailr-job-observability`](../../skills/datatailr-job-observability/SKILL.md).

In every later command, keep using `.venv/bin/python` and `.venv/bin/dt`, or the `PATH` export from step 1. The skills you hand over to also run `dt` and `python`.

## Troubleshooting

- **`setup-skills` fails with a permissions error**: confirm you are inside the project subdirectory from step 0, not the workspace root.
- **`setup-skills: error: unrecognized arguments: --agent`**: the installed `datatailr` predates the flag. Run `.venv/bin/python -m pip install --upgrade datatailr` and try again. If that does not help, run the command without `--agent` and tell the user where the skills went.
- **`login: error: unrecognized arguments: --device`**: the installed `datatailr` predates device login. Run `.venv/bin/python -m pip install --upgrade datatailr`. If that does not help, tell the user their package version does not support device login yet.
- **"Datatailr base URL is required for device login"**: pass `--url` or set `DATATAILR_BASE_URL`.
- **"Device authorization request expired" or "timed out"**: the user did not approve within 15 minutes. Start the login again and share the new link.
- **"Native dt CLI detected on this system"**: you are running inside Datatailr, where `dt` is already installed and the remote CLI is not needed. Continue with the native `dt`.
- **A `dt` command fails with "Not authenticated or session expired"**: the session expired. Repeat step 3.
