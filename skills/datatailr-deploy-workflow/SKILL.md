---
name: datatailr-deploy-workflow
description: Deploy a DAG workflow on the Datatailr platform using the Python SDK. Workflows are directed acyclic graphs of tasks that run in parallel when possible. Use when the user asks to deploy a workflow, data pipeline, batch job, or DAG on Datatailr / dt, or to make existing Python functions deployable as a workflow.
metadata:
  version: 0.1.0-dev.1
  compatibility-status: unverified
---

# Deploy a Workflow on Datatailr

## Overview

A Datatailr workflow is a DAG (directed acyclic graph) of tasks. Tasks are Python functions decorated with `@task()`. A workflow function decorated with `@workflow()` composes tasks -- dependencies are inferred automatically from the data flow between calls. Tasks with no dependencies run in parallel. The `datatailr` Python SDK handles packaging, image building, and scheduling. Use the Datatailr SDK installed in the agent's active Python environment. Check its version with `datatailr version` and use the release approved for the target Datatailr environment; do not assume the SDK is present or upgrade it implicitly.

## Project layout

See [datatailr-project-layout.md](references/datatailr-project-layout.md) for packaging rules (deploy script outside the package, only the package directory is sent, gitignore / skip dirs).

## Task functions

Define tasks in a separate module. Each task is a regular Python function decorated with `@task()`:

```python
# tasks/processing.py
from datatailr import task

@task()
def get_data() -> dict:
    return {"a": 1, "b": 2, "c": 3}

@task()
def process_data(data: dict) -> dict:
    data["sum"] = sum(data.values())
    return data

@task(memory="512m", cpu=2)
def heavy_computation(x, y):
    return x ** y
```

`@task()` accepts optional `memory` and `cpu` to override the workflow defaults for that task.

## Workflow function

The workflow function composes tasks. Call tasks like normal functions -- the SDK builds the DAG from the data flow:

```python
# deploy.py
from datatailr import workflow, task
from tasks.processing import get_data, process_data

@task()
def add(a, b):
    return a + b

@workflow(name="My Data Workflow", python_requirements=["requests"])
def my_workflow():
    data = get_data()
    process_data(data)

    a = add(1, 2).alias("add_1_2")
    b = add(3, 4).alias("add_3_4")
    add(a, b).alias("sum_both")
```

Key rules:
- **Data passing is automatic.** Each task runs in its own container. When you pass the return value of one task as an argument to another, the platform automatically serializes, transfers, and deserializes it. You do not need to handle files, queues, or any inter-task communication -- just use normal function call syntax.
- **Dependencies are inferred from data flow.** If `process_data(data)` receives the output of `get_data()`, the platform ensures `get_data` finishes before `process_data` starts. No explicit ordering is needed.
- **Independent tasks run in parallel.** Tasks with no data dependency between them are scheduled concurrently.
- To share data between separate jobs (not tasks in the same DAG), use blob storage (see the blob-storage skill).
- When the same task is called multiple times, use `.alias("unique_name")` on each call to avoid name collisions.

## `@workflow()` parameters

- `name`: display name on the platform. Defaults to the function name, title-cased.
- `python_requirements`: a list of pip package names (e.g. `["requests"]`) or a path to a `requirements.txt` file. The path is resolved **locally** when the job definition is built (at deploy time); the file is read on the machine running the deploy script and its **contents** are sent to the remote. If using a path, the file must exist where you run `python deploy.py`.
- `resources`: default `Resources(memory=..., cpu=...)` for all tasks. Individual `@task()` overrides take precedence.
- `schedule`: a `Schedule` for recurring execution (see below).
- `env_vars`: dict of environment variables passed to every task container.
- `python_version`: Python version for containers (default `"auto"`).
- `run_as` / `acl`: leave unset to use default permissions. Only if the user explicitly requests access restrictions, see [datatailr-acl.md](references/datatailr-acl.md). If their request is vague (e.g., "restrict access"), ask who should be able to see, edit, and operate the job before proceeding.
- `fail_after`: max duration before marked failed (e.g., `"2h"` or `timedelta(hours=2)`).
- `expire_after`: duration after which completed workflow resources are cleaned up.
- `build_script_pre` / `build_script_post`: shell commands for the Docker image build. See [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) for formatting. If the script must operate on the installed package, it is at `/opt/datatailr/usr/lib/python/site-packages/<package_name>` where `<package_name>` is the name of the directory that is deployed.

