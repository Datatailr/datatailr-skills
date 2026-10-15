---
name: datatailr-nodes
description: Manage compute nodes on the Datatailr platform with the `Node` class of the Python SDK or the `dt node` CLI. List and inspect nodes, see the containers that run on a node, drain a node, read and set node tags, look up cloud instance types, and start, stop, restart, resize, create or terminate nodes. Use when the user asks about nodes, instances, machines, VMs, cluster capacity, draining, GPU nodes, or instance types on Datatailr / dt. For autoscaler and platform settings, use datatailr-admin instead.
---

# Compute Nodes on Datatailr

A node is a machine (a cloud instance, or the local host) that runs jobs. The Python SDK class `Node` and the `dt node` CLI give the same operations. Prefer `Node` when you run from Python.

Related skills:

- [datatailr-admin](../datatailr-admin/SKILL.md) for the autoscaler and the other platform settings
- [datatailr-job-observability](../datatailr-job-observability/SKILL.md) for job status and logs
- [datatailr-sorting-and-filtering-dsl.md](../datatailr-sorting-and-filtering-dsl.md) for the filter grammar

## Safety tiers

Read the tier before you run a command.

| Tier | Rule | SDK | CLI |
|---|---|---|---|
| **Read-only** | Run freely | `Node.ls()`, `Node("name")`, `Node.get()`, `Node.exists()`, `node.ps()`, `node.drain_status()`, `node.ls_tags()`, `node.get_tag()`, `Node.instance_types*()` | `node ls`, `node ps`, `node drain-status`, `node ls-tags`, `node get-tag`, `node instance-types*` |
| **Confirm** | State the exact command and its impact. Wait for explicit approval | `Node.new()`, `Node.start()`, `Node.stop()`, `Node.restart()`, `Node.change_type()`, `node.drain()`, `node.set_tag()`, `node.rm_tag()` | `node new`, `node start`, `node stop`, `node restart`, `node change-type`, `node drain`, `node set-tag`, `node rm-tag` |
| **Hard-gate** | Refuse by default. Proceed only if the user names the exact node ids **and** asks you to terminate them | `Node.terminate()` | `node terminate` |

`terminate` permanently destroys a cloud VM and every job that runs on it. `stop`, `restart` and `change-type` interrupt the jobs on the node. `new` starts cloud instances and causes cloud charges.

## Permissions

- Lifecycle operations (`new`, `start`, `stop`, `restart`, `terminate`, `change-type`) need `root`, the user `admin`, or membership of the `admin` or `node_admin` group.
- `drain`, `set-tag` and `rm-tag` go to the node daemon and need membership of the `admin` group.
- Every user can run the read-only operations.

## Python SDK

```python
from datatailr import Node
```

### List nodes

```python
nodes = Node.ls()                                   # list[Node]
nodes = Node.ls(filter="environment = dev and status = running")
nodes = Node.ls(filter="node_class = gpu", sort="-created_at", limit=10, offset=0)
```

### Load one node

```python
node = Node("compute-node-1")        # by name
node = Node("i-08666efd2a24f10f8")   # by instance id
node = Node.get("compute-node-1")    # same as Node("compute-node-1")
Node.exists("compute-node-1")        # True or False
```

`Node(...)` raises `ValueError` when no node has that name or id.

### Read node fields

```python
node.id                 # "i-08666efd2a24f10f8"
node.name               # "compute-node-1"
node.environment        # "dev", "pre", "prod" or "all"
node.node_class         # "compute" or "gpu"
node.type               # cloud instance type, for example "r6a.large"
node.status             # controller status, for example "running"
node.state              # cloud provider state, for example "running"
node.private_ip         # "10.0.0.5"
node.host, node.port    # node daemon address; None when the node is not registered
node.architecture       # "x86_64" or "arm64"
node.availability_zone  # "eu-west-1a"
node.created_at         # Unix timestamp in seconds
node.cpu                # {"allocated_cpus": 2.0, "free_cpus": 6.0, "total_cpus": 8}
node.memory             # bytes: allocated_memory, free_memory, max_memory, used_memory, ...
node.jobs               # [{"name": ..., "environment": ..., "state": ..., "run_id": ..., "num_cpus": ..., "memory_limit": ...}]
node.tags               # cloud provider tags, for example {"Name": "compute-node-1"}
node.to_dict()          # the raw `dt node ls` row
```

`Node.ls()` rows do not trigger an extra API call. `node.cpu`, `node.memory` and `node.jobs` are empty when the controller has not registered the node (for example a stopped node).

### Containers on a node

```python
containers = node.ps()
# [{"id": ..., "name": ..., "image": ..., "entrypoint": ..., "network_mode": ..., "creation_time": ...}]
```

### Drain a node

A draining node accepts no new jobs. Jobs that already run continue until they finish.

```python
node.drain()                 # start draining (confirm first)
node.drain_status()          # True
node.drain(stop=True)        # accept new jobs again (confirm first)
```

### Node tags

Node tags are key-value pairs stored on the node daemon (for example `node_name`, `node_ip`). They are not the cloud provider tags in `node.tags`.

