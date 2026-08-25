import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

// HSCode privacy: never fetch remote models.dev at build time. Use a local
// standalone snapshot (empty by default) unless MODELS_DEV_API_JSON points to
// a real file. This keeps the build offline and self-contained.
const standalone = path.resolve(dir, "scripts/models-dev-standalone.json")
export const modelsData = process.env.MODELS_DEV_API_JSON
  ? await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  : await Bun.file(standalone).text()
console.log("Loaded models.dev snapshot (local, offline)")
