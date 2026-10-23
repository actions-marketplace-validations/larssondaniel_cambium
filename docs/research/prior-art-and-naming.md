# Prior art and naming research

Researched 2026-10-23 against primary sources (GitHub API via `gh`, GitHub Marketplace search pages, the npm registry via `npm view`, and the tools' own docs). Every claim has a URL. Anything I could not confirm is marked **UNVERIFIED**.

## TL;DR

1. **No maintained, registry-free tool posts a readable schema diff as a PR comment.** The incumbent, GraphQL Inspector's Action, reports through a **Check Run summary plus inline annotations**, not a comment.
2. GraphQL Inspector (MIT, ~1.8k stars, released 2026-10-20) is the default choice. Its check title is "Something is wrong with your schema." or "Everything looks good", and the summary is just counts.
3. The Inspector **GitHub App is deprecated** and no longer available. The Action replaces it.
4. Apollo (Rover + GraphOS) and Hive (`hive schema:check --github`) both need a **registry/account**. Both report a GitHub check that links back to their web UI, not an in-PR diff.
5. `graphql-schema-diff` on npm is by **Fabian Schneider (fabsrc)**, not Andrei Kashcha. It is MIT, and its last release was 3.0.0 in Aug 2024. It is a CLI/library and has no PR integration.
6. `graphql-schema-linter` is lint-only, and its last commit was 2022-05-21. StepZen/IBM has **no** schema-diff Action in the stepzen-dev org.
7. The Marketplace long tail (felamaslen, Inspector forks, federated wrapper) consists of 0-star, annotation-only or stale actions.
8. **Graft: hard collision.** A Marketplace "Graft Pack" action from a repo named `graft` packages git diffs in CI, and npm `graft` is taken.
9. **Understory: soft collision.** npm `understory` is taken, and an active 341-star AI-memory dev tool uses the name. **Treering: clear** for dev tooling, with a soft trademark note: Treering is a school-yearbook company.
10. Two extra clear names: **Lignin** (all npm variants free, no Marketplace hits) and **Cambium** (Marketplace clear; npm bare name held by a 2019 placeholder).

---

## JOB A: Prior art survey

### A1. GraphQL Inspector: GitHub Action (`@graphql-inspector/action`)

- **Repo:** https://github.com/graphql-hive/graphql-inspector. `kamilkisiela/graphql-inspector` redirects here. The `gh api repos/kamilkisiela/graphql-inspector` call resolves to `graphql-hive/graphql-inspector`.
- **Maintenance:** last push 2026-10-20. The latest release is "October 20, 2026" (https://github.com/graphql-hive/graphql-inspector/releases). Stars: ~1,767. There are 132 open issues.
- **License:** MIT (https://github.com/graphql-hive/graphql-inspector/blob/master/packages/action/LICENSE).
- **npm:** `@graphql-inspector/action` 6.2.2 and `@graphql-inspector/cli` 7.0.2, published by Kamil Kisiela with The Guild maintainers (https://www.npmjs.com/package/@graphql-inspector/action, https://www.npmjs.com/package/@graphql-inspector/cli).
- **Marketplace:** https://github.com/marketplace/actions/graphql-inspector
- **What it does:** diffs the PR schema against a git ref (`schema: 'master:schema.graphql'`) or a live endpoint. It classifies each change as Breaking, Dangerous or Safe. It supports rules such as `considerUsage`, and an `approve-label` (default `approved-breaking-change`) that forces the check to pass. Source: https://github.com/graphql-hive/graphql-inspector/blob/master/action.yml
- **PR comment?** **No.** It calls `octokit.rest.checks.create` and updates the Check Run with `output: { title, summary, annotations }` (https://github.com/graphql-hive/graphql-inspector/blob/master/packages/action/src/run.ts). The docs list check runs, annotations and step outputs, and do not mention comments (https://the-guild.dev/graphql/inspector/docs/products/action).
- **Output format:**
  - Check title: `'Something is wrong with your schema.'` on failure, `'Everything looks good'` otherwise (run.ts, around line 239).
  - Summary (`createSummary`, https://github.com/graphql-hive/graphql-inspector/blob/master/packages/action/src/utils.ts):
    ```
    # Found N changes

    Breaking: x
    Dangerous: y
    Safe: z
    ```
    The summary is followed by change lists, capped at 100. Past the cap, the summary says "Total amount of changes (…) is over the limit (100)".
  - Per-change inline annotations on the `.graphql` file. Severity is filterable with `annotation-level`.
- **Backend needed?** No. It runs on git plus the GitHub Checks API.
- **Known friction:**
  - The action needs `checks: write` and also `pull-requests: read`. The error "Resource not accessible by integration" has been open since 2023-12, and in that thread users had to work out the minimum permissions themselves (https://github.com/graphql-hive/graphql-inspector/issues/2672).
  - A request to make the bypass label discoverable is open (https://github.com/graphql-hive/graphql-inspector/issues/2656).
  - Several diff-accuracy bugs are open, for example #2644 (default values) and #2847 (deprecations).
  - Fork PRs: a read-only `GITHUB_TOKEN` on forked PRs cannot create Check Runs, so annotation/check-based reporting breaks there. **UNVERIFIED** in this session: the GitHub docs pages I fetched (https://docs.github.com/en/actions/concepts/security/github_token) did not state the fork rule explicitly.
- **Unofficial copies on Marketplace:** two forks, https://github.com/marketplace/actions/forked-graphql-inspector-without-checks and https://github.com/marketplace/actions/graphql-inspector-fork-bf. They exist mainly to avoid the Checks API. Their existence is evidence of demand for a non-Checks mode. The forks' source repos are **UNVERIFIED**.

### A2. GraphQL Inspector: GitHub App

- Deprecated and "no longer available". The CLI and Action are recommended instead (https://the-guild.dev/graphql/inspector/docs/products/github).
- While it ran, it was a Probot app (`@graphql-inspector/github` 4.0.1, MIT, https://www.npmjs.com/package/@graphql-inspector/github). It produced the same check summary and annotations, with no PR comment. It was free and could be self-hosted.
- There is a migration guide: https://the-guild.dev/graphql/inspector/docs/migration-guides/from-app-to-action

### A3. Apollo Rover `graph check` / `subgraph check` + GraphOS schema checks

- **Repo:** https://github.com/apollographql/rover. Last push 2026-10-23; latest release v1.0.1 on 2026-10-21 (https://github.com/apollographql/rover/releases). ~456 stars.
- **License:** mixed. Per the repo LICENSE, "an MIT compatible license or … the Elastic License 2.0" depending on subdirectory, with MIT-compatible as the default (https://github.com/apollographql/rover/blob/main/LICENSE). GitHub reports `NOASSERTION`.
- **What it does:** runs build checks, operations checks against historical client traffic, and linter checks in GraphOS. Custom, proposals and contract checks are Enterprise-only (https://www.apollographql.com/docs/graphos/platform/schema-management/checks).
- **PR comment?** No, at least not from the GitHub integration. A GraphOS webhook sets "pass/fail status checks on your pull requests", and the check's **Details** link opens the GraphOS Studio page. For non-GitHub VCS, Apollo suggests you script a PR comment yourself (https://www.apollographql.com/docs/graphos/platform/schema-management/checks/run). Whether the check body includes the diff is **UNVERIFIED**.
- **Backend needed?** Yes. You need a GraphOS account and graph, and results live in Studio.

### A4. GraphQL Hive schema checks (`@graphql-hive/cli`)

- **Repo:** https://github.com/graphql-hive/console. MIT, last push 2026-10-23, ~483 stars. CLI `@graphql-hive/cli` 0.68.1 (https://www.npmjs.com/package/@graphql-hive/cli).
- **What it does:** `hive schema:check` compares the schema against the registry. It supports `--baseline` for merge queues.
- **PR comment?** No. With `--github`, results are reported "as Check Suite". This requires the Hive GitHub Integration and repo access in project settings (https://the-guild.dev/graphql/hive/docs/other-integrations/ci-cd). The exact check body format is **UNVERIFIED**.
- **Backend needed?** Yes. It needs Hive Cloud or a self-hosted registry (`HIVE_REGISTRY`), an access token and a target.

### A5. `graphql-schema-diff` (npm)

- **Author: Fabian Schneider (`fabsrc`)**, not Andrei Kashcha (https://www.npmjs.com/package/graphql-schema-diff, repo https://github.com/fabsrc/graphql-schema-diff).
- **What it does:** a CLI/library that "Returns the diff of two GraphQL schemas. Detects dangerous and breaking changes." It can output an HTML diff.
- **PR comment?** No. It has no GitHub integration.
- **Backend needed?** No.
- **Maintenance:** last release 3.0.0 on 2024-08-18; last commit 2024-08-27 (a dependency bump). 68 stars.
- **License:** MIT.
- **Related project:** https://github.com/Ambro17/graphql-schema-diff (Python `schemadiff`, GPL-3.0, last push 2025-11-29, 45 stars). It is a CLI only.

### A6. `graphql-schema-linter`

- **Repo:** https://github.com/cjoudrey/graphql-schema-linter. MIT, ~703 stars. npm 3.0.1 (https://www.npmjs.com/package/graphql-schema-linter).
- **What it does:** lints a single schema against rules such as descriptions, naming and Relay connections. It does **not diff**. It has a `--format` option for text/json-style output (README).
- **PR comment?** No.
- **Backend needed?** No.
- **Maintenance:** last commit 2022-05-21 (https://github.com/cjoudrey/graphql-schema-linter/commits). The repo's `pushed_at` is 2026-10-22, probably bot branches; that cause is **UNVERIFIED**. Treat it as dormant.

### A7. StepZen / IBM API Connect for GraphQL

- The stepzen-dev org contains `stepzen-login` ("github action for logging into a stepzen server"), `stepzen-install`, `gqltest` and others. None of them diffs schemas (https://github.com/orgs/stepzen-dev/repositories).
- I found no IBM- or StepZen-published schema-check Action or PR comment feature. IBM's product page is marketing only (https://www.ibm.com/forms/mkt-demo-automatestepzen). **UNVERIFIED** that none exists outside GitHub.

### A8. Other Marketplace results ("graphql schema", "graphql", "graphql breaking", "graphql comment")

Search: https://github.com/marketplace?type=actions&query=graphql+schema

| Action | Source | What / output | PR comment? | Backend | Last push | License |
|---|---|---|---|---|---|---|
| Detect Breaking GraphQL Changes (https://github.com/marketplace/actions/detect-breaking-graphql-changes) | https://github.com/felamaslen/detect-breaking-graphql-changes | graphql-js breaking/dangerous detection. Emits `core.error` / `core.warning` workflow annotations and fails on breaking changes | No | No | 2026-07-20 | MIT (package.json); 0 stars |
| Graphql Inspector Federated Schemas Action (https://github.com/marketplace/actions/graphql-inspector-federated-schemas-action) | https://github.com/mohammedtigrini1/federated-graphql-inspector-action | Concatenates subgraph schemas, then runs Inspector | No (Inspector checks) | No | 2022-09-20 | none declared |
| Nitro Schema Validate (https://github.com/marketplace/actions/nitro-schema-validate) | https://github.com/ChilliCream/nitro-schema-validate | Validates against ChilliCream's Nitro registry | **UNVERIFIED** | Yes (Nitro) | 2026-10-23 | MIT |
| GraphQL Painkiller PR Review (https://github.com/marketplace/actions/graphql-painkiller-pr-review) | https://github.com/olddognewflex/GraphQL-PainKiller | Static analysis of *queries* (N+1, over-fetching), not schema diffs | **Yes**, as PR review comments (README shows "PR comment example") | No | 2026-06-16 | Apache-2.0; 0 stars |
| Genesis Release Guardian (https://github.com/marketplace/actions/genesis-release-guardian) | https://github.com/genesiscode2026/genesis-release-guardian | Multi-format breaking-change gate with "x402 pay-per-call" on Base USDC | **UNVERIFIED** | Yes (paid API) | 2026-09-27 | MIT |
| GraphQL Schema Merge, GraphQL Pluck, Convert Introspection, Lint GraphQL Operation Files | Marketplace listing | Adjacent utilities, not diffs | n/a | n/a | n/a | n/a |

A search for "graphql diff" returned **zero** Marketplace actions.

### A9. Assessment: what a new standalone action must do better

1. **Post a real PR comment, updated in place.** The diff should live where reviewers already read. The incumbent's verdict sits behind a Checks tab and only gives counts.
2. **Show the diff itself:** grouped Breaking / Dangerous / Safe with the SDL before and after. "Breaking: 2" is not enough.
3. **Work on fork PRs and with minimal permissions.** Inspector's `checks: write` dependency and #2672 show that this is a real pain point.
4. **Need zero backend.** That is the gap Apollo and Hive leave, since they are registry-first by design.
5. **Be exactly right on edge cases** where Inspector has open bugs: default values, deprecations, and directive changes.
6. **Make the escape hatch obvious.** Name the approve label inside the comment, which fixes #2656.
7. **Stay quiet on no-op PRs.** Do not post a comment when there is no schema change, and edit or delete a stale comment.
8. **Accept any schema source:** file, glob, multiple files, or introspection from a running server built in CI.
9. **Ship one `uses:` line with sane defaults.** Two Inspector forks exist just to drop Checks, so people want a simpler mode.
10. **The honest risk:** if a new action is only "Inspector, but as a comment", Inspector could add a comment mode and erase the advantage. The comment's readability and the fork/permissions story must be distinctly better.

---

## JOB B: Name collision check

Method: Marketplace search (`https://github.com/marketplace?type=actions&query=<name>`), `npm view` for `<name>`, `graphql-<name>` and `<name>-action`, `gh search repos` (by stars, and with "graphql" / "action"), and `gh api users/<name>`.

### Graft: **HARD collision**

- **Marketplace:** two hits.
  - "Graft Pack" (https://github.com/marketplace/actions/graft-pack) from https://github.com/YhaliWaizman/graft, "an offline CLI for packaging Git diffs". It is a CI/git-diff tool.
  - "regraft" (https://github.com/marketplace/actions/regraft, https://github.com/achedon12/regraft), which keeps template repos in sync.
- **npm:** `graft` is taken ("Full-Stack JavaScript Through Microservices", GraftJS, https://www.npmjs.com/package/graft). `graphql-graft` and `graft-action` are free.
- **GitHub:**
  - https://github.com/orbitinghail/graft: transactional storage engine, ~1.6k stars, active.
  - https://github.com/grft-dev/graftcode: integration tool, ~900 stars.
  - https://github.com/nats-io/graft: RAFT implementation in Go.
  - The user `graft` exists (https://github.com/graft).
  - "graft" is also git terminology for grafts and replace refs. **UNVERIFIED** link not fetched.
- **Reasoning:** Graft has a same-domain Marketplace action (git diffs in CI), several well-starred dev tools, and an existing git term. It would be confusing and hard to search for.

### Understory: **SOFT collision**

- **Marketplace:** no results (https://github.com/marketplace?type=actions&query=understory).
- **npm:** `understory` is taken (lodash-fp utilities by Kai Curry, last modified 2023-07, https://www.npmjs.com/package/understory). `graphql-understory` and `understory-action` are free.
- **GitHub:**
  - https://github.com/thecodacus/understory: "memory that grows… for AI agents (MCP…)", 341 stars, pushed 2026-10-15.
  - https://github.com/forest-rs/understory: UI/scene data structures in Rust, 41 stars.
  - https://github.com/RedEagle-dh/understory: dependency auditing dashboard, 2 stars.
  - The user `understory` exists with 2 repos (https://github.com/understory).
  - None of these is GraphQL- or schema-related.
- **Reasoning:** nothing collides in the GraphQL or Actions space. However, an active, growing dev tool uses the exact name, and the bare npm name is taken.

### Treering: **CLEAR** (soft trademark note)

- **Marketplace:** no results.
- **npm:** `treering`, `graphql-treering`, `treering-action` and `tree-ring` are **all free** (all E404).
- **GitHub:**
  - The org https://github.com/TreeRing ("Easy and robust solutions for publishing in a digital world", 1 repo) maps to Treering, a school yearbook company (https://treering.com, page title "Treering: School Yearbooks and Custom Photo Books").
  - "Tree-Ring" is a known AI-image watermarking technique (https://github.com/YuxinWenRick/tree-ring-watermark, 368 stars).
  - The other matches are dendrochronology science repos.
  - Nothing is GraphQL-, schema- or CI-related.
- **Reasoning:** the dev-tool namespace is free. The real company is in a different domain, so this is soft trademark exposure only. Search results would also be crowded by actual tree-ring science.

### Two additional suggestions (tree/branch-themed, short, pronounceable)

1. **Lignin** ("LIG-nin"), the polymer that gives wood its structure, a nice fit for "schema".
   - npm `lignin`, `graphql-lignin` and `lignin-action` are all free (E404).
   - No Marketplace hits.
   - The GitHub user `lignin` exists with 0 public repos (https://github.com/lignin). The only repos using the name are chemistry research.
   - Verdict: **clear**.
2. **Cambium** ("CAM-bee-um"), the growth layer under the bark where each new ring is laid down. It is the exact metaphor for "what this PR adds to the schema", and pairs naturally with Canopy.
   - No Marketplace hits (https://github.com/marketplace?type=actions&query=cambium).
   - `graphql-cambium` and `cambium-action` are free. The bare npm `cambium` is held by a 1.0.0 placeholder ("cambium", created 2019, last modified 2022, https://www.npmjs.com/package/cambium).
   - GitHub hits are unrelated: KimGLee/Cambium (LLM governance, 611 stars) and a Clojure logging lib. The org `Cambium` exists with 0 public repos.
   - Verdict: **clear for Marketplace/action use**, soft on bare npm.

Considered and rejected:
- **Scion**: GoogleCloudPlatform/scion has 2k stars, and there is SCION networking and a git-for-agents tool. Hard.
- **Heartwood**: Radicle's git-based stack. Soft to hard.
- **Sprig**: Masterminds/sprig has 4.7k stars, plus hackclub/sprig. Hard.
- **Bough**: npm React tree component, and nickelsec/bough. Soft.
- **Burl**: tj/burl and tomnomnom/burl are curl wrappers. Soft.
- **Xylem** and **Pith**: npm placeholders and minor repos. Soft.
