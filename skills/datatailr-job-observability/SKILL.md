---
name: datatailr-job-observability
description: Monitor and troubleshoot Datatailr jobs using the CLI. Check job statuses, read logs, list runs, inspect versions, and manage running jobs. Use when the user asks about job status, wants to see logs, check if something is running, debug a failed job, or manage jobs on Datatailr / dt.
metadata:
  version: 0.1.0-dev.1
  compatibility-status: unverified
---

# Job Observability on Datatailr

All observability commands use the `dt` CLI. Always add `--json` when you need to parse the output programmatically. Human-readable (table) output is the default.

For programmatic access from Python (fetching workflow runs, per-task logs, and cached task results via the SDK), see [fetch-logs-and-results.md](references/fetch-logs-and-results.md).

## Safety: confirm before mutating

Commands are split into **read-only** and **mutating**. Always confirm with the user before running a mutating command.

| Category | Commands | Confirmation required? |
|---|---|---|
| Read-only | `job ls`, `job get`, `job runs`, `job versions`, `log read` | No |
| Mutating | `job stop`, `job start`, `job rm`, `job restore`, `job promote` | **Yes -- always ask the user first** |

When the user asks to stop, remove, or promote a job, state exactly what you are about to do (job name, environment, version) and wait for explicit approval before running the command. This is especially important for `job rm` and `job promote -e prod`.

## List jobs

```bash
dt job ls                                            # all jobs
dt job ls -f "type = app"                            # only apps
dt job ls -f "type = batch"                          # only workflows/batches
dt job ls -f "type = service"                        # only services
dt job ls -f "type = excel"                          # only Excel add-ins
dt job ls -f "name = my_job"                         # by exact name
dt job ls -f "name starts_with my_"                  # by name prefix
dt job ls -f "type = app and environment = prod"     # combine with `and`/`or`
dt job ls --json                                     # JSON output
dt job ls --json --pretty                            # pretty-printed JSON
```

### `job ls` filter grammar

Filters use a space-separated expression:

```
field operator value [and|or field operator value ...]
```

Always wrap the whole expression in quotes so the shell passes it as a single argument. Operators: `=`/`==`, `!=`, `<`/`<=`/`>`/`>=` (numeric only), `starts_with`/`ends_with`/`contains` (text only), `is_null`/`is_not_null`. Use `[v1, v2, v3]` for "any of" matching, `not` for negation, `(`/`)` for grouping. See `internal-docs/dsl-filtering-sorting.md` for the full grammar.

Sorting: `-s "+field"` (ASC) or `-s "-field"` (DESC), multiple fields are space-separated.

| Field | Type | Description | Example values |
|---|---|---|---|
| `name` | text | Exact job name (use `starts_with`/`contains` for prefix/substring) | `my_app` |
| `display_name` | text | Human-readable job name | `"My App"` |
| `id` | text | Job ID (UUID) | `abc123...` |
| `type` | text | Job type | `app`, `batch`, `service`, `excel`, `workspace` |
| `state` | text | Job state (see [Job states](#job-states)) | `ready`, `running`, `failed` |
| `environment` | text | Environment | `dev`, `pre`, `prod` |
| `run_as` | text | User who owns the job | `alice` |
| `create_time` | numeric | Unix timestamp of creation | `1700000000` |
| `cpu` | numeric | Number of CPUs | `2` |
| `memory` | numeric | Memory in bytes | `1073741824` |
| `version` | numeric | Job version number | `3` |

## Get job details

```bash
dt job get my_job                      # default (dev environment)
dt job get my_job -e prod              # specific environment
dt job get my_job -v 3                 # specific version
dt job get my_job --json               # JSON output
dt job get my_job -c                   # show child jobs (for workflows)
dt job get my_job -b stdout            # read build logs (stdout or stderr)
```

## List runs

Shows execution history for all jobs or filtered by type/state.

```bash
dt job runs                                         # all runs
dt job runs -f "type = batch"                       # only workflow runs
dt job runs -f "state = running"                    # only currently running
dt job runs -f "state = failed"                     # only failed
dt job runs -f "name = my_job"                      # runs for a specific job
dt job runs -f "run_id = 456"                       # a specific run
dt job runs -f "name = my_job and state = failed"   # combine
dt job runs --json                                  # JSON output
```

### `job runs` filter fields

Same grammar as [`job ls`](#job-ls-filter-grammar); wrap the whole expression in quotes.

| Field | Type | Description | Example values |
|---|---|---|---|
| `name` | text | Exact job name (use `starts_with`/`contains` for prefix/substring) | `my_job` |
| `state` | text | Run state | `running`, `completed`, `failed`, `pending`, `stopped` |
| `type` | text | Job type | `app`, `batch`, `service`, `excel` |
| `environment` | text | Environment | `dev`, `pre`, `prod` |
| `job_id` | text | Job ID (UUID) | `abc123...` |
| `run_id` | numeric | Specific run ID | `456` |
| `submit_time` | numeric | Unix timestamp the run was submitted | `1700000000` |
| `start_time` | numeric | Unix timestamp the run started | `1700000005` |
| `scheduled_time` | numeric | Unix timestamp the run was scheduled for | `1700000000` |
| `end_time` | numeric | Unix timestamp the run ended | `1700000060` |

## Read logs

```bash
dt log read my_job                     # last 10 lines of stdout
dt log read my_job -l 100              # last 100 lines
dt log read my_job -f                  # follow (tail -f style)
dt log read my_job -r                  # read stderr instead
dt log read my_job -e prod             # specific environment
dt log read my_job -i 42               # specific run ID
dt log read my_job -c 3                # child job #3 (for workflows)
```

## Job states

| State | Meaning |
|---|---|
| `created` | Job definition saved, not yet built |
| `building` | Container image is being built |
| `ready` | Built and ready to start |
| `scheduled` | Waiting for its scheduled time |
| `pending` | Waiting for resources |
| `starting` | Container is starting up |
| `running` | Actively running |
| `completed` | Finished successfully |
| `failed` | Exited with an error |
| `failed_after` | Exceeded `fail_after` timeout |
| `out_of_memory` | Killed due to OOM |
| `stopped` | Manually stopped |
| `expired` | Cleaned up after `expire_after` |

## Manage jobs

```bash
dt job start my_job                    # start a stopped job
dt job stop my_job                     # stop a running job
dt job start my_job -e prod            # start in specific environment
dt job stop my_job my_other_job        # stop multiple jobs
```

## Versions and promotion

```bash
dt job versions my_job                 # list all versions
dt job versions my_job -e prod         # versions in prod
dt job promote my_job 5 dev            # promote version 5 from dev to next env
```

## Remove and restore

```bash
dt job rm my_job                       # remove job (soft delete)
dt job rm my_job -v 3                  # remove specific version
dt job restore my_job                  # restore a removed job
```

## Troubleshooting workflow

When a user reports a job issue, follow this sequence:

1. **Check status**: `dt job get <name> --json` -- look at `state` and `exit_code`.
2. **Check build logs** (if state is `building` or `failed` right after deploy): `dt job get <name> -b stderr`.
3. **Read runtime logs**: `dt log read <name> -l 50` for stdout, add `-r` for stderr.
4. **Check run history**: `dt job runs -f "name = <name>" --json` to see if it has been failing repeatedly.
5. **Check OOM**: if state is `out_of_memory`, the job needs more memory in its `Resources`.
6. **Follow live**: `dt log read <name> -f` to watch output in real time.
