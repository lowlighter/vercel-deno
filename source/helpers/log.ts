// Imports
import process from "node:process"

/** Debug log with gray color. */
export function debug(text: string) {
  console.debug(color(text, 90))
}

/** Info log with cyan color. */
export function info(text: string) {
  console.info(color(text, 36))
}

/** Warn log with yellow color. */
export function warn(text: string) {
  console.warn(color(text, 33))
}

/** Ok log with green color. */
export function ok(text: string) {
  console.log(color(text, 32))
}

/** Colorize text with given color code. */
function color(text: string, colorCode: number) {
  let color = false
  try {
    color = Number(process.env.FORCE_COLOR) > 0
  } catch {
    // ignore
  }
  return color ? `\x1b[${colorCode}m${text}\x1b[0m` : text
}
