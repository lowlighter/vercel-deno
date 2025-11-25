#!/usr/bin/env -S deno run
const text = { rock: "🪨 Rock", paper: "📜 Paper", scissors: "✂️ Scissors" }

export default {
  async fetch(request) {
    const { input } = await request.json()
    const cpu = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)]
    switch (true) {
      case (input === "rock") && (cpu === "scissors"):
      case (input === "paper") && (cpu === "rock"):
      case (input === "scissors") && (cpu === "paper"):
        return new Response(`You chose [${text[input]}], I chose [${text[cpu]}]. You win! 🎉`)
      case (input === "rock") && (cpu === "paper"):
      case (input === "paper") && (cpu === "scissors"):
      case (input === "scissors") && (cpu === "rock"):
        return new Response(`You chose [${text[input]}], I chose [${text[cpu]}]. I win! 🤖`)
      default:
        return new Response(`We both chose [${text[input]}]. It's a tie! 🤝`)
    }
  },
} satisfies Deno.ServeDefaultExport

// --- META ---
export const description = `
  Example of an interactive serverless function that reads a [\`Request.body\`](https://developer.mozilla.org/en-US/docs/Web/API/Request/body) provided by an end-user
  and and plays a game of Rock Paper Scissors against them.
`

export const input = { type: "select", options: text }
