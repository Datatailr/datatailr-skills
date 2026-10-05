---
name: datatailr-deploy-excel-addin
description: Deploy an Excel add-in on the Datatailr platform using the Python SDK. Excel add-ins expose Python functions as Excel worksheet functions. Use when the user asks to deploy an Excel add-in, expose Python functions to Excel, or create Excel UDFs on Datatailr / dt.
metadata:
  version: 0.1.0-dev.1
  compatibility-status: unverified
---

# Deploy an Excel Add-in on Datatailr

## Overview

A Datatailr Excel add-in exposes Python functions as Excel worksheet functions (UDFs). Users call server-side computations directly from Excel spreadsheets. Functions can return single values or stream live data. The `datatailr` Python SDK handles packaging, image building, and scheduling. Use the Datatailr SDK installed in the agent's active Python environment. Check its version with `datatailr version` and use the release approved for the target Datatailr environment; do not assume the SDK is present or upgrade it implicitly.

## Project layout

See [datatailr-project-layout.md](references/datatailr-project-layout.md) for packaging rules (deploy script outside the package, only the package directory is sent, gitignore / skip dirs).

## Add-in code

Create an `Addin` instance and decorate functions with `@addin.expose()` to make them available in Excel. Include a `main(port, ws_port)` function -- the deploy script needs it as the entrypoint, and it is useful for local debugging. At runtime the platform launches the add-in directly via `dt-excel.sh` and does not call `main()`.

```python
# my_addin/addin.py
from datatailr.excel import Addin

addin = Addin("My Addin", "Description of the add-in")

@addin.expose(description="Adds two numbers", help="Provide a and b")
def add(a: float, b: float) -> float:
    return a + b

@addin.expose(description="Multiplies two numbers", help="Provide a and b")
def multiply(a: float, b: float) -> float:
    return a * b

def main(port=8080, ws_port=8000):
    addin.run(port, ws_port)

if __name__ == "__main__":
    main()
```

### `@addin.expose()` parameters

- `description`: short description shown in Excel.
- `help`: help text for the function.
- `streaming=True`: for functions that push live data continuously. Streaming functions receive a `Queue` as the first parameter.

### Streaming functions

```python
from datatailr.excel import Addin, Queue
import time

@addin.expose(description="Streams live prices", help="Provide initial price", streaming=True)
def stream_price(queue: Queue, initial_price: float) -> list:
    price = initial_price
    while True:
        price *= (1 + 0.001)
        queue.push([[price]])
        time.sleep(0.1)
```

### Multi-dimensional data (ranges)

**Input**: When a user selects a cell range in Excel (e.g., A1:C10), the function receives it as a nested list of lists. Type-hint the parameter with the element type (e.g., `float`) -- the SDK accepts both scalars and list of lists.

**Output**: Return a list of lists to fill multiple cells. Each inner list is one row.

```python
import numpy as np

@addin.expose(description="Cross-rate matrix for currency pairs", help="Provide base and quote currency lists")
def rate_table(bases: list, quotes: list) -> list:
    """Accepts a column of base currencies and a column of quote currencies.
    Returns an N x M matrix of cross rates."""
    bases = np.array(bases)
    quotes = np.array(quotes)

    rates = {"EUR": 1.0, "USD": 1.08, "GBP": 0.86, "JPY": 161.0}
    result = []
    for b in bases.flatten():
        row = []
        for q in quotes.flatten():
            row.append(rates.get(str(q), 1.0) / rates.get(str(b), 1.0))
        result.append(row)
    return result
```

**Streaming multi-dimensional data**: push a list of lists (or `.tolist()` on an array) to `queue.push()`.

```python
@addin.expose(description="Streams a matrix of random numbers", help="Provide rows and cols", streaming=True)
def random_matrix(queue: Queue, m: int, n: int) -> list:
    X = np.random.rand(int(m), int(n))
    while True:
        X += np.random.normal(0, 0.01, X.shape)
        queue.push(X.tolist())
        time.sleep(0.1)
```

### Key rules

- `main(port, ws_port)` is required as the deploy script entrypoint and for local debugging. The platform does **not** call `main()` at runtime -- it launches `dt-excel.sh` directly, which imports the `addin` object from the module.
- The `Addin` instance variable must be named `addin` in the module. The `Addin.__init__` method sets `__dt_addin__` on the module automatically -- you do not need to set it yourself, but the instance **must** be called `addin`.
- **Use only plain type hints**: `int`, `float`, `list`, `bool`, and `str`. Do **not** use generic types like `List[float]`, `list[list[str]]`, or `Optional[int]` -- they cause "Invalid argument" errors in the Excel bridge. The platform infers dimensionality from the actual value, not from the type hint.
- Streaming functions may annotate the first parameter as `queue: Queue` (or `datatailr.excel.Queue`); that parameter is excluded from the Excel signature.
- `ExcelAddin(...)` validates annotations in the entrypoint source file at construction time and raises `ValueError` if any exposed function uses a disallowed type.
- Use `snake_case` for function names - this simplifies the conversion to Excel function names.

