# Publishing a GitHub Action to the Marketplace (research, 2026-10-23)

Sources are primary only: docs.github.com, github.blog, github.com/github/roadmap, and repos in the `actions` org (read with `gh api` on 2026-10-23). Claims I could not tie to a primary source are marked **UNVERIFIED**.

## TL;DR

1. Requirements: public repo, one `action.yml`/`action.yaml` at the root, a unique `name`, 2FA on the publishing account, and an accepted Marketplace Developer Agreement. GitHub does not review listings; they go live when the release is published.
2. The Marketplace name is `name:` in `action.yml`. It must not match an existing Marketplace action, a GitHub user or org (unless that owner is the one publishing), a Marketplace category, or a reserved GitHub feature name.
3. You publish by drafting a GitHub Release and ticking "Publish this Action to the GitHub Marketplace", then choosing a Primary category and an optional second one.
4. The "Verified creator" badge is only for GitHub **partner organizations** (requested via partnerships@github.com). Individuals cannot get it.
5. Versioning: create `vX.Y.Z` releases and keep a floating `v1` tag (and optionally `v1.2`) pointed at the latest compatible release by force-pushing it. `actions/checkout` does this with a manual `workflow_dispatch` workflow that runs `git tag -f` and `git push --force`.
6. `actions/publish-action` (it moves major tags) says it is for **internal use only, alpha, not recommended** for public use. Don't depend on it. Use `script/release` from the typescript-action template, or a small force-push workflow of your own.
7. For JS/TS actions, the bundled `dist/` (for example `dist/index.js`) must be in the git ref that users reference. The typescript-action template's `check-dist.yml` rebuilds `dist/` on PRs and pushes to `main` and fails if `git diff dist/` is not empty.
8. **Immutable releases are GA** (2025-10-28) and opt-in per repo or org. A release's tag can't be moved or deleted once published. That conflicts with a floating `v1` only if `v1` is itself a release. Keep `v1` as a plain git tag, not a GitHub release.
9. **"Immutable actions" (OCI packages on ghcr.io) is dead for now.** The roadmap item was closed on 2025-12-11 and "removed from the roadmap", and `actions/publish-immutable-action` says it is "not ready for public use".
10. GitHub's security guidance tells *consumers* to pin to a full-length SHA, or better, to use the new workflow dependency lockfiles (public preview). Lockfiles require the locked commit to "exist within a branch", which matters if `dist/` only lives on tag commits. How the "Use latest version" snippet works is not documented (**UNVERIFIED**).

---

## 1. Requirements to publish

| Requirement | Finding | Source |
|---|---|---|
| Public repo | "The action must be in a public repository." | https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace |
| `action.yml` at root | "Each repository must contain a single action metadata file (`action.yml` or `action.yaml`) at the root." Metadata files in subfolders are allowed but are not listed automatically. | same |
| Unique name | See section 2. | same |
| README | Not listed as a hard requirement on the publishing page. The manage-actions page "recommend[s] creating a README file". | https://docs.github.com/en/actions/how-tos/create-and-publish-actions/manage-custom-actions |
| Required metadata keys | `name`, `description`, `runs` are required. `author` is optional. `branding` (icon is a Feather icon, plus a color) is optional: "Badges are shown next to your action name in GitHub Marketplace." | https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax |
| Release checkbox | Go to `action.yml`, click **Draft a release**, then under "Release Action" select **Publish this Action to the GitHub Marketplace**. Metadata problems show as errors or warnings that you must fix first. | publish page (above) |
| Developer Agreement | You must accept the terms of service. The checkbox is disabled until the owning account has accepted the Marketplace Developer Agreement. | publish page |
| 2FA | "Publishing requires you to use two-factor authentication." | publish page |
| Review | Published immediately. GitHub does not review it. | publish page |
| Verified creator badge | Means GitHub has verified the creator as a **partner organization**. Partners request it at partnerships@github.com. Individuals are not offered a route. | publish page; also described as "a useful signal" at https://docs.github.com/en/actions/reference/security/secure-use |
| Delisting | Uncheck the Marketplace box on **each** published release. Deleting the repo deletes the listing. Listings are linked to the repo through the unique `name`, and repo transfers redirect. | publish page |

**UNVERIFIED:** the publish page doesn't mention restrictions on workflow files in the repo, so this note makes no claim about them.

## 2. Naming rules

- The Marketplace name comes from the `name:` field in `action.yml`. Source: https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
- Constraints (same page):
  - "The `name` in the action's metadata file must be unique."
  - It "cannot match an existing action name published on GitHub Marketplace."
  - It "cannot match a user or organization on GitHub, unless the user or organization owner is publishing the action." So a name can collide with an existing user or org name, and that blocks publishing unless you own that account.
  - It "cannot match an existing GitHub Marketplace category."
  - "GitHub reserves the names of GitHub features."
