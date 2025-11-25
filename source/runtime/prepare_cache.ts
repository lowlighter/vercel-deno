// Imports
import type { Files, PrepareCacheOptions } from "@vercel/build-utils"
import { glob } from "@vercel/build-utils"

/** Prepopulated cache. */
export async function prepareCache({ workPath }: PrepareCacheOptions): Promise<Files> {
  return await glob(".vercel/cache/deno/**", workPath)
}
