---
name: datatailr-users-and-groups
description: Manage users and groups on the Datatailr platform. Create, list, inspect, and remove users and groups. Add or remove users from groups. Use when the user asks to manage platform users, create accounts, set up teams or groups, check who has access, or manage membership on Datatailr / dt.
---

# Users & Groups on Datatailr

Users and groups are the foundation for access control on the platform. Groups organize users into teams; ACLs on jobs, blobs, and KV entries reference users and groups to control permissions.

## Safety: confirm before mutating

| Category | Commands | Confirmation required? |
|---|---|---|
| Read-only | `User.ls()`, `User.exists()`, `User("name")`, `Group.ls()`, `Group.exists()`, `Group("name")` | No |
| Mutating | `User.add()`, `User.remove()`, `Group.add()`, `Group.remove()`, `add_users()`, `remove_users()` | **Yes -- always ask the user first** |

State exactly what you are about to do and wait for explicit approval before creating, removing, disabling, or modifying users/groups and their membership.

## Python SDK -- User

```python
from datatailr import User
```

### Look up a user

```python
user = User("alice")         # fetch by username
user.name                    # "alice"
user.user_id                 # 42
user.email                   # "alice@example.com"
user.groups                  # ["analysts", "dtusers"]
user.is_system_user          # False
```

### Current user

```python
me = User.signed_user()      # the authenticated user running this code
```

### List all users

```python
users = User.ls()            # returns list of User instances
```

### Check existence

```python
if User.exists("alice"):
    user = User("alice")
```

### Create a user

```python
new_user = User.add(
    name="bob",
    first_name="Bob",
    last_name="Smith",
    email="bob@example.com",
    password="secure_password",
    groups=["analysts"],
)
```

For non-interactive service accounts, set `is_system_user=True` (password is ignored).

### Remove a user

```python
User.remove("bob")
```

## Python SDK -- Group

```python
from datatailr import Group
```

### Look up a group

```python
group = Group("analysts")
group.name                   # "analysts"
group.group_id               # 7
group.members                # [42, 55, 68]  (user IDs)
```

### List all groups

```python
groups = Group.ls()          # returns list of Group instances
```

### Check existence

```python
if Group.exists("analysts"):
    group = Group("analysts")
```

### Create a group

```python
new_group = Group.add("data_team")
```

### Add / remove users

```python
group = Group("data_team")
group.add_users(["alice", "bob"])
group.remove_users(["bob"])
group.is_member(User("alice"))  # True
```

### Remove a group

```python
Group.remove("data_team")
```

## CLI

### User commands

```bash
dt user ls                                     # list all users
dt user ls --json                              # JSON output
dt user get alice                              # inspect a user
dt user exists alice                           # check if user exists
dt user add bob -f Bob -l Smith -e bob@co.com -P pass   # create user
dt user add bot -f Bot -l Account -s           # create system user
dt user add-to-group alice analysts            # add user to group
dt user rm-from-group alice analysts           # remove user from group
dt user disable alice                          # disable user (keeps data)
dt user enable alice                           # re-enable user
dt user rm alice                               # remove user permanently
```

### Group commands

```bash
dt group ls                                    # list all groups
dt group ls --json                             # JSON output
dt group get analysts                          # inspect a group
dt group exists analysts                       # check if group exists
dt group add data_team                         # create group
dt group add-users data_team alice,bob         # add users to group
dt group rm-users data_team bob                # remove user from group
dt group rename data_team research_team        # rename group
dt group rm data_team                          # remove group permanently
```

### Safety (CLI)

All mutating CLI commands (`dt user add`, `dt user rm`, `dt user disable`, `dt user modify`, `dt user add-to-group`, `dt user rm-from-group`, `dt group add`, `dt group rm`, `dt group add-users`, `dt group rm-users`, `dt group rename`) require user confirmation before running.

## Relationship to ACLs

Users and groups are referenced in ACLs across the platform:

```python
from datatailr import ACL, Permission, User, Group

acl = ACL({
    Permission.READ: [User("alice"), Group("analysts")],
    Permission.WRITE: [User("alice")],
})
```

See [datatailr-acl.md](../datatailr-acl.md) for full ACL documentation.
