// Imports
import decompress from "decompress"
import { join } from "node:path"
import { stat } from "node:fs/promises"
import { Buffer } from "node:buffer"
import { inspect } from "node:util"
import assert from "node:assert"
import { debug } from "./log"

/** Download Deno binary for given version, platform, and architecture. */
export async function denoDownload(version: string, { denoDir, ...options }: { denoDir: string; platform: string; arch: string }): Promise<{ version: string; dir: string }> {
  // Normalize platform and architecture
  const platform = {
    darwin: "apple-darwin",
    linux: "unknown-linux-gnu",
    win32: "pc-windows-msvc",
  }[options.platform]
  assert(platform, `Unsupported platform: "${options.platform}"`)
  const arch = {
    x64: "x86_64",
    arm64: "aarch64",
  }[options.arch]
  assert(arch, `Unsupported CPU architecture: "${options.arch}"`)

  // Resolve latest version (if needed)
  if (version === "latest") {
    const { tag_name } = await fetch("https://api.github.com/repos/denoland/deno/releases/latest").then((response) => response.json())
    version = tag_name.replace(/^v/, "")
    debug(`resolved latest deno version to: ${version}`)
  }

  // Download and extract deno binary
  const dir = join(denoDir, `bin-${arch}-${platform}-${version}`)
  const bin = join(dir, `deno${platform === "win32" ? ".exe" : ""}`)
  try {
    await stat(bin)
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error
    const url = `https://github.com/denoland/deno/releases/download/v${version}/deno-${arch}-${platform}.zip`
    debug(`downloading deno for: ${inspect({ version, platform, arch }, { compact: true })}`)
    debug(`downloading deno from: ${url}`)
    const response = await fetch(url)
    assert(response.ok, `Failed to download deno: ${response.status}`)
    assert(response.body, `Response body is null`)
    await decompress(Buffer.from(await response.arrayBuffer()), dir)
  }
  debug(`deno binary path: ${bin}`)
  return { version, dir }
}