```python
node.ls_tags()                        # {"node_name": "compute-node-1", ...}
node.get_tag("node_name")             # "compute-node-1"; JSON values are parsed
node.set_tag("my_tag", "my_value")    # confirm first
node.rm_tag("my_tag")                 # confirm first
```

### Instance types

Use these to find valid `type` values before you create or resize nodes.

```python
Node.instance_types()             # list of {"name", "node_class", "family", "cpu", "memory", "architecture", "has_gpu", "storage_gib", "price"}
Node.instance_types_by_class()    # {"compute": [...], "gpu": [...]}
Node.instance_types_by_family()   # {"r6a": [...], ...}
```

### Create nodes (confirm)

State the instance type, the node class, the environment and the count. Wait for approval.

```python
# One node from keyword arguments. Defaults: node_class="compute", environment="dev", num_instances=1
Node.new(instance_type="Standard_D2ps_v5")              # from Node.instance_types()
Node.new(instance_type="g5.xlarge", node_class="gpu", environment="prod", num_instances=2)

# Or a ready configuration: one dict, or a list of dicts, sent as is
Node.new({
    "type": "Standard_D2ps_v5",
    "node_class": "compute",      # "compute" or "gpu"
    "environment": "dev",         # "dev", "pre" or "prod"
    "num_instances": 1,
    "disk_size": 10,              # optional root disk size in GB (default 10); ignored on Hetzner
})
```

Do not pass a configuration and `instance_type` together. The autoscaler does not start GPU nodes. A job that sets `vram` can run only after a user starts a GPU node with `node_class="gpu"`.

### Lifecycle (confirm; terminate is hard-gated)

Each method accepts one or more instance ids or `Node` instances.

```python
Node.start("i-08666efd2a24f10f8")
Node.stop(node)
Node.restart("i-08666efd2a24f10f8", "i-06e130508f9c5c45")
Node.change_type("Standard_D4ps_v5", node)   # restarts the node with the new type
Node.terminate("i-08666efd2a24f10f8")        # hard-gate
```

## CLI

Add `--json` when you parse the output.

```bash
dt node ls
dt node ls --json
dt node ls -f "environment = [dev, pre] and status = running" -s "-created_at"
dt node ls name=compute                     # name prefix, or id=i-08
dt node ps -N compute-node-1 --json         # containers on a node; omit -N for the local node
dt node drain -N compute-node-1             # confirm first
dt node drain-status -N compute-node-1
dt node drain -s -N compute-node-1          # stop draining; confirm first
dt node ls-tags -N compute-node-1 --json
dt node get-tag -N compute-node-1 node_name
dt node set-tag -N compute-node-1 my_tag my_value    # confirm first
dt node rm-tag -N compute-node-1 my_tag              # confirm first
dt node instance-types --json
dt node instance-types-by-class
dt node instance-types-by-family
dt node new file://nodes.json               # confirm first
dt node start i-08666efd2a24f10f8           # confirm first
dt node stop i-08666efd2a24f10f8            # confirm first
dt node restart i-08666efd2a24f10f8         # confirm first
dt node change-type Standard_D4ps_v5 i-08666efd2a24f10f8   # confirm first
dt node terminate i-08666efd2a24f10f8       # hard-gate
```

`-N` accepts the node name or its host address. Lifecycle commands accept more than one node id.

## `node ls` filter fields

Wrap the whole expression in quotes.

| Field | Type | Example values |
|---|---|---|
| `name` | text | `compute-node-1` |
| `id` | text | instance id |
| `environment` | text | `dev`, `pre`, `prod`, `all` |
| `status` | text | `running`, `stopped`, `draining` |
| `state` | text | cloud provider state |
| `node_class` | text | `compute`, `gpu` |
| `type` | text | VM instance type |
| `architecture` | text | `x86_64`, `arm64` |
| `availability_zone`, `private_ip`, `host`, `image_id`, `subnet_id` | text | |
| `created_at` | numeric | Unix timestamp in seconds |
| `cpu_total`, `cpu_free`, `cpu_allocated` | numeric | CPUs |
| `memory_max`, `memory_free`, `memory_allocated`, `memory_used`, `memory_unallocated`, `memory_wasted` | numeric | bytes |

## Routing

- `ls`, `new`, `start`, `stop`, `restart`, `terminate`, `change-type`, `instance-types*` go to the controller (port 6666).
- `ps`, `drain`, `drain-status` and the tag commands go to the node daemon (port 4444) of the local node, or of the node given with `-N` / `Node(...)`.

## Troubleshooting

1. **A job stays pending.** Run `Node.ls(filter="environment = <env>")`. Compare `node.cpu["free_cpus"]` and `node.memory["free_memory"]` with the job resources. Then read the autoscaler settings with [datatailr-admin](../datatailr-admin/SKILL.md).
2. **A node accepts no jobs.** Run `node.drain_status()`. If it returns `True`, ask the user before you run `node.drain(stop=True)`.
3. **A GPU job does not start.** Run `Node.ls(filter="node_class = gpu")`. If the list is empty, a user must create a GPU node with `Node.new(instance_type=..., node_class="gpu")`.
4. **Which containers run on a node?** Run `node.ps()`.
