#!/usr/bin/env -S deno serve --allow-sys=osRelease
export default {
  fetch() {
    return new Response(`💻 os release: ${Deno.osRelease()}`)
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function with extra permissions and options specified through a [shebang](https://docs.deno.com/examples/hashbang_tutorial).
`
