# PR comment permissions and posting strategy (research)

Researched 2026-10-23 from primary sources (docs.github.com, github.blog changelog, GitHub Security Lab, and the source of two widely used comment actions). Each claim has its source URL next to it. Anything not confirmed by a primary source is marked **UNVERIFIED**.

## TL;DR

1. Creating, listing and editing a PR conversation comment uses the Issues comments API. **Either** `issues: write` **or** `pull-requests: write` is enough: GitHub's permission tables list these endpoints under both, as "any one permission from a set".
2. Recommend `pull-requests: write` in the README (it is what marocchino and thollander document). GitHub's own `workflow_run` example uses `issues: write`. Both work.
3. Since 2023-02-02, **new** repos and orgs default to a read-only `GITHUB_TOKEN`. Declaring any `permissions:` key sets every unlisted scope to `none`. So the README snippet must always include a `permissions:` block, plus `contents: read` if it checks out code.
4. On `pull_request` from a fork, write scopes are downgraded to read. You cannot fix this with `permissions:`. The comment will fail with 403 "Resource not accessible by integration".
5. `pull_request_target` gives a write token on fork PRs, but it runs the default branch's code. Checking out and running PR head code under it is the "pwn request" hazard.
6. New in 2026: GitHub adds a default policy that **blocks `pull_request_target` in public repos**. It is in evaluate mode now, enforced 2026-12-02 per docs. Also, `actions/checkout` now refuses fork-PR checkouts under `pull_request_target` and `workflow_run` unless you set `allow-unsafe-pr-checkout: true`.
7. The safe fork pattern is still two workflows: `pull_request` (unprivileged) computes the diff and uploads an artifact, then `workflow_run` (privileged) downloads it, treats it as untrusted data, and comments. GitHub documents this pattern and the Security Lab recommends it.
8. Sticky comments: put a hidden marker such as `<!-- graphql-schema-diff -->` in the body. Paginate `GET .../issues/{n}/comments` (max `per_page=100`, `Link` header). Match the marker, preferably also the bot author, then PATCH, or POST if nothing matches.
9. The body limit is 65,536 characters (a 422 "Body is too long" error). It is not in the REST docs (**UNVERIFIED** from a primary doc), so truncate and link to the job summary, which allows 1 MiB per step.
10. `GITHUB_TOKEN` comments come from `github-actions[bot]`. A custom name and avatar need a GitHub App and its installation token, which is out of scope. The job summary (`GITHUB_STEP_SUMMARY`) needs no permissions and works on fork PRs, so it makes a good always-on fallback.

---

## 1. Permissions needed to create and edit an issue comment on a PR

- PR conversation comments are issue comments, because "every pull request is an issue": https://docs.github.com/en/rest/issues/comments
- Endpoints used by a sticky comment:
  - `GET /repos/{owner}/{repo}/issues/{issue_number}/comments` (list)
  - `POST /repos/{owner}/{repo}/issues/{issue_number}/comments` (create)
  - `PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}` (update)
  Source: https://docs.github.com/en/rest/issues/comments
- **Scope mapping.** In "Permissions required for GitHub Apps", all three endpoints appear under **both** "Repository permissions for Issues" and "Repository permissions for Pull requests". List needs read, and create and update need write. All three carry the "Additional permissions" checkmark, which the page defines as: "Other endpoints work with any one permission from a set of permissions." https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps . The fine-grained PAT table shows the same thing: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- **Conclusion:** `issues: write` alone or `pull-requests: write` alone is enough for list, create and update. You do not need both. The `GITHUB_TOKEN` is a GitHub App installation token, so the App tables apply to it: https://docs.github.com/en/actions/concepts/security/github_token
- The workflow-syntax permission table says `issues: write` "permits adding a comment to an issue". It describes `pull-requests: write` as "add a label to a pull request". https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions
- GitHub's own `workflow_run` comment example grants `actions: read` and `issues: write`: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run
- Popular actions document `pull-requests: write`:
  - marocchino/sticky-pull-request-comment README: https://github.com/marocchino/sticky-pull-request-comment
  - thollander/actions-comment-pull-request README ("this actions needs at least: pull-requests: write"): https://github.com/thollander/actions-comment-pull-request
- Recommended README block:

  ```yaml
  permissions:
    contents: read        # only if the job uses actions/checkout
    pull-requests: write  # create/update the PR comment (issues: write also works)
  ```

## 2. Default GITHUB_TOKEN permissions

