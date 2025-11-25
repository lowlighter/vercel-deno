#!/usr/bin/env -S deno serve
// deno-lint-ignore no-import-prefix
import { say } from "jsr:@libs/testing@5/imports"

export default {
  fetch() {
    return new Response(say(`📦 jsr import: ${say()}`))
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function using [\`jsr:\`](https://jsr.io) imports.

  > ℹ️ Dependencies imported via \`jsr:\` are [vendored](https://docs.deno.com/runtime/fundamentals/modules/#vendoring-remote-modules)
  > and cached at build time.
`
