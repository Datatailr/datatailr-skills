# Skills versioning

- **Development:** daily sync updates `main` from Sonic. It writes the SDK
  version of the synced skills into both skills manifests, creates no release
  tags and updates no installed skills. The dashboard keeps the version that
  Sonic gives it, so a new dashboard version moves with the sync.
- **Releases:** after the SDK is published to PyPI through Sonic's release
  workflow, it publishes a matching `v<SDK version>` tag here. The tag contains
  skills from the same source commit and matching skills manifest versions.
  Public `main` is unchanged by this release step.
- **Selection:** use the tag matching your installed SDK. For example, SDK
  `0.1.9` corresponds to skills `v0.1.9`, if that tag exists. Do not assume
  development `main` matches an older SDK. Never move an existing release tag.

The skills manifests on `main` carry the SDK version of the skills on `main`,
which is the version Sonic's `main` declares. A release tag holds the same
version with the skills of that release commit. If no matching tag exists, use
the skills bundled with your SDK.
Older tags retain their original packaging. The Claude catalog and skills.sh
bundle require a tag containing `.claude-plugin/marketplace.json` and the root
`SKILL.md`; do not move an old tag to add them.

The SDK still bundles skills, and `datatailr setup-skills` copies those files.
Selecting marketplace releases through that command and removing bundled
skills are separate work. Platform–SDK compatibility is handled separately.

The Claude directory submission of the skills plugin tracks `main`. A new SDK
release reaches it with the next sync, which writes the new version, and the
directory reviews the new version. A change to the connect skill or the session
hook, which live only here, reaches it the same way. See
[Claude's update guide](https://claude.com/docs/plugins/submit#change-the-tracked-branch-or-tag).

The `datatailr-dashboard` plugin keeps its own version. Sonic sets it in the
dashboard `plugin.json`, and the release script does not change it. It does not
match the SDK version. A new version reaches `main` with the next sync, and the
Claude directory submission of the dashboard tracks `main`. A release tag holds
the dashboard copy of its release commit, so a tag gives a fixed pair of skills
and dashboard.

OpenAI skills updates require a new ZIP and publication through its portal;
Cursor updates go through its marketplace review. Repository install commands
without a ref follow development `main`. Install a checked-out release through
the local flows in [README.md](README.md) when an exact version is needed.
Do not assume marketplace updates or `skills update` select the version that
matches the local SDK. Review compatibility before accepting an update.
