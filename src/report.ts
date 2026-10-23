import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isIntrospectionType,
  isObjectType,
  isScalarType,
  isSpecifiedDirective,
  isSpecifiedScalarType,
  isUnionType,
  type GraphQLSchema
} from 'graphql'
import type { Change, Severity } from './diff/index.js'

/** What a brand-new schema file contains, for the "New schema" report. */
export interface SchemaInventory {
  types: number
  interfaces: number
  unions: number
  enums: number
  inputTypes: number
  scalars: number
  directives: number
}

/**
 * The result of comparing the schema file at the merge-base with the schema
 * file at the head: either a list of changes (possibly empty), or one of the
 * two whole-file events.
 */
export type Report =
  | { event: 'changed'; schemaPath: string; changes: Change[] }
  | { event: 'new-schema'; schemaPath: string; inventory: SchemaInventory }
  | { event: 'schema-removed'; schemaPath: string }

export type Counts = Record<Severity, number>

/** How many changes of each severity the report carries; a removed schema counts as one breaking change. */
export function countsOf(report: Report): Counts {
  switch (report.event) {
    case 'changed':
      return report.changes.reduce(
        (counts, change) => ({
          ...counts,
          [change.severity]: counts[change.severity] + 1
        }),
        { breaking: 0, dangerous: 0, safe: 0 }
      )
    case 'new-schema':
      return {
        breaking: 0,
        dangerous: 0,
        safe: inventorySize(report.inventory)
      }
    case 'schema-removed':
      return { breaking: 1, dangerous: 0, safe: 0 }
  }
}

/** The one-line judgement at the top of the comment. */
export function verdictOf(report: Report): string {
  switch (report.event) {
    case 'new-schema':
      return 'New schema'
    case 'schema-removed':
      return 'Schema removed'
    case 'changed':
      if (report.changes.length === 0) return 'No schema changes'
      return countsOf(report).breaking > 0
        ? 'Breaking schema change'
        : 'Schema changed, nothing breaking'
  }
}

/** Counts the user-defined types and directives in a schema. */
export function inventoryOf(schema: GraphQLSchema): SchemaInventory {
  const inventory: SchemaInventory = {
    types: 0,
    interfaces: 0,
    unions: 0,
    enums: 0,
    inputTypes: 0,
    scalars: 0,
    directives: schema.getDirectives().filter((d) => !isSpecifiedDirective(d))
      .length
  }
  for (const type of Object.values(schema.getTypeMap())) {
    if (isIntrospectionType(type) || isSpecifiedScalarType(type)) continue
    if (isObjectType(type)) inventory.types += 1
    else if (isInterfaceType(type)) inventory.interfaces += 1
    else if (isUnionType(type)) inventory.unions += 1
    else if (isEnumType(type)) inventory.enums += 1
    else if (isInputObjectType(type)) inventory.inputTypes += 1
    else if (isScalarType(type)) inventory.scalars += 1
  }
  return inventory
}

function inventorySize(inventory: SchemaInventory): number {
  return Object.values(inventory).reduce((sum, n) => sum + n, 0)
}
