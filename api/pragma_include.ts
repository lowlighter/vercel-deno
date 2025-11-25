#!/usr/bin/env -S deno serve --allow-read
//@vercel: --include LICENSE
export default {
  async fetch() {
    const content = (await Deno.readTextFile("LICENSE")).split("\n").slice(0, 1)
    return new Response(`📃 file content: ${content}`)
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function including additional files through the \`--include\` pragma.

  Vercel requires files to be explicitly included in the deployment bundle so if your entrypoint
  references any local files that are not statically analyzed, you will need to use this pragma
  to explicitly include them *(glob patterns are supported)*.
`
