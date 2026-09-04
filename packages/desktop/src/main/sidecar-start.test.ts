import { describe, expect, test } from "bun:test"
import { sendSidecarStartOnSpawn, type SidecarStartMessage } from "./sidecar-start"

describe("sidecar startup", () => {
  test("sends the start message only after utility process spawn", () => {
    let onSpawn: (() => void) | undefined
    const messages: SidecarStartMessage[] = []
    const child = {
      once(event: "spawn", listener: () => void) {
        expect(event).toBe("spawn")
        onSpawn = listener
      },
      off(event: "spawn", listener: () => void) {
        expect(event).toBe("spawn")
        if (onSpawn === listener) onSpawn = undefined
      },
      postMessage(message: SidecarStartMessage) {
        messages.push(message)
      },
    }
    const message: SidecarStartMessage = {
      type: "start",
      hostname: "127.0.0.1",
      port: 1234,
      password: "secret",
      userDataPath: "C:\\state",
    }

    const cancel = sendSidecarStartOnSpawn(child, message)
    expect(messages).toEqual([])
    onSpawn?.()
    expect(messages).toEqual([message])

    cancel()
  })
})