## Scheduling

Use `Schedule` for recurring workflows:

```python
from datatailr import workflow, Schedule

@workflow(
    name="Daily Workflow",
    schedule=Schedule(at_hours=[8, 16], weekdays=["Mon","Tue","Wed","Thu","Fri"]),
)
def daily_workflow():
    ...
```

`Schedule` accepts either a raw `cron_expression` or human-readable helpers: `at_hours`, `at_minutes`, `every_hour`, `every_minute`, `weekdays`, `day_of_month`, `in_month`, `every_month`, `timezone`.

## Build environment and native dependencies

Datatailr jobs run in **Linux (Debian) containers**. The user's local OS (macOS, Windows, etc.) is **irrelevant** to the build.

**If the workflow uses Cython, C extensions, native libraries, or any dependency that requires a compiler or system headers, you MUST read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) before writing the deploy script.** The build image is minimal and has no compiler or build tools — they must be installed explicitly via `build_script_pre`. Do not assume they are present and do not skip them based on a deploy command succeeding (it may have used cached layers).

## Deploying

Call the workflow function to deploy:

```python
if __name__ == "__main__":
    my_workflow()
```

After creating all the files, tell the user to activate their venv (if using one) and run the deploy script; if possible, give them the exact command to run. Do not mention `PATH`, `PYTHONPATH`, venv bin paths, or any internal details. Do not print the full app code at the end.
When you (the agent) run the deploy script yourself, you may get `RuntimeError: Datatailr CLI ('dt') is not available.` or an `ImportError` for `datatailr`. If user is using a venv (ask if they are), you need to invoke the deploy script as `PATH="/path/to/.venv/bin:$PATH" .venv/bin/python deploy_script.py` so that `dt` is on `PATH`. If `dt` is also not installed in the venv, tell the user to run `datatailr setup-cli`. Do not run `setup-cli` yourself as it's an interactive command which requires input from the user.

### Other invocation modes

```python
my_workflow(local_run=True)   # execute locally for testing
my_workflow(save_only=True)   # save without starting
my_workflow(to_json=True)     # return JSON representation without deploying
```

### Instant Runs
It is possible to trigger a workflow run without waiting for an image to be built - this is great for 'one-off' runs.
See [instant-run.md](references/instant-run.md) for more details.

## Making existing code deployable

If the user has existing Python functions and wants to turn them into a Datatailr workflow, see [existing-code.md](references/existing-code.md).

## Using KV and Secrets in tasks

Each task runs in its own container. If a task reads from KV or Secrets:

- `KV().get()` **raises** if the key does not exist. Ensure keys are created before the workflow runs (ask the user to create it in the UI if required). Alternatively, wrap in try/except with a default.
- `KV().get()` may return a string or an already-parsed object. Always handle both (see the [kv-and-secrets skill](../datatailr-kv-and-secrets/SKILL.md) for the pattern).

## Checklist

- [ ] Task functions are decorated with `@task()`
- [ ] Workflow function is decorated with `@workflow(name=...)`
- [ ] `.alias()` is used when the same task is called multiple times
- [ ] All files required for the workflow are inside the packaged directory
- [ ] `python_requirements` includes all task dependencies
- [ ] If native code / Cython / system libraries are needed: read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) and set `build_script_pre` / `build_script_post`
- [ ] Deploy script is outside the tasks module directory
- [ ] No hyphens in directory names (use underscores)

## Platform environment variables

The platform sets these environment variables in every running task container. Use them when tasks need to know their runtime context:

- `DATATAILR_JOB_NAME`: name of the running task.
- `DATATAILR_USER`: username running the workflow.
- `DATATAILR_JOB_TYPE`: always `batch` for workflow tasks.
- `DATATAILR_JOB_ENVIRONMENT`: Datatailr compute environment (`dev`, `pre`, or `prod`).
- `DATATAILR_BATCH_RUN_ID`: unique ID for this workflow run.
- `DATATAILR_DOMAIN`: platform domain.

## Related skills

Sibling skill links assume the full Datatailr collection is installed. If a referenced skill is missing, install it from the same release before following the dependent workflow.
