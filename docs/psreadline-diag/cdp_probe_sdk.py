"""Query sidecar's view: config.shell + pty.shells list (via renderer SDK, authenticated)."""
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
        async def js(expr, timeout=30):
            r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
            res = r.get("result", {})
            if "exceptionDetails" in res:
                return "EXC: " + json.dumps(res["exceptionDetails"].get("exception", {}).get("description", res["exceptionDetails"]))[:500]
            return res.get("result", {}).get("value")
        await send("Runtime.enable")

        # Find the app's SDK instance. The app stores server SDK in a context; try to reach
        # the sidecar via a known global. Fallback: read config from the opencode config file path
        # exposed on window, or use the SDK if exposed.
        # Probe window for any sdk/client reference.
        probe = await js(r"""
        (() => {
          const w = window;
          const keys = Object.keys(w).filter(k => /sdk|client|opencode|server/i.test(k));
          return 'window keys: ' + keys.join(',');
        })()
        """)
        print("PROBE:", probe)

asyncio.run(main())
