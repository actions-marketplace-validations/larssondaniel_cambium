---
status: accepted
---

# The base schema is read at the merge-base, not the target branch tip

The pull request payload offers `base.sha`, the tip of the target branch at event time. We instead resolve the merge-base with the compare API and read the base schema there, so the diff covers only what the PR itself changed. This matches GitHub's own Files tab (three-dot diff).

## Considered Options

- **Merge-base to head (chosen).** If `main` gains `Query.invoices` after the PR branched, the comment does not accuse the PR of removing it. One extra API call.
- **Target branch tip to head.** Simplest, and wrong whenever the target branch moves. Reviewers would learn to distrust the comment on the first stale PR.
- **Target branch tip to merge commit (`refs/pull/N/merge`).** Answers "what will the schema be after merge", but the merge ref is absent when the PR conflicts and GitHub computes it lazily, so it is the most fragile.

## Consequences

- A PR that is behind its target branch still gets an accurate comment. Changes that only land through the merge itself are out of scope by design.
