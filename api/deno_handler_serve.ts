#!/usr/bin/env -S deno serve
export default {
  fetch() {
    return new Response(`🦕 deno version: ${Deno.version.deno}`)
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Serverless function that receive a [\`Request\`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
  and return a [\`Response\`](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response), using the same
  interface as exports used by [\`deno serve\`](https://docs.deno.com/runtime/reference/cli/serve/).
`
