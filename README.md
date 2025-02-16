# jsonschema-gen

Generate Effect Schemas from JSON Schema

## Usage

```bash
pnpm add -D @jpowersdev/jsonschema-gen

# Basic usage
pnpm jsonschema-gen --spec ./schema.json --output ./schema.ts

# Advanced usage, with a prefix for reserved words and a "satisfies" file
pnpm jsonschema-gen --spec ./schema.json --output ./schema.ts --reservedPrefix Mcp --satisfies mcp.ts
```

## Options

- `--spec`: The path to the JSON Schema file to generate the Effect Schema from.
- `--output`: The path to the output file to write the generated Effect Schema to.
- `--prefix`: The prefix to apply to the generated Effect Schema.
- `--reservedPrefix`: The prefix to use for reserved words (defaults to `Schema`).
- `--satisfies`: The path to a typescript file containing interfaces against which to validate the generated code.

## About

This library is a work in progress, and is primarily designed to help me generate Effect Schemas for [Model Context Protocol](https://github.com/modelcontextprotocol/specification/blob/main/schema/2024-11-05/schema.json)

Credit due to [@tim-smart](https://github.com/tim-smart) for the [openapi-gen](https://github.com/tim-smart/openapi-gen) library, from which I took inspiration.
