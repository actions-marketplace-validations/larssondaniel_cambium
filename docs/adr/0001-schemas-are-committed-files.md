---
status: accepted
---

# Schemas are read from committed files at the PR's base and head refs

The action needs a base schema and a head schema to diff. We read both from a schema file committed in the repository, at the pull request's base ref and head ref respectively. We do not generate the head schema in the workflow, and we do not introspect running servers.

## Considered Options

- **Committed file at both refs (chosen).** Both inputs are exactly what git says they are. Correctness depends on nothing the action cannot see. Teams with code-first schemas must commit the generated schema, which most already do.
- **Generated head, historical base.** Supports code-first teams without a committed file, but the base is then stale or missing, so the first diff lies and later ones drift silently when the generator changes.
- **Live introspection of two endpoints.** Needs a schema registry or deployed preview environments. That is a service, and this project has no backend beyond the GitHub API.

## Consequences

- A team without a committed schema file cannot use v1. "Generate at head" is logged as a v2 idea, not absorbed into v1.
- The action's README can describe the contract in one sentence: point it at the file, it diffs the file.
