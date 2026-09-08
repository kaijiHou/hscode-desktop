"""Via CDP, call the renderer's SDK: pty.shells() + pty.list() to see sidecar's real shell resolution and the actual command of each PTY."""
import asyncio, json, urllib.request
import websockets

def pages():
    data = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5).read().decode())
    return next(p for p in data if p.get("type") == "page")

async def main():
    pg = pages()
    async with websockets.connect(pg["webSocketDebuggerUrl"], max_size=None) as ws:
        _id = 0
        async def send(method, params=None, timeout=30):
            nonlocal _id
            _id += 1
            await ws.send(json.dumps({"id": _id, "method": method, "params": params or {}}))
            async with asyncio.timeout(timeout):
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == _id:
                        return msg
        async def js(expr, timeout=40):
            r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
            res = r.get("result", {})
            if "exceptionDetails" in res:
                return "EXC: " + json.dumps(res["exceptionDetails"].get("exception",{}).get("description",""))[:400]
            return res.get("result", {}).get("value")
        await send("Runtime.enable")

        # The renderer exposes an SDK. Find it via the Solid context is hard; instead hit the sidecar
        # HTTP directly from the renderer context (it has the auth in its fetch interceptor).
        # Strategy: use the app's own fetch wrapper. The SDK client is created via createServerSDK;
        # it's stored in a module. Try reaching it via the window or a global the app may set.
        # Fallback: reconstruct a fetch to sidecar with Basic auth found in the DOM/performance entries.
        # Find sidecar port + credentials from performance entries / fetch.
        res = await js(r"""
        (async () => {
          const out = {};
          // discover sidecar port from a recent fetch URL
          let port = null;
          for (const e of performance.getEntriesByType('resource')) {
            const m = (e.name||'').match(/127\.0\.0\.1:(\d{4,5})/);
            if (m) { port = m[1]; break; }
          }
          out.port = port;
          return JSON.stringify(out);
        })()
        """)
        print("port probe:", res)

asyncio.run(main())
