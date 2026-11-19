# Cost & Budget (Python SDK)

Budgets group jobs for spend reporting and optional spend caps. `Cost` queries aggregated job-run costs. Both wrap the `dt cost` CLI via the Python SDK.

Prefer the SDK classes below when running from Python. Equivalent CLI: `dt cost view`, `dt cost list-budgets`, `dt cost get-budget`, and the admin `*-budget*` / `*-budget-acl` subcommands.

## Concepts

| Concept | Purpose |
|---|---|
| **Budget** | Named spend bucket with a USD cap, current-month usage, optional `prevent_overflow`, and an ACL |
| **budget_id** | Numeric id on job definitions; jobs omit it to use the built-in `default` budget (id `1`) |
| **Cost view** | Daily cost rows aggregated by owner, job type, environment, and instance type |

### Budget ACL permissions

| Permission | Effect |
|---|---|
| **read** (`r`) | See cap, usage, and ACL fields |
| **operate** (`o`) | Assign jobs to this budget; list the budget without cap/usage/ACL when read is missing |

Members of the `admin` group can manage all budgets regardless of ACL. Soft-deleted budgets keep their id for historical jobs/cost views; re-adding a name creates a **new** id.

## Safety

| Tier | API / CLI | Rule |
|---|---|---|
| **Read-only** | `Cost.view()`, `Budget.ls()`, `Budget.get()`, `Budget("name")`, `Budget.get_acl()` | Run freely |
| **Confirm** | `Budget.add()`, `Budget.update()`, `Budget.set_acl()`, `Budget.add_acl()`, `Budget.remove_acl()` | State exact change + impact; wait for approval |
| **Hard-gate** | `Budget.remove()` | Soft-deletes a budget; only proceed if the user names the budget and explicitly asks to remove it |

Do not remove the built-in `default` budget. Before ACL mutations, remember that `run_as` users on jobs referencing the budget must retain **operate**.

## Cost — view spend

```python
from datetime import date
from datatailr import Cost

# Current UTC month through now (CLI defaults)
rows = Cost.view()

# Explicit UTC date range
rows = Cost.view(begin="2026-03-01", end="2026-03-25")
rows = Cost.view(begin=date(2026, 3, 1), end=date(2026, 3, 25))
```

- `begin` / `end` accept `YYYY-MM-DD` strings or `datetime.date` / `datetime.datetime`
- Omit both for CLI defaults; omit only `begin` when only `--end` is set (begin defaults to first day of that month)
- Returns `list[dict]` rows with keys: `date`, `owner`, `job_type`, `environment`, `instance_type`, `cost`

CLI equivalent:

```bash
dt cost view --json
dt cost view --begin 2026-03-01 --end 2026-03-25 --json
```

## Budget — inspect

```python
from datatailr import Budget

b = Budget("default")       # load by name (same as Budget.get)
b.name                      # "default"
b.id                        # numeric budget_id for job JSON
b.budget_usd                # cap, or None if not visible
b.usage_usd                 # current UTC month usage, or None
b.usage_percentage          # usage as % of cap, or None
b.prevent_overflow          # bool or None
b.acl                       # ACL or None without read permission

budgets = Budget.ls()       # budgets visible to the current user
```

Operate-only visibility may omit cap/usage/ACL fields (`None`).

## Budget — create / update / remove (admin)

```python
from datatailr import ACL, Budget, Group, Permission

# Create
Budget.add("team_q1", 50000.0, prevent_overflow=True)

# Create with ACL
acl = ACL(
    permissions={
        Permission.READ: [Group.get("analysts")],
        Permission.OPERATE: [Group.get("developers")],
    }
)
Budget.add("team_q1", 50000.0, prevent_overflow=False, acl=acl)

# Update cap and/or prevent_overflow (at least one required)
Budget.update("team_q1", amount=75000.0)
Budget.update("team_q1", prevent_overflow=False)

# Soft-delete (hard-gate)
Budget.remove("team_q1")
```

## Budget — ACL management (admin)

```python
from datatailr import ACL, Budget, Group, Permission

current = Budget.get_acl("team_q1")

acl = ACL(
    permissions={
        Permission.READ: [Group.get("analysts")],
        Permission.OPERATE: [Group.get("developers")],
    }
)
Budget.set_acl("team_q1", acl)       # replace
Budget.add_acl("team_q1", acl)       # merge
Budget.remove_acl("team_q1", acl)    # remove entries
```

## Assigning a budget to a job

Pass a `Budget` instance or budget name when defining jobs so the generated JSON includes `budget_id`:

```python
from datatailr import Budget
from datatailr.scheduler import App  # or Workflow, Service, ExcelAddin, …

budget = Budget("team_q1")
# e.g. App(..., budget=budget) or budget="team_q1"
```

Omitting `budget` leaves `budget_id` out of the job JSON so the backend applies `default`.

## Troubleshooting

1. **Who is spending?** — `Cost.view(begin=…, end=…)` and group by `owner` / `environment`
2. **Budget near limit?** — `Budget.ls()` or `Budget("name")`; check `usage_usd` / `usage_percentage` / `prevent_overflow`
3. **Can't assign a budget to a job?** — caller needs **operate** on that budget; verify with `Budget.get_acl(name)` (admin) or ask an admin
4. **Missing cap/usage on list?** — operate-only visibility; need **read** (or admin) for full fields
