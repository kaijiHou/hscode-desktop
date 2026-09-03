// Verify bundled PSReadLine 2.3.5: does ECH (ESC[nX) disappear on SPACE presses?
import { spawn } from "bun-pty"
import { writeFileSync } from "node:fs"

const PS = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
const BUNDLED = "C:\\ProgramData\\PSReadLine-test\\PSReadLine\\2.3.5\\PSReadLine.psd1"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function summarize(name: string, raw: string) {
  const escRe = /\x1b\[[0-9;?]*[A-Za-z]/g
  const counts: Record<string, number> = {}
  let m: RegExpExecArray | null
  while ((m = escRe.exec(raw)) !== null) {
    const key = Buffer.from(m[0]).toString("hex")
    counts[key] = (counts[key] ?? 0) + 1
  }
  const readable: Record<string, string> = {}
  for (const [k, v] of Object.entries(counts)) {
    readable[Buffer.from(k, "hex").toString("utf8").replace(/\x1b/, "ESC")] = v
  }
  const ech = Object.entries(readable).filter(([s]) => /ESC\[\d*X/.test(s))
  const bg = Object.entries(readable).filter(([s]) => {
    const mm = s.match(/ESC\[[0-9;]*m/)
    if (!mm) return false
    const codes = mm[0].slice(4, -1).split(";").filter((c) => c !== "")
    return codes.some((c) => { const n = Number(c); return (n >= 40 && n <= 47) || n === 48 || (n >= 100 && n <= 107) })
  })
  console.log(`\n===== ${name} ===== raw=${raw.length}`)
  console.log(`ECH sequences: ${ech.length === 0 ? "NONE" : ""}`)
  for (const [s, v] of ech) console.log(`  ${s} x${v}`)
  console.log(`BG SGR: ${bg.length === 0 ? "NONE" : ""}`)
  for (const [s, v] of bg) console.log(`  ${s} x${v}`)
  writeFileSync(`D:/hscode/docs/psreadline-capture-${name}.txt`, Buffer.from(raw, "utf8").toString("base64"))
}

async function capture(name: string, initCmd: string) {
  const pty = spawn(PS, [], {
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
  await sleep(4000)
  pty.write(initCmd + "\r")
  await sleep(2000)
  for (let i = 0; i < 20; i++) { pty.write(" "); await sleep(120) }
  await sleep(800)
  pty.write("\r")
  await sleep(1000)
  pty.kill()
  await sleep(500)
  summarize(name, raw)
}

await capture("D_spaces_bundled235", `Import-Module '${BUNDLED}' -Force`)
console.log("\nDONE")
process.exit(0)
