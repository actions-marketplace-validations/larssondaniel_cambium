---
status: accepted
---

# graphql-js defines breaking and dangerous; we only enumerate safe changes

There is no GraphQL Foundation document that lists breaking changes. The closest thing is graphql-js, the Foundation's reference implementation, whose `findBreakingChanges` and `findDangerousChanges` utilities are the de facto convention. We use those two functions as the sole source of breaking and dangerous classifications, and write a small walker of our own only for safe changes, which graphql-js does not report.

## Considered Options

- **graphql-js plus our own safe-change walker (chosen).** Zero extra dependency, since graphql-js already parses the schemas. Severity is the reference implementation's judgement, not ours. Our taste goes into how the comment presents a change, never into whether it is breaking.
- **@graphql-inspector/core `diff`.** One call, richer catalogue, but severities are The Guild's opinions, and the product collapses into "Inspector with a nicer comment", which Inspector could ship in an afternoon.
- **Our own engine.** Would mean inventing a classification, which the project explicitly does not do.

## Consequences

- We inherit graphql-js's judgement calls, such as "enum value added" being dangerous. No input to reclassify them in v1.
- The safe-change walker is the only diffing code we own and test; breaking and dangerous are tested at the rendering boundary, not re-derived.
