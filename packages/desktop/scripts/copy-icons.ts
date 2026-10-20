import { cp } from "node:fs/promises"
import { resolveChannel } from "./utils"

const arg = process.argv[2]

const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const src = `./icons/${channel}`

const dest = "resources/icons"

await cp(src, dest, { recursive: true, force: true })

console.log(`Copied ${channel} icons from ${src} to ${dest}`)
