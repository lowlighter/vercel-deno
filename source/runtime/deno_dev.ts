// Imports
import { loadHandler } from "./deno.ts"

// Load handler
const entrypoint = Deno.env.get("VERCEL_DEV_ENTRYPOINT")
Deno.env.delete("VERCEL_DEV_ENTRYPOINT")
const handler = await loadHandler(`file://${entrypoint}`)

// Start server
Deno.serve({
  port: 0,
  async onListen({ port }) {
    const bytes = new TextEncoder().encode(String(port))
    try {
      await using portFd = await Deno.open("/dev/fd/3", { read: false, write: true })
      portFd.writeSync(bytes)
    } catch {
      // See: https://github.com/denoland/deno/issues/6305
      await Deno.writeFile(Deno.env.get("VERCEL_DEV_PORT_FILE")!, bytes)
    } finally {
      Deno.env.delete("VERCEL_DEV_PORT_FILE")
    }
  },
}, handler)
