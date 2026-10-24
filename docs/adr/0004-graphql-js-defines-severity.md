---
status: accepted
---

# graphql-js defines severity; we add only deprecation changes

There is no GraphQL Foundation document that lists breaking changes. The closest thing is graphql-js, the Foundation's reference implementation, whose schema-change utility is the de facto convention. We use graphql-js's `findSchemaChanges` as the sole source of breaking, dangerous and safe classifications, and write a small walker of our own only for deprecations added, removed or reworded, which graphql-js does not report.

## Considered Options

- **graphql-js plus our own deprecation walker (chosen).** Zero extra dependency, since graphql-js already parses the schemas. Severity is the reference implementation's judgement, not ours. Our taste goes into how the comment presents a change, never into whether it is breaking.
- **@graphql-inspector/core `diff`.** One call, richer catalogue, but severities are The Guild's opinions, and the product collapses into "Inspector with a nicer comment", which Inspector could ship in an afternoon.
- **Our own engine.** Would mean inventing a classification, which the project explicitly does not do.

## Consequences

- We inherit graphql-js's judgement calls, such as "enum value added" being dangerous, and a built-in scalar that stops being referenced counting as a breaking removal. No input to reclassify them in v1.
- The deprecation walker is the only diffing code we own. Every other kind is tested at the rendering boundary, one fixture pair per kind, not re-derived.
- graphql-js reports each change as a kind and an English sentence. The kind decides the severity; the sentence is read only for the schema path, and any value shown next to it is looked up in the two schemas.

## Amendment, 2026-10-24

As first written, this record named `findBreakingChanges` and `findDangerousChanges` and said that graphql-js does not report safe changes. graphql-js 17 deprecates both functions in favour of `findSchemaChanges`, which also returns a safe-change catalogue, and will remove them in v18. The decision stands; the walker we own shrank from all safe changes to deprecations.
