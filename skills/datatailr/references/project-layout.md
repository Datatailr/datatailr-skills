# Project layout and packaging

These rules apply to all Datatailr job types: apps, services, Excel add-ins, and workflows.

## Layout

The deploy script must live **outside** the package directory that is sent to the remote; it is only used locally to register and run the job. Do not use hyphens in directory names — use underscores. Always prefer **absolute imports** (`from my_package.utils import ...`) instead of relative imports (`from .utils import ...`).

**Only the entrypoint package directory** is packaged and sent to the remote. Root-level files such as `deploy.py`, a root `setup.py`, or root `requirements.txt` are not included. Therefore **all files required for the job** (code, `setup.py`, `pyproject.toml`, Cython sources, data files, etc.) must live **inside** that package directory. A root `pyproject.toml` can still supply the job's dependencies and Python version: `python_requirements="auto"` / `python_version="auto"` (or a path to the file) read it on the deploy machine, but the file itself is not shipped and the project is not pip-installed in the image. For installable packages (e.g. with Cython), put `setup.py` and any build assets inside that directory.

Example:

```
my_project/
├── my_package/
│   ├── __init__.py
│   ├── app.py        # Job code
│   └── setup.py      # If needed; must be inside my_package/
└── deploy.py         # Deploy script (outside my_package/; not sent to remote)
```

## What gets packaged

When packaging, if the module is inside a git repository, only non-ignored files are included (tracked files plus untracked files that are not matched by `.gitignore`). Outside a git repo, the packager still skips obvious junk directories such as `.venv`, `node_modules`, `build/`, `dist/`, etc. In both cases, files named `.env` or `.DS_Store` are omitted.
