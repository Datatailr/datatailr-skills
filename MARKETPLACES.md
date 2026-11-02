# Publish Datatailr skills

Use a tested release tag containing this packaging and matching the SDK, with
the same version in both skills manifests. Include the entire repository
contents; the skills share references. No MCP server or automatic setup hook
is required.

## Before submitting

- Follow the local setup in [README.md](README.md). Check skill discovery,
  shared references, and the example prompts against a development environment.
- Run `claude plugin validate --profile directory --strict .` on the repository
  root and `claude plugin validate --profile directory --strict datatailr-dashboard`
  on the dashboard folder. Both must pass without warnings.
- Validate root `plugin.json` against its declared Agent Plugins schema.
- Confirm the privacy policy covers the submitted functionality and retention.
  A public Terms of Service URL has not been supplied; add it to the relevant
  listing metadata if required. Do not use the privacy policy as a substitute.

## Claude

The repository holds two plugins. Each plugin is one submission in the portal.

1. Open [the developer portal](https://claude.ai/directory/manage) with the
   intended publisher organization and GitHub write access.
2. Submit the skills plugin. Choose **Submit new → Plugin bundle**, enter
   `Datatailr/datatailr-skills`, leave the plugin path empty, and select the
   tested release tag. To release the next version, change the tracked tag.
3. Submit the dashboard plugin. Choose **Submit new → Plugin bundle**, enter
   `Datatailr/datatailr-skills`, set the plugin path to `datatailr-dashboard`,
   and track the branch `main`. A new `version` in Sonic's dashboard
   `plugin.json` reaches `main` with the next sync. That is the release step.
   The directory reviews each new version before it goes live.
4. For each submission, validate, resolve blocking findings, complete the
   listing and data-handling fields, submit for review, then follow the
   portal's publication steps.

The dashboard holds a hooks module, which is code. The portal applies its own
rules to code, a safety scan and a policy review. For the data-handling
questions, answer that both plugins send data only to the user's own Datatailr
installation, through the `datatailr` CLI session, and to no other service.
Neither plugin declares a connector.

The repository catalog enables direct Claude Code installation independently
of directory approval. Keep the existing brand name; any name-confusion hold
needs reviewer resolution. [Submission guide](https://claude.com/docs/plugins/submit).

## OpenAI

1. Select the owning organization/project in [the plugin portal](https://platform.openai.com/plugins).
   Complete developer/business verification; use an owner account or one with
   **Apps Management Write**. Confirm local-execution eligibility with your
   OpenAI representative; if the desktop-only field is rejected, provide your
   organization ID to them.
2. Create a ZIP from the tested tag (`vX.Y.Z` below is a placeholder):

   ```bash
   git archive --format=zip --output=datatailr-skills.zip vX.Y.Z
   ```

3. Upload the ZIP as **Skills only**, review **Metadata & Skills**, fix required
   findings and upload again. Submit for review, then publish after approval.

The portable root manifest includes desktop-only execution, listing details
and icon paths. Skills-only submissions do not require MCP test cases or a
demo recording. OpenAI reads only `skills/`, so it does not get the connect
skill. Updates require a new ZIP.
[Submission guide](https://developers.openai.com/plugins/deploy/submission) ·
[Desktop requirements](https://developers.openai.com/plugins/deploy/desktop-only).

## Cursor

Submit the public repository at [Cursor Marketplace](https://cursor.com/marketplace/publish)
after testing the local plugin. Cursor accepts the root Agent Plugins manifest;
this repo needs no Cursor-specific manifest or marketplace catalog.
Cursor reads only `skills/`, so it does not get the connect skill.
Initial listings and updates are reviewed.
[Requirements](https://cursor.com/docs/reference/plugins).

## skills.sh

Publish the root `SKILL.md` with the complete `skills/` tree. Verify discovery
with `npx skills@1.7.2 add . --list` and test installation in a temporary project
using `npx skills@1.7.2 add /path/to/datatailr-skills --agent codex`.
The root entry point installs the bundle intact; native plugins discover the
individual skills under `skills/` instead.

There is no directory submission form: public repository installs are counted
by the skills CLI's telemetry and drive listing discovery. Do not assume that
local validation means the directory has indexed the repository.
[FAQ](https://skills.sh/docs/faq) · [CLI](https://github.com/vercel-labs/skills).
