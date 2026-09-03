// HSCode PSReadLine black-background raw byte capture (dev evidence) — extended
// Replicates the user's exact repro (20 SPACE presses at empty prompt) plus
// argument/quote/pipe commands, with and without PSReadLine loaded.
import { spawn } from "bun-pty"
import { writeFileSync } from "node:fs"

const PS = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

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
    const s = Buffer.from(k, "hex").toString("utf8")
    readable[s.replace(/\x1b/, "ESC")] = v
  }
  const bg: string[] = []
  for (const [s, v] of Object.entries(readable)) {
    // any background SGR: 40-47, 48;2;..., 48;5;..., 100-107
    const m2 = s.match(/ESC\[[0-9;]*m/)
    if (m2) {
      const codes = m2[0].slice(4, -1).split(";").filter((c) => c !== "")
      const hasBg = codes.some((c) => {
        const n = Number(c)
        return (n >= 40 && n <= 47) || n === 48 || (n >= 100 && n <= 107)
      })
      if (hasBg) bg.push(`${s} x${v}`)
    }
  }
  console.log(`\n========== ${name} ==========`)
  console.log(`raw bytes: ${raw.length}`)
  console.log(`BACKGROUND SGR sequences: ${bg.length === 0 ? "NONE" : ""}`)
  for (const i of bg) console.log(`  ${i}`)
  console.log(`all distinct ESC sequences: ${Object.keys(readable).length}`)
  for (const [s, v] of Object.entries(readable).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`  ${s} x${v}`)
  }
  writeFileSync(`D:/hscode/docs/psreadline-capture-${name}.txt`, Buffer.from(raw, "utf8").toString("base64"))
}

async function capture(name: string, preCommands: string[], typeFn: (pty: any) => Promise<void>) {
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
  pty.onData((d: string) => {
    raw += d
  })
  await sleep(4000)
  for (const cmd of preCommands) {
    pty.write(cmd + "\r")
    await sleep(1500)
  }
  await typeFn(pty)
  pty.kill()
  await sleep(500)
  summarize(name, raw)
}

// Repro A: 20 SPACE presses at empty prompt (user's exact repro)
const spaces = async (pty: any) => {
  for (let i = 0; i < 20; i++) {
    pty.write(" ")
    await sleep(120)
  }
  await sleep(800)
  pty.write("\r")
  await sleep(1000)
}

// Repro B: command + space + argument
const echoArg = async (pty: any) => {
  pty.write("echo hello world")
  await sleep(400)
  pty.write("\r")
  await sleep(1000)
}

// Repro C: quotes + pipe + operator
const quoted = async (pty: any) => {
  pty.write("Get-ChildItem D:\\ -Filter *.ts | Select-Object Name")
  await sleep(400)
  pty.write("\r")
  await sleep(1500)
}

const REMOVE = "Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue"

// loaded version for the record
const ver = Bun.spawnSync(["powershell.exe", "-NoProfile", "-Command", "Import-Module PSReadLine; (Get-Module PSReadLine).Version.ToString()"], {
  stdout: "pipe",
  stderr: "pipe",
})
console.log(`PSReadLine version on this machine: ${ver.stdout.toString().trim()}`)

await capture("A_spaces_plain", [], spaces)
await capture("A_spaces_nopsreadline", [REMOVE], spaces)
await capture("B_echoarg_plain", [], echoArg)
await capture("B_echoarg_nopsreadline", [REMOVE], echoArg)
await capture("C_quoted_plain", [], quoted)
await capture("C_quoted_nopsreadline", [REMOVE], quoted)

console.log("\nDONE")
process.exit(0)
