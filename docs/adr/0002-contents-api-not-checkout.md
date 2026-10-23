---
status: accepted
---

# Schema files are fetched through the GitHub Contents API, not a checkout

The action reads the base schema and head schema with the Contents API at the relevant commit shas, using the workflow's own token. It does not require, and does not use, `actions/checkout`.

## Considered Options

- **Contents API (chosen).** The workflow is a single `uses:` step. Needs only `contents: read`, which every token has. Works for fork PRs because the head file is read from the fork through the API. The raw media type serves files up to 100 MB, far past any real schema.
- **`actions/checkout` plus `git show <sha>:<path>`.** A default checkout is a depth-1 fetch of the merge commit, so the action would have to fetch the base sha itself, and it would break whenever users customise checkout. Two steps in the README instead of one.

## Consequences

- Two extra API calls per run and a hard dependency on the GitHub API being the source of truth. That dependency already exists for posting the comment.
- The action can never read uncommitted files from the working tree. That is deliberate; see ADR-0001.
