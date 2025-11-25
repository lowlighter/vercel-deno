// Imports
// deno-lint-ignore-file no-import-prefix
// @ts-expect-error: jsr import
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding@1/base64"
// @ts-expect-error: jsr import
import { assert } from "jsr:@std/assert@1/assert"
// @ts-expect-error: jsr import
import { parseArgs } from "jsr:@std/cli@1"
// @ts-expect-error: jsr import
import { copy } from "jsr:@std/fs@1"
// @ts-expect-error: jsr import
import { join } from "jsr:@std/path@1"
import { debug, warn } from "../helpers/log.ts"
import { parsePermissions } from "../helpers/deno_permissions.ts"
import { resolve } from "node:path"

// Setup
const RUNTIME_PATH = "2018-06-01/runtime"
switch (true) {
  // Build
  case Deno.env.has("ENTRYPOINT"): {
    const ENTRYPOINT = `${Deno.env.get("ENTRYPOINT")}`
    debug(`caching entrypoint: ${ENTRYPOINT}`)
    await import(ENTRYPOINT)
    break
  }
  // Runtime
  case Deno.env.has("_HANDLER"): {
    try {
      // Setup
      const { permissions, "copy-cache": copyCache } = parseArgs(Deno.args, { boolean: ["copy-cache"] })
      if (permissions)
        Deno.env.set("VERCEL_DENO_PERMISSIONS", permissions)
      debug(`DENO_DIR: ${Deno.env.get("DENO_DIR")}`)
      if (copyCache) {
        const LAMBDA_TASK_ROOT = Deno.env.get("LAMBDA_TASK_ROOT")
        const DENO_DIR = Deno.env.get("DENO_DIR")
        assert(LAMBDA_TASK_ROOT, 'Env var "LAMBDA_TASK_ROOT" is not set but --copy-cache is enabled')
        assert(DENO_DIR, 'Env var "DENO_DIR" is not set but --copy-cache is enabled')
        await copy(join(LAMBDA_TASK_ROOT, ".vercel/cache/deno"), DENO_DIR, { overwrite: true })
      }
      debug(`handler permissions: ${permissions}`)
      const AWS_LAMBDA_RUNTIME_API = Deno.env.get("AWS_LAMBDA_RUNTIME_API")
      assert(AWS_LAMBDA_RUNTIME_API, 'Env var "AWS_LAMBDA_RUNTIME_API" is not set')
      const _HANDLER = Deno.env.get("_HANDLER")
      assert(_HANDLER, 'Env var "_HANDLER" is not set')
      const resolved = resolve(_HANDLER as string)
      debug(`handler: ${_HANDLER} → ${resolved}`)
      const runtime = `http://${AWS_LAMBDA_RUNTIME_API}/${RUNTIME_PATH}`
      const handler = await loadHandler(resolved)
      while (true) {
        // Fetch next invocation
        const invocation = await fetch(`${runtime}/invocation/next`)
        assert(invocation.status === 200, `Next invocation failed: ${invocation.status}`)

        // Propagate X-Ray trace ID
        const traceId = invocation.headers.get("lambda-runtime-trace-id")
        Deno.env.delete("_X_AMZN_TRACE_ID")
        if (traceId)
          Deno.env.set("_X_AMZN_TRACE_ID", traceId)

        // Get AWS request ID
        const awsRequestId = invocation.headers.get("lambda-runtime-aws-request-id")
        assert(awsRequestId, 'Header "lambda-runtime-aws-request-id" is not set')

        // Read invocation event
        const event = JSON.parse(await invocation.text())
        try {
          // Parse payload
          const handle = handler as (request: Request) => Promise<Response>
          const payload = JSON.parse(event.body)
          const headers = new Headers(payload.headers)
          headers.set("x-vercel-deno-request-id", awsRequestId as string)
          const body = payload.body ? decodeBase64(payload.body) : undefined
          const base = `${headers.get("x-forwarded-proto")}://${headers.get("x-forwarded-host")}`
          const request = new Request(new URL(payload.path, base), { method: payload.method, headers, body })
          const result = await handle(request)

          // Send invocation response
          const buffer = await result.arrayBuffer()
          const response = await fetch(`${runtime}/invocation/${awsRequestId}/response`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ statusCode: result.status, headers: result.headers, encoding: "base64", body: buffer.byteLength > 0 ? encodeBase64(buffer) : "" }),
          })
          assert(response.status === 202, `Invocation result response failed: ${response.status} ${JSON.stringify(response)}`)
        } // Report invocation error
        catch (exception) {
          const error = exception instanceof Error ? exception : new Error(String(exception))
          warn(`handler error: ${error}`)
          console.error(error)
          const response = await fetch(`${runtime}/invocation/${awsRequestId}/error`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lambda-Runtime-Function-Error-Type": "Unhandled" },
            body: JSON.stringify({ errorType: error.name, errorMessage: error.message, stackTrace: (error.stack ?? "").split("\n").slice(1) }),
          })
          assert(response.status === 202, `Invocation error response failed: ${response.status}`)
          continue
        }
      }
    } catch (error) {
      warn(`runtime error: ${error}`)
      console.error(error)
      Deno.exit(1)
    }
  }
}

