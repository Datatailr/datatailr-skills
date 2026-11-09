# Audit logs (`dt log audit`, `dt log events`)

`dt log audit` (admin only) answers **who did what**: one row per request a user made, refused and failed ones included. `dt log events` answers **what the platform did**: builds, placement, containers, runs; `--all` searches every job (admin only). A job's stdout/stderr is `dt log read`, see [datatailr-job-observability](../datatailr-job-observability/SKILL.md). Listing commands (`job ls`, `log audit` itself) are not recorded.

Always add `--json` when parsing. Filters are attribute matches; there is no SQL filter on these commands.

## `dt log audit` options

| Flag | Meaning |
|---|---|
| `-u` / `--user` | User (substring unless `--match exact`); `scim` for changes an identity provider pushed through SCIM |
| `-A` / `--action` | One or more comma-separated actions: `job.save`, `kv.put`, `auth.login`, ... SCIM changes carry the same `user.*`/`group.*` actions as the CLI; a refused SCIM token is `auth.scim` |
| `-r` / `--resource` | Resource: job name, key, user, ... (substring unless `--match exact`) |
| `-m` / `--match` | `contains` (default) or `exact` for `-u` and `-r` |
| `-C` / `--category` | One or more of `change`, `sensitive_read`, `auth` |
| `-O` / `--outcome` | One or more of `success`, `denied`, `failed` |
| `-e` / `--environment` | One or more comma-separated of `dev`, `pre`, `prod`, `system` (`system`: rows about no job); every environment when omitted |
| `-s` / `--source` | `cli`, `gui`, `python`, `remote_cli`, `oidc`, `registry` |
| `-T` / `--trace-id` | A full 32-hex trace id, or its first 8 or more hex characters |
| `-w` / `--with-events` | With `-T`: also the platform events of the same trace (the build, the run it created) |
| `-S` / `--starttime`, `-E` / `--endtime` | `YYYY-MM-DDTHH:MM:SSZ` or microseconds; default the last 24 hours, at most 366 days |
| `-b` / `--batch-size`, `-o` / `--offset` | Page size (default 100, max 1000) and rows to skip |

## `dt log events` options

| Flag | Meaning |
|---|---|
| `<job>` | The job's latest run (`-i` for another run, `-e` for its environment) |
| `--job-level` | What the platform did to the job itself: builds per version, schedules |
| `-a` / `--all` | Admin: every job, including names that were never created (`-e` then takes a list) |
| `-A` / `--event` | Event name, e.g. `scheduler.placement_blocked`; with `--job-level` also an audit action, e.g. `job.save` |
| `-O` / `--outcome` | One or more of `success`, `blocked`, `failed`; with `--job-level` also `denied` for the audit rows |
| `-r` / `--resource`, `-m` / `--match` | Job, run, parent run, workflow or task name |
| `-T` / `--trace-id` | As for `log audit`; a run's trace id is on its `scheduler.run_created` event |
| `--group-rows-only` | Run view without each child's rows; `--children-of <event> --reason <text> --group <group_id>` lists one group's children (`group_id` is on the group row; with `--all`, add `--parent-run <run>`) |

Paging: each reply's `pagination` has `has_more` and `end_time`; repeat with `--offset <next> --endtime <end_time>` so new rows do not shift the pages. `--with-events` and `--job-level` page through at most 1000 rows; past that, narrow the time window.

## Examples

```bash
dt log audit -A job.save,job.rm -r pricing --json        # who saved or removed a job
dt log audit -O denied -e prod --json                     # refusals in prod
dt log audit -T 4bf92f35 --with-events --json             # one request and what it caused
dt log events --all -O blocked,failed -e dev --json       # every problem in dev
dt log events pricing --job-level --json                  # a job's builds and schedules
```

Reply shape: `{"events": [...], "pagination": {"offset", "limit", "returned", "has_more", "end_time"}}`; each event has `kind` (`audit` or `lifecycle`) and `trace_id`, which `-T` takes; a `scheduler.run_created` event carries `run_trace_id`, the trace of the run it names.

## Workflow

1. **Who changed it**: `dt log audit -A <action> -r <name> --json`.
2. **Follow that request**: take `trace_id`, then `dt log audit -T <id> --with-events --json`; for the run itself, `dt log events --all -T <run_trace_id>`.
3. **Job never started**: `dt log events --all -r <name> --json`, look for `scheduler.placement_blocked`.
4. **Process output**: `dt log read <job>`.

## Not these

| Command | What it is |
|---|---|
| `dt log extract` | Admin raw query of the default log stream; not for audit or activity search |
| `dt log system` | Download a host system-log tarball |
