---
name: datatailr-skills
description: Build and deploy apps, services and workflows, manage storage and users, and troubleshoot jobs in an existing Datatailr environment. Use when the user asks to work with Datatailr or its dt CLI.
---

# Datatailr Skills

Build, deploy and manage workloads in your Datatailr environment with your
AI coding assistant. This bundle provides guidance for using the Datatailr
Python SDK and `dt` CLI, from deploying your first app to troubleshooting jobs.

## What you can do

- Deploy web apps, dashboards, background services and Excel add-ins.
- Build data pipelines and DAG workflows, and distribute scikit-learn workloads.
- Inspect job status, runs and logs, and roll back deployments.
- Work with blob storage, configuration and secrets.
- Manage users, groups, permissions, compute nodes and budgets.

Requires an existing Datatailr environment, a configured SDK and CLI, and
permission to perform the requested operations.

## Example requests

- "Deploy this Streamlit dashboard to my Datatailr development environment."
- "Show the logs for my failed workflow and help me find the cause."
- "Save this dataset to Datatailr blob storage."

## Instructions for the agent

Read [the Datatailr guide](skills/datatailr/SKILL.md), then the relevant
`SKILL.md` under `skills/` for the requested operation. Follow its linked
references as needed; resolve each link relative to the file containing it.
For user and group management, read
[users and groups](skills/datatailr-users-and-groups/SKILL.md).

Use the user's configured SDK, CLI and environment. If setup or login is
missing, explain what the user needs to configure; do not request passwords
or tokens in chat. Ask before installing or upgrading software.
