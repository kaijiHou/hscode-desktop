import { execFile } from "node:child_process"
import * as fs from "node:fs/promises"

import { defineConfig } from "electron-vite"
import appPlugin from "@opencode-ai/app/vite"

const OPENCODE_SERVER_DIST = "../opencode/dist/node"

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`

// Every named export the renderer graph's node-only packages (@effect/
// platform-node*, undici, llm protocols, glob) pull from node builtins.
// Stubbed at build time: that chain is statically reachable but never
// executes in the renderer. Missing a name fails the build with its exact
// spelling — add it to this list.
const NODE_STUB_EXPORT_NAMES = [
  "Agent",
  "Assert",
  "AssertionError",
  "availableParallelism",
  "basename",
  "Blob",
  "BlockList",
  "Buffer",
  "chdir",
  "chmod",
  "chmodSync",
  "chown",
  "chownSync",
  "close",
  "closeSync",
  "constants",
  "copyFile",
  "copyFileSync",
  "cp",
  "createGzip",
  "createHash",
  "createHmac",
  "createInterface",
  "createReadStream",
  "createServer",
  "createWriteStream",
  "DatabaseSync",
  "debuglog",
  "deflate",
  "delimiter",
  "dirname",
  "Duplex",
  "EOL",
  "emitKeypressEvents",
  "env",
  "exec",
  "execFile",
  "execFileSync",
  "exists",
  "existsSync",
  "exit",
  "extname",
  "File",
  "findPackageJSON",
  "finished",
  "fdatasync",
  "format",
  "fork",
  "fsync",
  "glob",
  "globSync",
  "hrtime",
  "IncomingMessage",
  "inspect",
  "Interface",
  "isAbsolute",
  "join",
  "lstat",
  "lstatSync",
  "mkdtemp",
  "mkdtempSync",
  "nextTick",
  "normalize",
  "open",
  "openAsBlob",
  "opendir",
  "opendirSync",
  "openSync",
  "parse",
  "pathToFileURL",
  "pid",
  "platform",
  "pipeline",
  "posix",
  "ppid",
  "promisify",
  "randomBytes",
  "randomUUID",
  "read",
  "readFile",
  "readFileSync",
  "readlink",
  "readlinkSync",
  "readSync",
  "readv",
  "realpath",
  "realpathSync",
  "relative",
  "rename",
  "renameSync",
  "request",
  "resolve",
  "rmdir",
  "rmdirSync",
  "rm",
  "rmSync",
  "sep",
  "Server",
  "ServerResponse",
  "spawn",
  "stat",
  "Stats",
  "statSync",
  "stderr",
  "stdin",
  "stdout",
  "styleText",
  "symlink",
  "symlinkSync",
  "syncBuiltinESMExports",
  "stripTypeScriptTypes",
  "TextDecoder",
  "TextEncoder",
  "threadId",
  "timeout",
  "setTimeout",
  "TLSSocket",
  "tmpdir",
  "truncate",
  "truncateSync",
  "types",
  "unzip",
  "unlink",
  "unlinkSync",
  "unwatchFile",
  "urlToHttpOptions",
  "URL",
  "URLSearchParams",
  "utimes",
  "utimesSync",
  "validateHeaderName",
  "validateHeaderValue",
  "versions",
  "WASI",
  "watch",
  "watchFile",
  "webcrypto",
  "win32",
  "WriteStream",
  "write",
  "writeFile",
  "writeFileSync",
  "writeSync",
  "writev",
  "writevSync",
  "createHmac",
  "createPrivateKey",
  "createPublicKey",
  "generateKeyPairSync",
  "getEventListeners",
  "setMaxListeners",
]

// HSCode: Sentry sourcemap 上传插件已彻底移除（隐私清理），构建产物不再上传到 Sentry

export default defineConfig({
  main: {
    define: {
      "import.meta.env.OPENCODE_CHANNEL": JSON.stringify(channel),
    },
    build: {
      rollupOptions: {
        input: {
          index: "src/main/index.ts",
          sidecar: "src/main/sidecar.ts",
          // HSCode Network Inspector: capture worker must be a separate bundle
          // entry, otherwise `new Worker(...)` at runtime points to a .ts file
          // that does not exist in out/main → MODULE_NOT_FOUND / instant crash.
          "capture-worker": "src/main/network/capture-worker.ts",
        },
        // Keep this identical to electron-vite's Node 20.11+ shim. Its regex insertion can
        // corrupt bundled TypeScript, while a Rollup banner places the shim safely.
        output: {
          banner: `
// -- CommonJS Shims --
import __cjs_mod__ from 'node:module';
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require = __cjs_mod__.createRequire(import.meta.url);
`,
        },
      },
      externalizeDeps: { include: [nodePtyPkg] },
    },
    plugins: [
      {
        name: "opencode:node-pty-narrower",
        enforce: "pre",
        resolveId(s) {
          if (s === "@lydell/node-pty") return nodePtyPkg
        },
      },
      {
        name: "opencode:virtual-server-module",
        enforce: "pre",
        resolveId(id) {
          if (id === "virtual:opencode-server") return this.resolve(`${OPENCODE_SERVER_DIST}/node.js`)
        },
      },
      {
        name: "opencode:copy-server-assets",
        async writeBundle() {
          for (const l of await fs.readdir(OPENCODE_SERVER_DIST)) {
            if (!l.endsWith(".wasm")) continue
            await fs.writeFile(`./out/main/chunks/${l}`, await fs.readFile(`${OPENCODE_SERVER_DIST}/${l}`))
          }
        },
      },
    ],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: "src/preload/index.ts" },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    plugins: [
      appPlugin,
      {
        // Renderer stub for node builtins: the app graph statically reaches
        // node-only packages (@effect/platform-node*, undici, llm protocols)
        // through lazy code paths that never execute in the renderer. Stub
        // every node:/bare builtin import so the production build passes; a
        // missing named export fails the build with the exact name to add.
        name: "hscode:renderer-node-stub",
        enforce: "pre",
        resolveId(id) {
          const BARE = new Set([
            "fs", "fs/promises", "path", "path/posix", "path/win32", "stream", "stream/promises", "stream/web",
            "http", "https", "crypto", "os", "net", "tls", "url", "util", "util/types", "zlib", "events",
            "child_process", "readline", "readline/promises", "buffer", "process", "string_decoder", "assert",
            "assert/strict", "querystring", "module", "tty", "dns", "dns/promises", "timers", "timers/promises",
            "vm", "worker_threads", "async_hooks", "perf_hooks", "trace_events", "v8", "domain",
            "punycode", "sys", "wasi", "constants",
          ])
          const name = id.startsWith("node:") ? id.slice(5) : id
          if (id.startsWith("node:") || BARE.has(name)) return "hscode-virtual-node-stub:node:" + name
        },
        load(id) {
          if (!id.startsWith("hscode-virtual-node-stub:node:")) return
          const prelude = "const noop = () => {}"
          const stub = { __isNodeStub: true }
          return (
            prelude +
            "\nexport default stub\n" +
            NODE_STUB_EXPORT_NAMES.map((n) => `export const ${n} = noop`).join("\n")
          )
        },
      },
    ],
    publicDir: "../../../app/public",
    root: "src/renderer",
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          main: "src/renderer/index.html",
        },
      },
    },
  },
})
