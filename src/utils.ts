export const makeImportPath = (path: string) => {
  const prefix = path.startsWith("./") || path.startsWith("../") ? "" : "./"
  return prefix + path.replace(".ts", "") + ".js"
}
