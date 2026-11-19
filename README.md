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

The catalog is `.claude-plugin/marketplace.json`. Publishing steps are in
[MARKETPLACES.md](MARKETPLACES.md), and release tags are explained in
[VERSIONING.md](VERSIONING.md).

Licensed under [MIT](LICENSE).
