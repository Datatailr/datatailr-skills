# Skills versioning

- **Development:** daily sync updates `main` from Sonic. It does not create
  release tags, change plugin versions or update installed skills.
- **Releases:** after the SDK is published to PyPI through Sonic's release
  workflow, it publishes a matching `v<SDK version>` tag here. The tag contains
  skills from the same source commit and matching plugin manifest versions.
  Public `main` is unchanged by this release step.
- **Selection:** use the tag matching your installed SDK. For example, SDK
  `0.1.9` corresponds to skills `v0.1.9`, if that tag exists. Do not assume
  development `main` matches an older SDK. Never move an existing release tag.

The manifests on `main` use a development version that does not declare SDK
compatibility. Check the repository's tags for a matching SDK release. If no
matching tag exists, use the skills bundled with your SDK.
Older tags retain their original packaging. The Claude catalog and skills.sh
bundle require a tag containing `.claude-plugin/marketplace.json` and the root
`SKILL.md`; do not move an old tag to add them.

The SDK still bundles skills, and `datatailr setup-skills` copies those files.
Selecting marketplace releases through that command and removing bundled
skills are separate work. Platform–SDK compatibility is handled separately.

For Claude directory releases, select a tested tag in the portal. To release
the next version, change the tracked tag to the new one and follow validation
and publishing. See [Claude's update guide](https://claude.com/docs/plugins/submit#change-the-tracked-branch-or-tag).

OpenAI skills updates require a new ZIP and publication through its portal;
Cursor updates go through its marketplace review. Repository install commands
without a ref follow development `main`. Install a checked-out release through
the local flows in [README.md](README.md) when an exact version is needed.
Do not assume marketplace updates or `skills update` select the version that
matches the local SDK. Review compatibility before accepting an update.
