# Datatailr skills

Skills that teach coding assistants to deploy apps, services and workflows,
manage data, and troubleshoot jobs in an existing Datatailr environment.
These are instructions for an agent, not an SDK or a Datatailr installation.

## Requirements

- An existing Datatailr environment and permission to use it.
- A compatible Datatailr Python SDK and configured, authenticated `dt` CLI.
- An agent that can run local commands and reach your environment.

## Install or try locally

Download this repository using GitHub's **Code → Download ZIP**, then extract
and review it, or check out a matching SDK release tag. Keep the complete
folder together: skills link to shared files. See [versioning](VERSIONING.md).
Choose one installation method per agent; disable any previous copy, including
skills installed by `datatailr setup-skills`, to avoid duplicate instructions.

### Claude Code

From inside the downloaded folder:

```bash
claude plugin validate .
claude --plugin-dir .
```

This loads the plugin for that session; it does not install the SDK or log in
to Datatailr. To install from our repository catalog in Claude Code 2.1.275+:

```text
/plugin install datatailr-skills --marketplace Datatailr/datatailr-skills
```

That command follows development `main`; it is separate from approval for
Claude's public directory. For a checked-out release, use the local command
above or `claude plugin install datatailr-skills --marketplace .`.

### OpenAI / Codex

After publication, install Datatailr Skills from the OpenAI Plugin Directory
in the desktop app and use a local chat. The plugin requires local execution
to use your SDK and CLI. Before publication, use OpenAI's
[local plugin setup](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)
with this complete folder. Publishing steps are in [MARKETPLACES.md](MARKETPLACES.md).

### Cursor

For local use, copy the complete folder to
`~/.cursor/plugins/local/datatailr-skills`, reload Cursor, and check **Customize**.
Local plugin imports must be allowed by your organization. After publication,
install from **Customize** instead. The root `plugin.json` is supported directly;
no separate Cursor manifest is needed.

### skills.sh

With Node.js and npm installed:

```bash
npx skills@1.7.2 add Datatailr/datatailr-skills
```

Select your agent and install the `datatailr-skills` bundle. The root `SKILL.md`
keeps all shared references in the installed folder. Do not select individual
nested skills or use `--full-depth`: they depend on sibling files. To install a
checked-out release instead, run `npx skills@1.7.2 add /path/to/datatailr-skills`.
The repository command follows development `main`.

## Usage

Use a development environment when trying deployment examples.

Example prompts:

- "List my Datatailr jobs and show the logs for a failed run."
- "Deploy this Streamlit app to my Datatailr development environment."
- "Turn these Python functions into a Datatailr workflow."

## Data handling

Skills guide your agent to run Python and `dt` commands using your configured
Datatailr credentials. Requests go to your Datatailr environment independently
of any connectors declared in the AI platform. Depending on your task, they
can read or store names, emails, files, code, configuration and job data.
Retrieved data and command output may enter the agent's conversation.

Data stored in Datatailr follows that environment's retention and deletion
policies and may remain longer than 30 days. Deployed code can contact services
and download packages required by your workload. Keep credentials out of chat
and source files; configure authentication through the SDK/CLI yourself.

[Privacy policy](https://datatailr.com/privacy-policy) ·
[Support](https://datatailr.com/contact) ·
[Datatailr documentation](https://ai.docs.datatailr.com/latest/)

## Maintenance

Edit skills in Sonic's `python/datatailr/src/datatailr/agent_skills/`.
The daily sync copies that tree here at 00:00 CET (23:00 UTC, fixed UTC+1).
Direct edits under `skills/` are overwritten; the root skill entry point,
repository docs, icons and manifests are preserved. OpenAI and Cursor share
the root manifest; Claude reads `.claude-plugin/plugin.json`. Provider-specific
OpenAI settings stay under `extensions.com.openai`.

See [MARKETPLACES.md](MARKETPLACES.md) for validation and publishing. Syncing
does not publish marketplace listings or update installed skills.

Licensed under [MIT](LICENSE).
