import { cp, mkdir, readdir } from "node:fs/promises"
import { join } from "node:path"
import { resolveChannel } from "./utils"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const src = `./icons/${channel}`
const dest = "resources/icons"

async function copyTree(from: string, to: string) {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name)
    const target = join(to, entry.name)
    if (entry.isDirectory()) await copyTree(source, target)
    else await cp(source, target, { force: true })
  }
}

await copyTree(src, dest)
console.log(`Copied ${channel} icons from ${src} to ${dest}`)
