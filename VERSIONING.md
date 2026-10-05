# Keeping skills, SDK, and platform versions compatible

Track three separate versions: the customer's Datatailr platform release, the SDK/CLI version used by the agent, and this skills release. They do not need identical version numbers. They need an explicitly verified compatibility mapping.

## Current state

- Skills release: `0.1.0-dev.1` (development snapshot).
- Imported SDK source version: `0.1.133`.
- Verified platform/SDK combinations: none recorded yet.

[compatibility.json](compatibility.json) records this state. An empty `supported_combinations` array means **unknown compatibility**, not support for every platform. These are Datatailr-maintained metadata fields; marketplaces do not automatically enforce them.

## Release records

Give the collection one version. Keep it identical in root `plugin.json`, `.claude-plugin/plugin.json`, `compatibility.json`, and every skill's `metadata.version`. The per-skill field preserves the release identity when a user installs only a skill folder.

Use immutable Git tags, such as `v1.0.0`, for released snapshots. That tag is an example, not a release that already exists. Never move a published tag to different contents. Use patch versions for compatible corrections, minor versions for compatible additions, and major versions when removing support or changing required behavior. Version numbers alone do not prove compatibility.

For each release, populate `supported_combinations` with exact platform and SDK combinations that have been verified. Start with exact versions; add broader ranges only when the compatibility policy and evidence justify them. A record has this shape (values below are illustrative placeholders):

```json
{
  "platform_release": "<verified platform release>",
  "sdk_version": "<verified SDK version>",
  "verified_on": "<YYYY-MM-DD>",
  "notes": "<available capabilities and any limitations>"
}
```

The outer `skills_version` identifies the skill release covered by these records. Once a release has verified records, update `compatibility_status` and each skill's `metadata.compatibility-status` consistently. Record optional feature requirements, especially connector availability, alongside the version mapping.

## Select the customer's release

1. Read the customer's actual platform release from its deployment record or supported platform metadata. Use `datatailr version` to read the local SDK version; it is not a server-version check.
2. Select a skills release whose compatibility record matches both versions and the required capabilities. If no verified combination exists, check compatibility before making platform changes.
3. Install that exact release and record its tag/commit with the customer's deployment configuration. Choose a versioned artifact or a checkout at that tag where the installation channel supports it. Do not use a moving branch as an exact version pin.
4. Keep different customer environments in separate project installations when their compatible versions differ. Avoid loading SDK-bundled and marketplace copies of the same skill simultaneously.
5. On a platform or SDK upgrade, select and install the matching skills release as part of the same rollout. Keep the previous matching combination available for rollback.

For a reproducible manual installation, clone [Datatailr/datatailr-skills](https://github.com/Datatailr/datatailr-skills), check out the selected release tag, and install from that checkout with the skills CLI. Keep the checkout at that tag if the installer uses symlinks, or use its `--copy` option. Do not treat a later generic update command as preserving that pin.

## Keep the SDK distribution aligned

Use this repository as the authoritative skill source. When building a Datatailr SDK release, import the selected skills Git tag into its bundled `agent_skills` directory and retain all reference documents, helper scripts, agent metadata, and version fields. Update shared reference copies together; those copies are intentional so each consuming skill retains its required documents when installed separately.

The current Sonic SDK's `datatailr setup-skills` command copies skills bundled in the installed SDK into an agent skills directory. It does not query this repository or choose a release based on the remote platform. Installing a new SDK also does not update every existing agent installation automatically; rerun the installation step for the selected release and remove obsolete copies where applicable.

The inspected SDK package-data patterns currently include Markdown files only. Before importing this collection into an SDK release, include the connectors' `.py`, `.js`, and `.yaml` resources too, and verify that the built package retains them.

## Enforcement to implement in Datatailr

For automatic compatibility, extend the SDK/CLI installer to read the platform release, local SDK version, and installed skills version, resolve the approved combination, and install it. Persist the selected tag/commit and artifact checksum. If the installed skill release is unsupported, explain the mismatch and require a compatible selection before continuing with incompatible operations.

Repeat that check when the user switches Datatailr environments or upgrades the SDK. Agent instructions can remind users to check versions; deterministic SDK/CLI checks provide enforcement. The metadata and documentation in this repository do not implement that resolver or runtime check.

## Marketplace releases

Build every channel's package from the same tagged source. Record which source version each published listing serves, because submission reviews and publication times differ. Updating Git alone does not update installed copies, and marketplace updates do not select a version based on a customer's Datatailr release.

Only enable automatic updates when each update remains compatible with the supported customer environments. Where a marketplace cannot retain a selected older release, provide an appropriate versioned installation route or maintain backward-compatible skills that check feature availability. Do not assume that all marketplaces offer the same pinning controls.

This development snapshot has no release tags, published marketplace packages, or automatic synchronization configured.
