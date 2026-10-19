# Datatailr skills

Skills that teach coding assistants to deploy apps, services and workflows,
manage data, and troubleshoot jobs in an existing Datatailr environment.
These are instructions for an agent, not an SDK or a Datatailr installation.

## Requirements

- An existing Datatailr environment and permission to use it.
- A compatible Datatailr Python SDK and configured, authenticated `dt` CLI.
- An agent that can run local commands and reach your environment.

## Try in Claude Code

Download this repository using GitHub's **Code → Download ZIP**, then extract
and review it. With [Claude Code](https://code.claude.com/docs/en/overview)
installed, run the following from inside the extracted folder:

```bash
claude plugin validate .
claude --plugin-dir .
```

This loads the plugin for that session; it does not install the SDK or log in
to Datatailr. Use a development environment when trying deployment examples.
Avoid loading another copy of the same Datatailr skills in that session.

Example prompts:

- "List my Datatailr jobs and show the logs for a failed run."
- "Deploy this Streamlit app to my Datatailr development environment."
- "Turn these Python functions into a Datatailr workflow."

Keep the complete plugin directory together: skills link to shared files in
[`skills/`](skills/). This checkout follows development `main`; use a matching
SDK release tag when available. See [versioning](VERSIONING.md).

## Publish to Claude's directory

For maintainers:

1. Prepare a release with the intended plugin version. Validate it and try the
   examples above, including shared references, in Claude Code.
2. Open the [developer portal](https://claude.ai/directory/manage) from the
   Datatailr publisher organization. Use an eligible paid account and connect
   a GitHub account with write access to this repo.
3. Choose **Submit new → Plugin bundle**, enter `Datatailr/datatailr-skills`,
   leave the plugin path empty, and select the tested release tag.
4. Run **Validate**, fix blocking findings, review the listing and data-handling
   details, and submit. Follow the review and **Publish** steps in the portal.

The README and `.claude-plugin/plugin.json` provide the listing details.
Claude uses that manifest; the root `plugin.json` supports other agents.
Local validation does not replace portal validation or review. A
`marketplace.json` is not required for directory submission.
See the [official submission guide](https://claude.com/docs/plugins/submit).

## Maintenance

Edit skills in Sonic's `python/datatailr/src/datatailr/agent_skills/`.
The daily sync copies that tree here at 00:00 CET (23:00 UTC, fixed UTC+1).
Direct edits under `skills/` are overwritten; repository docs and manifests
are preserved. Syncing does not publish a Claude listing or update installed
skills.

Licensed under [MIT](LICENSE).
