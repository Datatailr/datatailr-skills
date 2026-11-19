# Datatailr plugins

This repository is a plugin catalog with two plugins, each in its own folder:

- [`datatailr-skills/`](datatailr-skills/README.md): skills that teach coding
  assistants to deploy apps, services and workflows, manage data, and
  troubleshoot jobs in an existing Datatailr environment.
- [`datatailr-dashboard/`](datatailr-dashboard/README.md): a live Datatailr
  dashboard in a pane of Claude Code.

To install both in Claude Code from this catalog:

```text
/plugin install datatailr-skills --marketplace Datatailr/datatailr-skills
/plugin install datatailr-dashboard --marketplace Datatailr/datatailr-skills
```

The repository also has catalogs for other agents, which list the skills
plugin only. The dashboard runs in Claude Code alone.

| Agent | Catalog | How to add it |
|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add Datatailr/datatailr-skills` |
| Codex and the ChatGPT desktop app | `.agents/plugins/marketplace.json` | `codex plugin marketplace add Datatailr/datatailr-skills` |
| Cursor | `.cursor-plugin/marketplace.json` | A Teams or Enterprise admin imports the repository under **Dashboard → Settings → Plugins** |
| skills.sh | `SKILL.md` (the `datatailr-skills` bundle) | `npx skills add Datatailr/datatailr-skills` |

Publishing steps are in
[MARKETPLACES.md](MARKETPLACES.md), and release tags are explained in
[VERSIONING.md](VERSIONING.md).

Licensed under [MIT](LICENSE).
