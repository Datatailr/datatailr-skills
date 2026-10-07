---
name: datatailr-build-scripts
description: Customize the Docker image for a Datatailr job using build_script_pre and build_script_post. Covers installing OS packages (apt-get), compilers, system libraries, Cython / native extension compilation, and build script formatting. Use when the user's job needs system-level dependencies, native code compilation, or any image customization beyond pip packages.
---

# Customizing the container image with build scripts

## Deployment target is always Linux

Datatailr jobs always run in **Linux (Debian) containers**, regardless of the user's local OS (macOS, Windows, etc.). All OS-level package decisions (`apt-get install`, system library names, compiler packages) must target Debian.

Every Datatailr job type (`App`, `Service`, `ExcelAddin`, `@workflow`) accepts two optional parameters for running shell commands during the Docker image build:

- `build_script_pre`: runs **before** pip install -- use for OS packages, system libraries, etc.
- `build_script_post`: runs **after** pip install -- use for post-install configuration, compiling extensions, etc.

The build image is a minimal debian slim with **no compiler, no build tools, and very few OS packages**. Do not assume any tool (gcc, make, etc.) is available — always install what you need in `build_script_pre`. Do not skip OS package installation based on other jobs succeeding; those may have used cached image layers.

### Do not perform generic "Docker optimizations"

**Do not** add image-size or layer tricks in `build_script_pre` / `build_script_post`: wiping apt cache/lists, broad `apt-get autoremove`, stripping unrelated packages, or other DIY optimizations. Your scripts should **only** add OS/runtime dependencies required by the app or its build (compilers, C library `-dev` packages such as `libpq-dev`, etc.).

### Never install `python3-dev` or distro Python packages

**Do not** install `python3-dev`, `python3-all-dev`, or similar packages. The image already ships the correct Python interpreter. For native extensions, use `build-essential` plus C library headers (e.g. `libssl-dev`) — never `python3-dev`.

### Use `python -m` instead of console script names

Pip-installed console scripts (e.g. `cythonize`, `pytest`, `flask`) may not be on `PATH` inside the build container. Always invoke them via `python -m`, e.g.:

- `python setup.py build_ext --inplace` or `python -m Cython.Build.cythonize` — not `cythonize`
- `python -m pytest` — not `pytest`
- `python -m flask` — not `flask`

## Formatting rules

Each script is a **single string**. The build system writes the string to a `.sh` file using `echo -e`, so escape sequences like `\n` are interpreted as real newlines.

### Multi-line: separate commands with literal `\n`

```python
build_script_pre="apt-get update\napt-get install -y libpq-dev libssl-dev"
```

### Single-line: chain with `&&`

```python
build_script_pre="apt-get update && apt-get install -y libpq-dev"
```

### File path: point to a `.sh` script

If the value is a path to an existing file, the SDK reads its contents automatically:

```python
build_script_pre="scripts/pre_build.sh"
```

This is the cleanest option for complex scripts.

## Package path in the container image

The job bundle is **extracted** (not pip-installed) into `/opt/datatailr/usr/lib/python/site-packages/<package_name>/`, where **`<package_name>` is the name of the directory that is deployed** (the entrypoint package directory, e.g. `my_app`). That path is on `PYTHONPATH`, so inside the running container the package is importable by its directory name — use normal imports like `from my_app.file import function_name`.
Extraction happens before `build_script_post` runs, so when the post script runs, the package directory is already at that path. If the package needs a build step (e.g. compiling Cython extensions via `setup.py`), do it in `build_script_post` targeting that path.


## Example deploy script with build scripts

```python
import my_app.app as entrypoint
from datatailr import App, Resources

app = App(
    name="My App",
    entrypoint=entrypoint,
    framework="streamlit",
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["streamlit", "psycopg2"],
    build_script_pre="apt-get update\napt-get install -y libpq-dev",
)
app.run()
```

## Cython / native extensions

Put `cython` in `python_requirements` — it is pip-installed before `build_script_post` runs. Do **not** duplicate `pip install cython` in the post script.

**`build_script_pre`**: install `build-essential` (`apt-get update && apt-get install -y build-essential`). The build image has no compiler — do not skip this based on previous successful builds. Never install `python3-dev`.

**`build_script_post`**: `cd` into the deployed package directory and compile:

```python
PACKAGE_DIR = "my_app"
build_script_post=(
    f"cd /opt/datatailr/usr/lib/python/site-packages/{PACKAGE_DIR} && "
    "python setup.py build_ext --inplace"
)
```

**Extension naming pitfall**: because `setup.py` lives *inside* the deployed directory (flat layout), use the bare module name in `Extension()`. Using the dotted package name causes setuptools to look for a nested subdirectory that doesn't exist.

```python
# setup.py inside my_app/
# CORRECT — .so lands next to the .pyx, importable as my_app.fast_math
Extension("fast_math", ["fast_math.pyx"])

# WRONG — setuptools expects my_app/fast_math.pyx layout under a nested my_app/
Extension("my_app.fast_math", ["fast_math.pyx"])
```
