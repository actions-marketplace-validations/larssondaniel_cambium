import {
  BreakingChangeType,
  DangerousChangeType,
  SafeChangeType
} from 'graphql'

export type Severity = 'breaking' | 'dangerous' | 'safe'

/** The order sections appear in, worst first. */
export const SEVERITIES: readonly Severity[] = ['breaking', 'dangerous', 'safe']

/**
 * Kinds of change. graphql-js's own kinds are used as they are; the
 * deprecation kinds are the only ones Cambium adds, because graphql-js does
 * not report deprecations. `UNRECOGNIZED` is the fallback for a graphql-js
 * change whose sentence Cambium could not read; it is still shown, with
 * graphql-js's own words.
 */
export type ChangeKind =
  | keyof typeof BreakingChangeType
  | keyof typeof DangerousChangeType
  | keyof typeof SafeChangeType
  | 'DEPRECATION_ADDED'
  | 'DEPRECATION_REMOVED'
  | 'DEPRECATION_REASON_CHANGED'
  | 'UNRECOGNIZED'

/**
 * One difference between the base schema and the head schema.
 */
export interface Change {
  severity: Severity
  kind: ChangeKind
  /** Schema path: `Type`, `Type.field`, `Type.field(arg:)`, `Enum.VALUE` or `@directive`. */
  path: string
  /** Value before the change, when a value changed. */
  before?: string
  /** Value after the change, when a value changed. */
  after?: string
  /** A second name the change involves: a union member, an interface, a directive location. */
  subject?: string
  /** Free text the change carries: a description or a deprecation reason. */
  text?: string
  /** graphql-js's own sentence, used when the change is `UNRECOGNIZED`. */
  description?: string
}

/** Severity of a graphql-js change kind, read from graphql-js's own catalogues. */
export function severityOf(kind: string): Severity {
  if (kind in BreakingChangeType) return 'breaking'
  if (kind in DangerousChangeType) return 'dangerous'
  return 'safe'
}

/** Sorts by schema path, then by kind, so changes to one type sit together. */
export function compareChanges(a: Change, b: Change): number {
  if (a.path !== b.path) return a.path < b.path ? -1 : 1
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
  return 0
}
