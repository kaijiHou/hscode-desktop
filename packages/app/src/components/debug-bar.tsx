import { useLocation } from "@solidjs/router"
import { createMemo, createSignal, ErrorBoundary, onCleanup, onMount, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServerSync } from "@/context/server-sync"

const tok = (n?: number) => {
  if (n === undefined || Number.isNaN(n)) return
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${n}`
}

const secs = (ms?: number) => {
  if (ms === undefined || Number.isNaN(ms)) return
  return `${(ms / 1000).toFixed(1)}s`
}

type UsageMessage = {
  id?: string
  role?: string
  tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } }
  time?: { created?: number; completed?: number }
}

const session = (path: string) => path.includes("/session")

function Cell(props: {
  bad?: boolean
  dim?: boolean
  inline?: boolean
  label: string
  tip: string
  value: string
  span?: 2 | 3
}) {
  const content = () => (
    <div
      classList={{
        "flex min-w-0 items-center": true,
        "min-h-[20px] w-fit justify-start px-1.5 py-0.5 text-left": !!props.inline,
        "justify-center text-center": !props.inline,
        "min-h-[42px] w-full flex-col rounded-[8px] px-0.5 py-1": !props.inline,
        "col-span-2": props.span === 2 && !props.inline,
        "col-span-3": props.span === 3 && !props.inline,
      }}
    >
      <div
        classList={{
          "flex min-w-0": true,
          "-translate-y-px items-baseline gap-1.5": !!props.inline,
          "flex-col items-center": !props.inline,
        }}
      >
        <div
          classList={{
            "text-[10px] leading-none font-black uppercase tracking-[0.04em] opacity-70": true,
          }}
        >
          {props.label}
        </div>
        <div
          classList={{
            "uppercase leading-none font-bold tabular-nums": true,
            "text-[11px]": !!props.inline,
            "text-[13px] sm:text-[14px]": !props.inline,
            "text-text-on-critical-base": !!props.bad,
            "opacity-70": !!props.dim,
          }}
        >
          {props.value}
        </div>
      </div>
    </div>
  )

  if (props.inline) {
    return (
      <TooltipV2 value={props.tip} placement="top">
        {content()}
      </TooltipV2>
    )
  }

  return (
    <Tooltip value={props.tip} placement="top">
      {content()}
    </Tooltip>
  )
}

function ToggleCell(props: {
  active: boolean
  inline?: boolean
  label: string
  onClick: () => void
  tip: string
  value: string
}) {
  const content = () => (
    <button
      type="button"
      aria-label={`${props.label}: ${props.value}`}
      aria-pressed={props.active}
      classList={{
        "flex min-w-0 items-center font-mono uppercase hover:bg-surface-raised-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-border-focus": true,
        "min-h-[20px] w-fit justify-start rounded px-1.5 py-0.5 text-left": !!props.inline,
        "min-h-[42px] w-full flex-col justify-center rounded-[8px] px-0.5 py-1 text-center": !props.inline,
        "bg-surface-raised-base text-text-strong": props.active,
      }}
      onClick={props.onClick}
    >
      <span
        classList={{
          flex: true,
          "-translate-y-px items-baseline gap-1.5": !!props.inline,
          "flex-col items-center": !props.inline,
        }}
      >
        <span class="text-[10px] leading-none font-black tracking-[0.04em] opacity-70">{props.label}</span>
        <span class="text-[11px] leading-none font-bold">{props.value}</span>
      </span>
    </button>
  )

  if (props.inline) {
    return (
      <TooltipV2 value={props.tip} placement="top">
        {content()}
      </TooltipV2>
    )
  }

  return (
    <Tooltip value={props.tip} placement="top">
      {content()}
    </Tooltip>
  )
}

export function DebugBar(props: { inline?: boolean } = {}) {
  const language = useLanguage()
  const platform = usePlatform()
  const location = useLocation()

  // App-process CPU/memory from the desktop main process (desktop builds only).
  const [proc, setProc] = createStore<{ cpu?: number; rss?: number }>({})

  onMount(() => {
    // Local cast: the renderer-side Window.api augmentation may lag the preload bridge.
    const stats = () => (window as unknown as { api?: { processStats?: () => Promise<{ cpuPercent: number; rssMB: number }> } }).api
      ?.processStats
    let timer: number | undefined
    const tick = async () => {
      try {
        const next = await stats()?.()
        if (next) setProc({ cpu: next.cpuPercent, rss: next.rssMB })
      } catch {}
    }
    void tick().then(() => {
      if (stats()) timer = window.setInterval(tick, 2000)
    })
    onCleanup(() => {
      if (timer !== undefined) clearInterval(timer)
    })
  })

  const [state, setState] = createStore({ focus: false })

  const na = () => language.t("debugBar.na").toUpperCase()
  const toggleFocus = async () => {
    if (!platform.setForceFocus) return
    const enabled = !state.focus
    await platform.setForceFocus(enabled)
    setState("focus", enabled)
  }

  onCleanup(() => {
    if (state.focus) void platform.setForceFocus?.(false).catch(() => undefined)
  })

  let prev = ""
  let start = 0
  let init = false
  let one = 0
  let two = 0

  return (
    <aside
      aria-label={language.t("debugBar.ariaLabel")}
      classList={{
        "pointer-events-auto hidden overflow-hidden text-text-strong md:block": true,
        "mt-[-6px] w-full shrink-0 px-3 py-1": !!props.inline,
        "fixed bottom-3 right-3 z-50 w-[308px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border-base bg-surface-raised-stronger-non-alpha p-0.5 shadow-[var(--shadow-lg-border-base)] sm:bottom-4 sm:right-4 sm:w-[324px]":
          !props.inline,
      }}
    >
      <div
        classList={{
          "font-mono": true,
          "gap-[9px]": !!props.inline,
          "gap-px": !props.inline,
          "flex w-full flex-nowrap items-center justify-center": !!props.inline,
          "grid-cols-4": !props.inline,
          grid: !props.inline,
        }}
      >
        {/* Plain-language session stats (dsh style) — requires the server-sync
            provider, which some layouts mount the bar outside of; the boundary
            hides the section instead of crashing the page. */}
        <ErrorBoundary fallback={null}>
          <SessionUsageCells inline={props.inline} />
        </ErrorBoundary>
        <Cell
          label="CPU"
          tip="HSCode 主进程的 CPU 占用（占单核百分比，随负载波动）"
          value={proc.cpu !== undefined ? `${Math.min(100, Math.max(1, Math.round(proc.cpu)))}%` : na()}
          dim={proc.cpu === undefined}
          inline={props.inline}
        />
        <Cell
          label="内存"
          tip="整个 HSCode 应用占用的物理内存（包含所有会话，不是单指当前对话）"
          value={proc.rss !== undefined ? `${proc.rss.toFixed(0)}MB` : na()}
          dim={proc.rss === undefined}
          inline={props.inline}
        />
        <ToggleCell
          active={language.direction() === "rtl"}
          inline={props.inline}
          label={language.t("debugBar.direction.label")}
          tip={language.t("debugBar.direction.tip")}
          value={language.t(`debugBar.direction.${language.direction()}`)}
          onClick={() => language.setDirection(language.direction() === "rtl" ? "ltr" : "rtl")}
        />
      </div>
    </aside>
  )
}

// Observed time-to-first-token per assistant message (sampled while the bar
// is open; renderer-observed, so it includes a little client latency).
const ttftSamples = new Map<string, number>()

// Session LLM stats fetched straight from the local server API — the debug
// bar renders outside the route providers, so contexts are unavailable here.
// The call site wraps this in an ErrorBoundary: worst case the section hides.
function SessionUsageCells(props: { inline?: boolean }) {
  const location = useLocation()
  const language = useLanguage()
  const na = () => language.t("debugBar.na").toUpperCase()
  const [ttft, setTtft] = createSignal<number>()
  const [rows, setRows] = createSignal<{ info: UsageMessage; parts: { type?: string }[] }[]>([])

  const sessionID = () => {
    const seg = location.pathname.split("/").filter(Boolean)
    return seg[0] === "server" ? seg[3] : seg[1] === "session" ? seg[2] : undefined
  }

  onMount(() => {
    let base: string | undefined
    let auth: string | undefined
    let timer: number | undefined
    const poll = async () => {
      const id = sessionID()
      if (!id || !base) return
      try {
        const init: RequestInit = auth ? { headers: { authorization: auth } } : {}
        const res = await fetch(`${base}/session/${id}/message`, init)
        if (!res.ok) return
        const data = (await res.json()) as unknown
        const list = Array.isArray(data) ? (data as { info?: UsageMessage; parts?: { type?: string }[] }[]) : []
        setRows(
          list.filter((row): row is { info: UsageMessage; parts: { type?: string }[] } => !!row.info),
        )
        const last = [...list].reverse().find((row) => row.info?.role === "assistant" && !!row.info?.id)
        if (last?.info?.id && !ttftSamples.has(last.info.id)) {
          const created = last.info.time?.created
          if (created) {
            ttftSamples.set(last.info.id, Date.now() - created)
            let sum = 0
            for (const v of ttftSamples.values()) sum += v
            setTtft(sum / ttftSamples.size)
          }
        }
      } catch {}
    }
    void (async () => {
      for (let i = 0; i < 30 && !base; i++) {
        try {
          const ready = await window.api?.awaitInitialization?.()
          if (ready?.url) {
            base = ready.url.replace(/\/+$/, "")
            if (ready.username) auth = `Basic ${btoa(`${ready.username}:${ready.password ?? ""}`)}`
          }
        } catch {}
        if (!base) await new Promise((r) => setTimeout(r, 1000))
      }
      if (!base) return
      void poll()
      timer = window.setInterval(poll, 2000)
    })()
    onCleanup(() => {
      if (timer !== undefined) clearInterval(timer)
    })
  })

  const usage = createMemo(() => {
    const list = rows()
    if (list.length === 0) return undefined
    let rounds = 0
    let steps = 0
    let inTok = 0
    let outTok = 0
    let cacheRead = 0
    let llmMs = 0
    for (const row of list) {
      const m = row.info
      if (!m || m.role !== "assistant") continue
      rounds++
      steps += (row.parts ?? []).filter((p) => p.type === "tool").length
      const t = m.tokens
      if (t) {
        inTok += t.input ?? 0
        outTok += (t.output ?? 0) + (t.reasoning ?? 0)
        cacheRead += t.cache?.read ?? 0
      }
      const created = m.time?.created
      const completed = m.time?.completed
      if (created && completed && completed > created) llmMs += completed - created
    }
    const cacheBase = inTok + cacheRead
    return {
      rounds,
      steps,
      inTok,
      outTok,
      llmMs,
      cachePct: cacheBase > 0 ? cacheRead / cacheBase : undefined,
      avgRate: llmMs > 0 ? outTok / (llmMs / 1000) : undefined,
    }
  })

  return (
    <>
      <Cell
        label="轮次"
        tip="当前会话 AI 回复的轮数"
        value={usage() ? `${usage()!.rounds}` : na()}
        dim={!usage()}
        inline={props.inline}
      />
      <Cell
        label="步"
        tip="本会话 agent 执行的工具调用步数"
        value={usage() ? `${usage()!.steps}` : na()}
        dim={!usage()?.steps}
        inline={props.inline}
      />
      <Cell
        label="生成耗时"
        tip="当前会话模型生成回复的总耗时"
        value={usage() ? (secs(usage()!.llmMs) ?? na()) : na()}
        dim={!usage()?.llmMs}
        inline={props.inline}
      />
      <Cell
        label="首token"
        tip="平均首 token 延迟（本机轮询观测，粒度约 2 秒；仅在统计条打开期间统计）"
        value={ttft() !== undefined ? `${(ttft()! / 1000).toFixed(1)}s` : na()}
        dim={ttft() === undefined}
        inline={props.inline}
      />
      <Cell
        label="输出速度"
        tip="本会话平均输出速度（token/秒）"
        value={usage()?.avgRate !== undefined ? `${usage()!.avgRate!.toFixed(0)} t/s` : na()}
        dim={usage()?.avgRate === undefined}
        inline={props.inline}
      />
      <Cell
        label="缓存命中"
        tip="提示词缓存命中率——命中的部分不用重新计费计算，越高越省"
        value={usage()?.cachePct !== undefined ? `${Math.round(usage()!.cachePct! * 100)}%` : na()}
        dim={usage()?.cachePct === undefined}
        inline={props.inline}
      />
      <Cell
        label="输入"
        tip="当前对话的上下文体积：本会话累计发给模型的输入 token（不含缓存命中）"
        value={usage() ? (tok(usage()!.inTok) ?? na()) : na()}
        dim={!usage()?.inTok}
        inline={props.inline}
      />
      <Cell
        label="输出"
        tip="本会话模型累计输出的 token（含思考内容）"
        value={usage() ? (tok(usage()!.outTok) ?? na()) : na()}
        dim={!usage()?.outTok}
        inline={props.inline}
      />
    </>
  )
}
