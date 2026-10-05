---
name: datatailr-project-structure
description: Structure Python projects for Datatailr so shared code is importable and every job deploys without copying packages. Use when creating or restructuring a Datatailr project, adding a workflow/service/app/Excel add-in that shares code, fixing ImportError on deploy, or replacing sync/copy scripts for common modules.
metadata:
  version: 0.1.0-dev.1
  compatibility-status: unverified
---

# Datatailr project structure

Use this skill **before** writing deploy scripts or splitting code into packages.

## The packaging rule (non-negotiable)

When you deploy, Datatailr packages **only the top-level directory that contains
the entrypoint import** and sends that tree to the remote.

| Included | Not included |
|----------|----------------|
| Everything under that package dir (`__init__.py`, subpackages, data, `setup.py` if needed) | Sibling packages, repo-root `requirements.txt`, `deploy_*.py`, `config/` outside the package, scripts |

Implications:

1. **Shared code must live inside the packaged directory** (or be a subpackage of it).
2. Copying / syncing a `*_common` package into each job directory is fragile — do not do it.
3. Deploy scripts stay **outside** the package; they only run locally to register the job.

## Recommended layout: one deployable package

For any project with more than one job (workflow + API + app, etc.), nest all
runtime code under a **single top-level package**. Every deploy imports an
entrypoint from that package, so the whole tree ships every time.

```
my_project/
├── my_app/                    # ONE package — this is what gets deployed
│   ├── __init__.py
│   ├── common/                # shared client, storage, config helpers
│   │   ├── __init__.py
│   │   └── ...
│   ├── ingest/                # workflow tasks
│   │   ├── __init__.py
│   │   ├── requirements.txt   # job-specific deps (optional but preferred)
│   │   └── tasks/
│   ├── api/                   # service
│   ├── dashboard/             # Streamlit/Dash/etc.
│   └── excel/                 # Excel add-in
├── deploy_ingest.py           # outside package — not sent to remote
├── deploy_api.py
├── deploy_dashboard.py
├── deploy_excel.py
├── config/                    # local/KV seed files; not in image unless copied into package
├── scripts/                   # local-only helpers
└── requirements.txt           # local/dev; not auto-included in jobs
```

This repo uses `jpx_alpha/` in that role (`jpx_alpha.common`, `jpx_alpha.api`, …).

### Naming

- Package and directory names: **underscores only** (no hyphens).
- Prefer a short product name (`jpx_alpha`, `my_lab`) as the single root.
- Subpackages: `common`, then one folder per deployable component.

## Imports

Always use **absolute** imports from the package root:

```python
# good
from my_app.common.storage import get_parquet
from my_app.ingest.tasks.pipeline import fetch_bars

# bad — breaks under Datatailr packaging / relative resolution
from .storage import get_parquet
from my_common.storage import get_parquet   # sibling package outside packaged dir
```

Local runs work from the **repo root** (so `my_app` is importable). Do not rely on
editable installs or `PYTHONPATH` hacks as the primary story unless the user asks.

## Deploy scripts

Each script lives at repo root (or otherwise **outside** the package) and imports
the entrypoint from inside the package:

```python
# deploy_api.py
from my_app.api.app import main
from datatailr import Resources, Service

service = Service(
    name="My API",
    entrypoint=main,
    resources=Resources(memory="2g", cpu=1),
    python_requirements="my_app/api/requirements.txt",
)
service.run()
```

```python
# deploy_ingest.py
from datatailr import workflow
from my_app.ingest.tasks.pipeline import task_a, task_b

@workflow(name="My Ingest", python_requirements="my_app/ingest/requirements.txt")
def my_ingest():
    task_b(task_a())

if __name__ == "__main__":
    my_ingest()
```

Because `main` / tasks are imported from `my_app.…`, Datatailr packages **`my_app/`**
— including `common/` and every sibling subpackage.

For component-specific entrypoint shapes (`main(port)`, Streamlit module, Excel
`main(port, ws_port)`, `@task` / `@workflow`), follow the relevant deploy skill.

## Requirements

- Prefer **per-job** `requirements.txt` under each subpackage (smaller images).
- Paths in `python_requirements=` are resolved **on the machine running deploy**;
  the file contents are sent to the remote — the path need not exist inside the image.
- Root `requirements.txt` is for local/dev only unless you point a job at it explicitly.
- List only what that job needs; shared libs (pandas, requests) may appear in several files.

## What must live inside the package

Anything the remote job imports or reads at runtime:

- Shared clients, analysis, blob helpers
- Task modules and `pipeline_core`-style libraries
- Optional: `setup.py` / Cython sources for that package
- Optional: small static data files the code opens by package-relative path

Keep out of the package (unless you intentionally want them in every image):

- `deploy_*.py`
- Secrets / `.env`
- Large local artifact caches
- Notebooks and one-off scripts (unless the job is a notebook app)

Config often lives in Datatailr KV/Secrets at runtime; local `config/*.json` can stay
at repo root for seeding — do not assume those files exist in the container.

## Anti-patterns (do not)

| Pattern | Why it fails |
|---------|----------------|
| Top-level `foo_common/` + `foo_api/` + copy/sync script | Drift; easy to miss sync; nested duplicates |
| Importing a **sibling** package (`from foo_common import …` while packaging `foo_api/`) | `ImportError` on remote — sibling was never uploaded |
| Putting shared code only at repo root | Not packaged |
| Hyphenated package dirs (`my-app/`) | Invalid / fragile Python package names |
| Relative imports across job boundaries | Break when package root is installed as site-packages |
| Assuming root `requirements.txt` is installed automatically | Only `python_requirements=` contents are used |

## Decision guide

```
Multiple jobs share code?
  YES → one top-level package + subpackages (this skill)
  NO  → single package dir still fine; keep deploy script outside it

Need smaller images / different deps per job?
  YES → per-subpackage requirements.txt; still one code package
  NO  → one shared requirements path is OK

Only one job ever?
  → Flat package is fine; still keep deploy script outside and absolute imports
```

## Agent checklist

When creating or restructuring a Datatailr project:

- [ ] Single top-level package directory holds all runtime code
- [ ] Shared utilities are a **subpackage** (e.g. `my_app.common`), not a sibling tree
- [ ] Absolute imports only (`from my_app.…`)
- [ ] No sync/copy script for shared modules
- [ ] Each `deploy_*.py` is outside the package and imports entrypoints from it
- [ ] `python_requirements` points at a real local path (prefer per-job file)
- [ ] Directory names use underscores
- [ ] Local smoke: `python -c "from my_app.common… import …"` from repo root
- [ ] Then follow the matching `datatailr-deploy-*` skill to finish the job definition

## Related skills

- Component overview: [datatailr](../datatailr/SKILL.md)
- Workflow / service / app / Excel: [workflow](../datatailr-deploy-workflow/SKILL.md), [service](../datatailr-deploy-service/SKILL.md), [app](../datatailr-deploy-app/SKILL.md), and [Excel add-in](../datatailr-deploy-excel-addin/SKILL.md) skills
- Native deps / Cython: [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md)

## Related skills

Sibling skill links assume the full Datatailr collection is installed. If a referenced skill is missing, install it from the same release before following the dependent workflow.
