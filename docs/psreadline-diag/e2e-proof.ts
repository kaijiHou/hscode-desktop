// End-to-end runtime proof: spawn powershell.exe with the EXACT init args that
// pty.ts produces via Shell.legacyPowerShellCompatArgs, press spaces, count ECH.
import { spawn } from "bun-pty"
import { Shell } from "../../packages/core/src/shell"

const PS = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const args = Shell.legacyPowerShellCompatArgs(PS)!
console.log("init args pty.ts will use:", args)
const decoded = Buffer.from(args[2], "base64").toString("utf16le")
console.log("decoded init cmd:", decoded)

const pty = spawn(PS, args, {
  name: "xterm-256color",
  cols: 120,
  rows: 30,
  cwd: "D:/hscode",
  env: {
    ...process.env,
    TERM: "xterm-256color",
    OPENCODE_TERMINAL: "1",
    LC_ALL: "C.UTF-8",
    LC_CTYPE: "C.UTF-8",
    LANG: "C.UTF-8",
  },
} as any)

let raw = ""
pty.onData((d: string) => { raw += d })
await sleep(4500)
// Press 20 spaces (the user's exact repro), then commit.
for (let i = 0; i < 20; i++) { pty.write(" "); await sleep(120) }
await sleep(800)
pty.write("\r")
await sleep(1200)
pty.kill()
await sleep(600)

const seqs = raw.match(/\x1b\[[0-9;?]*[A-Za-z]/g) ?? []
const ech = seqs.filter((s) => /^\x1b\[[0-9]*X$/.test(s))
const bgSgr = seqs.filter((s) => {
  const m = s.match(/^\x1b\[(\d+(?:;\d+)*)m$/)
  if (!m) return false
  return m[1].split(";").some((c) => {
    const n = Number(c)
    return (n >= 40 && n <= 47) || n === 48 || (n >= 100 && n <= 107)
  })
})
console.log(`\nraw bytes: ${raw.length}`)
console.log(`ECH (ESC[nX) sequences: ${ech.length}${ech.length ? "  -> " + JSON.stringify(ech) : "  (NONE - fix working)"}`)
console.log(`BG SGR sequences: ${bgSgr.length}${bgSgr.length ? "  -> " + JSON.stringify(bgSgr) : "  (NONE)"}`)
console.log(`\nVERDICT: ${ech.length === 0 ? "PASS — no ECH, no black block growth" : "FAIL — ECH still present"}`)
process.exit(0)
