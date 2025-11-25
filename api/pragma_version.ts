#!/usr/bin/env -S deno serve
//@vercel: --version 2.5.0
export default {
  fetch() {
    return new Response(`🦕 deno version: ${Deno.version.deno}`)
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function using a fixed Deno version through the \`--version\` pragma.

  By default, the runtime uses the latest stable Deno version that was available at build time.
`
