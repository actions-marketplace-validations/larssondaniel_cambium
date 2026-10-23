# Building a TypeScript GitHub Action on the Actions toolkit (research, 2026-10-23)

Sources are primary only: docs.github.com, the GitHub Changelog (github.blog/changelog, GitHub's own announcements), github.com/actions/toolkit, github.com/actions/typescript-action, github.com/github/local-action, github.com/actions/checkout, and npm registry metadata (`npm view`). Anything not traced to one of these is marked **UNVERIFIED**.

## TL;DR

1. Use `runs.using: node24`. Node 20 is gone from GitHub-hosted runners as of 2026-09-23 and the opt-out was removed ([changelog](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/)).
2. Current majors: `@actions/core` 3.x, `@actions/github` 9.x, `@actions/exec` 3.x, `@actions/glob` 0.7.x. All of them are **ESM-only** now ([core RELEASES](https://github.com/actions/toolkit/blob/main/packages/core/RELEASES.md), [github RELEASES](https://github.com/actions/toolkit/blob/main/packages/github/RELEASES.md)).
3. The `actions/typescript-action` template bundles with **Rollup** to a single ESM `dist/index.js`, not ncc or esbuild ([rollup.config.ts](https://github.com/actions/typescript-action/blob/main/rollup.config.ts)).
4. `dist/` is committed. A `check-dist` workflow fails CI when the committed bundle drifts from a fresh build ([check-dist.yml](https://github.com/actions/typescript-action/blob/main/.github/workflows/check-dist.yml)).
5. The template tests with **Jest 30 + ts-jest in ESM mode**. It mocks `@actions/core` with `jest.unstable_mockModule` plus a `__fixtures__/core.ts` file of `jest.fn()`s, then imports the module under test dynamically ([main.test.ts](https://github.com/actions/typescript-action/blob/main/__tests__/main.test.ts)).
6. Run locally with `npx @github/local-action . src/main.ts .env` (v7.0.1). It runs **non-transpiled `src/`** code only, and its stub table lists older toolkit versions (core 2.0.2, github 7.0.0) ([README](https://github.com/github/local-action)).
7. Get the PR from `github.context.payload.pull_request` (`.base.sha`, `.base.ref`, `.head.sha`, `.head.ref`) and the client from `github.getOctokit(core.getInput('token'))`. On `pull_request`, `GITHUB_SHA` is the merge commit, not the head commit ([events doc](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
8. You can read the base-ref file without checking it out: `octokit.rest.repos.getContent({owner, repo, path, ref: baseSha})`. The default JSON response is supported up to 1 MB. From 1 to 100 MB only the `raw`/`object` media types work, and `object` returns an empty `content` with `encoding: "none"`. Above 100 MB the endpoint is unsupported ([contents API](https://docs.github.com/en/rest/repos/contents)).
9. Branding colors are limited to `white, black, yellow, blue, green, orange, red, purple, gray-dark`. Icons come from Feather v4.28.0, minus brand icons and 13 named exclusions ([metadata syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)).
10. Fail with `core.setFailed(msg)`, which logs the message and sets a failing exit code. Set outputs with `core.setOutput`. Write the summary with `core.summary.*` and then `.write()`. Each step's summary is capped at 1 MiB, and at most 20 step summaries are shown per job ([core README](https://github.com/actions/toolkit/blob/main/packages/core/README.md), [workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)).

---

## 1. Packages in `actions/toolkit`

The `packages/` directory of [actions/toolkit](https://github.com/actions/toolkit/tree/main/packages) contains: `artifact, attest, cache, core, exec, github, glob, http-client, io, tool-cache`. The descriptions below are paraphrased from the [toolkit README](https://github.com/actions/toolkit#packages). Versions are npm `latest` as of 2026-10-23 (`npm view <pkg> version`, [npmjs.com](https://www.npmjs.com/package/@actions/core)).

| Package | npm latest | What it does |
|---|---|---|
| `@actions/core` | 3.0.1 | Inputs, outputs, results, logging, secrets, variables, job summary |
| `@actions/github` | 9.1.1 | An Octokit client hydrated with the run context (`context`, `getOctokit`) |
| `@actions/exec` | 3.0.0 | Runs CLI tools and processes their output |
| `@actions/glob` | 0.7.0 | Finds files that match glob patterns |
| `@actions/io` | 3.0.2 | Disk I/O such as cp, mv, rmRF, which |
| `@actions/http-client` | 4.0.1 | A lightweight HTTP client |
| `@actions/tool-cache` | 4.0.0 | Downloads and caches tools (used by setup-* actions) |
| `@actions/cache` | 6.3.0 | Caches dependencies and build outputs |
| `@actions/artifact` | 6.3.1 | Works with Actions artifacts |
| `@actions/attest` | 3.2.0 | Writes attestations for workflow artifacts |

Notes:
- **ESM-only.** `@actions/core` 3.0.0 says "Package is now ESM-only - CommonJS consumers must use dynamic `import()`" ([core RELEASES](https://github.com/actions/toolkit/blob/main/packages/core/RELEASES.md)). `@actions/github` 9.0.0 ([github RELEASES](https://github.com/actions/toolkit/blob/main/packages/github/RELEASES.md)), `@actions/exec` 3.0.0 ([exec RELEASES](https://github.com/actions/toolkit/blob/main/packages/exec/RELEASES.md)) and `@actions/glob` 0.6.0 ([glob RELEASES](https://github.com/actions/toolkit/blob/main/packages/glob/RELEASES.md)) say the same. Each `package.json` has `"type": "module"`.
- Node 24 support arrived in core 2.0.0 and exec 2.0.0 ([core RELEASES](https://github.com/actions/toolkit/blob/main/packages/core/RELEASES.md)).
- The repo's `packages/core/package.json` already says **3.1.0**, which adds `core.declareArtifact`. npm `latest` is still 3.0.1 (published 2026-04-21), so 3.1.0 is not released on npm yet ([core RELEASES](https://github.com/actions/toolkit/blob/main/packages/core/RELEASES.md); `npm view @actions/core dist-tags`).
- `@actions/github` 9.x depends on `@octokit/core` ^7, `plugin-rest-endpoint-methods` ^17 and `plugin-paginate-rest` ^14 ([packages/github/package.json](https://github.com/actions/toolkit/blob/main/packages/github/package.json)).
- The toolkit README says the repo is "not taking contributions" but still receives security updates and fixes for major breaking changes ([toolkit README, Note](https://github.com/actions/toolkit#note)).

## 2. Project layout from `actions/typescript-action`

Sources: [template repo](https://github.com/actions/typescript-action) (last commit on main 2026-05-09), [package.json](https://github.com/actions/typescript-action/blob/main/package.json).

- **Layout:** `src/index.ts` (entry, calls `run()`), `src/main.ts` (logic), `__tests__/`, `__fixtures__/`, `dist/`, `action.yml`, `rollup.config.ts`, `jest.config.js`, `.node-version` (`24.4.0`), `.env.example`, `eslint.config.mjs`, `.licensed.yml`, `script/` ([repo tree](https://github.com/actions/typescript-action)).
- **package.json:** `"type": "module"`, `"engines": {"node": ">=24.0.0"}`. The only runtime dependency is `@actions/core ^3.0.0`. Dev dependencies include `rollup ^4.57`, `@rollup/plugin-typescript`, `plugin-node-resolve`, `plugin-commonjs`, `jest ^30.2`, `ts-jest`, `typescript ^5.9`, `@github/local-action ^7.0.1` ([package.json](https://github.com/actions/typescript-action/blob/main/package.json)).
- **Bundler: Rollup.** The `package` script is `rollup --config rollup.config.ts --configPlugin @rollup/plugin-typescript`. The config takes `input: src/index.ts` and writes `dist/index.js` with `format: 'es'` and `sourcemap: true`, using the typescript, nodeResolve({preferBuiltins:true}) and commonjs plugins ([rollup.config.ts](https://github.com/actions/typescript-action/blob/main/rollup.config.ts)). The template does not use ncc or esbuild. The docs tutorial names "rollup.js" and "@vercel/ncc" as acceptable bundlers and does not mention esbuild ([Create a JavaScript action](https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action)). The `@actions/github` README says "most bundlers like esbuild, webpack, and rollup handle ESM imports automatically" ([github README](https://github.com/actions/toolkit/blob/main/packages/github/README.md)).
- **dist/ must be committed.** The check-dist workflow comment says `dist/index.js` "is the code that will be run" when the action is referenced with `uses:`. The workflow rebuilds and fails if the committed `dist/` differs ([check-dist.yml](https://github.com/actions/typescript-action/blob/main/.github/workflows/check-dist.yml)). `.gitattributes` marks `dist/** -diff linguist-generated=true` ([.gitattributes](https://github.com/actions/typescript-action/blob/main/.gitattributes)). The docs say checking in `node_modules` "can cause problems" and recommend bundling. The docs example commits `dist/index.js` and tags `v1.1` ([Create a JavaScript action](https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action)). The README says `npm run bundle` / `npm run all` "is important!" or "your action will not work correctly" ([template README](https://github.com/actions/typescript-action#readme)).
- **runs.using:** the template's `action.yml` sets `runs: using: node24, main: dist/index.js` ([action.yml](https://github.com/actions/typescript-action/blob/main/action.yml)). The metadata syntax lists only `node20` and `node24` as JavaScript runtimes ([metadata syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)).
- **Node runtime deprecation timeline** ([2025-09-19 changelog](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/), [2026-09-23 changelog](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/)):
  - Node 20 reached EOL in April 2026.
  - From 2026-06-16, runners used Node 24 by default. `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` was a temporary opt-out, and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` let you test early. The dates moved several times; see the editor's notes in the changelog.
  - Node 20 was removed on 2026-09-23. The opt-out "is no longer available." Node 24 is incompatible with macOS 13.4 and earlier and does not officially support ARM32.
  - Neither post says whether an action that still declares `node20` fails or is silently run on Node 24. **UNVERIFIED.**
  - No Node 26 runtime is announced. **UNVERIFIED / none found.**
  - The metadata-syntax page still lists `node20` as a value with no deprecation note, which conflicts with the changelog. Treat `node24` as the only safe value.
- The template's own CI uses `actions/checkout@v6` and `actions/setup-node@v6` ([check-dist.yml](https://github.com/actions/typescript-action/blob/main/.github/workflows/check-dist.yml)). The latest `actions/checkout` release is v7.0.1 (2026-07-20) ([releases](https://github.com/actions/checkout/releases)).

## 3. PR context and authenticated Octokit (`@actions/github`)

- **Context source:** `Context` loads `payload` by JSON-parsing the file at `GITHUB_EVENT_PATH`. It also exposes `eventName, sha, ref, refName, repo {owner, repo}, issue {owner, repo, number}, apiUrl, serverUrl, graphqlUrl` ([context.ts](https://github.com/actions/toolkit/blob/main/packages/github/src/context.ts)). `context.issue.number` falls back to `payload.pull_request.number`.
- **Typing:** `WebhookPayload.pull_request` is typed only as `{ [key: string]: any; number; html_url?; body? }` ([interfaces.ts](https://github.com/actions/toolkit/blob/main/packages/github/src/interfaces.ts)), so `base`/`head` are `any`. The README suggests casting to types from `@octokit/webhooks-definitions` ([github README](https://github.com/actions/toolkit/blob/main/packages/github/README.md)). That package's current maintenance status is **UNVERIFIED**; `@octokit/webhooks-types` may be the successor (**UNVERIFIED**).
- **base/head fields:** the REST pull-request schema has required `base` and `head` objects, each with `label, ref, repo, sha, user` ([Get a pull request](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request)). The webhook payload's `pull_request` uses the same object. **UNVERIFIED** from the webhook docs page, which does not expand the sub-schema. `head.repo` can be null for a deleted fork in practice (**UNVERIFIED**; the REST schema does not mark it nullable).
- **SHA semantics:** on `pull_request`, `GITHUB_SHA` (= `context.sha`) is the "last merge commit" of `refs/pull/N/merge`, not the head commit. Use `github.event.pull_request.head.sha` for the head commit. On `pull_request_target`, `GITHUB_SHA` is the last commit on the default branch ([events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
- **Fork PRs:** "The `GITHUB_TOKEN` has read-only permissions in pull requests from forked repositories" ([events doc](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). Read access is enough for `getContent`. Posting PR comments from fork PRs will fail on `pull_request`.
- **Authenticated Octokit:** `const octokit = github.getOctokit(core.getInput('token'))`. You can pass options such as `{userAgent}` as the second argument. The client follows proxy settings and sets GHES base URLs. Use `octokit.rest.*` for REST and `octokit.graphql(query, vars)` for GraphQL ([github README](https://github.com/actions/toolkit/blob/main/packages/github/README.md)). A common pattern is an input `token` with `default: ${{ github.token }}` in action.yml. That pattern is **UNVERIFIED** here; it is not in the template.

```ts
import * as core from '@actions/core'
import * as github from '@actions/github'
const octokit = github.getOctokit(core.getInput('token', { required: true }))
const pr = github.context.payload.pull_request // undefined on non-PR events
const baseSha: string = pr?.base.sha, headSha: string = pr?.head.sha
const { owner, repo } = github.context.repo
```

## 4. `action.yml` metadata

From [metadata syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax):
- `inputs.<id>`: `description` (required string), `required` (optional boolean), `default` (string, used when the workflow does not specify the input), `deprecationMessage` (optional, logged as a warning when the input is used).
- `outputs.<id>`: `description` (required). For JavaScript actions there is no `value`; outputs are set at runtime with `core.setOutput`.
- `runs`: `using` (`node20` | `node24`; use node24, see section 2), `main`, and optional `pre`, `pre-if`, `post`, `post-if` (the `-if` keys default to `always()`).
- `branding.color`: "The background color of the badge." Allowed values: **`white`, `black`, `yellow`, `blue`, `green`, `orange`, `red`, `purple`, `gray-dark`**.
- `branding.icon`: "The name of the v4.28.0 [Feather](https://feathericons.com/) icon to use." Brand icons are omitted, as are: `coffee, columns, divide-circle, divide-square, divide, frown, hexagon, key, meh, mouse-pointer, smile, tool, x-octagon`. The docs page has the full allowed list.
- The template ships `branding: {icon: heart, color: red}` ([action.yml](https://github.com/actions/typescript-action/blob/main/action.yml)).

## 5. Testing and local runs

- **Test runner: Jest** (not Vitest). The template uses `jest ^30.2`, `ts-jest`, `ts-jest-resolver` and `@jest/globals`, and runs `NODE_OPTIONS=--experimental-vm-modules npx jest` ([package.json](https://github.com/actions/typescript-action/blob/main/package.json)). In `jest.config.js`: `preset: 'ts-jest'`, `extensionsToTreatAsEsm: ['.ts']`, ts-jest `useESM: true`, `resolver: 'ts-jest-resolver'`, `testEnvironment: 'node'`, coverage on `./src/**` ([jest.config.js](https://github.com/actions/typescript-action/blob/main/jest.config.js)).
- **Mocking `@actions/core`:** `__fixtures__/core.ts` exports `jest.fn<typeof core.X>()` for `debug, error, info, getInput, setOutput, setFailed, warning` ([__fixtures__/core.ts](https://github.com/actions/typescript-action/blob/main/__fixtures__/core.ts)). The test calls `jest.unstable_mockModule('@actions/core', () => core)` *before* `const { run } = await import('../src/main.js')`. The comment says "Mocks should be declared before the module being tested is imported" ([__tests__/main.test.ts](https://github.com/actions/typescript-action/blob/main/__tests__/main.test.ts)). Mocking `@actions/github` and `core.summary` would follow the same pattern; the template has no fixture for either.
- **Local runs: `@github/local-action`** v7.0.1 ([npm](https://www.npmjs.com/package/@github/local-action), [repo](https://github.com/github/local-action)). It stubs the toolkit so `src/` runs directly: `npx @github/local-action . src/main.ts .env` (template script `local-action`). It supports `--pre`/`--post` entrypoints. Inputs go in `.env` as `INPUT_<name>` with hyphens kept, and `GITHUB_EVENT_PATH` etc. can be set there ([.env.example](https://github.com/actions/typescript-action/blob/main/.env.example)). Caveats from its README:
  - It supports "non-transpiled action code only" because it uses `quibble` to override toolkit imports.
  - It is tested on Node 22 and 24.
  - Its README table lists implemented toolkit versions as core `2.0.2`, github `7.0.0`, artifact `5.0.2`, cache `5.0.3`, which is behind core 3 and github 9. Whether its stubs fully cover the ESM-only v3/v9 API is **UNVERIFIED**.

## 6. Reading a file from the PR base ref without a full checkout

**Option A: REST contents API** (no checkout needed). `octokit.rest.repos.getContent({ owner, repo, path, ref: pr.base.sha })`. `ref` is "The name of the commit/branch/tag. Default: the repository's default branch" ([contents API](https://docs.github.com/en/rest/repos/contents)). Size behavior, quoted from that page:
- "1 MB or smaller: All features of this endpoint are supported."
- "Between 1-100 MB: Only the raw or object custom media types are supported... when using the object media type, the content field will be an empty string and the encoding field will be "none"." Use `application/vnd.github.raw+json` to get the bytes.
- "Greater than 100 MB: This endpoint is not supported." Use another method, such as the Git blobs API or a checkout. The blobs API limit is **UNVERIFIED**.
- Directory listings are capped at 1,000 entries; use the Git Trees API beyond that.
- Media types: `raw` (raw file contents), `html`, `object`.
- Requesting raw through Octokit: pass `mediaType: { format: 'raw' }`. The pattern of passing `mediaType.format` is shown in the [github README](https://github.com/actions/toolkit/blob/main/packages/github/README.md) with `format: 'diff'`. With raw, `data` is a string at runtime, but the TypeScript type still says the object union, so a cast is needed (**UNVERIFIED**). The default JSON response returns base64 `content` (**UNVERIFIED**; the docs page excerpt did not state the encoding value).
- A missing file at that ref returns 404. Handle it as "file did not exist on base" (**UNVERIFIED** status-code wording).

**Option B: actions/checkout + git.** By default checkout fetches "a single commit... for the ref/SHA that triggered the workflow". `fetch-depth: 0` fetches all history for all branches and tags. It also supports `ref`, `filter` (partial clone) and `sparse-checkout` ([actions/checkout README](https://github.com/actions/checkout)). On `pull_request` the default checkout is the merge commit. With `fetch-depth: 2` its first parent is normally the base, but that is **UNVERIFIED** as documented. Explicitly `git fetch --depth=1 origin <base.sha>` then `git show <base.sha>:<path>` is standard git (**UNVERIFIED** as a GitHub-documented recipe). This option needs the consumer to configure checkout. Option A does not.

Recommendation implied by the sources: for schema files (typically far below 1 MB), the contents API with `ref: base.sha` needs no workflow coupling. Request the raw media type so 1–100 MB files still work.

## 7. Outputs, job summary, failure

- **Outputs:** `core.setOutput('name', value)` ([core README](https://github.com/actions/toolkit/blob/main/packages/core/README.md)). It writes to `$GITHUB_OUTPUT` ([workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)). The docs page states no size limit for outputs (**UNVERIFIED** limit).
- **Job summary:** `core.summary` is a buffer. It has `addHeading, addRaw, addEOL, addCodeBlock, addList, addTable, addDetails, addImage, addSeparator, addBreak, addQuote, addLink`, plus `stringify, isEmptyBuffer, emptyBuffer, clear`. Content "must be written... via the `core.summary.write()` method", and `write({overwrite: true})` replaces earlier content ([core README](https://github.com/actions/toolkit/blob/main/packages/core/README.md#populating-job-summary)). Limits: "each step is restricted to a maximum size of 1MiB"; "A maximum of 20 job summaries from steps are displayed per job" ([workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)). What happens when the 1 MiB cap is exceeded (truncation or error) is **UNVERIFIED**.
- **Failing:** "You should use this library to set the failing exit code for your action. If status is not set and the script runs to completion, that will lead to a success." `core.setFailed` "logs the message and sets a failing exit code" ([core README, Exit codes](https://github.com/actions/toolkit/blob/main/packages/core/README.md#exit-codes)). The template wraps `run()` in try/catch and calls `core.setFailed(error.message)` ([src/main.ts](https://github.com/actions/typescript-action/blob/main/src/main.ts)). `setFailed` sets `process.exitCode` rather than calling `process.exit` (**UNVERIFIED** from source here), so write the summary before returning.