- **UNVERIFIED:** how the URL slug is derived (for example `github.com/marketplace/actions/<slug>` from `name`), whether matching is case- or whitespace-insensitive, and whether renaming `name` in a later release renames the listing.

## 3. Versioning conventions

**GitHub docs guidance (for authors):**

- Use tags for release management. "Move the major version tag (for example, `v1`) to point to the Git ref of the current release". Introduce `v2` for breaking changes. Users should not reference the default branch. https://docs.github.com/en/actions/how-tos/create-and-publish-actions/manage-custom-actions
- Recommended: semantic tags like `v1.1.3`, plus "keeping major (`v1`) and minor (`v1.1`) tags current to the latest appropriate commit". The example process builds during release and "intentionally does not commit dependencies to the `main` branch, only to the tagged release commits." https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions
- The toolkit versioning doc recommends: create a GitHub release for each specific version, tick "Publish this Action to the GitHub Marketplace" when you release that specific version, then move `v1` with `git tag -fa v1 -m "Update v1 tag"` and `git push origin v1 --force`. https://github.com/actions/toolkit/blob/main/docs/action-versioning.md

**How actions/checkout does it** (`gh api repos/actions/checkout`, 2026-10-23):

- Releases are `v7.0.1`, `v6.1.0`, `v5.1.0`, `v4.4.0` (all published 2026-07-20, `immutable: false`). There are plain tags `v7`, `v7.0.0`, `v7.0.1`, and so on. https://github.com/actions/checkout/releases
- `.github/workflows/update-main-version.yml` is a `workflow_dispatch` with inputs `target` and `major_version` (a choice of v5/v4/v3/v2). It runs `git tag -f <major> <target>` and `git push origin <major> --force`, and its comments say it doubles as a rollback tool. https://github.com/actions/checkout/blob/main/.github/workflows/update-main-version.yml
- `dist/` is committed on `main`, and there is a `check-dist.yml`. https://github.com/actions/checkout/tree/main
- checkout also still has `publish-immutable-actions.yml`, which uses `actions/publish-immutable-action@v0.0.4`. See section 5 for why this is moot.

**Pinning guidance (for consumers):**

- GitHub's secure-use reference: "Pin references to actions to a commit SHA in your workflow files." It warns that tags can be moved or deleted. It now says the best measure is a workflow dependency lockfile, which "supersedes SHA pinning for repositories that adopt it." https://docs.github.com/en/actions/reference/security/secure-use
- Lockfiles are "in public preview". They live at `.github/workflows/actions.lock` and are generated by the `gh actions-lock` extension. The locked commit "must exist within a branch of the source repository". https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles
  - Implication: if you follow the "dist only on tagged release commits" pattern, the tag commit may not be on any branch. The doc doesn't say what happens then (**UNVERIFIED**). Committing `dist/` to `main`, the typescript-action pattern, avoids this.
- A full SHA must be used, not an abbreviated one. Pinning to a SHA means users don't get updates. https://docs.github.com/en/actions/how-tos/create-and-publish-actions/manage-custom-actions
- The toolkit doc's recommendation is the opposite of the security doc's: "bind to major versions ... reserve binding to a specific release or SHA as a mitigation strategy". https://github.com/actions/toolkit/blob/main/docs/action-versioning.md

**Automation for moving the major tag:**

- `actions/publish-action` updates or creates the major tag from the latest release. Its README says: "this action is for internal usage only, issues are disabled and contributing PRs will not be reviewed. We also do not recommend this action for public or production usage". Status: "Alpha". The repo is not archived and was last pushed 2026-10-17. https://github.com/actions/publish-action
- The release-and-maintain page points to an action that can "force push semantic major, minor, and patch tags". It also notes that with immutable releases you "cannot use this action to force push tags tied to releases on GitHub." https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions
- The typescript-action template ships `script/release`. It prompts for `vX.X.X`, tags it, syncs the major tag, creates `releases/v#` for a new major, and pushes. "From here, you will need to create a new release in GitHub". https://github.com/actions/typescript-action#publishing-a-new-release

## 4. `dist/` and check-dist

