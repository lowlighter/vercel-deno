// Imports
import type { BuildOptions, BuildResultV3, Files } from "@vercel/build-utils"
import { download, FileBlob, FileFsRef, getProvidedRuntime, glob, Lambda } from "@vercel/build-utils"
import { quote } from "shell-quote"
import { parseShebang } from "../helpers/parse_shebang"
import { denoDownload } from "../helpers/deno_download"
import { denoInfo } from "../helpers/deno_info"
import { debug, info, ok } from "../helpers/log"
import { join, relative } from "node:path"
import { readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { inspect } from "node:util"
import process from "node:process"
import assert from "node:assert"

/** Directory name. */
const dirname = import.meta.dirname!

/** Path to the runtime script. */
const runscript = join(dirname, "./deno.js")

/** Path to the worker script. */
const workerscript = join(dirname, "./deno_worker.js")

/** Bootstrap script for AWS Lambda provided.al2 runtime. */
const bootstrap = [
  "#!/bin/bash",
  "set -e -u -o pipefail",
  'export HOME="$(eval echo "~")"',
  'export PATH="$LAMBDA_TASK_ROOT/bin:$PATH"',
  'export DENO_DIR="<DENO_DIR>"',
  `exec \${AWS_LAMBDA_EXEC_WRAPPER-} deno run <ARGS> .vercel-deno-runtime.js --permissions <PERMISSIONS> <COPY_CACHE>`,
].join("\n")

/** Build function. */
export async function build({ workPath, files, entrypoint, config = {}, meta = {} }: BuildOptions): Promise<BuildResultV3> {
  await download(files, workPath, meta)
  const { devCacheDir: cacheDir = join(workPath, ".vercel", "cache") } = meta
  const userConfig = { permissions: undefined } // TODO: support user config from vercel.json ?

  // Parse shebang
  const args = parseShebang(await readFile(join(workPath, entrypoint), { encoding: "utf8" }), { permissions: userConfig.permissions })
  const denoDir = join(cacheDir, "deno")
  const version = args.version
  const userEnv = args.env
  const includes = [...args.include, ...[config.includeFiles].flat().filter(Boolean)] as string[]

  // Download deno binaries
  const downloads = [denoDownload(version, { platform: "linux", arch: "x64", denoDir })]
  if ((process.platform !== "linux") || (process.arch !== "x64"))
    downloads.push(denoDownload(version, { platform: process.platform, arch: process.arch, denoDir }))
  const [runtime, buildtime = runtime] = await Promise.all(downloads)

  // Prepare flags and env
  const flags = args.flags
  if (!flags.includes("--unstable-worker-options"))
    flags.push("--unstable-worker-options")
  if (!flags.includes("--no-prompt"))
    flags.push("--no-prompt")
  const permissions = args.permissions
  const env = { ...process.env, ...userEnv, DENO_DIR: denoDir, ENTRYPOINT: join(workPath, entrypoint), VERCEL_DENO_PERMISSIONS: JSON.stringify(permissions) } as Record<string, string>
  env.PATH ??= ""
  if (!env.PATH.includes(runtime.dir))
    env.PATH = [buildtime.dir, env.PATH].filter(Boolean).join(":")
  userEnv.PATH ??= ""
  if (!userEnv.PATH.includes(runtime.dir))
    userEnv.PATH = [runtime.dir, userEnv.PATH].filter(Boolean).join(":")

  // Cache imports
  info(`Caching ${inspect(entrypoint, { colors: true })}`)
  const cacheFlags = [...flags]
  if ((!cacheFlags.includes("--quiet")) && (!cacheFlags.includes("-q")))
    cacheFlags.push("--quiet")
  if (cacheFlags.includes("--vendor=false"))
    cacheFlags.splice(cacheFlags.indexOf("--vendor=false"), 1)
  if ((!cacheFlags.includes("--vendor")) && (!cacheFlags.includes("--vendor=true")))
    cacheFlags.push("--vendor")
  for (const script of [runscript, workerscript, join(workPath, entrypoint)]) {
    const code = await new Promise<number>((resolve) => {
      debug(`> deno install ${cacheFlags.join(" ")} --entrypoint ${script}`)
      const child = spawn("deno", ["install", ...cacheFlags, "--entrypoint", script], { env, cwd: workPath, stdio: "inherit" })
      child.on("exit", (code) => resolve(code as number))
    })
    assert(code === 0, `Build failed with exit code ${code}`)
    debug(`> deno install ${cacheFlags.join(" ")} --entrypoint ${script}: OK`)
  }

  // Create lambda files
  const runFlags = [...flags]
  if ((!runFlags.includes("--allow-all")) && (!runFlags.includes("-A")))
    runFlags.push("--allow-all")
  if (!userEnv.DENO_DIR)
    runFlags.push("--cached-only")
  if (runFlags.includes("--vendor=false"))
    runFlags.push("--vendor")
  if ((!runFlags.includes("--vendor")) && (!runFlags.includes("--vendor=true")))
    runFlags.push("--vendor")
  info(`Bootstraping ${inspect(entrypoint, { colors: true })} (flags: ${inspect(runFlags, { colors: true })})`)
  const bootstraped = bootstrap
    .replace("<DENO_DIR>", userEnv.DENO_DIR || "$LAMBDA_TASK_ROOT/.vercel/cache/deno")
    .replace("<COPY_CACHE>", userEnv.DENO_DIR ? "--copy-cache" : "")
    .replace("<ARGS>", quote(runFlags))
    .replace("<PERMISSIONS>", quote([JSON.stringify(permissions)]))
  debug(`bootstraped: ${bootstraped.split("\n").slice(2).join("\n")}`)
  const outputFiles = {
    bootstrap: new FileBlob({ data: bootstraped, mode: 0o755 }),
    "bin/deno": await FileFsRef.fromFsPath({ fsPath: join(runtime.dir, "deno") }),
  } as Files
  for (const filename of ["deno.json", "deno.jsonc", "deno.lock", "package.json", "package-lock.json"]) {
    try {
      outputFiles[filename] = await FileFsRef.fromFsPath({ fsPath: join(workPath, filename) })
      debug(`included project file: ${join(workPath, filename)} → ${filename}`)
    } catch (error) {
      if (error?.code !== "ENOENT")
        throw error
    }
  }
  const lambdaFiles = Object.keys(outputFiles).length
  debug(`registered ${lambdaFiles} lambda file(s)`)

  // Include deno discovered files
  await denoInfo(runscript, { outputFiles, env, cwd: workPath, renameFile: ".vercel-deno-runtime.js" })
  await denoInfo(workerscript, { outputFiles, env, cwd: workPath, renameFile: "deno_worker.js" })
  await denoInfo(join(workPath, entrypoint), { outputFiles, env, cwd: workPath })
  for (const dir of ["vendor", "node_modules"] as const) {
    await glob(`${dir}/**`, { cwd: workPath, includeDirectories: true }).then((files) => {
      Object.keys(files).forEach((path) => outputFiles[path] = files[path])
      debug(`caching ${dir}: ${join(workPath, dir)} → ${dir}`)
    })
  }
  await glob("npm/**", { cwd: denoDir, includeDirectories: true }).then((files) => {
    const registries = [...new Set(Object.keys(files).filter((path) => /^npm\/[^/]+\/.*$/.test(path)).map((path) => path.split("/").slice(0, 2).join("/")))]
    const relpath = relative(workPath, denoDir)
    Object.keys(files).forEach((path) => outputFiles[join(relpath, path)] = files[path])
    registries.forEach((registry) => debug(`caching npm: ${join(workPath, registry)} → ${join(relpath, registry)}`))
  })
  const discoveredFiles = Object.keys(outputFiles).length - lambdaFiles
  debug(`registered ${discoveredFiles} deno discovered file(s)`)

  // Include additional files
  for (const pattern of includes) {
    const matches = await glob(pattern, workPath)
    for (const name of Object.keys(matches)) {
      if (!outputFiles[name]) {
        outputFiles[name] = matches[name]
        debug(`included additional file: ${name}`)
      }
    }
  }
  if (includes.length > 0) {
    const additionalFiles = Object.keys(outputFiles).length - lambdaFiles - discoveredFiles
    debug(`registered ${additionalFiles} additional included file(s)`)
  }

  // Return lambda
  ok(`Ready: ${entrypoint}`)
  return {
    output: Object.assign(
      new Lambda({
        runtime: "provided.al2",
        supportsWrapper: true,
        handler: entrypoint,
        files: outputFiles,
        environment: userEnv,
      }),
      { runtime: await getProvidedRuntime() },
    ),
  }
}
