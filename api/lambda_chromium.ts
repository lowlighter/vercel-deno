#!/usr/bin/env -S deno serve --allow-env --allow-read --allow-write=/tmp --allow-run --allow-net
// deno-lint-ignore-file no-import-prefix
import { launch } from "jsr:@lowlighter/astral@0.5.5"
import { chromium } from "jsr:@libs/toolbox@0.1.4/download-lambda-chromium"

export default {
  async fetch() {
    await using browser = await launch({ path: await chromium({ path: "/tmp/chromium" }), launchPresets: { lambdaInstance: true } })
    await using page = await browser.newPage("https://example.com", { sandbox: { permissions: { net: ["example.com"] } } })
    return new Response(`🌐 browser capture: ${await page.evaluate(() => document.title)}`)
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function using [\`@astral/astral\`](https://jsr.io/@astral/astral) to launch a headless Chromium browser,
  using the full power of deno permissions system.

  > ℹ️ This function might take a bit longer on cold starts due to the browser initialization.
`
