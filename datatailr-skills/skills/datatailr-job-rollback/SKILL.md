---
name: datatailr-job-rollback
description: Roll back a Datatailr job (app, service, workflow, Excel add-in) to its previous version. Use when the user asks to roll back, revert, undo a deploy, go back to an earlier version, or restore the previous version of a job on Datatailr / dt.
---

# Roll Back a Job on Datatailr

Every deploy creates a new version of the job. The current version is the highest version that has not been removed. Rolling back means removing the current version, so the previous one becomes current, and starting it.

## Safety: confirm first

Rollback stops the running job and removes a version. State the job name, environment, and the version you will remove and the one that will become current, then wait for explicit approval.

## Steps

```bash
dt job versions my_job -e dev          # e.g. (1, 2, 3): 3 is current, 2 is previous
dt registry exists my_job dev 2        # must print true: version 2 still has its image
dt job rm my_job -v 3 -e dev           # remove the current version; this stops the job
dt job start my_job -e dev             # start the previous version
dt job get my_job -e dev               # confirm: version 2 is current
```

After starting, apps, services and Excel add-ins should reach `running`. A scheduled workflow shows `scheduled`, and a one-off workflow may already be `completed`. Treat any of these as success; `failed` or the error below is not.

- Check the image first. `dt registry exists` needs only read permission, prints `true` or `false`, and exits 0 either way, so read the output. If it prints `false`, do not remove anything: the previous version cannot start. Go to [When the previous image is gone](#when-the-previous-image-is-gone). `dt registry get my_job` lists every version that still has an image.
- `dt job rm` stops the job and does not start the previous version. Always run `dt job start` afterwards.
- Removing the current version of a scheduled workflow cancels its schedule. `dt job start` schedules it again from the previous version's schedule.
- `dt job rm` needs write permission on the job, and operate permission to stop it.
- `dt job restore` undeletes a removed version. It is the undo for `dt job rm`, not a rollback.

## When the previous image is gone

Rollback only works if the previous version's image is still in the registry. Image retention can delete images of older versions. `dt registry exists` then prints `false`. If you removed the current version without checking, `dt job start` fails with:

```
No image for job my_job version 2 in environment dev ... image removed by the image retention policy
```

The previous version is now current but cannot start, so the job is down. First bring the version you removed back; its image is still there, because retention never deletes images of removed versions:

```bash
dt job restore my_job -v 3 -e dev      # undo the removal; version 3 is current again
dt job start my_job -e dev
```

To roll back without the image, redeploy the previous code:

- **dev**: deploy the previous code again. This creates a new version and builds its image.
- **pre / prod**: nothing is built in these environments. Deploy the previous code in `dev` and promote it.

## Image retention is an admin setting

Retention policies are set per environment in `dt settings get image-retention`. Only Datatailr admins (members of the `admin` group) can read or change them; for other users the command returns "Permission denied". Use `dt registry exists` to check a specific version instead.

- `by_count` N keeps the N most recently built images per job. With N = 1 the previous image is deleted, so rollback by `dt job rm` never works.
- `by_time` keeps images younger than the given age, plus the newest one.
- When retention is disabled for an environment, all images are kept.

If the user is not an admin and needs reliable rollbacks, tell them to ask a Datatailr admin to keep at least 2 images in that environment (`by_count` of 2 or more, or a long enough `by_time`). Do not try to change retention settings yourself unless the user is an admin and asks for it; see [datatailr-admin](../datatailr-admin/SKILL.md).

## From the GUI

Open the job, choose **Delete**, select the current version on the single-version tab, and confirm. Then start the job.
