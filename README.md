# jsonschema-gen

Generate Effect Schemas from JSON Schema

## Usage

```bash
npx jsonschema-gen --spec ./schema.json --output ./schema.ts
npx jsonschema-gen --spec ./schema.json --output ./schema.ts --prefix MCP --satisfies mcp.ts
```

## Options

- `--spec`: The path to the JSON Schema file to generate the Effect Schema from.
- `--output`: The path to the output file to write the generated Effect Schema to.
- `--prefix`: The prefix to apply to the generated Effect Schema.
- `--reservedPrefix`: The prefix to use for reserved words (defaults to `Schema`).
- `--satisfies`: The path to a typescript file containing interfaces against which to validate the generated code.
