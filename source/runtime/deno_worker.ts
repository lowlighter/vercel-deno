/** Handler. */
let handler = undefined as Deno.ServeHandler | Deno.ServeDefaultExport | undefined

// Listen for messages
self.onmessage = async (event) => {
  try {
    // Load handler
    if (event.data.setup) {
      const { path } = event.data
      try {
        const imported = await import(path)
        if (!imported.default)
          throw new Error(`Handler "${path}" default export is not set`)
        handler = imported.default
        if ((typeof handler === "object") && (handler?.fetch))
          handler = handler.fetch.bind(handler)
        if (typeof handler !== "function")
          throw new Error("Handler is not a function")
        self.postMessage({ ready: true })
      } catch (error) {
        self.postMessage({ setup: true, error })
      }
      return
    }

    // Handle request
    const { id, url, method, headers, body } = event.data
    const request = new Request(url, { method, headers, body: body ? new Uint8Array(body) : undefined })
    const response = await (handler as Deno.ServeHandler)(request, { remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 0 }, completed: Promise.resolve() })
    const buffer = await response.arrayBuffer()
    self.postMessage({ id, status: response.status, headers: Object.fromEntries(response.headers), body: buffer.byteLength > 0 ? [...new Uint8Array(buffer)] : null })
  } catch (error) {
    self.postMessage({ id: event.data.id, status: 500, error })
  }
}