- On **2023-02-02**, GitHub changed the default from read/write to read-only for **new** enterprises, orgs not owned by an enterprise, and personal-account repos. Org-owned repos inherit the org's setting. "This change will not impact any existing enterprises, organizations or repositories." https://github.blog/changelog/2023-02-02-github-actions-updating-the-default-github_token-permissions-to-read-only/
- In the repo settings, "restricted" means "just read access for the `contents` and `packages` permissions". "Permissive" means read and write for all. https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
- "If you specify the access for any of these permissions, all of those that are not specified are set to `none`." https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions
- How permissions are calculated: start from the enterprise, org or repo default, then apply the workflow-level `permissions`, then the job-level ones. Finally, for fork PR events other than `pull_request_target`, write is downgraded to read. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#how-permissions-are-calculated-for-a-workflow-job
- **What this means for the README:** yes, users must add a `permissions:` block. Under the restricted default the token has no write access to issues or PRs, so commenting fails with 403. Once they add any `permissions:` key, they must also list `contents: read` if they use `actions/checkout`. marocchino's README warns about exactly this ("Recently, GitHub sets permissions conservatively for newly created repositories... you will also need the `contents` permissions set"): https://github.com/marocchino/sticky-pull-request-comment

## 3. `pull_request` vs `pull_request_target`, and fork PRs

### `pull_request` from a fork

- "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository. The `GITHUB_TOKEN` has read-only permissions in pull requests from forked repositories." https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflows-in-forked-repositories
- "You can use the `permissions` key to add and remove read permissions for forked repositories, but typically you can't grant write access." The exception is the admin setting **Send write tokens to workflows from pull requests**. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#changing-the-permissions-in-a-forked-repository
- That setting (and "Send secrets to workflows from pull requests") exists **for private repositories only**: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#enabling-workflows-for-forks-of-private-repositories
- Dependabot PRs are treated like fork PRs, so they also get a read-only token and no secrets. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions-for-workflow-runs-triggered-by-dependabot
- The practical effect is that a comment step on a public repo's fork PR returns 403 "Resource not accessible by integration". thollander documents this: "if the PR comes from a fork, it will have only read permission despite the permissions given in the action for the `pull_request` event." https://github.com/thollander/actions-comment-pull-request . The exact 403 message text is **UNVERIFIED** from GitHub docs.

### What `pull_request_target` changes

- It "runs in the context of the default branch of the base repository, rather than in the context of the merge commit... This event allows your workflow to do things like label or comment on pull requests from forks. Avoid using this event if you need to build or run code from the pull request." https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target
- Under `pull_request_target`, "the GITHUB_TOKEN is granted read/write repository permission, even when it is triggered from a public fork", and the workflow can access secrets. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax and https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- Since 2025-12-08, the workflow file and checkout commit always come from the repository's **default** branch, whatever the PR's base branch. https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/

### The pwn-request hazard

- The insecure pattern is `pull_request_target` plus `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}`, followed by any step that runs the checked-out code (`make test`, `npm install`, build scripts, config files). That code then runs with the base repo's secrets and write token. https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target and https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/ (Security Lab, 2021-08-03)
- The same hazard applies to `workflow_run` and `issue_comment` workflows that fetch and run fork code. "A `workflow_run` workflow should treat artifacts uploaded by other workflows as untrusted data." https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- **New 2026 protections:**
  - **Default event policy:** "For public repositories that do not already have an applicable Actions event policy, GitHub adds a default policy that blocks workflows triggered by `pull_request_target`." It is currently in **evaluate** mode, and GitHub "will enforce the default policy... On December 2, 2026". It does not apply to private or internal repos. https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target . Secondary coverage gives 2026-11-02 instead. The docs page is the primary source, but the exact date is **UNVERIFIED** against a changelog post.
  - **`actions/checkout` guard:** the new input `allow-unsafe-pr-checkout` (default `false`) is "Required to check out fork pull request code from a workflow triggered by `pull_request_target` or `workflow_run`." https://github.com/actions/checkout/blob/main/action.yml (v7.0.1, v6.1.0 and v5.1.0 were released 2026-07-20: https://github.com/actions/checkout/releases)
  - **Implication:** a README that tells users to switch to `pull_request_target` will stop working by default on public repos after enforcement, unless they create an allow policy.

### What reputable comment actions recommend

