/** Default Deno permissions. */
const defaultPermissions = {
  read: false,
  write: false,
  net: false,
  env: false,
  sys: false,
  run: false,
  ffi: false,
  import: ["deno.land:443", "jsr.io:443", "esm.sh:443", "cdn.jsdelivr.net:443", "raw.githubusercontent.com:443", "gist.githubusercontent.com:443"],
} as Deno.PermissionOptionsObject

/** Deno permission configuration type. */
export type DenoPermissionConfig = Deno.PermissionOptions | { all: boolean }

/** Parse Deno permissions from descriptor. */
export function parsePermissions(descriptor: DenoPermissionConfig = {}): Exclude<Deno.PermissionOptions, "none"> {
  if ((typeof descriptor === "object") && ("all" in descriptor))
    descriptor = descriptor.all ? "inherit" : "none"
  if (descriptor === "none")
    return { ...defaultPermissions, import: [] }
  if (descriptor === "inherit")
    return "inherit"
  return { ...defaultPermissions, ...descriptor }
}
