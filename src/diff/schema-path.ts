import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  print,
  valueToLiteral,
  type GraphQLArgument,
  type GraphQLEnumValue,
  type GraphQLField,
  type GraphQLInputField,
  type GraphQLNamedType,
  type GraphQLDirective,
  type GraphQLSchema
} from 'graphql'

/** Anything a schema path can point at. */
export type SchemaElement =
  | GraphQLNamedType
  | GraphQLField<unknown, unknown>
  | GraphQLInputField
  | GraphQLArgument
  | GraphQLEnumValue
  | GraphQLDirective

const PATH = /^(@)?([^.(]+)(?:\.([^(]+))?(?:\(([^:]+):\))?$/

/**
 * Resolves a schema path (`Type`, `Type.field`, `Type.field(arg:)`,
 * `Enum.VALUE`, `@directive`, `@directive(arg:)`) to the element it names in
 * a schema, or `undefined` when the schema has no such element.
 */
export function resolvePath(
  schema: GraphQLSchema,
  path: string
): SchemaElement | undefined {
  const match = PATH.exec(path)
  if (!match) return undefined
  const [, at, name, member, arg] = match

  if (at) {
    const directive = schema.getDirective(name)
    if (!directive || member) return undefined
    return arg ? directive.args.find((a) => a.name === arg) : directive
  }

  const type = schema.getType(name)
  if (!type || !member) return type

  if (isEnumType(type)) return type.getValue(member) ?? undefined
  if (isInputObjectType(type)) return arg ? undefined : type.getFields()[member]
  if (isObjectType(type) || isInterfaceType(type)) {
    const field = type.getFields()[member]
    if (!field) return undefined
    return arg ? field.args.find((a) => a.name === arg) : field
  }
  return undefined
}

/** The element's description, or `undefined` when it has none. */
export function descriptionOf(
  element: SchemaElement | undefined
): string | undefined {
  return element?.description ?? undefined
}

/** The element's deprecation reason, or `undefined` when it is not deprecated. */
export function deprecationOf(
  element: SchemaElement | undefined
): string | undefined {
  if (!element || !('deprecationReason' in element)) return undefined
  return element.deprecationReason ?? undefined
}

/** The element's default value as GraphQL literal text, or `undefined` when it has none. */
export function defaultOf(
  element: SchemaElement | undefined
): string | undefined {
  if (!element || !('default' in element)) return undefined
  const { default: defaultInput, type } = element as GraphQLArgument
  if (!defaultInput) return undefined
  if (defaultInput.literal) return print(defaultInput.literal)
  const literal = valueToLiteral(defaultInput.value, type)
  return literal ? print(literal) : undefined
}

/** The word for a named type's kind, as a reviewer would say it. */
export function typeKindWord(type: GraphQLNamedType | undefined): string {
  if (!type) return 'type'
  if (isEnumType(type)) return 'enum'
  if (isInterfaceType(type)) return 'interface'
  if (isInputObjectType(type)) return 'input type'
  if (isUnionType(type)) return 'union'
  if (isScalarType(type)) return 'scalar'
  return 'type'
}
