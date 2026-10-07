---
name: datatailr-blob-storage
description: Use Datatailr blob storage to persist and retrieve files and data. Blob storage is a key-value store for arbitrary binary data accessible from any job. Use when the user asks to store data, save files, share data between jobs, read/write blobs, or use persistent storage on Datatailr / dt.
---

# Blob Storage on Datatailr

Datatailr blob storage is a persistent key-value store for arbitrary files and binary data. Every blob is identified by a path (e.g., `my_bucket/my_file.csv`). Blobs are accessible from any job running on the platform.

## Python SDK

The SDK is already installed in the workspace -- do not look for it.

```python
from datatailr import Blob

blob = Blob()
```

### Store and retrieve bytes

```python
blob.put("my_bucket/greeting.txt", b"Hello, world!")
data = blob.get("my_bucket/greeting.txt")  # returns bytes
```

`put` accepts `bytes` or `str` (strings are UTF-8 encoded automatically).

### Store and retrieve files

```python
blob.put_file("my_bucket/model.pkl", "/local/path/model.pkl")
blob.get_file("my_bucket/model.pkl", "/local/path/model_copy.pkl")
```

### List blobs

```python
files = blob.ls("my_bucket/")  # returns list of blob paths
```

### Check existence

```python
if blob.exists("my_bucket/model.pkl"):
    data = blob.get("my_bucket/model.pkl")
```

### Delete

```python
blob.delete("my_bucket/model.pkl")
```

### ACLs on blobs

By default, blobs inherit standard permissions. To set explicit ACLs:

```python
from datatailr import Blob, ACL, Permission, User, Group

blob = Blob()
blob.put("my_bucket/shared.csv", data, acl=ACL({
    Permission.READ: [User("alice"), Group("analysts")],
    Permission.WRITE: [User("alice")],
}))
```

To inspect or update ACLs on existing blobs:

```python
current_acl = blob.acls("my_bucket/shared.csv")
blob.set_acls("my_bucket/shared.csv", new_acl)
```

Only set ACLs if the user explicitly requests access restrictions. See [datatailr-acl.md](../datatailr-acl.md) for details on the `ACL` class.

## CLI

The `dt blob` CLI provides the same operations. Use it for scripting or quick checks.

```bash
dt blob ls my_bucket/                              # list blobs
dt blob ls my_bucket/ -r                           # recursive listing
dt blob cp local_file.csv blob://my_bucket/file.csv   # upload
dt blob cp blob://my_bucket/file.csv local_file.csv   # download
dt blob get blob://my_bucket/file.txt              # print to stdout
echo "hello" | dt blob put my_bucket/hello.txt     # pipe to blob
dt blob exists my_bucket/file.csv                  # check existence
dt blob rm my_bucket/file.csv                      # delete
```

### Safety

`dt blob rm` is destructive. Always confirm with the user before deleting blobs.

## Common patterns

### Sharing data between jobs

Any job (app, service, workflow task) can read and write blobs. This is the standard way to pass large data between jobs that don't share a DAG:

```python
# In job A (e.g., a workflow task)
from datatailr import Blob
blob = Blob()
blob.put_file("pipeline/output.parquet", "output.parquet")

# In job B (e.g., an app)
from datatailr import Blob
blob = Blob()
blob.get_file("pipeline/output.parquet", "/tmp/output.parquet")
```

For tasks within the same workflow, prefer returning values directly -- the platform handles inter-task data passing automatically (see the datatailr-deploy-workflow skill). Use blob storage only for data that needs to persist beyond a single workflow run or be shared across different jobs.

### Saving model artifacts

```python
import pickle
from datatailr import Blob

model = train_model()
blob = Blob()
blob.put("models/latest.pkl", pickle.dumps(model))
```

### Configuration files

```python
import json
from datatailr import Blob

blob = Blob()
config = json.loads(blob.get("config/app_settings.json"))
```
