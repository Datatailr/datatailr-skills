## Fetching logs and results programmatically

After a workflow has run, get a handle to the deployed workflow with `get_existing=True` and use `runs()`, `logs()`, and `result()` to inspect what happened. This is useful for scripting, regression checks, or feeding a task's output into a notebook or another job.

```python
from datatailr import Environment
from datatailr import Workflow
from datetime import datetime, timedelta

wf = Workflow(name="Simple Data Pipeline", environment=Environment.DEV, get_existing=True)

since = datetime.now() - timedelta(days=1)
recent_runs = wf.runs(start_time=since, refresh=True)

latest_run = max([run for run in recent_runs
                  if run['state'] == 'completed'],
                  key=lambda x: x['start_time'])
result_for_get_data_node = wf.result(latest_run['run_id'], 'get_data')
print(f'Result for run that started at {latest_run["start_time"]}: {result_for_get_data_node}')

# Output:
#Result for run that started at 2026-06-30 09:45:09.249250: {'a': 1, 'b': 2, 'c': 3}
```

`name` must be the workflow's display name (the `name` passed to `@workflow(...)`, or the title-cased function name if not set).
`wf.runs()` returns a list of run dicts (`run_id`, `state`, `start_time`/`end_time` as `datetime`, `job_version`, `original_run_id`). It accepts optional `start_time` and `end_time` `datetime` arguments to filter to runs whose `start_time` falls within that window (either bound can be omitted), and `refresh=True` to bypass the per-instance cache. Use `wf.run_details(run_id)` for the per-task breakdown.

### `wf.logs(run_id, task_name=None, stderr=False, lines=5000, task_id=None)`

Returns the captured **stdout** (or **stderr** with `stderr=True`) of a specific task in a specific run as a string. `task_name` is the task's display name -- the same name shown in `run_details(...)["tasks"]` and in the DAG view. The most recent 5000 lines are returned by default; override with `lines=N`.

```python
run_id = latest_run['run_id']
print(wf.logs(run_id=run_id, task_name="get_data"))
print(wf.logs(run_id=run_id, task_name="get_data", stderr=True))
```

For runs produced by an older workflow version (whose task names may have changed since), pass `task_id` instead -- it's exposed in `run_details(...)["tasks"][i]["id"]` and bypasses name resolution against the current definition. `task_id` takes precedence over `task_name` when both are provided:

```python
details = wf.run_details(run_id=run_id)
print(wf.logs(run_id=run_id, task_id=details["tasks"][0]["id"]))
```

### `wf.result(run_id, task_name=None, task_id=None)`

Returns the cached Python return value of a task (DataFrame, dict, list, etc.) -- the same object the task originally returned, deserialized. Returns `None` when no result is stored (task still running, raised before returning, returned `None`, or the cache entry has expired).

```python
data = wf.result(run_id=run_id, task_name="get_data")
total = wf.result(run_id=run_id, task_name="process_data")
```

As with `logs()`, pass `task_id` to address a task by its numeric id when the run is from an older workflow version:

```python
details = wf.run_details(run_id=run_id)
data = wf.result(run_id=run_id, task_id=details["tasks"][0]["id"])
```

Both `logs()` and `result()` raise `ValueError` if `task_name` is given and does not match any task on the currently-loaded workflow. They also work on non-workflow jobs (`App`, `Service`, `ExcelAddin`); in that case `task_name`/`task_id` is informational and the call addresses the job itself.

For CLI-based equivalents (`dt log read`, `dt job runs`, etc.) and broader troubleshooting, see [datatailr-job-observability](../datatailr-job-observability/SKILL.md).

## Instant-run handle (script + notebooks)

When a workflow is started with `instant_run=True`, the call returns an
`InstantRunHandle` object. It exposes the same observability primitives and can
be polled by user code:

```python
handle = my_workflow(instant_run=True)
print(handle.status())
print(handle.task_status(task_name="get_data"))
print(handle.logs(task_name="get_data"))
print(handle.result(task_name="get_data"))
```

In Jupyter notebooks, `InstantRunHandle` is displayable. If it's the last
expression in a cell, it renders the interactive `SingleRunViewerWidget`
directly (DAG + per-task stdout/stderr/result tabs for that run).

Instant-run supports mode selection:

- `instant_run_mode="auto"` (default): use cloudpickle in Jupyter kernels,
  source bundles otherwise.
- `instant_run_mode="cloudpickle"`: force cloudpickle payload creation.
- `instant_run_mode="source"`: force source bundle payload creation.

Cloudpickle mode needs `cloudpickle` in the workstation image's
`python_requirements` and the same Python minor version locally as in that
image. `instant_run` checks both before submitting and raises `ValueError`
if either is not met.

Cloudpickle mode supports module embedding by value:

```python
import test
handle = my_workflow(
    instant_run=True,
    instant_run_mode="cloudpickle",
    instant_run_embed=[test, "test"],
)
```

Use module objects where possible so typos are caught by normal Python imports.
String module names are still supported.

Note: embedding modules by value does not make runtime imports inside task
bodies universally portable. For example, `from test import helper` executed
inside a task still relies on module importability at runtime. In those cases,
prefer source mode or restructure tasks to avoid late imports.
