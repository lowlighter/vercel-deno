// Imports
import type { StartDevServerOptions, StartDevServerResult } from "@vercel/build-utils"
import type { Readable } from "node:stream"
import { shouldServe } from "@vercel/build-utils"
import { parseShebang } from "../helpers/parse_shebang"
import { info, warn } from "../helpers/log"
import { inspect } from "node:util"
import { readFile, unlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawn } from "node:child_process"
import assert from "node:assert"
import process from "node:process"
export { shouldServe }

/** Temporary directory. */
const temp = tmpdir()

/** Directory name. */
const dirname = import.meta.dirname!

/** Path to the runtime script. */
const devscript = join(dirname, "./deno_dev.js")

/** Start dev server function. */
export async function startDevServer({ workPath, entrypoint }: StartDevServerOptions): Promise<StartDevServerResult> {
  process.env.FORCE_COLOR = "1"
  const portFile = join(temp, `vercel-deno-port-${Math.random().toString(32).substring(2)}`)
  const userConfig = { permissions: undefined } // TODO: support user config from vercel.json ?

  // Parse shebang
  const args = parseShebang(await readFile(join(workPath, entrypoint), { encoding: "utf8" }), { permissions: userConfig.permissions })
  const userEnv = args.env

  // Prepare flags and env
  const flags = args.flags
  if ((!flags.includes("--allow-all")) && (!flags.includes("-A")))
    flags.push("--allow-all")
  if (!flags.includes("--unstable-worker-options"))
    flags.push("--unstable-worker-options")
  if (!flags.includes("--no-prompt"))
    flags.push("--no-prompt")
  const permissions = args.permissions
  const env = { ...process.env, ...userEnv, VERCEL_DEV_ENTRYPOINT: join(workPath, entrypoint), VERCEL_DEV_PORT_FILE: portFile, VERCEL_DENO_PERMISSIONS: JSON.stringify(permissions) } as Record<string, string>

  // Cache imports
  info(`Calling ${inspect(entrypoint, { colors: true })} (flags: ${inspect(flags, { colors: true })})`)
  const child = spawn("deno", ["run", ...flags, devscript], { env, cwd: workPath, stdio: ["ignore", "inherit", "inherit", "pipe"] })

  // Listen for port from child process
  const portPipe = child.stdio[3] as Readable
  assert(portPipe?.readable === true, "Port pipe is not readable")
  const onPort = new Promise<{ port: number }>((resolve) => {
    portPipe.setEncoding("utf8")
    portPipe.once("data", (data) => resolve({ port: Number(data) }))
  })

  // Listen for port file from child process
  const controller = new AbortController()
  // deno-lint-ignore no-async-promise-executor
  const onPortFile = new Promise<{ port: number }>(async (resolve, reject) => {
    while (!controller.signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      try {
        const port = Number(await readFile(portFile, "ascii"))
        unlink(portFile).catch((_) => warn(`failed to delete port file: ${portFile}`))
        resolve({ port })
      } catch (error) {
        if (error?.code !== "ENOENT")
          reject(error)
      }
    }
  })

  // Listen for exit from child process
  const onExit = new Promise<{ port: void }>((resolve, reject) => {
    child.on("exit", resolve)
    child.on("error", reject)
    controller.signal.addEventListener("abort", () => (child.removeListener("exit", resolve), child.removeListener("error", reject)))
  })

  // Wait for port or exit
  try {
    const result = await Promise.race([onPort, onPortFile, onExit])
    switch (true) {
      case (typeof result.port === "number") && (typeof child.pid === "number"):
        return { port: result.port, pid: child.pid }
      case Array.isArray(result):
        throw new Error(`Failed to start dev server "${entrypoint}" (code=${result[0]}, signal=${result[1]})`)
      default:
        throw new Error(`Failed to start dev server "${entrypoint}" (unknown reason)`)
    }
  } finally {
    controller.abort()
  }
}
