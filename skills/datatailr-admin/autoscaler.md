# Autoscaler Settings

The autoscaler setting controls how Datatailr provisions and terminates compute nodes per environment. It is managed via `dt settings`.

## Read autoscaler config

```bash
dt settings get autoscaler
```

## Schema

The value is a JSON object with one key per compute environment:

```json
{
  "dev": {
    "enabled": true,
    "max_cpus": 32,
    "max_ram": 32,
    "minimum_idle_time": "1m",
    "minimum_uptime": "2m",
    "zombie_timeout": "5m",
    "scale_up_cooldown": "2m",
    "preferable_families": ["c6g", "r6g"],
    "fallback_to_other_families": false
  },
  "pre": { "...same fields..." },
  "prod": { "...same fields..." }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether autoscaling is active for this environment |
| `max_cpus` | integer ≥ 0 | `32` | Maximum total CPUs across all nodes in this environment; `0` disables scale-up |
| `max_ram` | integer ≥ 0 (optional) | unset (no limit) | Maximum total RAM in GB across all nodes in this environment. Omit the key to leave RAM uncapped (still subject to the license limit) |
| `minimum_idle_time` | duration | `1m` | How long a node must be idle before auto-terminate |
| `minimum_uptime` | duration | `2m` | Minimum time a node must run before it can be terminated |
| `zombie_timeout` | duration | `5m` | How long after a node stops reporting the controller waits before force-terminating the still-running cloud instance. Applies to every node with a `nodes` row, including ones created with `dt node new`. `0s` disables cleanup for that environment |
| `scale_up_cooldown` | duration (≥ `1m`) | `2m` | Minimum time between scale-up attempts for this environment. Provisioning a VM usually takes 2–3 minutes; setting this too low can overprovision nodes |
| `preferable_families` | string[] | cloud-specific | VM families the autoscaler prefers |
| `fallback_to_other_families` | boolean | `false` | Allow non-preferred families when preferred ones are unavailable |

### Duration format

Use `Ns` / `Nm` / `Nh` / `Nd` (e.g. `10s`, `5m`, `15m`).

### Cloud-specific `preferable_families` defaults

Defaults follow the architecture of the controller host (`arch`).

| Provider | amd64 | arm64 |
|---|---|---|
| AWS | `m5`, `m6` | `c6g`, `r6g` |
| Azure | `standardDav6Family`, `StandardDasv7Family` | `standardDPSv5Family`, `StandardDpsv6Family` |
| GCP | `n4`, `n4d`, `c4` | `n4a`, `c4a` |
| Hetzner | `cx`, `ccx` | `cax` |

## Safe-change workflow

**Always follow this sequence** when the user explicitly requests an autoscaler change:

1. Read current: `dt settings get autoscaler --json`
2. Parse the current JSON
3. Merge only the fields the user requested — keep all other fields and all three environments intact
4. Show a field-by-field diff (current → proposed)
5. Apply: `dt settings put autoscaler '<full merged json>'`
6. Verify: `dt settings get autoscaler --json`

**Never put a partial JSON object.** A partial put can wipe sibling fields or entire environments.

## Hard-gate thresholds

Refuse to apply (or even suggest) these changes unless the user states the exact values and explicitly asks to apply them:

| Change | Risk |
|---|---|
| Decrease `max_cpus` or set to `0` | Caps cluster capacity; jobs stay pending |
| Set `enabled: false` | Disables autoscaling; no new nodes provisioned |
| Set `minimum_idle_time`, `minimum_uptime`, or `zombie_timeout` above **15m** | Nodes stay up too long when idle, wasting cost |
| Enable `fallback_to_other_families: true` | Allows expensive or unexpected VM families |

## Safe changes (confirm tier)

These changes are lower risk but still require user confirmation before applying:

- Increasing `max_cpus` (within cloud quota/budget)
- Adjusting `preferable_families` list
- Small increases to `minimum_idle_time` / `minimum_uptime` (below 15m)
- Decreasing idle/uptime (faster scale-down; may cause churn)

## Anti-patterns

Do **not** do these without the user explicitly requesting the exact values:

```bash
# BAD: caps capacity to zero — all pending jobs will stall
dt settings put autoscaler '{"dev":{"max_cpus":0,...}}'

# BAD: disables autoscaling entirely
dt settings put autoscaler '{"dev":{"enabled":false,...}}'

# BAD: extreme idle time — nodes never scale down
dt settings put autoscaler '{"dev":{"minimum_idle_time":"120m",...}}'

# BAD: partial object — may wipe pre/prod or other fields
dt settings put autoscaler '{"dev":{"max_cpus":64}}'
```

## Example: increase max_cpus for dev

```bash
# 1. Read current
dt settings get autoscaler --json

# 2. Merge (example — use actual current values)
dt settings put autoscaler '{
  "dev": {
    "enabled": true,
    "max_cpus": 64,
    "minimum_idle_time": "1m",
    "minimum_uptime": "2m",
    "zombie_timeout": "5m",
    "scale_up_cooldown": "2m",
    "preferable_families": ["c6g", "r6g"],
    "fallback_to_other_families": false
  },
  "pre": { "...copy from current..." },
  "prod": { "...copy from current..." }
}'

# 3. Verify
dt settings get autoscaler --json
```

## How autoscaler interacts with nodes

- The autoscaler does not start GPU nodes. A user must start a GPU node manually with `dt node new` and `"node_class": "gpu"` before a job that sets `vram` can run
- The autoscaler reads `settings/autoscaler` on each scale decision
- When total CPUs in an environment reach `max_cpus`, no new nodes are provisioned
- Nodes with `--auto-terminate` use `minimum_idle_time` and `minimum_uptime` from this setting. Self-terminate retries start after a random delay and then double that delay so concurrent idle waves do not stampede the cloud API
- If a node stops reporting, the scheduler marks it dead. After `zombie_timeout`, the controller leader force-terminates the cloud instance if it is still `running` or `draining`. This applies to manually created nodes as well as autoscaler-managed ones
- Manual `dt node new` bypasses some scheduler logic but still respects quota
- Use `dt node ls --json` alongside autoscaler settings to diagnose capacity issues
