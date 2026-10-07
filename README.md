# Datatailr skills

Agent skills for building, deploying, and managing workloads in an existing Datatailr environment.

## Source

The [`skills/`](skills/) directory is an exact copy of the tracked files in
`python/datatailr/src/datatailr/agent_skills/` in Sonic. File contents and directory
layout are preserved, including shared reference documents beside the skill
folders. Make skill changes in Sonic; direct edits to this copy will be
overwritten by the next sync.

The daily sync workflow is maintained in Sonic at
`.github/workflows/sync-agent-skills.yml`. Once merged into Sonic's `main`, it
runs daily at 00:00 CET (23:00 UTC; fixed UTC+1), with a manual run option. It copies Sonic's
latest `main`, removes obsolete files inside `skills/`, verifies an exact match,
and commits only when the skill content changes. Repository metadata outside
`skills/` is preserved.

## Prerequisites and installation

- An existing Datatailr environment and the permissions needed for the operation.
- A Datatailr SDK and CLI compatible with that environment.
- An agent that can execute the required commands and reach the environment.

Each skill has a `SKILL.md`; some reference shared documents outside their own
folder. Keep the complete `skills/` tree together when installing from this
snapshot. Do not assume an installer that copies individual skill folders also
retains these shared documents. Provider-specific packaging and installation
validation are separate work.

The root `plugin.json` and `.claude-plugin/plugin.json` contain development
plugin metadata. A repository sync does not publish marketplace listings or
update skills already installed on users' machines.

See [versioning](VERSIONING.md) for the SDK-aligned release plan. Skills and
reference material retain the SDK's [MIT license](LICENSE).
