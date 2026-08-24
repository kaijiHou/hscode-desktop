import { beforeEach, describe, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { SessionProjector } from "@opencode-ai/core/session/projector"

import { AccessToken, AccountID, OrgID, RefreshToken } from "../../src/account/schema"
import { AccountRepo } from "../../src/account/repo"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Session } from "@/session/session"
import type { SessionID } from "../../src/session/schema"
import { ShareNext } from "@/share/share-next"
import { SessionShareTable } from "@opencode-ai/core/share/sql"
import { Database } from "@opencode-ai/core/database/database"
import { eq } from "drizzle-orm"
import { provideTmpdirInstance } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"
import { pollWithTimeout, testEffect } from "../lib/effect"

const env = LayerNode.compile(LayerNode.group([CrossSpawnSpawner.node]))
const it = testEffect(env)

const json = (req: Parameters<typeof HttpClientResponse.fromWeb>[0], body: unknown, status = 200) =>
  HttpClientResponse.fromWeb(
    req,
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )

const none = HttpClient.make(() => Effect.die("unexpected http call"))

function requestLayer(client: HttpClient.HttpClient) {
  const replacement = [httpClient, Layer.succeed(HttpClient.HttpClient, client)] as const
  return LayerNode.compile(LayerNode.group([ShareNext.node, AccountRepo.node]), [replacement])
}

function integrationLayer(client: HttpClient.HttpClient) {
  const replacement = [httpClient, Layer.succeed(HttpClient.HttpClient, client)] as const
  return LayerNode.compile(
    LayerNode.group([
      ShareNext.node,
      EventV2Bridge.node,
      Session.node,
      SessionProjector.node,
      AccountRepo.node,
      Database.node,
    ]),
    [replacement],
  )
}

const share = (id: SessionID) =>
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    return yield* db
      .select()
      .from(SessionShareTable)
      .where(eq(SessionShareTable.session_id, id))
      .get()
      .pipe(Effect.orDie)
  })

const seed = (url: string, org?: string) =>
  AccountRepo.Service.use((repo) =>
    repo.persistAccount({
      id: AccountID.make("account-1"),
      email: "user@example.com",
      url,
      accessToken: AccessToken.make("st_test_token"),
      refreshToken: RefreshToken.make("rt_test_token"),
      expiry: Date.now() + 10 * 60_000,
      orgID: org ? Option.some(OrgID.make(org)) : Option.none(),
    }),
  )

beforeEach(async () => {
  await resetDatabase()
})

