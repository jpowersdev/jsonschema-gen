import { CliConfig } from "@effect/cli"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import pkg from "package.json" assert { type: "json" }
import { JsonSchemaGen } from "./JsonSchemaGen.js"

const spec = Options.file("spec").pipe(
  Options.withAlias("s"),
  Options.withDescription("The JsonSchema spec file to generate the client from")
)

const output = Options.file("output").pipe(
  Options.withAlias("o"),
  Options.withDescription(
    "The output file to write the generated code to. If not provided, the code will be written to stdout."
  ),
  Options.optional
)

const prefix = Options.text("prefix").pipe(
  Options.withAlias("p"),
  Options.withDescription("An optional prefix to apply to all generated code"),
  Options.optional
)

const reservedPrefix = Options.text("reservedPrefix").pipe(
  Options.withAlias("r"),
  Options.withDescription("An optional prefix to use for reserved words (defaults to `Schema`)"),
  Options.optional
)

const satisfiesPath = Options.text("satisfies").pipe(
  Options.withAlias("s"),
  Options.withDescription(
    "An optional path to a typescript file containing interfaces against which to validate the generated code"
  ),
  Options.optional
)

const root = Command.make("jsonschemagen", { spec, output, prefix, satisfiesPath, reservedPrefix }).pipe(
  Command.withHandler(({ output, prefix, reservedPrefix, satisfiesPath, spec }) =>
    JsonSchemaGen.generate(spec as any, output, { prefix, satisfiesPath, reservedPrefix })
  ),
  Command.withDescription("Generate Effect Schemas from JSON Schema"),
  Command.provide(JsonSchemaGen.Default)
)

const run = Command.run(root, {
  name: "jsonschema-gen",
  version: pkg.version
})

const Env = Layer.mergeAll(
  NodeContext.layer,
  JsonSchemaGen.Default,
  CliConfig.layer({
    showBuiltIns: false
  })
)

run(process.argv).pipe(Effect.provide(Env), NodeRuntime.runMain)
