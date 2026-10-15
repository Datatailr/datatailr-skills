---
name: datatailr-deploy-app
description: Deploy a web app on the Datatailr platform using the Python SDK. Supports Streamlit, Dash, Flask, FastAPI, Panel, and standalone Notebook (Voila) apps. Use when the user asks to create and deploy an app, dashboard, web app, or notebook app on Datatailr / dt.
---

# Deploy an App on Datatailr

## Overview

Datatailr deploys apps as containerized jobs. You write a standard web app using any supported framework, then use the `datatailr` Python SDK to deploy it. The SDK handles packaging, image building, and scheduling. The SDK is already installed in the workspace -- do not look for it.

## Project layout

See [datatailr-project-layout.md](../datatailr-project-layout.md) for packaging rules (deploy script outside the package, only the package directory is sent, gitignore / skip dirs).

## Deploy script pattern

The entrypoint import and what the module must expose differ by framework — see the framework-specific file for the exact deploy script pattern.

Key parameters:
- `name`: human-readable name for the app on the platform.
- `entrypoint`: see the framework-specific file for what to import and pass.
- `framework`: one of `"streamlit"`, `"dash"`, `"flask"`, `"fastapi"`, `"panel"`.
- `resources`: CPU, memory, and optional GPU memory for the container. Defaults to 128MB / 0.25 CPU. Set GPU memory with `Resources(..., vram="2g")`. `vram` uses the same size strings as memory. If you omit `vram`, the job JSON omits the `vram` field. There is no autoscaling for GPU nodes. If a job sets `vram`, the user must start a GPU node manually before the job can run (see [datatailr-nodes](../datatailr-nodes/SKILL.md)).
- `python_requirements`: a list of pip package names (e.g. `["streamlit", "cython"]`), a path to a `requirements.txt` file, a path to a `pyproject.toml` (its `[project].dependencies` are used), or `"auto"` (the dependencies of the project's `pyproject.toml`, found by searching up from the entrypoint package to the repo root; falls back to `pip freeze`). `python_version` likewise accepts a `pyproject.toml` path or `"auto"` (`.python-version`, else `requires-python`). The path is resolved **locally** when the job definition is built (at deploy time); the file is read on the machine running the deploy script and its **contents** are sent to the remote. If using a path, the file must exist where you run `python deploy.py` (e.g. `my_app/requirements.txt` when running from project root). Must include the framework itself.
- `app.run()` saves the definition AND starts the app. Use `app.save()` to only save.
- `python_version`: Python version for the container image (default `"auto"` -- auto-detects from your environment).
- `build_script_pre` / `build_script_post`: shell commands for the Docker image build. If the user needs to install OS packages or system libraries, see [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) for formatting details. If the script must operate on the installed package (e.g. run Cython or post-install steps), the package is installed at `/opt/datatailr/usr/lib/python/site-packages/<package_name>` where `<package_name>` is the **name of the directory that is deployed** (e.g. `my_app`); use that path in the script.
- `env_vars`: dict of environment variables passed to the running container.
- `run_as` / `acl`: leave unset to use default permissions. Only if the user explicitly requests access restrictions, see [datatailr-acl.md](../datatailr-acl.md). If their request is vague (e.g., "restrict access"), ask who should be able to see, edit, and operate the job before proceeding.

## Framework-specific details

Prefer Flask or FastAPI for most production web apps (routing, templates, auth patterns, performance). Use Streamlit when the user explicitly requests it or when building a quick internal/prototype UI where its constraints are acceptable.

Read **only** the file for the framework being deployed:

- Flask: see [flask.md](flask.md)
- Streamlit: see [streamlit.md](streamlit.md)
- Dash: see [dash.md](dash.md)
- FastAPI: see [fastapi.md](fastapi.md)
- Panel: see [panel.md](panel.md)
- Voila (notebook apps): see [voila.md](voila.md)
- Jupyter (notebook apps): see [jupyter.md](jupyter.md)

## Build environment and native dependencies

Datatailr jobs run in **Linux (Debian) containers**. The user's local OS (macOS, Windows, etc.) is **irrelevant** to the build.

**If the app uses Cython, C extensions, native libraries, or any dependency that requires a compiler or system headers, you MUST read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) before writing the deploy script.** The build image is minimal and has no compiler or build tools — they must be installed explicitly via `build_script_pre`. Do not assume they are present and do not skip them based on a deploy command succeeding (it may have used cached layers).

## Deploying

After creating all the files, tell the user to activate their venv (if using one) and run the deploy script; if possible, give them the exact command to run. Do not mention `PATH`, `PYTHONPATH`, venv bin paths, or any internal details. Do not print the full app code at the end.
When you (the agent) run the deploy script yourself, you may get `RuntimeError: Datatailr CLI ('dt') is not available.` or an `ImportError` for `datatailr`. If user is using a venv (ask if they are), you need to invoke the deploy script as `PATH="/path/to/.venv/bin:$PATH" .venv/bin/python deploy_script.py` so that `dt` is on `PATH`. If `dt` is also not installed in the venv, tell the user to run `datatailr setup-cli`. Do not run `setup-cli` yourself as it's an interactive command which requires input from the user.

## Checklist

- [ ] App code follows the framework-specific pattern (see the framework file)
- [ ] Deploy script is outside the app module directory
- [ ] `entrypoint` and module requirements follow the framework-specific pattern (see the framework file)
- [ ] All files required for the job (including setup.py, Cython sources, etc.) are inside the app package directory
- [ ] `framework` is explicitly set
- [ ] `python_requirements` includes the framework and all dependencies
- [ ] If native code / Cython / system libraries are needed: read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) and set `build_script_pre` / `build_script_post`
- [ ] No hyphens in directory names (use underscores)

## Platform environment variables

The platform sets these environment variables in every running app container. Use them when the app needs to know its runtime context:

- `DATATAILR_JOB_NAME`: name of the running job.
- `DATATAILR_USER`: username running the job.
- `DATATAILR_JOB_TYPE`: always `app` for apps.
- `DATATAILR_JOB_ENVIRONMENT`: Datatailr compute environment for this job (`dev`, `pre`, or `prod`).
- `DATATAILR_DOMAIN`: platform domain (useful for constructing URLs).

Dash apps also get `DASH_REQUESTS_PATHNAME_PREFIX` for URL routing (see [dash.md](dash.md)).

## User Identity
A user accessing the app from a browser can be identified by the "X-Datatailr-User" header in the request.
A helper method exists to retrieve the user from the request: `User.from_request(request)`:

```python
from datatailr import User
user = User.from_request(request)
if user:
    print(f"User {user.name} is accessing the app")
else:
    print("No user found in the request")
```

## Calling other services

If the app needs to fetch data from a Datatailr service, see [datatailr-service-communication.md](../datatailr-service-communication.md) for how to construct the internal URL and authenticate.