describe("ShareNext", () => {
  it.live("request uses legacy share API without active org account", () =>
    provideTmpdirInstance(
      () =>
        ShareNext.Service.use((svc) =>
          Effect.gen(function* () {
            const req = yield* svc.request()

            expect(req.api.create).toBe("/api/share")
            expect(req.api.sync("shr_123")).toBe("/api/share/shr_123/sync")
            expect(req.api.remove("shr_123")).toBe("/api/share/shr_123")
            expect(req.api.data("shr_123")).toBe("/api/share/shr_123/data")
            expect(req.baseUrl).toBe("https://legacy-share.example.com")
            expect(req.headers).toEqual({})
          }),
        ).pipe(Effect.provide(requestLayer(none))),
      { config: { enterprise: { url: "https://legacy-share.example.com" } } },
    ),
  )

  it.live("request uses default URL when no enterprise config", () =>
    provideTmpdirInstance(() =>
      ShareNext.Service.use((svc) =>
        Effect.gen(function* () {
          const req = yield* svc.request()

          expect(req.baseUrl).toBe("https://opncd.ai")
          expect(req.api.create).toBe("/api/share")
          expect(req.headers).toEqual({})
        }),
      ).pipe(Effect.provide(requestLayer(none))),
    ),
  )

  it.live("request uses org share API with auth headers when account is active", () =>
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        yield* seed("https://control.example.com", "org-1")

        const req = yield* ShareNext.use.request()

        expect(req.api.create).toBe("/api/shares")
        expect(req.api.sync("shr_123")).toBe("/api/shares/shr_123/sync")
        expect(req.api.remove("shr_123")).toBe("/api/shares/shr_123")
        expect(req.api.data("shr_123")).toBe("/api/shares/shr_123/data")
        expect(req.baseUrl).toBe("https://control.example.com")
        expect(req.headers).toEqual({
          authorization: "Bearer st_test_token",
          "x-org-id": "org-1",
        })
      }).pipe(Effect.provide(requestLayer(none))),
    ),
  )

  it.live("create is hard-disabled: no HTTP request, returns empty result", () =>
      provideTmpdirInstance(
        () => {
          const createRequests: HttpClientRequest.HttpClientRequest[] = []
          const client = HttpClient.make((req) => {
            createRequests.push(req)
            return Effect.succeed(json(req, { ok: true }))
          })
          return Effect.gen(function* () {
            const session = yield* (yield* Session.Service).create({ title: "test" })

            const result = yield* (yield* ShareNext.Service).create(session.id)

            // HSCode: Session Share 永久禁用 —— create 短路，返回空结果
            expect(result).toEqual({ id: "", url: "", secret: "" })
            expect(yield* share(session.id)).toBeUndefined()
            // 关键断言：零 HTTP 请求
            expect(createRequests).toHaveLength(0)
          }).pipe(Effect.provide(integrationLayer(client)))
        },
        { config: { enterprise: { url: "https://legacy-share.example.com" } } },
      ),
    )

    it.live("remove is hard-disabled: no HTTP request", () =>
      provideTmpdirInstance(
        () => {
          const seen: HttpClientRequest.HttpClientRequest[] = []
          const client = HttpClient.make((req) => {
            seen.push(req)
            return Effect.succeed(HttpClientResponse.fromWeb(req, new Response(null, { status: 200 })))
          })
          return Effect.gen(function* () {
            const session = yield* (yield* Session.Service).create({ title: "test" })
            const service = yield* ShareNext.Service

            yield* service.create(session.id)
            yield* service.remove(session.id)

            // HSCode: disabled 时 remove 短路，零 HTTP 请求
            expect(yield* share(session.id)).toBeUndefined()
            expect(seen).toHaveLength(0)
          }).pipe(Effect.provide(integrationLayer(client)))
        },
        { config: { enterprise: { url: "https://legacy-share.example.com" } } },
      ),
    )

    it.live("disabled via env OPENCODE_DISABLE_SHARE=false cannot re-enable sharing", () =>
          provideTmpdirInstance(() => {
            // HSCode: 环境变量无法恢复 Share 上传（硬禁用）
            process.env["OPENCODE_DISABLE_SHARE"] = "false"
            const seen: HttpClientRequest.HttpClientRequest[] = []
            const client = HttpClient.make((req) => {
              seen.push(req)
              return Effect.succeed(json(req, { ok: true }))
            })
            return Effect.gen(function* () {
              const session = yield* (yield* Session.Service).create({ title: "test" })
              const result = yield* (yield* ShareNext.Service).create(session.id)

              expect(result).toEqual({ id: "", url: "", secret: "" })
              expect(seen).toHaveLength(0)
            })
              .pipe(Effect.provide(integrationLayer(client)))
              .pipe(Effect.onExit(() => Effect.sync(() => delete process.env["OPENCODE_DISABLE_SHARE"])))
          }),
        )

  it.live("create is disabled even on non-ok client: zero HTTP requests", () =>
      provideTmpdirInstance(() => {
        const client = HttpClient.make((req) => Effect.succeed(json(req, { error: "bad" }, 500)))
        return Effect.gen(function* () {
          const session = yield* (yield* Session.Service).create({ title: "test" })

          const result = yield* (yield* ShareNext.Service).create(session.id)

          // HSCode: disabled 短路 —— 不触发 HTTP，客户端返回 500 也不会影响
          expect(result).toEqual({ id: "", url: "", secret: "" })
          expect(yield* share(session.id)).toBeUndefined()
        }).pipe(Effect.provide(integrationLayer(client)))
      }),
    )

    it.live("ShareNext disabled: session diff events do not produce sync HTTP requests", () =>
      provideTmpdirInstance(
        () => {
          const seen: Array<{ url: string; body: string }> = []
          const client = HttpClient.make((req) => {
            if (req.url.endsWith("/sync") && req.body._tag === "Uint8Array") {
              seen.push({ url: req.url, body: new TextDecoder().decode(req.body.body) })
            }
            return Effect.succeed(json(req, { ok: true }))
          })

          return Effect.gen(function* () {
            const events = yield* EventV2Bridge.Service
            const share = yield* ShareNext.Service
            const session = yield* Session.Service

            const info = yield* session.create({ title: "first" })
            yield* share.init()
            yield* Effect.sleep(50)

            yield* events.publish(Session.Event.Diff, {
              sessionID: info.id,
              diff: [
                {
                  file: "a.ts",
                  patch:
                    "Index: a.ts\n===================================================================\n--- a.ts\t\n+++ a.ts\t\n@@ -1,1 +1,1 @@\n-one\n\\ No newline at end of file\n+two\n\\ No newline at end of file\n",
                  additions: 1,
                  deletions: 1,
                  status: "modified",
                },
              ],
            })
            yield* Effect.sleep(200)

            // HSCode: disabled 时事件监听不生效，sync 请求数为 0
            expect(seen).toHaveLength(0)
          }).pipe(Effect.provide(integrationLayer(client)))
        },
        { config: { enterprise: { url: "https://legacy-share.example.com" } } },
      ),
    )
})
