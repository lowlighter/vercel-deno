// Imports
import Mizu from "@mizu/render/server"
import { fromFileUrl } from "@std/path"
import { join } from "node:path"

/** API directory. */
const api = fromFileUrl(import.meta.resolve("../../api"))

/** Input HTML file. */
const input = fromFileUrl(import.meta.resolve("./index.html"))

/** Output HTML file. */
const output = fromFileUrl(import.meta.resolve("../../dist/public/index.html"))

const mdcontent = await Deno.readTextFile(fromFileUrl(import.meta.resolve("../../README.md")))

/** README file. */
const readme = {
  hero: mdcontent.match(/<!-- <hero> -->([\s\S]*?)<!-- <\/hero> -->/)?.[1] ?? "",
  about: mdcontent.match(/<!-- <about> -->([\s\S]*?)<!-- <\/about> -->/)?.[1] ?? "",
  usage: mdcontent.match(/<!-- <usage> -->([\s\S]*?)<!-- <\/usage> -->/)?.[1] ?? "",
}

/** Examples collection. */
const examples = [] as Array<{ path: string; name: string; description: string; input: unknown; code: string }>
for await (const { name } of Deno.readDir(api)) {
  const path = join(api, name)
  const content = await Deno.readTextFile(path)
  const { description = "", input = null } = await import(path)
  examples.push({ path, name, description, input, code: content.replace(/\/\/ --- META ---[\s\S]*/, "").replace(/^\s*\/\/ deno-lint-ignore(?:-file) .*\n/g, "") })
}

// Render HTML file
let content = await Deno.readTextFile(input)
for (const _ of [1, 2]) {
  content = await Mizu.render(content, { context: { readme, examples } })
  content = content.replaceAll(/class="language-([a-z]+)"/g, "*code[$1]")
}
content = content
  .replaceAll(/id="user-content-/g, 'id="')
  .replaceAll("[!NOTE]", '<b class="accent">ℹ️ Note</b><br>')
  .replaceAll("[!IMPORTANT]", '<b class="variant">⚠️ Important</b><br>')
await Deno.writeTextFile(output, content)