/** Load user handler and create the sandboxed worker. */
export async function loadHandler(path: string): Promise<Deno.ServeHandler> {
  // Load permissions
  const permissions = parsePermissions(JSON.parse(Deno.env.get("VERCEL_DENO_PERMISSIONS") || "{}"))
  Deno.env.delete("VERCEL_DENO_PERMISSIONS")
  if ((permissions !== "inherit") && (permissions.read !== "inherit") && (permissions.read !== true)) {
    const filepath = URL.canParse(path) ? new URL(path).pathname : path
    if (permissions.read === false)
      delete permissions.read
    permissions.read ??= []
    if (!permissions.read.includes(filepath)) {
      permissions.read.push(filepath)
      debug(`added read permission for handler file: ${filepath}`)
    }
  }

  // Create worker
  const requests = new Map<string, { resolve: (value: Response) => void; reject: (reason?: unknown) => void }>()
  const worker = new Worker(new URL("./deno_worker.js", import.meta.url).href, {
    name: path,
    type: "module",
    // @ts-expect-error: Deno Worker options
    deno: { permissions },
  })
  const { promise: ready, resolve, reject } = (Promise as unknown as { withResolvers: <T>() => { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } }).withResolvers<void>()
  worker.onmessage = (event) => {
    if (event.data.ready) {
      resolve()
      debug(`handler worker ready: ${path}`)
      return
    }
    if ((event.data.setup) && (event.data.error)) {
      const error = event.data.error instanceof Error ? event.data.error : new Error(String(event.data.error))
      warn(`handler worker setup error: ${error}`)
      requests.forEach(({ reject }) => reject(error))
      reject(error)
      return
    }
    const { id, status, headers, body, error } = event.data
    if (error)
      requests.get(id)?.reject(error)
    else
      requests.get(id)?.resolve(new Response(body ? new Uint8Array(body) : null, { status, headers }))
  }
  worker.postMessage({ id: null, setup: true, path })
  debug(`preparing handler worker: ${path}`)
  await ready

  // Return handler function
  return async function (request: Request): Promise<Response> {
    const { method, headers: _headers, url, body } = request
    const headers = Object.fromEntries(_headers)
    if (!headers["x-vercel-deno-request-id"])
      headers["x-vercel-deno-request-id"] = crypto.randomUUID()
    const id = headers["x-vercel-deno-request-id"] as string
    const { promise, resolve, reject } = (Promise as unknown as { withResolvers: <T>() => { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } }).withResolvers<Response>()
    requests.set(id, { resolve, reject })
    debug(`request ${id}: ${method} ${url}`)
    worker.postMessage({ id, method, headers, url, body: body ? [...new Uint8Array(await request.arrayBuffer())] : null })
    try {
      const response = await promise
      debug(`response ${id}: ${response.status}`)
      return response
    } finally {
      requests.delete(id)
    }
  }
}