## Deploy script

Import the `main` function and use the `ExcelAddin` class. No `framework` parameter.

```python
# deploy.py
from my_addin.addin import main
from datatailr import ExcelAddin, Resources

addin = ExcelAddin(
    name="My Excel Addin",
    entrypoint=main,
    resources=Resources(memory="4g", cpu=1),
    python_requirements=["numpy", "pandas"],
)
addin.save()
```

Key parameters:
- `name`: human-readable name on the platform.
- `entrypoint`: the `main` function (imported callable, not a string).
- `resources`: CPU and memory. Excel add-ins often need more memory (e.g., `"4g"`).
- `python_requirements`: a list of pip package names (e.g. `["numpy", "pandas"]`) or a path to a `requirements.txt` file. The path is resolved **locally** when the job definition is built (at deploy time); the file is read on the machine running the deploy script and its **contents** are sent to the remote. If using a path, the file must exist where you run `python deploy.py` (e.g. `my_addin/requirements.txt` when running from project root).
- Use `addin.save()` to deploy the add-in. To start an instance of the addin a user should access it from the UI.
- `python_version`: Python version for the container image (default `"auto"` -- auto-detects from your environment).
- `build_script_pre` / `build_script_post`: shell commands for the Docker image build. See [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) for formatting. If the script must operate on the installed package, it is at `/opt/datatailr/usr/lib/python/site-packages/<package_name>` where `<package_name>` is the name of the directory that is deployed (e.g. `my_addin`).
- `env_vars`: dict of environment variables passed to the running container.
- `run_as` / `acl`: leave unset to use default permissions. Only if the user explicitly requests access restrictions, see [datatailr-acl.md](references/datatailr-acl.md). If their request is vague (e.g., "restrict access"), ask who should be able to see, edit, and operate the job before proceeding.

## Build environment and native dependencies

Datatailr jobs run in **Linux (Debian) containers**. The user's local OS (macOS, Windows, etc.) is **irrelevant** to the build.

**If the add-in uses Cython, C extensions, native libraries, or any dependency that requires a compiler or system headers, you MUST read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) before writing the deploy script.** The build image is minimal and has no compiler or build tools — they must be installed explicitly via `build_script_pre`. Do not assume they are present and do not skip them based on a deploy command succeeding (it may have used cached layers).

## Deploying

After creating all the files, tell the user to activate their venv (if using one) and run the deploy script; if possible, give them the exact command to run. Do not mention `PATH`, `PYTHONPATH`, venv bin paths, or any internal details. Do not print the full app code at the end.
When you (the agent) run the deploy script yourself, you may get `RuntimeError: Datatailr CLI ('dt') is not available.` or an `ImportError` for `datatailr`. If user is using a venv (ask if they are), you need to invoke the deploy script as `PATH="/path/to/.venv/bin:$PATH" .venv/bin/python deploy_script.py` so that `dt` is on `PATH`. If `dt` is also not installed in the venv, tell the user to run `datatailr setup-cli`. Do not run `setup-cli` yourself as it's an interactive command which requires input from the user.

## Checklist

- [ ] `Addin` instance is named `addin` in the module
- [ ] Functions are decorated with `@addin.expose(description=..., help=...)`
- [ ] All function parameters have type hints
- [ ] Module has a `main(port, ws_port)` function calling `addin.run(port, ws_port)`
- [ ] Deploy script is outside the addin module directory
- [ ] Deploy script imports `main` (not a string path)
- [ ] All files required for the job are inside the addin package directory
- [ ] `python_requirements` includes all dependencies
- [ ] If native code / Cython / system libraries are needed: read [datatailr-build-scripts](../datatailr-build-scripts/SKILL.md) and set `build_script_pre` / `build_script_post`
- [ ] No hyphens in directory names (use underscores)

## Platform environment variables

The platform sets these environment variables in every running add-in container:

- `DATATAILR_JOB_NAME`: name of the running add-in.
- `DATATAILR_USER`: username running the add-in.
- `DATATAILR_JOB_ENVIRONMENT`: `dev`, `pre`, or `prod`.
- `DATATAILR_JOB_TYPE`: always `excel` for Excel add-ins.

## Calling other services

If the add-in functions need to fetch data from a Datatailr service, see [datatailr-service-communication.md](references/datatailr-service-communication.md) for how to construct the internal URL and authenticate.

## Related skills

Sibling skill links assume the full Datatailr collection is installed. If a referenced skill is missing, install it from the same release before following the dependent workflow.
