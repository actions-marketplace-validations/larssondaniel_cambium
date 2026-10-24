# Changelog

All notable changes to Cambium are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Diff of a committed GraphQL schema file between a pull request's merge-base
  and head, read through the Contents API with no checkout.
- Changes classified as breaking, dangerous or safe. Breaking and dangerous come
  from graphql-js's own catalogue; deprecations added, removed or reworded are
  reported as safe.
- One sticky pull request comment per schema file: a verdict in words, one line
  of counts, then the changes grouped by severity and sorted by schema path.
  Safe changes collapse when anything more important is on the page.
- The full report in the job summary on every run; fork pull requests get the
  summary and a notice instead of a comment.
- `fail-on` gate (`breaking`, `dangerous` or `never`) and three count outputs.
- SDL and introspection JSON schema files, detected by content.
