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

At the time of this update, this repo has no release tags. The manifests on
`main` use `0.1.0-dev.1`, a placeholder that does not declare SDK compatibility.
Until a matching tag is available, use the skills bundled with your SDK for
version-aligned installation; the local Claude plugin flow is for evaluation.

The SDK still bundles skills, and `datatailr setup-skills` copies those files.
Selecting marketplace releases through that command and removing bundled
skills are separate work. Platform–SDK compatibility is handled separately.

For Claude directory releases, select a tested tag in the portal. To release
the next version, change the tracked tag to the new one and follow validation
and publishing. See [Claude's update guide](https://claude.com/docs/plugins/submit#change-the-tracked-branch-or-tag).
