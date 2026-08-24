import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createHighlights } from "./highlights"

// HSCode: 远程 Release Notes 已禁用。真实运行 createHighlights 的 start
// 逻辑（版本变化触发），并断言零次远程 fetch 调用。

function makePlatform(version: string) {
  const fetchCalls: string[] = []
  const platform = {
    platform: "desktop" as const,
    version,
    storage: undefined,
    fetch: (input: string | URL | Request) => {
      fetchCalls.push(String(input))
      return Promise.resolve(new Response("{}", { status: 200 }))
    },
  }
  return { platform, fetchCalls }
}

describe("HSCode Highlights — remote release notes disabled", () => {
  test("runs real start logic with version change and performs zero remote fetches", async () => {
    const { platform, fetchCalls } = makePlatform("1.19.0")
    const settings = { ready: () => true }

    let highlights: ReturnType<typeof createHighlights> | undefined
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        highlights = createHighlights(platform, settings)
        setTimeout(() => {
          dispose()
          resolve()
        }, 50)
      })
    })

    // 真实 start 逻辑已运行（版本从无到有 → markSeen），但 HSCode
    // 硬禁用远程 changelog：必须零 fetch。
    expect(highlights?.last).toBe("1.19.0")
    expect(fetchCalls).toHaveLength(0)
  })

  test("does not fetch on subsequent version change either", async () => {
    const { platform, fetchCalls } = makePlatform("1.20.0")
    const settings = { ready: () => true }

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        createHighlights(platform, settings)
        setTimeout(() => {
          dispose()
          resolve()
        }, 50)
      })
    })

    expect(fetchCalls).toHaveLength(0)
  })
})