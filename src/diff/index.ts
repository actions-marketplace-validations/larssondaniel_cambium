import type { GraphQLSchema } from 'graphql'
import { compareChanges, type Change } from './change.js'
import { findDeprecationChanges } from './deprecations.js'
import { readGraphqlJsChanges } from './graphql-js-changes.js'

export type { Change, ChangeKind, Severity } from './change.js'
export { SEVERITIES } from './change.js'

/**
 * Every change between the base schema and the head schema, sorted by schema
 * path. Breaking and dangerous severities are graphql-js's judgement; Cambium
 * adds only deprecation changes, which are always safe.
 */
export function diffSchemas(
  base: GraphQLSchema,
  head: GraphQLSchema
): Change[] {
  return [
    ...readGraphqlJsChanges(base, head),
    ...findDeprecationChanges(base, head)
  ].sort(compareChanges)
}
