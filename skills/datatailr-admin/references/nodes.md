# Compute Nodes (`dt node`)

All node commands use the `dt` CLI. Add `--json` for programmatic parsing.


## List nodes

```bash
dt node ls
dt node ls --json
dt node ls --json --pretty
dt node ls -f "environment = [all, dev]"
dt node ls -f "environment = [dev, pre] and status = active"
dt node ls -f "name starts_with compute-"
dt node ls -s "+environment -name"
```

### `node ls` filter fields

Filters use the same DSL as other `dt` commands. Wrap the whole expression in quotes.

| Field | Type | Example values |
|---|---|---|
| `name` | text | `compute-node-1` |
| `id` | text | instance id |
| `environment` | text | `dev`, `pre`, `prod` |
| `status` | text | `active`, `stopped`, etc. |
| `node_class` | text | `compute` |
| `type` | text | VM instance type |
| `cpus` | numeric | `4` |
| `memory` | numeric | bytes |
| `jobs` | numeric | running job count |

See [datatailr-sorting-and-filtering-dsl.md](datatailr-sorting-and-filtering-dsl.md) for the full filter grammar.

## Inspect running jobs on a node

```bash
dt node ps                          # local node
dt node ps -N compute-node-1        # remote node
dt node ps -N compute-node-1 --json
```

## Drain a node

Drain prevents new jobs from being scheduled on a node. Running jobs continue until finished.

```bash
dt node drain -N compute-node-1              # start draining
dt node drain-status -N compute-node-1       # check drain state
dt node drain -s -N compute-node-1           # stop draining
```

## Provision new nodes

Requires admin or `node_admin` permissions. Provisions cloud resources and triggers billing.

```bash
dt node new file://tests/tests_examples/test_node.json
```

Example config (`test_node.json`):

```json
[
  {
    "type": "Standard_D2ps_v5",
    "node_class": "compute",
    "environment": "dev",
    "num_instances": 1
  }
]
```

Fields:

| Field | Description |
|---|---|
| `type` | Cloud instance type (use `dt node instance-types` to list options) |
| `node_class` | Node class, typically `compute` |
| `environment` | `dev`, `pre`, or `prod` |
| `num_instances` | Number of instances to provision |

**Confirm before running.** State the instance type, environment, and count, and wait for user approval.

## Lifecycle operations

All lifecycle commands require admin or `node_admin` permissions.

```bash
dt node start i-08666efd2a24f10f8
dt node stop i-08666efd2a24f10f8
dt node restart i-08666efd2a24f10f8
dt node change-type Standard_D4ps_v5 i-08666efd2a24f10f8
```

Multiple node ids/names can be passed as arguments.

**Confirm before running** `start`, `stop`, `restart`, or `change-type`. State which node(s) and the expected impact (downtime, job disruption).

### Terminate (hard-gate)

```bash
dt node terminate i-08666efd2a24f10f8
```

**Hard-gate: refuse unless** the user states the exact node id(s) and explicitly asks to terminate. This permanently destroys a cloud VM and all running workloads on it.

## Instance types

```bash
dt node instance-types
dt node instance-types-by-class
dt node instance-types-by-family
dt node instance-types --json
```

Use these to look up valid `type` values before provisioning or resizing.

## Node tags

Tags are key-value metadata on cloud instances. Commands target the node daemon (local or `-N`).

```bash
dt node ls-tags -N compute-node-1
dt node get-tag -N compute-node-1 my_tag
dt node set-tag -N compute-node-1 my_tag my_value    # confirm before running
dt node rm-tag -N compute-node-1 my_tag              # confirm before running
```

## Routing note

- `ls`, `new`, `start`, `stop`, `restart`, `terminate`, `change-type`, `instance-types*` → controller (port 6666)
- `ps`, `drain`, `drain-status`, tags → node daemon (port 4444, or `-N <host>`)
