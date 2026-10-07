# Skills versioning

Sonic is the source of truth. This repository mirrors its skills for distribution.

The release policy is to give SDK releases and their corresponding skills
snapshots the same immutable Git tag. Release automation must publish the skills
from the source snapshot used for that SDK release. Do not move an existing tag
or tag a later development snapshot as an older SDK release.

There is no manually maintained compatibility mapping file. Platform-to-SDK
compatibility is handled separately; selecting the matching skills tag then
follows the SDK version.

## Current behavior

The daily workflow synchronizes `main` only. It does not create release tags,
change plugin versions, or update installed skills. The plugin manifests retain
a development placeholder version; it is not an SDK compatibility declaration.
Use a released matching tag once release publishing is implemented, rather than
assuming the latest `main` matches an older SDK.

SDK debundling, release tag publishing, and upgrading `datatailr setup-skills`
to select a matching tag and install for different AI providers are separate
work. The existing SDK still ships its bundled skills and copies those files
when `setup-skills` is run.
