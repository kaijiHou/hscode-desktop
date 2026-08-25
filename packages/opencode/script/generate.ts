// HSCode: load models.dev catalog for build.
// Privacy: NEVER fetch from models.dev at build time.
// The bundled snapshot (models-dev-standalone.json) must contain all provider data.
// If missing, the build should fail with a clear error, not silently fetch.

import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

const standalone = path.resolve(dir, "scripts/models-dev-standalone.json")

let modelsData: string

if (process.env.MODELS_DEV_API_JSON) {
  modelsData = await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  console.log(`Loaded models.dev from env: ${process.env.MODELS_DEV_API_JSON}`)
} else if (await Bun.file(standalone).exists()) {
  modelsData = await Bun.file(standalone).text()
  console.log("Loaded models.dev snapshot (local, offline)")
} else {
  throw new Error(
    `HSCode build error: models-dev-standalone.json not found at ${standalone}\n` +
    `This file contains provider metadata for offline use.\n` +
    `Generate it by running: cd packages/opencode && bun script/generate.ts --fetch\n` +
    `Then commit the file to the repository.`
  )
}

export { modelsData }
