#!/usr/bin/env -S deno serve --allow-env
//@vercel: --env FOO=bar
export default {
  async fetch(request) {
    const { input } = await request.json()
    if (!allowed.includes(input))
      return new Response(`❌ env: ${input} is not allowed`, { status: 400, headers: { "Content-Type": "application/json" } })
    return new Response(`🦴 env: ${input}=${Deno.env.get(input)}`, { headers: { "Content-Type": "application/json" } })
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of a serverless function configuring environment variables through the \`--env\` pragma.

  *You can use the dropdown input below to print the value of the selected environment variable.*
`

export const input = {
  type: "select",
  options: {
    FOO: "FOO",
    _HANDLER: "HANDLER",
    HOME: "HOME",
    PWD: "PWD",
    PATH: "PATH",
    DENO_DIR: "DENO_DIR",
    LAMBDA_TASK_ROOT: "LAMBDA_TASK_ROOT",
    LAMBDA_RUNTIME_DIR: "LAMBDA_RUNTIME_DIR",
    AWS_REGION: "AWS_REGION",
    AWS_LAMBDA_FUNCTION_MEMORY_SIZE: "AWS_LAMBDA_FUNCTION_MEMORY_SIZE",
    VERCEL: "VERCEL",
    VERCEL_REGION: "VERCEL_REGION",
    VERCEL_PROJECT_NAME: "VERCEL_PROJECT_NAME",
    VERCEL_GIT_COMMIT_SHA: "VERCEL_GIT_COMMIT_SHA",
    VERCEL_GIT_COMMIT_REF: "VERCEL_GIT_COMMIT_REF",
    VERCEL_GIT_COMMIT_MESSAGE: "VERCEL_GIT_COMMIT_MESSAGE",
    VERCEL_GIT_COMMIT_AUTHOR_LOGIN: "VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
    VERCEL_GIT_COMMIT_AUTHOR_NAME: "VERCEL_GIT_COMMIT_AUTHOR_NAME",
  },
}

export const allowed = Object.keys(input.options)
