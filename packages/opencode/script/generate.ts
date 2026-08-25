// HSCode: load models.dev catalog for build.
// Priority:
//  1. MODELS_DEV_API_JSON env var → read that file
//  2. Local standalone snapshot → read if exists (cached from previous fetch)
//  3. Fetch from models.dev API → save for future offline builds
//
// The catalog is provider metadata (names, model IDs, npm packages).
// It does NOT contain API keys or user data.

import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

const MODELS_DEV_URL = "https://models.dev/api.json"

const standalone = path.resolve(dir, "scripts/models-dev-standalone.json")

let modelsData: string

if (process.env.MODELS_DEV_API_JSON) {
  modelsData = await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  console.log(`Loaded models.dev from env: ${process.env.MODELS_DEV_API_JSON}`)
} else if (await Bun.file(standalone).exists()) {
  modelsData = await Bun.file(standalone).text()
  console.log("Loaded models.dev snapshot (local, offline)")
} else {
  console.log(`Fetching models.dev catalog from ${MODELS_DEV_URL}...`)
  const resp = await fetch(MODELS_DEV_URL)
  if (!resp.ok) throw new Error(`Failed to fetch models.dev: ${resp.status} ${resp.statusText}`)
  modelsData = await resp.text()
  await Bun.write(standalone, modelsData)
  console.log(`Fetched and cached models.dev (${modelsData.length} bytes)`)
}

export { modelsData }
