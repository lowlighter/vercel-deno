#!/usr/bin/env -S deno serve
//@vercel: --env DENO_DIR=/tmp
export default {
  async fetch() {
    // deno-lint-ignore no-import-prefix
    const { say } = await import("jsr:@libs/testing@5/imports")
    return new Response(say(`📦 dynamic import: ${say()}`))
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function using dynamic imports.

  Since the [file system is read-only](https://vercel.com/docs/functions/runtimes#file-system-support)
  once a function is deployed, the deno cache must be set to a writable directory in order for dynamic
  imports to work properly. This can be done by setting the environment variable \`DENO_DIR\` to \`/tmp\`.
`
