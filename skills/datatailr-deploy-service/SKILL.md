---
name: datatailr-deploy-service
description: Deploy a long-running service on the Datatailr platform using the Python SDK. Services are background processes like API servers, message consumers, or workers that auto-restart on exit. Use when the user asks to deploy a service, API, or background worker on Datatailr, or to make existing service code run on Datatailr / dt.
metadata:
  version: 0.1.0-dev.1
  compatibility-status: unverified
---

# Deploy a Service on Datatailr

## Overview

A Datatailr service is a long-running background process (API server, message consumer, worker). It auto-restarts if it exits. The `datatailr` Python SDK handles packaging, image building, and scheduling. Use the Datatailr SDK installed in the agent's active Python environment. Check its version with `datatailr version` and use the release approved for the target Datatailr environment; do not assume the SDK is present or upgrade it implicitly.

## Project layout

See [datatailr-project-layout.md](references/datatailr-project-layout.md) for packaging rules (deploy script outside the package, only the package directory is sent, gitignore / skip dirs).

## Service code

Write a module with a `main(port)` function that starts the service. The platform calls `main` with the assigned port.

```python
# my_service/app.py
from fastapi import FastAPI
import uvicorn
from fastapi.responses import JSONResponse, PlainTextResponse

app = FastAPI(title="My Service", description="My Service API")

@app.get("/", response_class=JSONResponse, summary="Get the index of the service")
def index():
    return {"status": "running"}

@app.get("/health", response_class=PlainTextResponse, summary="Check the health of the service")
def health_check():
    return "OK\n"

def main(port):
    uvicorn.run(app, host="0.0.0.0", port=int(port))
```

## Documentation

The deployed service API can be documented and the specs served as a json file at `/openapi.json`. This documentation is available once the service is deployed and accessible at `https://<domain>/launcher/service/dev/<service-name>`. Using fastapi and specifying the response class of the endpoints, the documentation is automatically generated and served at `/openapi.json`.

Key points:
- `main(port)` is required -- the platform passes the port to bind to.
- Include a `/health` endpoint returning `"OK"` for platform health monitoring.
- Include a `/openapi.json` endpoint returning the OpenAPI specification of the service for documentation and discovery.
- The service can use any HTTP framework (Flask, FastAPI, etc.) or no framework at all.

## Deploy script

Import the `main` function (not the module) and use the `Service` class. No `framework` parameter.

```python
# deploy.py
from my_service.app import main
from datatailr import Service, Resources

service = Service(
    name="My Service",
    entrypoint=main,
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["fastapi", "uvicorn"],
)
service.run()
```

Key parameters:
- `name`: human-readable name on the platform.
- `entrypoint`: the `main` function (imported callable, not a string).
- `resources`: CPU and memory for the container. Defaults to 128MB / 0.25 CPU.
- `python_requirements`: a list of pip package names (e.g. `["fastapi", "uvicorn"]`) or a path to a `requirements.txt` file. The path is resolved **locally** when the job definition is built (at deploy time); the file is read on the machine running the deploy script and its **contents** are sent to the remote. If using a path, the file must exist where you run `python deploy.py` (e.g. `my_service/requirements.txt` when running from project root).
- `service.run()` saves the definition AND starts it. Use `service.save()` to only save.
- `python_version`: Python version for the container image (default `"auto"` -- auto-detects from your environment).
- `build_script_pre` / `build_script_post`: shell commands for the Docker image build. See [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) for formatting. If the script must operate on the installed package, it is at `/opt/datatailr/usr/lib/python/site-packages/<package_name>` where `<package_name>` is the name of the directory that is deployed (e.g. `my_service`).
- `env_vars`: dict of environment variables passed to the running container.
- `run_as` / `acl`: leave unset to use default permissions. Only if the user explicitly requests access restrictions, see [datatailr-acl.md](references/datatailr-acl.md). If their request is vague (e.g., "restrict access"), ask who should be able to see, edit, and operate the job before proceeding.

## Build environment and native dependencies

Datatailr jobs run in **Linux (Debian) containers**. The user's local OS (macOS, Windows, etc.) is **irrelevant** to the build.

**If the service uses Cython, C extensions, native libraries, or any dependency that requires a compiler or system headers, you MUST read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) before writing the deploy script.** The build image is minimal and has no compiler or build tools — they must be installed explicitly via `build_script_pre`. Do not assume they are present and do not skip them based on a deploy command succeeding (it may have used cached layers).

## Deploying

After creating all the files, tell the user to activate their venv (if using one) and run the deploy script; if possible, give them the exact command to run. Do not mention `PATH`, `PYTHONPATH`, venv bin paths, or any internal details. Do not print the full app code at the end.
When you (the agent) run the deploy script yourself, you may get `RuntimeError: Datatailr CLI ('dt') is not available.` or an `ImportError` for `datatailr`. If user is using a venv (ask if they are), you need to invoke the deploy script as `PATH="/path/to/.venv/bin:$PATH" .venv/bin/python deploy_script.py` so that `dt` is on `PATH`. If `dt` is also not installed in the venv, tell the user to run `datatailr setup-cli`. Do not run `setup-cli` yourself as it's an interactive command which requires input from the user.

## Calling this service from other jobs

Once deployed, the service is reachable from any other Datatailr job (app, workflow, add-in, or another service) at `http://<normalized-name>`. The name is derived from the `name` parameter: lowercased, non-alphanumeric characters replaced with hyphens (e.g., `"My Service"` becomes `http://my-service`).

For full details on constructing URLs, authentication patterns, and naming conventions, see [datatailr-service-communication.md](references/datatailr-service-communication.md).

## Checklist

- [ ] Service has a `main(port)` function
- [ ] Service has a `/health` endpoint returning `"OK"`
- [ ] Deploy script is outside the service module directory
- [ ] Deploy script imports the `main` function (not a string path)
- [ ] All files required for the job are inside the service package directory
- [ ] `python_requirements` includes all dependencies
- [ ] If native code / Cython / system libraries are needed: read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) and set `build_script_pre` / `build_script_post`
- [ ] No hyphens in directory names (use underscores)

## Platform environment variables

The platform sets these environment variables in every running service container. Use them when the service needs to know its runtime context:

- `DATATAILR_JOB_NAME`: name of the running service.
- `DATATAILR_USER`: username running the service.
- `DATATAILR_JOB_TYPE`: always `service` for services.
- `DATATAILR_JOB_ENVIRONMENT`: Datatailr compute environment (`dev`, `pre`, or `prod`).
- `DATATAILR_DOMAIN`: platform domain (useful for constructing URLs).

## Related skills

Sibling skill links assume the full Datatailr collection is installed. If a referenced skill is missing, install it from the same release before following the dependent workflow.
