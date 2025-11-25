#!/usr/bin/env -S deno run
const serve: Deno.ServeHandler = (_: Request) => {
  return new Response(`🦕 deno version: ${Deno.version.deno}`)
}
export default serve

// --- META ---
export const description = `
  Serverless function that receive a [\`Request\`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
  and return a [\`Response\`](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response), using the same
  interface as handlers used by [\`Deno.serve\`](https://docs.deno.com/api/deno/~/Deno.serve).
`

if (import.meta.main)
  Deno.serve(serve)
