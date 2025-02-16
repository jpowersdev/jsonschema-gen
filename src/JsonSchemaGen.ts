import { FileSystem } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import * as Array from "effect/Array"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { ESLint } from "eslint"
import { RESERVED_WORDS } from "./constants.js"
import { makeImportPath } from "./utils.js"

export class JsonSchemaDefinition extends Data.Class<{
  type?: string | Array<string>
  properties?: Record<string, JsonSchemaDefinition>
  items?: JsonSchemaDefinition | Array<JsonSchemaDefinition>
  required?: Array<string>
  enum?: Array<any>
  const?: any
  $ref?: string
  description?: string
  additionalProperties?: boolean | JsonSchemaDefinition
  oneOf?: Array<JsonSchemaDefinition>
  anyOf?: Array<JsonSchemaDefinition>
  allOf?: Array<JsonSchemaDefinition>
}> {}

export class GenerationError extends Schema.TaggedError<GenerationError>()(
  "GenerationError",
  {
    cause: Schema.Unknown,
    message: Schema.String
  }
) {}

export interface JsonSchemaConfig {
  readonly prefix: Option.Option<string>
  readonly reservedPrefix: Option.Option<string>
  readonly satisfiesPath: Option.Option<string>
}

const defaultConfig: JsonSchemaConfig = {
  prefix: Option.none(),
  reservedPrefix: Option.some("Schema"),
  satisfiesPath: Option.none()
}

