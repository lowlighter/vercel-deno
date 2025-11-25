#!/usr/bin/env -S deno serve
// deno-lint-ignore no-import-prefix
import { say } from "https://deno.land/x/libs@2025.11.20/testing/imports/mod.ts"

export default {
  fetch() {
    return new Response(say(`📦 https import: ${say()}`))
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function using HTTP(S) imports.
`
