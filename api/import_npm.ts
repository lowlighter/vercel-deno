#!/usr/bin/env -S deno serve
// deno-lint-ignore no-import-prefix
import { say } from "npm:@lowlighter/testing@5/imports"

export default {
  fetch() {
    return new Response(say(`📦 npm import: ${say()}`))
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function using [\`npm:\`](https://npmjs.com) imports.

  > ℹ️ Dependencies imported via \`npm:\` are [vendored](https://docs.deno.com/runtime/fundamentals/modules/#vendoring-remote-modules)
  > and cached at build time.
`
