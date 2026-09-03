// HSCode PSReadLine black-background raw byte capture (dev evidence)
// Spawns powershell.exe via bun-pty (same path HSCode uses), types a command,
// and dumps every ESC sequence from the ConPTY output.
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
    const seq = m[0]
    const key = Buffer.from(seq).toString("hex")
    counts[key] = (counts[key] ?? 0) + 1
  }
  // human-readable
  const readable: Record<string, string> = {}
  for (const [k, v] of Object.entries(counts)) {
    const s = Buffer.from(k, "hex").toString("utf8")
    readable[s.replace(/\x1b/, "ESC")] = v
  }
  const interesting: string[] = []
  for (const [s, v] of Object.entries(readable)) {
    // SGR 37 (fg white) / SGR 40 (bg black) / SGR 0 default reset
    if (/ESC\[(?:[0-9]*;)*(?:37|40|0)\]/.test(s) || /40/.test(s) || /37/.test(s)) {
      interesting.push(`${s} x${v}`)
    }
  }
  console.log(`\n========== ${name} ==========`)
  console.log(`raw bytes: ${raw.length}`)
  console.log(`SGR 37/40/reset sequences: ${interesting.length === 0 ? "NONE" : ""}`)
  for (const i of interesting) console.log(`  ${i}`)
  const allSeqs = Object.keys(readable)
  console.log(`all distinct ESC sequences: ${allSeqs.length}`)
  for (const [s, v] of Object.entries(readable).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${s} x${v}`)
  }
  writeFileSync(
    `D:/hscode/docs/psreadline-capture-${name.replace(/\s+/g, "_")}.txt`,
    Buffer.from(raw, "utf8").toString("base64"),
  )
}

async function capture(name: string, preCommands: string[]) {
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
  // type the repro: command + SPACE + argument
  pty.write("echo")
  await sleep(300)
  pty.write(" ")
  await sleep(500)
  pty.write("hello world")
  await sleep(500)
  pty.write("\r")
  await sleep(2000)
  pty.kill()
  await sleep(500)
  summarize(name, raw)
}

const loaded = Bun.spawnSync(
  ["powershell.exe", "-NoProfile", "-Command", "(Get-Module PSReadLine).Version.ToString()"],
  { stdout: "pipe", stderr: "pipe" },
)
console.log(`PSReadLine loaded at startup: ${loaded.stdout.toString().trim() || "unknown"}`)

const pwsh = Bun.spawnSync(["where.exe", "pwsh"], { stdout: "pipe", stderr: "ignore" })
console.log(`pwsh.exe present: ${pwsh.exitCode === 0 ? pwsh.stdout.toString().trim() : "NO"}`)

// Run 1: normal startup (as HSCode does today, minus the ESC[5 q init)
await capture("run1_plain", [])

// Run 2: Remove-Module PSReadLine first (zero-persistence proof)
await capture("run2_remove_psreadline", ["Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue"])

console.log("\nDONE")
process.exit(0)