- JS actions must ship their dependencies. "You should not commit the `node_modules` directory". Instead, bundle with rollup or `@vercel/ncc` into `dist/index.js` and commit it. The tutorial's `git add` explicitly includes `dist/index.js`. https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action
- So yes, the bundled `dist/` must be present at whatever ref users `uses:`. Whether that is `main` or only the release commits is up to you (see section 3). There is no separate Marketplace requirement for it beyond the action having to run.
- typescript-action's `.github/workflows/check-dist.yml` (https://github.com/actions/typescript-action/blob/main/.github/workflows/check-dist.yml):
  - Triggers: `pull_request` and `push` on `main`, with `permissions: contents: read`.
  - Steps: checkout (`actions/checkout@v6`), setup-node (from `.node-version`, npm cache), `npx rimraf ./dist`, `npm ci`, `npm run bundle`.
  - It fails if `dist/` is missing or if `git diff --ignore-space-at-eol --text dist/` is non-empty.
  - On failure it uploads the expected `dist/` as an artifact (`actions/upload-artifact@v7`).
- The template README stresses running `npm run all` (rollup bundle) before committing, or "your action will not work correctly". https://github.com/actions/typescript-action

## 5. Immutable releases vs. "immutable actions"

These are two different features.

### Immutable releases: GA, opt-in

- Public preview started 2025-08-26 (https://github.blog/changelog/2025-08-26-releases-now-support-immutability-in-public-preview/). GA came on 2025-10-28 (https://github.blog/changelog/2025-10-28-immutable-releases-are-now-generally-available/).
- It is enabled at the repo or org level. Once enabled, all new releases are immutable. Existing releases stay mutable unless republished, and disabling the setting doesn't unlock releases made while it was on (same changelog).
- Effects: assets can't be added, changed, or deleted, and the release tag is "locked to a specific commit". If you delete the release you can delete the tag, but the tag name can't be reused. A signed release attestation (Sigstore bundle) is generated. https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases
- For actions, GitHub's guide says to use an immutable GitHub release for fixed versions, and to keep movable tags as plain git tags: "If you want to be able to update the Git tag of a release later, do not create a release on GitHub." The major version tag should be updated to "the latest related minor version or patch version" by force-pushing. https://docs.github.com/en/actions/how-tos/create-and-publish-actions/using-immutable-releases-and-tags-to-manage-your-actions-releases
- Marketplace effect: none of these pages mention Marketplace. Because the Marketplace checkbox lives on a release, the natural fit is to publish `v1.2.3` as an immutable release and keep `v1` as a bare tag (**inference, UNVERIFIED**).

### Immutable actions (OCI packages on ghcr.io): shelved

- Roadmap issue "Immutable Actions [GA]" was closed on 2025-12-11 with a GitHub staff comment that it "has been removed from the roadmap for now". GitHub is instead "looking to build Actions specific features around immutable releases". https://github.com/github/roadmap/issues/592
- The `actions/publish-immutable-action` README: "not ready for public use ... Attempts to use this action to upload an OCI artifact will not work". Last push was 2025-08-08. https://github.com/actions/publish-immutable-action
- Conclusion: there is nothing to adopt here. It doesn't change tags or the Marketplace listing today.

## 6. Marketplace categories

- They are chosen at release time: the **Primary Category** dropdown (required) and an optional **Another Category**. https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
- The docs don't publish a canonical list. This is what the live Actions sidebar showed on 2026-10-23 (https://github.com/marketplace?type=actions): Agent apps, AI Assisted, API management, Backup Utilities, Chat, Code quality, Code review, Code Scanning Ready, Code search, Container CI, Continuous integration, Dependency management, Deployment, Deployment Protection Rules, Desktop tools, Game CI, GitHub Sponsors, IDEs, Learning, Localization, Mobile, Mobile CI, Monitoring, Open Source management, Project management, Publishing, Reporting, Security, Support, Sustainability, Testing, Time tracking, Utilities.
  - **UNVERIFIED:** whether every sidebar category is selectable for actions in the release dropdown. Some, such as "GitHub Sponsors", look app-specific.
- For a GraphQL schema diff action, "Code quality", "Code review", and "Continuous integration" all exist. Category names are also reserved as action names (section 2).

## 7. The "Use latest version" snippet

- The docs only say the tag typed in the release form is the version "people will see ... in the action's dedicated GitHub Marketplace page". https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
- The live `actions/checkout` listing shows "Use latest version" next to a "Choose a version" dropdown. The Latest badge is on `v7.0.1`, which is the latest *release*, and the README usage shows `actions/checkout@v7`. https://github.com/marketplace/actions/checkout
- **UNVERIFIED:** I found no primary source saying the snippet ever shows a floating major tag. Everything observed suggests it shows the exact tag of the latest Marketplace-published release (for example `@v1.2.3`), and that `v1` can't appear there because it is a bare tag, not a release. If you want users on `@v1`, show it in the README usage block, as `actions/checkout` does. One option, not recommended by GitHub, is publishing a release literally tagged `v1`, but that conflicts with immutable releases (section 5).