- **thollander/actions-comment-pull-request:** for fork PRs, "you may use the `pull_request_target` event". It gives no security caveat beyond noting that the code runs from the target branch. https://github.com/thollander/actions-comment-pull-request
- **marocchino/sticky-pull-request-comment:** its README has no fork-specific guidance (it covers only permissions and new-repo defaults). https://github.com/marocchino/sticky-pull-request-comment
- **GitHub Security Lab and GitHub docs** recommend: "Use `pull_request` unless the workflow truly needs write access or secrets", and split privileged and unprivileged work across two workflows. https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/ and https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#deciding-whether-to-use-pull_request_target

### Is the two-workflow pattern still recommended?

- **Yes.** The current events docs carry the canonical example. An "Upload data" workflow on `pull_request` writes the PR number to an artifact. A "Use the data" workflow on `workflow_run` (`types: [completed]`, `permissions: actions: read, issues: write`) downloads it into `${{ runner.temp }}` ("do not extract in the workspace dir that may contain executable scripts"), checks that the PR number is an integer, and calls `issues.createComment`. https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#using-data-from-the-triggering-workflow
- "The workflow started by the `workflow_run` event is able to access secrets and write tokens, even if the previous workflow was not." https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run
- Caveats from the same page:
  - `workflow_run` only triggers if the workflow file exists on the default branch.
  - It fires whatever the triggering run's conclusion was, so gate on `github.event.workflow_run.conclusion`.
  - Chains are limited to three levels.
- `workflow_run` is not covered by the new `pull_request_target` default block. It is covered by the checkout guard, but only if you check out fork code, which this pattern does not do. Source: the same securely-using-pull_request_target page and the checkout `action.yml`.
- Security Lab's guidance: treat artifact contents as untrusted. Reading a number or Markdown is fine; running binaries from the artifact is not. https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
- **For this action:** the diff Markdown in the artifact is attacker-influenced. Post it as a comment body only, never interpolate it into `${{ }}` expressions or shell. Security Lab covers untrusted input here: https://securitylab.github.com/resources/github-actions-untrusted-input/

## 4. The sticky comment pattern

- **Hidden marker:**
  - marocchino appends `<!-- Sticky Pull Request Comment${header} -->` to the body. https://github.com/marocchino/sticky-pull-request-comment/blob/main/src/comment.ts
  - thollander appends `<!-- thollander/actions-comment-pull-request "${commentTag}" -->`. https://github.com/thollander/actions-comment-pull-request/blob/main/src/main.ts
  - GitHub-flavoured Markdown does not render HTML comments, so the marker is invisible. This rendering detail is **UNVERIFIED** against a GitHub doc page, but both actions rely on it.
- **Finding the comment:**
  - thollander uses REST `octokit.paginate.iterator(issues.listComments)` and matches on `body.includes(marker)`. It does **not** check the author.
  - marocchino uses GraphQL `pullRequest.comments(first: 100, after:)` and matches marker **and** `author.login === viewer.login` (with `[bot]` stripped) **and** `!isMinimized`.
  - Recommendation: match on the author too, so a user who pastes the marker cannot hijack the comment slot. That rationale is inferred, not documented.
  - Sources: the same two source files.
- **List endpoint pagination:** `GET /repos/{owner}/{repo}/issues/{issue_number}/comments` accepts `per_page` (default 30, max 100), `page`, and `since`. Results are ordered by ascending ID. https://docs.github.com/en/rest/issues/comments#list-issue-comments . Follow the `Link` header's `rel="next"`: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
- **Update vs create:** `PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}` with `body`, or `POST .../issues/{issue_number}/comments` if none is found. https://docs.github.com/en/rest/issues/comments
- **Rate limits:**
  - Create "triggers notifications. Creating content too quickly using this endpoint may result in secondary rate limiting." https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
  - Secondary limit: "no more than 80 content-generating requests per minute and no more than 500... per hour". https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
  - `GITHUB_TOKEN` primary limit: 1,000 requests/hour per repository (15,000 on GHEC). https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-github_token-in-github-actions
  - Updating in place avoids a new notification each run. marocchino also offers `skip_unchanged` to skip the PATCH when the body is identical.
