# Datatailr skills

Agent skills for building, deploying, and managing workloads in an existing Datatailr environment.

This repository contains 14 skills, their reference documents and helper scripts, a portable plugin manifest for OpenAI and Cursor, and a Claude plugin manifest. The current version is **0.1.0-dev.1**, an unreleased development snapshot. Supported platform/SDK combinations have not yet been verified; see [compatibility.json](compatibility.json) and [version management](VERSIONING.md).

## Prerequisites

- An existing Datatailr environment and a user with permissions for the requested operation.
- A Datatailr Python SDK and `dt` CLI appropriate for that environment. The SDK source used for this snapshot declares version `0.1.133`; this is provenance, not a minimum supported version.
- An agent execution environment that can run the required Python/CLI commands and reach the Datatailr environment.
- Managed connectors must be available and configured when using the connectors skill. Its Python helper uses `requests`; include it in deployed Python requirements when needed.

Outside Datatailr, use the SDK's `datatailr login --device --url <environment-url>` flow to sign in and configure the remote CLI. Use `datatailr version` to inspect the local SDK version. That command does not report the remote platform release.

## Install

From the project where you want to use the skills, run the following. Select your agent in the installer:

```sh
npx skills add Datatailr/datatailr-skills --skill '*'
```

Install the full collection for workflows that use multiple skills. If you install an individual skill, add any related skill it requires from the same release. Referenced shared documents are included inside each consuming skill so that standalone skill installation retains those documents.

For a local Claude Code preview, load the plugin directly:

```sh
claude --plugin-dir /path/to/datatailr-skills
```

The source repository is [Datatailr/datatailr-skills](https://github.com/Datatailr/datatailr-skills). The command above installs the current default branch. Follow [version management](VERSIONING.md) when selecting and pinning a release for a customer environment.

## Included skills

| Skill | Purpose |
|---|---|
| [datatailr](skills/datatailr/SKILL.md) | Platform overview and selection of the appropriate skill. |
| [datatailr-project-structure](skills/datatailr-project-structure/SKILL.md) | Project layout and deployment packaging. |
| [datatailr-deploy-workflow](skills/datatailr-deploy-workflow/SKILL.md) | DAG workflows and batch processing. |
| [datatailr-deploy-service](skills/datatailr-deploy-service/SKILL.md) | Long-running services and APIs. |
| [datatailr-deploy-app](skills/datatailr-deploy-app/SKILL.md) | Web applications and dashboards. |
| [datatailr-deploy-excel-addin](skills/datatailr-deploy-excel-addin/SKILL.md) | Python functions exposed through Excel add-ins. |
| [datatailr-distributed-joblib](skills/datatailr-distributed-joblib/SKILL.md) | Distributed joblib and scikit-learn workloads. |
| [datatailr-build-scripts](skills/datatailr-build-scripts/SKILL.md) | System packages and image customization. |
| [datatailr-blob-storage](skills/datatailr-blob-storage/SKILL.md) | Persistent binary data and files. |
| [datatailr-kv-and-secrets](skills/datatailr-kv-and-secrets/SKILL.md) | User configuration and encrypted secrets. |
| [datatailr-job-observability](skills/datatailr-job-observability/SKILL.md) | Job status, logs, runs, and results. |
| [datatailr-admin](skills/datatailr-admin/SKILL.md) | Nodes, settings, autoscaling, cost, and budgets. |
| [datatailr-users-and-groups](skills/datatailr-users-and-groups/SKILL.md) | Users, groups, and membership. |
| [datatailr-connectors](skills/datatailr-connectors/SKILL.md) | Apps and workflows using managed business-data connectors. |

Example requests:

- "Deploy this Python processing code as a Datatailr workflow."
- "Build a Streamlit dashboard in my development environment."
- "Show me the failed runs and logs for this job."

## Layout and formats

Each skill has a `SKILL.md` with YAML `name`, `description`, and release metadata. Additional documents live under `references/`; the connectors skill also includes Python and JavaScript helpers under `scripts/` and its existing agent UI metadata.

| Channel | Entry point |
|---|---|
| skills.sh | `skills/<name>/SKILL.md` discovered from the repository. |
| Claude | `.claude-plugin/plugin.json`, with skills under `skills/`. |
| OpenAI | Root `plugin.json` using the Agent Plugins format and OpenAI display metadata. |
| Cursor | The same root `plugin.json` using its supported Agent Plugins format. |

These are development manifests. Complete publisher-specific listing assets and URLs, verification, and marketplace review before public distribution. A Git push alone does not publish an approved marketplace listing.

## Source and license

The initial collection uses the Sonic SDK's skill instructions, with the installed connectors skill added and connector routing retained in the overview. The source commit and SDK version are recorded in [compatibility.json](compatibility.json). Local reference paths were repaired and normalized, SDK setup guidance was adapted for external agent environments, and the service example's requirements were aligned with its FastAPI imports. Skills do not yet include the planned `datatailr-terraform-cli` environment installation skill.

The SDK's existing [MIT license](LICENSE) is preserved.

## Format documentation

- [skills CLI](https://github.com/vercel-labs/skills)
- [Claude plugin authoring](https://code.claude.com/docs/en/plugins/create)
- [OpenAI plugin packages](https://developers.openai.com/plugins/build/plugins)
- [Cursor plugin reference](https://cursor.com/docs/reference/plugins)
