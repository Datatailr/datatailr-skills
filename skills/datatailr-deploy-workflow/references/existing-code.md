# Making Existing Code Deployable as a Workflow

When the user has existing Python functions and wants to run them as a Datatailr workflow, follow these steps.

## 1. Identify tasks

Look at the user's code and identify functions that represent discrete computational steps. Good candidates for tasks are functions that:
- Perform a self-contained unit of work (fetch data, transform, compute, write output)
- Take inputs and return outputs (pure-ish functions)
- Could benefit from running in parallel with other steps

Functions that are small helpers called within a larger function should stay as regular functions -- not every function needs to be a task.

## 2. Add `@task()` decorators

For each identified function, add the `@task()` decorator. The function signature stays the same.

Before:
```python
def fetch_raw_data(source: str) -> dict:
    ...

def clean_data(raw: dict) -> dict:
    ...

def build_report(data: dict) -> str:
    ...
```

After:
```python
from datatailr import task

@task()
def fetch_raw_data(source: str) -> dict:
    ...

@task()
def clean_data(raw: dict) -> dict:
    ...

@task(memory="1g")
def build_report(data: dict) -> str:
    ...
```

No other changes to the function body are needed. The functions still work as normal Python when called directly.

## 3. Create the workflow function

Write a `@workflow()` function that calls the tasks in the correct order. The SDK infers dependencies from data flow -- pass task outputs to other tasks to create DAG edges.

```python
from datatailr import workflow

@workflow(name="My Report Pipeline", python_requirements=["pandas", "requests"])
def report_pipeline():
    raw = fetch_raw_data("s3://my-bucket/data.csv")
    cleaned = clean_data(raw)
    build_report(cleaned)
```

## 4. Handle common patterns

### Functions that are called from other functions

If `func_a` calls `func_b` internally, do NOT make `func_b` a task. Only the top-level orchestration functions should be tasks. Inner helper calls stay as regular Python.

### Functions with side effects (writing files, sending emails)

These work fine as tasks. They just won't have a meaningful return value for downstream tasks to consume.

### Functions that share state via globals or class instances

Refactor to pass data through function arguments and return values. Each task runs in its own container -- shared state does not work across tasks.

### Multiple calls to the same function with different inputs

Use `.alias()`:
```python
report_a = build_report(data_a).alias("report_us")
report_b = build_report(data_b).alias("report_eu")
```
