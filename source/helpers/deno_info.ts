// Imports
import type { Env, Files } from "@vercel/build-utils"
import { FileFsRef, streamToBuffer } from "@vercel/build-utils"
import { spawn } from "node:child_process"
import { relative } from "node:path"
import assert from "node:assert"
import { debug } from "./log"

/** Run `deno info` and collect files. */
export async function denoInfo(entrypoint: string, { outputFiles, env, cwd, renameFile }: { outputFiles: Files; env: Env; cwd: string; renameFile?: string }): Promise<void> {
  // Run deno info
  debug(`> deno info --json --quiet ${entrypoint}`)
  const child = spawn("deno", ["info", "--json", "--quiet", entrypoint], { env, cwd, stdio: ["ignore", "pipe", "inherit"] })
  const stdout = await streamToBuffer(child.stdout)
  const [code] = await new Promise<[number]>((resolve) => {
    child.on("exit", (code) => resolve([code as number]))
  })
  assert(code === 0, `Build failed with exit code ${code}`)
  const info = JSON.parse(stdout.toString("utf8"))
  const [root] = info.roots
  debug(`> deno info --json --quiet ${entrypoint}: OK`)

  // Collect files
  for (const mod of info.modules) {
    switch (true) {
      // Supported protocols
      case mod.specifier.startsWith("file://"):
      case mod.specifier.startsWith("http://"):
      case mod.specifier.startsWith("https://"): {
        for (const { remote } of [{ remote: false }, { remote: true }] as const) {
          try {
            let path = mod.local
            if (remote) {
              if (!path.startsWith(env.DENO_DIR))
                continue
              if ((path.startsWith(env.DENO_DIR)) && (!path.includes("/remote/")))
                continue
              path = path.replace(/^(.+?)\/remote\/(.+)$/, "$1/gen/$2.js")
            }
            const paths = { a: path, b: ((root === mod.specifier) && renameFile) ? renameFile : relative(cwd, path) }
            debug(`caching: ${paths.a} → ${paths.b}`)
            const ref = await FileFsRef.fromFsPath({ fsPath: paths.a })
            outputFiles[paths.b] = ref
          } catch (error) {
            if (error?.code !== "ENOENT")
              throw error
          }
        }
        break
      }
      // Special protocols
      case mod.specifier.startsWith("npm:"):
      case mod.specifier.startsWith("node:"): {
        break
      }
      default: {
        throw new Error(`Unsupported protocol: ${mod.specifier}`)
      }
    }
  }
}
