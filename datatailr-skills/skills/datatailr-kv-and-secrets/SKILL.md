---
name: datatailr-kv-and-secrets
description: Use Datatailr's user key-value store and secrets manager. KV stores user-owned configuration data. Secrets stores encrypted sensitive values like passwords, API keys, and tokens. Use when the user asks to store or retrieve user config, secrets, API keys, passwords, or values on Datatailr / dt. For platform admin settings (autoscaler, login, ACLs), use datatailr-admin instead.
---

# Key-Value Store & Secrets on Datatailr

Datatailr provides two related stores for **user-owned data**:

- **KV** -- plain-text key-value pairs for user configuration, feature flags, connection strings, etc.
- **Secrets** -- encrypted key-value pairs for passwords, API keys, tokens, and other sensitive data.

**Not covered here:** platform-wide admin settings (autoscaler, login, ACLs, system config) stored under the `settings/` prefix. Those are managed via `dt settings` and covered in [datatailr-admin](../datatailr-admin/SKILL.md).

## Creating KV entries and secrets

KV entries can be created and managed both through the **Datatailr UI** (Secrets Manager), the **Python SDK**, and the **CLI**.
Secrets can only be created and managed through the **Datatailr UI** (Secrets Manager) - when your code needs a secret that doesn't exist yet, **ask the user to create it in the UI**.

For example: "This workflow needs an access token called `datastream_api_key`. Please create it in the Datatailr Secrets Manager UI before deploying."

## Python SDK -- KV

The SDK is already installed in the workspace -- do not look for it. Jobs read KV values at runtime but should not create or modify them programmatically.

```python
from datatailr import KV

kv = KV()
url = kv.get("db_url")
keys = kv.ls()  # list all keys with their values and ACLs
```

**Important behavior:**

- `KV` is a class -- always instantiate it: `kv = KV()` then `kv.get(...)`. Calling `KV.get(...)` without parentheses will fail.
- `kv.get()` **raises an exception** if the key does not exist. Always wrap in a try/except when the key might be missing:

```python
try:
    value = kv.get("my_key")
except Exception:
    value = "default_value"
```

- `kv.get()` **may return a string or an already-parsed object** (e.g., dict) depending on the platform version and how the value was stored. When reading JSON, always handle both cases:

```python
import json

val = kv.get("config")
if isinstance(val, str):
    val = json.loads(val)
# val is now a dict regardless of what kv.get() returned
```

## Python SDK -- Secrets (read-only)

Jobs retrieve secrets at runtime but never create or modify them in code. If a secret is missing, ask the user to create it in the Datatailr UI.

```python
from datatailr import Secrets

secrets = Secrets()
db_password = secrets.get("database_password")  # returns str
all_secrets = secrets.ls()                       # list available secret keys
```

**Important behavior:**

- `Secrets` is a class -- always instantiate it: `secrets = Secrets()` then `secrets.get(...)`. Calling `Secrets.get(...)` without parentheses will fail.
- `secrets.get()` **raises an exception** if the key does not exist.
- `secrets.get()` always returns a **string**.

## CLI (read-only)

Use CLI commands to check existing KV entries and secrets. Creating, updating, and deleting entries should be done through the Datatailr UI.

### KV commands

```bash
dt kv get my_key                               # retrieve a value
dt kv ls                                       # list all keys
dt kv ls --json                                # JSON output
dt kv ls -v                                    # include values in listing
```

### Secrets commands

```bash
dt kv get -s api_key                           # retrieve a secret
dt kv ls -S                                    # list secret keys
```

### Safety

**Never log, print, or echo secret values.** When the agent retrieves a secret for debugging, it should describe the result (e.g., "the secret exists and is 40 characters long") rather than displaying the value.

## When to use what

| Need | Use |
|---|---|
| Database URLs, API endpoints, feature flags | **KV** |
| Passwords, API keys, tokens, certificates | **Secrets** |
| Large files, binary data, model artifacts | **Blob storage** (see the blob-storage skill) |

## Common patterns

### Reading config in a job

```python
from datatailr import KV, Secrets

kv = KV()
secrets = Secrets()

db_host = kv.get("db_host")
db_password = secrets.get("db_password")
connection_string = f"postgresql://app:{db_password}@{db_host}:5432/mydb"
```