export class JsonSchemaGen extends Effect.Service<JsonSchemaGen>()(
  "JsonSchemaGen",
  {
    accessors: true,
    dependencies: [NodeContext.layer],
    effect: Effect.gen(function*() {
      // Handle name collisions
      const formatName = (
        name: string,
        config: JsonSchemaConfig = defaultConfig
      ): string => {
        const { prefix = Option.none, reservedPrefix = Option.some("Schema") } = config

        // Always apply the general prefix if specified
        let formattedName = prefix + name

        // Check if the name is reserved
        if (RESERVED_WORDS.has(formattedName)) {
          formattedName = reservedPrefix + formattedName
        }

        return formattedName
      }

      const processDefinition = (
        name: string,
        def: JsonSchemaDefinition,
        config: JsonSchemaConfig = defaultConfig
      ): Effect.Effect<string, GenerationError> =>
        Effect.gen(function*() {
          const formattedName = formatName(name, config)
          const schema = yield* buildSchema(def, config)

          const satisfies = Option.match(config.satisfiesPath, {
            onSome: () => ` satisfies Schema.Schema<any, S.${name}>`,
            onNone: () => ""
          })

          return `export const ${formattedName} = ${schema}${satisfies}\nexport type ${formattedName} = typeof ${formattedName}.Type`
        })

      const handlePrimitive = (type?: string | Array<string>): string => {
        switch (type) {
          case "string":
            return "Schema.String"
          case "number":
          case "integer":
            return "Schema.Number"
          case "boolean":
            return "Schema.Boolean"
          case "null":
            return "Schema.Null"
          default:
            return "Schema.Unknown"
        }
      }

      // Update buildSchema to handle references with formatName
      const buildSchema = (
        def: JsonSchemaDefinition,
        config: JsonSchemaConfig = defaultConfig
      ): Effect.Effect<string, GenerationError> =>
        Effect.gen(function*() {
          if (def.$ref) {
            const refName = def.$ref.split("/").pop()!
            const formattedRefName = formatName(refName, config)
            return `Schema.suspend(() => ${formattedRefName})`
          }

          if (def.enum) {
            const values = def.enum.map((v) => JSON.stringify(v))
            return `Schema.Union(${
              values
                .map((v) => `Schema.Literal(${v})`)
                .join(", ")
            })`
          }

          if (def.anyOf) {
            const schemas = yield* Effect.forEach(def.anyOf, (schema) => buildSchema(schema, config))
            return `Schema.Union(${schemas.join(", ")})`
          }

          if (def.oneOf) {
            const schemas = yield* Effect.forEach(def.oneOf, (schema) => buildSchema(schema, config))
            return `Schema.Union(${schemas.join(", ")})`
          }

          if (def.allOf) {
            const schemas = yield* Effect.forEach(def.allOf, (schema) => buildSchema(schema, config))
            return `Schema.compose(${schemas.join(", ")})`
          }

          if (def.type === "object") {
            if (def.properties) {
              const props: Array<string> = []
              for (
                const [propName, propDef] of Object.entries(
                  def.properties
                )
              ) {
                const propSchema = yield* buildSchema(
                  propDef as JsonSchemaDefinition,
                  config
                )
                const isRequired = def.required?.includes(propName) ?? false
                props.push(
                  `${propName}: ${
                    isRequired
                      ? propSchema
                      : `Schema.optionalWith(${propSchema}, { as: "Option" })`
                  }`
                )
              }
              if (props.length === 0) {
                return `Schema.Object`
              }
              return `Schema.Struct({
          ${props.join(",\n        ")}
        })`
            }
            if (
              def.additionalProperties &&
              typeof def.additionalProperties === "object"
            ) {
              if ("type" in def.additionalProperties) {
                const value = yield* buildSchema(
                  def.additionalProperties as JsonSchemaDefinition,
                  config
                )
                return `Schema.Record({ key: Schema.String, value: ${value} })`
              }
              return "Schema.Record({ key: Schema.String, value: Schema.Unknown })"
            }
          }

          if (def.type === "array") {
            if (def.items) {
              const itemSchema = yield* buildSchema(
                Array.isArray(def.items) ? def.items[0] : def.items,
                config
              )
              return `Schema.Array(${itemSchema}).pipe(Schema.mutable)`
            }
            return "Schema.Array(Schema.Unknown).pipe(Schema.mutable)"
          }

          // Handle union types
          if (Array.isArray(def.type)) {
            const types = def.type.map((t) => handlePrimitive(t))
            return `Schema.Union(${types.join(", ")})`
          }

          if (def.const) {
            const value = JSON.stringify(def.const)
            return `Schema.Literal(${value}).pipe(Schema.propertySignature, Schema.withConstructorDefault(() => ${value} as const))`
          }

          return handlePrimitive(def.type)
        })

      // write a function to run eslint on the output
      const formatOutput = (
        output: string
      ): Effect.Effect<string, GenerationError> =>
        Effect.gen(function*() {
          const eslint = new ESLint({
            fix: true
          })

          const results = yield* Effect.tryPromise({
            try: () =>
              eslint.lintText(output, {
                filePath: "src/Generated.ts"
              }),
            catch: (cause) =>
              new GenerationError({
                cause,
                message: "Failed to format output"
              })
          })

          const resultOutput = results[0].output

          if (!resultOutput) {
            return yield* new GenerationError({
              cause: results[0],
              message: "No output"
            })
          }

          return resultOutput
        })

      // Update generateSchemas to accept config
      const generateSchemas = (
        schema: Record<string, any>,
        config: JsonSchemaConfig = defaultConfig
      ): Effect.Effect<string, GenerationError> =>
        Effect.gen(function*() {
          const definitions = schema.definitions || {}
          const satisfiesPath = Option.match(config.satisfiesPath, {
            onSome: (path) => `\nimport type * as S from "${makeImportPath(path)}"\n`,
            onNone: () => ""
          })
          const output: Array<string> = [
            `
            /**
             * @since 1.0.0
             */
            import * as Schema from "effect/Schema"${satisfiesPath}`
          ]

          // Process each definition with config
          for (const [name, def] of Object.entries(definitions)) {
            const schemaCode = yield* processDefinition(
              name,
              def as JsonSchemaDefinition,
              config
            )
            output.push(schemaCode)
          }

          const result = output.join("\n\n")

          return yield* formatOutput(result).pipe(
            Effect.tapErrorCause((e) => Effect.logError(e)),
            Effect.orElse(() => Effect.succeed(result))
          )
        })

      const generate = (inputPath: string, outputPath: Option.Option<string>, options: JsonSchemaConfig) =>
        Effect.gen(function*() {
          const FS = yield* FileSystem.FileSystem
          const schema = yield* FS.readFileString(inputPath)
          const output = yield* generateSchemas(JSON.parse(schema), options)
          if (Option.isNone(outputPath)) {
            return yield* Console.log(output)
          }
          return yield* FS.writeFileString(outputPath.value, output)
        })

      return {
        generateSchemas,
        processDefinition,
        buildSchema,
        generate
      }
    })
  }
) {}