- **Body size limit:**
  - The REST reference does **not** document a maximum body length. https://docs.github.com/en/rest/issues/comments
  - The commonly observed limit is 65,536 characters. Exceeding it returns HTTP 422 with "Body is too long (maximum is 65536 characters)". Whether this counts characters or bytes is disputed. **UNVERIFIED** (secondary sources only: https://golang.org/issue/45998 and https://github.com/dead-claudia/github-limits).
  - Recommendation: truncate well below 65,536 (for example about 60,000, leaving room for the marker and a footer), add a "truncated, see job summary" link, and put the full output in `GITHUB_STEP_SUMMARY` (1 MiB per step, see §6).
  - Neither marocchino nor thollander truncates (confirmed in their source).

## 5. Identity

- Comments made with `GITHUB_TOKEN` are authored by `github-actions[bot]` (user id 41898282, type `Bot`, app https://github.com/apps/github-actions). Verified via `GET https://api.github.com/users/github-actions%5Bbot%5D`.
- "The `GITHUB_TOKEN` secret is a GitHub App installation access token", so it acts as GitHub's own Actions app, not as your action. https://docs.github.com/en/actions/concepts/security/github_token
- **Custom name or avatar without a GitHub App:** not possible with `GITHUB_TOKEN`. A PAT would post as that **user**. No primary doc states "impossible" explicitly; this is inferred from the token being an installation token of the `github-actions` app.
- **A GitHub App would require:**
  - each user (or you, as a public App) to register or install an App;
  - storing its private key as a secret;
  - minting an installation token in the workflow, for example with `actions/create-github-app-token`.
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/making-authenticated-api-requests-with-a-github-app-in-a-github-actions-workflow
- The trade-off: secrets are not available on fork `pull_request` runs, so an App token does **not** fix the fork problem by itself. You would still need `workflow_run`. In return, an App gives its own bot identity and avatar, and its rate limit scales with installation size. https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app

## 6. Alternatives to a PR comment

| Mechanism | Permission | Works on fork `pull_request`? | Notes / source |
| --- | --- | --- | --- |
| Job summary (`GITHUB_STEP_SUMMARY`) | None (it is a file written on the runner) | Yes. No token is needed, so the read-only downgrade does not matter (inferred). | GFM supported. 1 MiB per step; over that, the upload fails with an error annotation. Max 20 step summaries shown per job. Visible on the run summary page, not in the PR conversation. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary |
| Workflow-command annotations (`::warning file=...::`) | None | Yes (inferred: no API call by the action) | Attached to files and lines, and shown in the PR "Files changed" tab. GitHub Actions limits them to "10 warning annotations and 10 error annotations per step". https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands and https://docs.github.com/en/rest/checks/runs |
| Check run via Checks API, with `output.summary` and annotations | `checks: write`. "Write permission for the REST API to interact with checks is only available to GitHub Apps" (`GITHUB_TOKEN` qualifies). | **No.** Write scopes are downgraded to read on fork PRs (general rule in §3). Use `workflow_run` instead. | `output.summary` and `output.text` max 65,535 characters each. 50 annotations per request (send more via update). Tied to a `head_sha`. https://docs.github.com/en/rest/checks/runs |
| PR review comments (inline on the diff) | `pull-requests: write` (**UNVERIFIED**: exact scope not checked in the App permission table) | **No** (same downgrade) | Comments "made on a portion of the unified diff". They need `commit_id`, `path` and `body`, plus `line` unless `subject_type: file`. That suits per-field breaking changes but not one summary. https://docs.github.com/en/rest/pulls/comments |

Recommendation implied by the table: always write the job summary (free, works on forks), and post the sticky comment when the token can write. On a 403, degrade gracefully with a warning that points to the summary, and do not fail the job. The graceful-degradation behaviour is a design suggestion, not a sourced fact.

## 7. Minimal `on:` trigger recommendations

- With no `types`, `pull_request` runs on `opened`, `synchronize` and `reopened`. "By default, a workflow only runs when a `pull_request` event's activity type is `opened`, `synchronize`, or `reopened`." So `types: [opened, synchronize, reopened]` is equivalent to the default, and listing it only makes the intent explicit. https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request
- Path filter semantics:
  - "If at least one path matches a pattern in the `paths` filter, the workflow runs."
  - With both `branches` and `paths`, both must match.
  - PRs use three-dot diffs.
  - If the diff has more than 3,000 files and the matching files are not in the first 3,000, the workflow does **not** run.
  https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore
- Caveat (inferred): with a `paths` filter, if a later push removes the schema change, the workflow does not run and the old sticky comment goes stale. The same happens when the schema is generated from code and not committed. Consider also including the generator inputs, or skipping `paths`.
- Suggested README snippet (same-repo PRs):

  ```yaml
  on:
    pull_request:
      types: [opened, synchronize, reopened]
      paths:
        - 'schema.graphql'          # adjust to the schema path(s)
  permissions:
    contents: read
    pull-requests: write
  ```

- For fork PRs on public repos, document the two-workflow variant (§3). Do **not** recommend `pull_request_target` with a checkout of the PR head. The new default policy will also block `pull_request_target` on public repos.
