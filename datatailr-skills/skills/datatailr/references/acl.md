# Access Control Lists (ACLs)

Every Datatailr job type (`App`, `Service`, `ExcelAddin`, `@workflow`) accepts an optional `acl` parameter to control who can read, write, operate, access, or promote the job.

## Default behaviour

If you omit `acl`, the SDK creates a default strict ACL: the current user gets full permissions, and no other users or groups get any permissions.

## The `ACL` class

```python
from datatailr import ACL, Permission, User, Group

acl = ACL({
    Permission.READ:    [User("alice"), Group("analysts")],
    Permission.WRITE:   [User("alice")],
    Permission.OPERATE: [User("alice"), User("bob")],
    Permission.ACCESS:  [User("alice"), Group("analysts")],
    Permission.PROMOTE: [User("alice")],
})
```

Pass this to any job:

```python
import my_app.app as entrypoint
from datatailr import App, ACL, Permission, User, Group, Resources

app = App(
    name="My App",
    entrypoint=entrypoint,
    framework="streamlit",
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["streamlit"],
    acl=ACL({
        Permission.READ:   [User("alice"), Group("data_team")],
        Permission.WRITE:  [User("alice")],
        Permission.ACCESS: [User("alice"), Group("data_team")],
    }),
)
app.run()
```

## Permission types

| Permission | What it controls |
|---|---|
| `Permission.READ` | View the job definition and metadata |
| `Permission.WRITE` | Modify or redeploy the job |
| `Permission.OPERATE` | Start, stop, or restart the job |
| `Permission.ACCESS` | Open/use the running job (e.g., access an app URL) |
| `Permission.PROMOTE` | Promote the job to the next environment (dev → pre → prod) |

## `User` and `Group`

- `User("username")` -- looks up a platform user by username.
- `Group("group_name")` -- looks up a platform group by name.

Both are imported from `datatailr`.

## `run_as`

All job types also accept an optional `run_as` parameter to specify which user the job runs as. Defaults to the currently signed-in user.

```python
import my_app.app as entrypoint

app = App(
    name="My App",
    entrypoint=entrypoint,
    framework="streamlit",
    run_as="alice",          # or User("alice")
    ...
)
```
