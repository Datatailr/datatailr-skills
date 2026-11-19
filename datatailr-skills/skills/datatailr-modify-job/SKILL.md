---
name: datatailr-modify-job
description: Change, fix or extend an app, a service or an Excel add-in that is already deployed on Datatailr, such as "add a chart to my gas storage dashboard". Fetches the deployed code from the job's bundle, keeps the job's ACL and every setting, and redeploys it as a new version. Use instead of rewriting a deployed job from scratch. Not for workflows. For undoing a deploy, use datatailr-job-rollback.
---

# Change a Deployed Job on Datatailr

If the user asks to change something that is already deployed, start from its deployed code. Never rewrite it from scratch. Each deploy stores the job's package directory as a bundle. Redeploying the edited bundle gives the job a new version with its code lineage.

This skill covers apps, services and Excel add-ins. A workflow is different. Its top-level `image` is the DAG runner and has no bundle. The task code is in `child_image`, and the task definitions are in `children_full`, which `dt job get <job> --json --show-children` returns. The deploy script that composes the tasks into the DAG is not stored. To change a workflow, edit its source project and deploy it again as [datatailr-deploy-workflow](../datatailr-deploy-workflow/SKILL.md) says. If the source project is gone, tell the user that this skill cannot rebuild the workflow.

## Steps

1. Read the job definition. The command reads the `dev` environment unless you add `-e <env>`. Add `-v <N>` for an older version:
   ```bash
   dt job get <job> --json
   ```
   Use `dt job ls` to find the job name if the user describes it.

   Carry over every setting of the job, not only the fields that the code needs. A setting that the new deploy script omits falls back to the SDK default, such as Python 3.12, the `default` budget and no environment variables. A code-only edit can then break the job or change its resources and its budget. The fields, and how the deploy script takes them:
   - `display_name`, `entrypoint`, `schedule` and `run_as`: as they are. For an app, also `app_section`.
   - `env`: a list of one-key dicts. The key `DATATAILR_JOB_ENV_DATATAILR_FRAMEWORK` gives the framework of an app. Remove the prefix `DATATAILR_JOB_ENV_` from every other key and pass the result as `env_vars`. For an Excel add-in, the SDK sets `DATATAILR_LOCAL` itself.
   - `memory` and `vram` (GPU memory): bytes. The SDK takes size strings, so divide by 1024² and write `m`. For example, 2147483648 becomes `"2048m"`. `vram` is absent when the job sets none. Then omit it.
   - `num_cpus`: as `cpu`.
   - `image.python_version`, `image.python_requirements`, `image.build_script_pre`, `image.build_script_post` and `image.build_secret_keys`: as they are. `build_secret_keys` is absent when the job uses none.
   - `budget_id`: find the budget with that `.id` in `Budget.ls()` from `datatailr` and pass `budget=Budget("<name>")`. Without it the job moves to the `default` budget.
   - `acl`: see below.
   - `image.bundle_name` and `image.path_to_module`: used in step 2.

   **Always carry over the existing `acl`** unless the user asks to change it. A deploy script without `acl=` resets the job to owner-only permissions. Read it from `dt job get <job> --json` without `-v`, because permissions belong to the job and not to a version. Positive IDs are user UIDs (`dt user ls`). Negative IDs are groups, written as `-<GID>` (`dt group ls`). Translate each key (`read`, `write`, `operate`, `access`, `promote`) into `ACL({Permission.READ: [User(...), Group(...)], ...})` from `datatailr` and pass `acl=` to the job.
2. Download the bundle and extract it into a new, empty folder, so that it cannot overwrite local code that was never deployed, including the edits of an earlier run of this skill. Pick a name that does not exist yet, such as `deployed-<job>-v<version>`. `mkdir` without `-p` fails if the folder exists. Then pick another name. Never reuse a folder from an earlier run. The bucket is the installation's blob prefix plus `entrypoint-bundles`:
   ```bash
   DEST=deployed-<job>-v<version>
   mkdir "$DEST"
   PREFIX=$(dt tag get blob_storage_prefix)
   dt blob cp "blob://${PREFIX}entrypoint-bundles/<bundle_name>" "$DEST/bundle.tgz"
   tar xzf "$DEST/bundle.tgz" -C "$DEST"
   ```
   This recreates the package directory inside the folder (for example `deployed-my-app-v3/my_app/`). Work in that folder from here on.
3. The deploy script is not in the bundle. Regenerate it in the folder from step 2, outside the package, from the fields in step 1, as the matching `datatailr-deploy-*` skill says, and include the `acl` from step 1. Use the same name, so the deploy updates the existing job and does not create a new one. The skills are [datatailr-deploy-app](../datatailr-deploy-app/SKILL.md), [datatailr-deploy-service](../datatailr-deploy-service/SKILL.md) and [datatailr-deploy-excel-addin](../datatailr-deploy-excel-addin/SKILL.md).
4. Make the requested change inside the package. The deploy script imports the package, so first install the `image.python_requirements` from step 1 into the local environment. Without them the deploy fails with `ModuleNotFoundError`. Then deploy as the matching `datatailr-deploy-*` skill says.

## Rolling back to a previous version

To undo a change or go back to an earlier version, roll back and do not edit, as [datatailr-job-rollback](../datatailr-job-rollback/SKILL.md) says.
