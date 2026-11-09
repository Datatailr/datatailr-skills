---
name: datatailr-admin
description: Manage Datatailr cluster administration via CLI and Python SDK. Inspect and modify compute nodes (`Node` / `dt node`), platform settings (`dt settings`) including autoscaler capacity, idle time, drain/terminate, login, and ACLs, cost/budgets (`Cost`, `Budget` / `dt cost`), and audit logs (`dt log audit`). Use when the user asks about admin settings, autoscaler, cluster capacity, nodes/instances, idle time, drain, terminate, platform settings, spend, cost view, budgets, audit logs, who did what, or denied requests on Datatailr / dt.
---

# Admin & Cluster Settings on Datatailr

An admin user is a user, member of the `admin` group. A non admin user will not have access to these commands and will not be able to perform these actions.
Platform administration is done through the `dt` CLI and the Python SDK. This skill covers **compute nodes** (`Node` / `dt node`), **global platform settings** (`dt settings`), **cost/budgets** (`Cost`, `Budget` / `dt cost`), and **audit logs** (`dt log audit`). For user-owned KV entries and secrets, see [datatailr-kv-and-secrets](../datatailr-kv-and-secrets/SKILL.md) instead. For a job's own stdout and platform timeline, see [datatailr-job-observability](../datatailr-job-observability/SKILL.md).

Always add `--json` when you need to parse CLI output programmatically.

## Safety tiers

Commands are split into three tiers. **Read the tier before running anything.**

| Tier | Rule | Examples |
|---|---|---|
| **Read-only** | Run freely | `Node.ls()` / `node ls`, `node.jobs()` / `node jobs`, `node.drain_status()` / `node drain-status`, `Node.instance_types*()` / `node instance-types*`, `node.get_tag()` / `node.ls_tags()`, `settings get`, `settings ls`, `settings get-schema`, `settings ls-schemas`, `Cost.view()`, `Budget.ls()` / `Budget.get()`, `dt cost view` / `list-budgets` / `get-budget`, `log audit`, `log events --all` |
| **Confirm** | State exact command + impact; wait for explicit user approval | `Node.start/stop/restart/new/change_type()`, `node.drain()`, `node.set_tag()` / `node.rm_tag()` and their `dt node` equivalents, `settings put` for `system`, `workstation`, `image-retention`, `audit`, `helpdesk`, non-capacity autoscaler fields (e.g. `preferable_families`), `Budget.add()` / `update()` / ACL mutations |
| **Hard-gate** | **Refuse by default.** Only proceed if the user states the exact target (node id, budget name, or full JSON value) **and** explicitly asks you to apply it | `Node.terminate()` / `node terminate`, capacity autoscaler changes, login/ACL settings, `settings rm`, `Budget.remove()` |

## Hard-gate rules

Do **not** suggest or run these unless the user has given the exact values and asked you to apply them.

### Node operations

| Command | Why it is hard-gated |
|---|---|
| `Node.terminate()` / `dt node terminate` | Permanently destroys a cloud VM and all running workloads on it |

### Autoscaler capacity settings

Refuse `dt settings put autoscaler` when the change would:

- Decrease `max_cpus` for any environment, or set it to `0`
- Set `enabled: false` for any environment
- Set `minimum_idle_time`, `minimum_uptime`, or `zombie_timeout` above **15m** for any environment
- Enable `fallback_to_other_families: true` without the user explicitly requesting it

See [autoscaler.md](autoscaler.md) for the full schema, defaults, and safe-change workflow.

### Login and ACL settings

| Key | Why it is hard-gated |
|---|---|
| `login` | SSO/MFA/JWT misconfiguration can lock users out or weaken security |
| `acls/environment` | Wrong ACLs block users from dev/pre/prod compute environments |
| `acls/gui_pages` | Can hide admin pages (settings, users, nodes) from operators |
| `default_acls/*` | Changes default permissions on all newly created KV/blob/workstation/job resources |

Never "fix permissions" by rewriting ACL or login settings. Diagnose with `dt settings get <key>` and explain lockout risk instead.

### Settings deletion

| Command | Why it is hard-gated |
|---|---|
| `dt settings rm` | Deletes an entire setting; services may fail on missing keys |
| `dt settings rm-schema` | Removes a stored schema document |

## Autoscaler write workflow

Full autoscaler reference: [autoscaler.md](autoscaler.md)

## Node operations

Full `Node` SDK and `dt node` reference: [datatailr-nodes](../datatailr-nodes/SKILL.md)

## Cost & budgets

Full Cost / Budget SDK reference: [cost-and-budget.md](cost-and-budget.md)

## Audit logs

Who did what (admin only): [audit.md](audit.md). Use `dt log audit` for user actions; `dt log audit -T <trace id> --with-events` to include the platform work of that trace (the build it started, the run it created). Job stdout stays on `dt log read`.

## Other settings keys (confirm tier)

These keys exist under `settings/` in the KV store. Use read commands freely; require confirmation before `put`.

| Key | Purpose | Read |
|---|---|---|
| `system` | System log retention (`system_logs_retention_period`, default `7d`) | `dt settings get system` |
| `workstation` | Default workstation and idle timeout (`idle_timeout`, default `5h`) | `dt settings get workstation` |
| `image-retention` | Registry image cleanup policies per environment. `by_count` 1 deletes every older image, so users cannot roll back with `dt job rm` (see [datatailr-job-rollback](../datatailr-job-rollback/SKILL.md)) | `dt settings get image-retention` |
| `audit` | Audit log retention (`retention_days`, default `365`, allowed 1 to 3650). Shortening it deletes older audit events within a minute | `dt settings get audit` |
| `helpdesk` | HubSpot integration credentials | `dt settings get helpdesk` |

For login, ACL, and autoscaler details, use the hard-gate rules above. User-facing documentation: `documentation/docs/admin/settings/index.md`.

## Permissions

- **Node mutations** (`new`, `start`, `stop`, `restart`, `terminate`, `change-type`): require `root`, user `admin`, member of `admin` group, or member of `node_admin` group
- **Node drain/tags/ps**: routed to the node daemon; drain requires admin group membership on the node
- **Settings keys** under `settings/` are reserved: only **root** can create them; non-root users can update existing keys if they have WRITE ACL on that key
- **Settings deletion** (`settings rm`): root only for reserved keys

## Troubleshooting workflow

When a user reports capacity or scheduling issues:

1. **Check autoscaler**: `dt settings get autoscaler --json` — look at `enabled`, `max_cpus`, idle/uptime per environment
2. **Check nodes**: `Node.ls()` or `dt node ls --json` — look at status, environment, CPU usage
3. **Check drain state**: `Node("<node>").drain_status()` or `dt node drain-status -N <node>` if a specific node is not accepting jobs
4. **Check pending jobs**: `dt job runs -f "state = pending" --json`
5. **Who changed it**: `dt log audit -r <name> --json` — see [audit.md](audit.md)
6. **Diagnose, don't mutate** — explain what you found and what change would help; apply hard-gate rules before any write
