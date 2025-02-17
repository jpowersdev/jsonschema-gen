import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as fs from "fs"
import * as path from "path"
import { JsonSchemaGen } from "../src/JsonSchemaGen.js"

describe("JsonSchemaGen", () => {
  it.effect("should handle primitive types correctly", () =>
    Effect.gen(function*() {
      const gen = yield* JsonSchemaGen

      // Test string type
      const stringSchema = { type: "string" }
      const stringResult = yield* gen.buildSchema(stringSchema)
      expect(stringResult).toBe("Schema.String")

      // Test number type
      const numberSchema = { type: "number" }
      const numberResult = yield* gen.buildSchema(numberSchema)
      expect(numberResult).toBe("Schema.Number")

      // Test boolean type
      const booleanSchema = { type: "boolean" }
      const booleanResult = yield* gen.buildSchema(booleanSchema)
      expect(booleanResult).toBe("Schema.Boolean")

      // Test null type
      const nullSchema = { type: "null" }
      const nullResult = yield* gen.buildSchema(nullSchema)
      expect(nullResult).toBe("Schema.Null")
    }).pipe(
      Effect.provide(JsonSchemaGen.Default)
    ))

  it.effect("should handle complex types correctly", () =>
    Effect.gen(function*() {
      const gen = yield* JsonSchemaGen

      // Test array type
      const arraySchema = {
        type: "array",
        items: { type: "string" }
      }
      const arrayResult = yield* gen.buildSchema(arraySchema)
      expect(arrayResult).toBe("Schema.Array(Schema.String).pipe(Schema.mutable)")

      // Test object type
      const objectSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name"]
      }
      const objectResult = yield* gen.buildSchema(objectSchema)
      expect(objectResult).toContain("Schema.Struct({")
      expect(objectResult).toContain("name: Schema.String")
      expect(objectResult).toContain("age: Schema.optionalWith(Schema.Number")

      // Test enum type
      const enumSchema = {
        enum: ["user", "assistant"]
      }
      const enumResult = yield* gen.buildSchema(enumSchema)
      expect(enumResult).toContain("Schema.Union(")
      expect(enumResult).toContain("Schema.Literal(\"user\")")
      expect(enumResult).toContain("Schema.Literal(\"assistant\")")
    }).pipe(
      Effect.provide(JsonSchemaGen.Default)
    ))

  describe("model context protocol example", () => {
    const loadSchema = () => {
      const schemaPath = path.join(__dirname, "jsonschema.json")
      return JSON.parse(fs.readFileSync(schemaPath, "utf-8"))
    }
    const schema = loadSchema()

    it.effect("should generate valid code for the schema", () =>
      Effect.gen(function*() {
        const gen = yield* JsonSchemaGen
        const result = yield* gen.generateSchemas(schema, {
          prefix: Option.none(),
          reservedPrefix: Option.some("MCP"),
          satisfiesPath: Option.some("jsonschema")
        })

        // Verify basic structure
        expect(result).toContain("import * as Schema from \"effect/Schema\"")
        expect(result).toContain("import type * as S from \"./jsonschema.js\"")

        // Test key type definitions
        expect(result).toContain("export const JSONRPCMessage =")
        expect(result).toContain("export const ClientRequest =")
        expect(result).toContain("export const ServerRequest =")

        // Test that generated types satisfy the interfaces
        expect(result).toContain("satisfies Schema.Schema<any, S.JSONRPCMessage>")
        expect(result).toContain("satisfies Schema.Schema<any, S.ClientRequest>")
        expect(result).toContain("satisfies Schema.Schema<any, S.ServerRequest>")

        // Test that reserved words are prefixed
        expect(result).toContain("export const MCPResource = Schema.Struct({")

        // Test specific complex types
        expect(result).toContain("export const ModelPreferences = Schema.Struct({")
        expect(result).toContain("export const InitializeRequest = Schema.Struct({")

        // Test enum types
        expect(result).toContain("export const Role = Schema.Union(")
        expect(result).toContain("export const LoggingLevel = Schema.Union(")

        // Test union types
        expect(result).toContain("export const ServerResult = Schema.Union(")
        expect(result).toContain("export const ClientResult = Schema.Union(")

        // Test optional properties
        expect(result).toContain("Schema.optionalWith")

        // Test array types
        expect(result).toContain("Schema.Array")

        // Test that all required types are generated
        const requiredTypes = [
          "JSONRPCMessage",
          "JSONRPCRequest",
          "JSONRPCResponse",
          "JSONRPCError",
          "InitializeRequest",
          "InitializeResult",
          "ClientCapabilities",
          "ServerCapabilities",
          "ResourceTemplate",
          "PromptMessage",
          "Tool",
          "ModelPreferences"
        ]

        for (const type of requiredTypes) {
          expect(result).toContain(`export const ${type} =`)
          expect(result).toContain(`export type ${type} =`)
        }

        // Test that references are handled correctly
        expect(result).toContain("Schema.suspend")

        // Test that annotations are preserved
        expect(result).toContain("Annotated")
      }).pipe(
        Effect.provide(JsonSchemaGen.Default)
      ))

    it.effect("should prefix all constructs when prefix is provided", () =>
      Effect.gen(function*() {
        const gen = yield* JsonSchemaGen
        const result = yield* gen.generateSchemas(schema, {
          prefix: Option.some("MCP"),
          reservedPrefix: Option.none(),
          satisfiesPath: Option.none()
        })

        expect(result).toContain("export const MCPResource = Schema.Struct({")
        expect(result).toContain("export const MCPModelPreferences = Schema.Struct({")
        expect(result).toContain("export const MCPInitializeRequest = Schema.Struct({")
      }).pipe(
        Effect.provide(JsonSchemaGen.Default)
      ))
  })
})
