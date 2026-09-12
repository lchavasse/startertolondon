/**
 * Converts markdown-style emphasis into real Unicode glyphs for platforms
 * that render no markdown (LinkedIn, X). Neither platform bolds `**text**` —
 * it posts literal asterisks — so Lachlan's actual voice uses Unicode
 * Mathematical Alphanumeric Symbols instead:
 *
 *   **text**  -> 𝗧𝗲𝘅𝘁  (Sans-Serif Bold)         — headline org/event names
 *   *text*    -> 𝘛𝘦𝘹𝘵  (Sans-Serif Bold Italic)  — asides, quiet callbacks
 *
 * Draft with normal markdown (easy to write correctly), then run this over
 * the file before handing it to Lachlan or pushing to Typefully — it leaves
 * everything else (urls, @handles, emoji, punctuation) untouched.
 *
 * Usage:
 *   npm run style:unicode -- docs/posts/2026-07-13-week.md          # print
 *   npm run style:unicode -- docs/posts/2026-07-13-week.md --write  # in-place
 */

import { readFileSync, writeFileSync } from 'node:fs'

const BOLD_UPPER = 0x1d5d4 // A
const BOLD_LOWER = 0x1d5ee // a
const BOLD_DIGIT = 0x1d7ec // 0
const BOLD_ITALIC_UPPER = 0x1d63c // A
const BOLD_ITALIC_LOWER = 0x1d656 // a

function mapChar(ch: string, upperBase: number, lowerBase: number, digitBase?: number): string {
  const code = ch.codePointAt(0)!
  if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(upperBase + (code - 65))
  if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(lowerBase + (code - 97))
  if (digitBase !== undefined && ch >= '0' && ch <= '9') return String.fromCodePoint(digitBase + (code - 48))
  return ch
}

function toSansBold(text: string): string {
  return [...text].map((ch) => mapChar(ch, BOLD_UPPER, BOLD_LOWER, BOLD_DIGIT)).join('')
}

function toSansBoldItalic(text: string): string {
  // Unicode has no italic digit variant — fall back to plain bold digits.
  return [...text].map((ch) => mapChar(ch, BOLD_ITALIC_UPPER, BOLD_ITALIC_LOWER, BOLD_DIGIT)).join('')
}

/** ** first (so *word* inside a **...** run isn't misread as bold-italic), then single *. */
export function convertEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, inner) => toSansBold(inner))
    .replace(/\*(.+?)\*/g, (_, inner) => toSansBoldItalic(inner))
}

/**
 * Only the "# X thread" and "# LinkedIn" sections get posted — Tagging/Shots/Notes
 * are Lachlan's own worksheets and use **bold** as plain markdown, not emphasis to
 * convert. Everything from "# Tagging" onward (or any other heading after LinkedIn)
 * passes through untouched.
 */
export function convertPostSections(fileText: string): string {
  const cutoff = fileText.search(/^# Tagging\b/m)
  if (cutoff === -1) return convertEmphasis(fileText)
  return convertEmphasis(fileText.slice(0, cutoff)) + fileText.slice(cutoff)
}

function main() {
  const file = process.argv[2]
  if (!file || file.startsWith('--')) {
    console.error('usage: npm run style:unicode -- <file.md> [--write]')
    process.exit(1)
  }
  const write = process.argv.includes('--write')
  const input = readFileSync(file, 'utf8')
  const output = convertPostSections(input)
  if (write) {
    writeFileSync(file, output)
    console.log(`✓ converted emphasis in place (X thread + LinkedIn only): ${file}`)
  } else {
    console.log(output)
  }
}

main()
