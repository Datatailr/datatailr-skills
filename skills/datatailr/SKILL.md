---
name: datatailr
description: Use the Datatailr platform to build and deploy data processing workflows, long running services with endpoints, web apps and Excel add-ins.
---

# Instructions

Before writing code, determine which components you need to build and how they should interact with each other. Some tasks will require multiple components to be deployed together.

## Components

| Component | Description | Skill |
|-----------|-------------|-------|
| Data Processing Workflows | A DAG-based data pipeline where python functions are turned into nodes on a graph. Datatailr automatically determines which tasks can run in parallel based on their dependencies. | [datatailr-deploy-workflow](../datatailr-deploy-workflow/SKILL.md) |
| Long Running Services with Endpoints | A background process that runs continuously. It can provide a RESTful API for interacting with it, expose a websocket connection, or a long running stream of data. | [datatailr-deploy-service](../datatailr-deploy-service/SKILL.md) |
| Web Apps | A web application that is deployed as a containerized job. Several frameworks are supported, including Streamlit, Dash, Flask, FastAPI, Panel, and standalone Notebook (Voila/jupyter) apps. | [datatailr-deploy-app](../datatailr-deploy-app/SKILL.md) |
| Excel Add-ins | A set of Excel worksheet functions that are deployed as a containerized job. | [datatailr-deploy-excel-addin](../datatailr-deploy-excel-addin/SKILL.md) |
| Distributed scikit-learn / joblib | Run joblib-parallel workloads (grid search, cross-validation) on an automatically managed pool of worker containers. | [datatailr-distributed-joblib](../datatailr-distributed-joblib/SKILL.md) |
| Compute Nodes | List, inspect, drain, tag, create, resize and terminate the machines that run jobs, with the `Node` class or `dt node`. | [datatailr-nodes](../datatailr-nodes/SKILL.md) |
| Admin & Cluster Settings | Manage autoscaler capacity, platform settings, login, ACLs and budgets via `dt settings` and `Budget`. | [datatailr-admin](../datatailr-admin/SKILL.md) |

Pair with [datatailr-project-structure](../datatailr-project-structure/SKILL.md) for which component
types to build, then the matching [datatailr-deploy-*](../datatailr-deploy-workflow/SKILL.md) skills for the deploy API.

## Data, Secrets, and Environment Variables

Blob storage can be used to store large files, images, videos, and other binary data - [datatailr-blob-storage](../datatailr-blob-storage/SKILL.md).

Key-value store can be used to store connection strings, configuration values, and other small pieces of data. Secrets can be used to store sensitive data like passwords, API keys, and tokens. - [datatailr-kv-and-secrets](../datatailr-kv-and-secrets/SKILL.md).

Environment variables can be passed to a job at runtime as a dictionary using the `env_vars` parameter when defining the job.
`env_vars` should be reserved for configuration values and non-sensitive data. All sensitive data should be stored in Secrets.

## Logging and Observability
Use the `datatailr.logging` module to log messages to the platform's logging system:

```python
from datatailr.logging import DatatailrLogger

log = DatatailrLogger(__name__).get_logger()

log.info("This is an info message")
log.warning("This is a warning message")
log.error("This is an error message")
log.critical("This is a critical message")
```

These logs will be visible in the Datatailr UI under the "stdout" and "stderr" tabs of the job's logs, as well as using the `Job.logs()` method and `dt log read` CLI command.
More about observability and logging can be found in [datatailr-job-observability](../datatailr-job-observability/SKILL.md). To roll a job back to a previous version, see [datatailr-job-rollback](../datatailr-job-rollback/SKILL.md).

## `dt` CLI and wrapper
All interactions with the platform are done via the `dt` CLI command. The command is also available as a Python wrapper.
For example: `dt user ls` is available in python via the `User` class:
```python
from datatailr import User

users = User.ls()
```

Underneath, the `User` class as well as all other `datatailr` classes are using the lower level `datatailr.wrapper` module:

```python
from datatailr.wrapper import dt__User

user_client = dt__User()
users = user_client.ls()
```

Each `dt` command has a corresponding class in the `datatailr.wrapper` module. Subcommands are available as methods of the class.

## Compatibility errors

Do not routinely check component versions. Investigate compatibility only when a Datatailr command reports an explicit version mismatch or the user requests a compatibility check. Explain the required change and ask for approval before installing anything. After an approved SDK update, restart the Python/agent session before retrying. Do not assume other errors are compatibility problems.

## Filtering, Sorting and Pagination
Many list-style `dt` commands support filtering, sorting, and pagination. The filter/sort expression strings are the same across commands that support these options.

See [datatailr-sorting-and-filtering-dsl.md](../datatailr-sorting-and-filtering-dsl.md) for the full filter grammar.
