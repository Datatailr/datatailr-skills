---
name: datatailr-distributed-joblib
description: Run distributed scikit-learn / joblib workloads on the Datatailr platform. Parallelizes joblib.Parallel work (grid search, cross-validation, random forests) across a pool of worker containers with no manual setup. Use when the user asks to distribute, scale out, or speed up scikit-learn or joblib code on Datatailr / dt.
---

# Distributed scikit-learn / joblib on Datatailr

## Overview

Any code that parallelizes with joblib (most scikit-learn estimators via
`n_jobs`, or explicit `joblib.Parallel` calls) can run its parallel workload
on Datatailr worker containers instead of local processes. The SDK starts an
ephemeral pool automatically - no service definitions or workflow authoring.

## Usage

```python
import joblib
from datatailr.joblib import register_datatailr

register_datatailr()
with joblib.parallel_backend("datatailr", n_jobs=16):
    search.fit(X, y)   # e.g. RandomizedSearchCV, GridSearchCV, RandomForest
```

Key points:
- `register_datatailr()` registers the `"datatailr"` backend with joblib
  (once per process).
- The first `Parallel` call inside the context starts the pool: `n_jobs`
  worker containers plus a small broker service. Startup takes tens of
  seconds. When that `Parallel` finishes, the pool is torn down; a later
  `Parallel` starts a fresh pool.
- Do not set `n_jobs` on the scikit-learn estimator. The estimator then uses
  the `n_jobs` of `parallel_backend` (16 workers above). Do not use
  `n_jobs=-1`: the backend then starts 4 workers, unless you set the
  `n_workers` option.
- Pools shut down automatically when the process exits. To free resources
  earlier, call `datatailr.joblib.shutdown_pools()`.

## Backend options

Pass options alongside `n_jobs` in `parallel_backend`:

```python
with joblib.parallel_backend(
    "datatailr",
    n_jobs=16,
    worker_memory="4g",     # memory per worker container (default "2g")
    worker_cpu=2,           # CPU cores per worker container (default 1)
    environment="dev",      # Datatailr environment
    embed_modules=("my_helpers",),  # local modules shipped by value
):
    ...
```

- `n_workers`: number of worker containers. The default is the `n_jobs` of
  the first `Parallel` call, or 4 if that `n_jobs` is `-1`.
- `embed_modules`: use when tasks reference helper modules that exist only on
  the driver machine (not installed in the workstation image). Accepts module
  objects or module-name strings.
- `idle_timeout` (seconds, default 600): an orphaned pool self-terminates
  after this long without driver contact.

## Requirements

- Run from a Datatailr workstation (the pool reuses the workstation image, so
  worker library versions always match the driver), or from a remote SDK
  session after `datatailr login`.
- `joblib` and `cloudpickle` must be installed in the driver environment, and
  `cloudpickle` must be available in the workstation image.
- Packages used inside tasks (scikit-learn, numpy, ...) must be installed in
  the workstation image - workers do not see driver-only pip installs.

## Behavior notes

- Function arguments and results are serialized with cloudpickle, so
  notebook-defined functions and closures work.
- Large objects repeated across parallel tasks (typical for sklearn CV /
  grid search with shared `X` and `y`) are uploaded once per pool to blob
  storage and referenced by content hash in each task payload. Workers
  fetch each shared object once and keep them in a process-local cache.
  Objects above 32 MiB move in parallel chunks, so shared data of several
  GB works. The driver keeps every shared object in memory until the pool
  shuts down.
- Exceptions raised in workers propagate to the driver.
- If a worker container crashes (e.g. out of memory), its task is retried on
  another worker up to 3 times, then fails with a descriptive error. Increase
  `worker_memory` for memory-hungry workloads.
- Nested parallelism inside a task runs sequentially (same as Ray's backend).
- Pool startup (broker + workers) takes tens of seconds per `Parallel` call.
  After the pool is warm, short fits can still be slower than local `loky`
  because each batch crosses HTTP — the backend wins when individual fits
  are heavy enough to amortize that overhead (larger grids, bigger models/data).
