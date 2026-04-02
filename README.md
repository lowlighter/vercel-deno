<!-- <hero> -->

[<img src="https://og-image.vercel.app/**vercel-deno**.png?theme=light&md=1&fontSize=100px&images=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Ffront%2Fassets%2Fdesign%2Fvercel-triangle-black.svg&images=https%3A%2F%2Fgithub.com%2Fdenolib%2Fhigh-res-deno-logo%2Fraw%2Fmaster%2Fdeno_hr_circle.svg&widths=184&widths=220&heights=160&heights=220">](https://github.com/lowlighter/vercel-deno)

The [Deno runtime](https://deno.com) running on [Vercel](https://vercel.com).

<!-- </hero> -->

[Live demo.](https://vercel-deno-runtime.vercel.app)

<!-- <about> -->

# ✨ Features

- Supports deno 2.x+
  - Supports local development with `vercel dev`
- Seamless integration using deno standards:
  - [`Deno.ServeHandler`](https://docs.deno.com/api/deno/~/Deno.ServeHandler)
  - [`Deno.ServeDefaultExport`](https://docs.deno.com/api/deno/~/Deno.ServeDefaultExport)
  - [Deno shebangs](https://docs.deno.com/examples/hashbang_tutorial)
- Advanced configuration, including:
  - Deno version selection
  - Permission management
  - Environment variables
  - Assets pre-caching

# ❓ Frequently Asked Questions

## What's the difference with vercel-community/deno?

This is a full rewrite of the unmaintained [vercel-community/deno](https://github.com/vercel-community/deno) (see [#159](https://github.com/vercel-community/deno/pull/159)).

This implementation has been designed from the ground up to be more aligned with Deno standards. For instance, you can directly reuse code written for [`deno serve`](https://docs.deno.com/runtime/reference/cli/serve/) and handlers for [`Deno.serve`](https://docs.deno.com/api/deno/~/Deno.serve), and it also natively supports
[deno shebangs](https://docs.deno.com/examples/hashbang_tutorial), which minimizes the friction required to deploy existing Deno code to Vercel.

It also provides better support for advanced use-cases, such as specifying environment variables, pre-caching assets, or selecting the Deno version to use through pragmas, and the permissions management system is fully supported.

## Why use Vercel instead of Deno Deploy?

While [Deno Deploy](https://deno.com/deploy) is a great platform, Vercel free tier offers more generous limits for serverless applications.

If you are deploying a fully-fledged Deno application (which requires to be constantly running, requires storage or database, writable filesystem, etc.), Deno Deploy is likely a better fit.

If you are deploying a simple Deno application with simple functions and callbacks, then Vercel with this runtime is a great choice. Note that the free tier of Vercel limits the number of serverless function to 12.

<!-- </about> -->
<!-- <usage> -->

# 📓 Usage

Add the following to your `vercel.json` file:

```js
// vercel.json
{
  "functions": {
    "api/**/*.ts": { "runtime": "@lowlighter/vercel-deno@2.7.11" }
  }
}
```

A serverless function may be defined using an `export default` of one of the following types:

- [`Deno.ServeHandler`](https://docs.deno.com/api/deno/~/Deno.ServeHandler)
- [`Deno.ServeDefaultExport`](https://docs.deno.com/api/deno/~/Deno.ServeDefaultExport)

[See `/api` for examples.](https://vercel-deno-runtime.vercel.app)

# 🪛 Advanced Usage

## Shebangs

Runtime options and permissions may be specified using [deno shebangs](https://docs.deno.com/examples/hashbang_tutorial).

```ts
#!/usr/bin/env -S deno run --allow-sys
export default async function serve() {
  return new Response(Deno.osRelease())
}
```

> [!IMPORTANT]
> The parser only supports shebangs that use `deno run` or `deno serve`.

> [!NOTE]
> The `--allow-read` permission for the function's source file is always implicitly granted as it is required to load and run the handler. Under the hood, the handler is run within a [`WebWorker` with the provided permissions](https://docs.deno.com/api/web/~/WorkerOptions).

## Pragma

Specific instructions may be provided to the runtime using the `//@vercel:` pragma (which must be placed at the top of the file or immediately after the shebang).

| Option      | Alias | Description                              | Multiple | Dev | Default  | Example      |
| ----------- | ----- | ---------------------------------------- | -------- | --- | -------- | ------------ |
| `--version` | `-v`  | Specify the Deno version to use.         |          | N¹  | `latest` | `-v 2.7.11`   |
| `--env`     | `-e`  | Specify environment variables to set.    | Y        | Y   |          | `-e FOO=bar` |
| `--include` | `-i`  | Specify additional modules to pre-cache. | Y        | N²  |          | `-i /assets` |

- ¹: Dev server always uses the currently installed Deno version.
- ²: Dev server always has access to the filesystem and not a subset of it.

```ts
//@vercel: -e FOO=bar
export default async function serve() {
  return new Response(Deno.env.get("FOO"))
}
```

## Deno in build steps

The Deno runtime is only made available by Vercel at runtime during serverless function execution.

If you wish to use it in build steps, you can use the following commands in your `vercel.json`:

```js
// vercel.json
{
  "installCommand": "curl -fsSL https://deno.land/install.sh | sh",
  "buildCommand": "([ -d /vercel ] && /vercel/.deno/bin/deno task build) || true"
}
```

<!-- </usage> -->

# 📜 License

MIT License © 2025 [Lowlighter](https://github.com/lowlighter).
