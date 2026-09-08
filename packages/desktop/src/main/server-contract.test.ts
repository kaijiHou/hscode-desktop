import { describe, expect, test } from "bun:test"
import { assertServerExport } from "./server-contract"

describe("embedded server export contract", () => {
  test("requires Server.listen", () => {
    expect(() => assertServerExport({ Config: {} })).toThrow(
      "virtual:opencode-server export contract invalid; exports=Config",
    )
    expect(() => assertServerExport({ Server: { listen: () => undefined } })).not.toThrow()
  })
})
