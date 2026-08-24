import { createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { usePlatform, type Platform } from "@/context/platform"
import { useSettings } from "@/context/settings"
import { persisted } from "@/utils/persist"

// HSCode: 远程 Release Notes 已禁用（隐私清理）。
// 不再请求任何远程 changelog / release notes 服务，本地 CHANGELOG.md 保留。

type Store = {
  version?: string
}

export type Highlights = {
  ready: () => boolean
  from: () => string | undefined
  to: () => string | undefined
  last: string | undefined
  markSeen: () => void
}

// HSCode: 可测试的工厂 —— 不使用任何远程 fetch。
// 传入 fake platform/settings 即可运行真实 start 逻辑并断言 0 次远程请求。
export function createHighlights(platform: Pick<Platform, "version" | "storage" | "platform">, settings: { ready: () => boolean }): Highlights {
  const [store, setStore, _, ready] = persisted(
    "highlights.v1",
    createStore<Store>({ version: undefined }),
    platform as Platform,
  )

  const [range, setRange] = createStore({
    from: undefined as string | undefined,
    to: undefined as string | undefined,
  })
  const state = { started: false }

  const markSeen = () => {
    if (!platform.version) return
    setStore("version", platform.version)
  }

  const start = (previous: string) => {
    // HSCode: 远程 Release Notes 禁用 —— 不请求任何远程 changelog，
    // 直接标记已读，避免产生外联请求；本地 CHANGELOG.md 保留。
    void previous
    markSeen()
    return
  }

  createEffect(() => {
    if (state.started) return
    if (!ready()) return
    if (!settings.ready()) return
    if (!platform.version) return
    state.started = true

    const previous = store.version
    if (!previous) {
      setStore("version", platform.version)
      return
    }

    if (previous === platform.version) return

    setRange({ from: previous, to: platform.version })
    start(previous)
  })

  return {
    ready,
    from: () => range.from,
    to: () => range.to,
    get last() {
      return store.version
    },
    markSeen,
  }
}

export const { use: useHighlights, provider: HighlightsProvider } = createSimpleContext({
  name: "Highlights",
  gate: false,
  init: () => createHighlights(usePlatform(), useSettings()),
})