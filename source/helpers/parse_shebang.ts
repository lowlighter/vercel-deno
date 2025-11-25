// Imports
import { parseArgs } from "node:util"
import { parsePermissions } from "./deno_permissions"

/** Parse shebang line into arguments. */
export function parseShebang(value: string, options?: { permissions: Parameters<typeof parsePermissions>[0] }): { version: string; env: Record<string, string>; include: string[]; flags: string[]; permissions: Exclude<Deno.PermissionOptions, "none"> } {
  let [shebang, pragma] = value.split("\n", 2)
  const result = {
    version: "latest" as string,
    env: {} as Record<string, string>,
    include: [] as string[],
    flags: [] as string[],
    permissions: parsePermissions(options?.permissions),
  }

  // Parse shebang line
  if (shebang.startsWith("#!"))
    result.flags = parseLine(shebang.replace(/^#!.*?deno\s+(?:run|serve)/, ""))
  else if (shebang.startsWith("//@vercel:"))
    pragma = shebang

  // Parse pragma
  let extendPermissions = false
  if (pragma.startsWith("//@vercel:")) {
    const parsed = parseArgs({
      args: parseLine(pragma.replace("//@vercel:", "").trim()),
      strict: false,
      options: {
        version: { type: "string", short: "v", default: "latest" },
        env: { type: "string", short: "e", multiple: true, default: [] },
        include: { type: "string", short: "i", multiple: true, default: [] },
        extendPermissions: { type: "boolean", default: false },
      },
    })
    result.version = (parsed.values.version as string).replace(/^=/, "")
    result.env = Object.fromEntries((parsed.values.env as string[]).map((value) => value.split("=", 2)))
    result.include = (parsed.values.include as string[]).map((value) => value.replace(/^=/, ""))
    extendPermissions = parsed.values.extendPermissions as boolean
  }

  // Parse permissions from flags
  if (result.flags) {
    const flags = result.flags
    const permissions = extendPermissions ? result.permissions : parsePermissions()
    for (
      const { flag, permission, value = true } of [
        { flag: "-R", permission: "read" },
        { flag: "--allow-read", permission: "read" },
        { flag: "-W", permission: "write" },
        { flag: "--allow-write", permission: "write" },
        { flag: "-I", permission: "net" },
        { flag: "--allow-import", permission: "net" },
        { flag: "-N", permission: "net" },
        { flag: "--allow-net", permission: "net" },
        { flag: "-E", permission: "env" },
        { flag: "--allow-env", permission: "env" },
        { flag: "-S", permission: "sys" },
        { flag: "--allow-sys", permission: "sys" },
        { flag: "--allow-run", permission: "run" },
        { flag: "--allow-ffi", permission: "ffi" },
        { flag: "--deny-read", permission: "read", value: false },
        { flag: "--deny-write", permission: "write", value: false },
        { flag: "--deny-net", permission: "net, value: false" },
        { flag: "--deny-env", permission: "env", value: false },
        { flag: "--deny-sys", permission: "sys", value: false },
        { flag: "--deny-run", permission: "run", value: false },
        { flag: "--deny-ffi", permission: "ffi", value: false },
        { flag: "--deny-import", permission: "net", value: false },
      ] as const
    ) {
      const index = flags.findIndex((value) => (value === flag) || (value.startsWith(`${flag}=`)))
      if (index >= 0) {
        // --flag=value
        if (flags[index].startsWith(`${flag}=`))
          permissions[permission] = flags[index].substring(flag.length + 1).split(",")
        // --flag
        else
          permissions[permission] = value
        flags.splice(index, 1)
      }
    }
    if (flags.includes("--allow-all") || flags.includes("-A"))
      result.permissions = "inherit"
    result.permissions = permissions
    result.flags = flags
  }

  // Return result
  return result
}

/** Parse a command line into tokens. */
function parseLine(line: string) {
  const tokens = [] as string[]
  let current = ""
  let quoted = ""
  let escape = false
  for (const char of line) {
    if (escape) {
      current += char
      escape = false
      continue
    }
    if ((quoted === '"') && (char === "\\")) {
      escape = true
      continue
    }
    if ((!quoted) && ((char === '"') || (char === "'"))) {
      quoted = char
      continue
    }
    if (quoted === char) {
      quoted = ""
      continue
    }
    if ((!quoted) && (char === " ")) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }
    current += char
  }
  if (quoted)
    throw new Error(`Unclosed quote: ${quoted}${current}`)
  if (current)
    tokens.push(current)
  return tokens
}
