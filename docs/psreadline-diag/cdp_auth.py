"""Query the running PTY list via the page's own SDK (authenticated), dump command/args of each session."""
import asyncio, json, urllib.request
import websockets

def pages():
    data = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5).read().decode())
    return next(p for p in data if p.get("type") == "page")

async def main():
    pg = pages()
    async with websockets.connect(pg["webSocketDebuggerUrl"], max_size=None) as ws:
        _id = 0
        async def send(method, params=None, timeout=25):
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
                return "EXC: " + json.dumps(res["exceptionDetails"])[:400]
            return res.get("result", {}).get("value")
        await send("Runtime.enable")

        # Find auth token from app: try localStorage / session storage / window globals
        token = await js(r"""
        (() => {
          for (const store of [localStorage, sessionStorage]) {
            for (let i = 0; i < store.length; i++) {
              const k = store.key(i);
              if (/token|auth|key/i.test(k)) return 'STORE:' + k + '=' + store.getItem(k).slice(0, 120);
            }
          }
          return 'NO_TOKEN_FOUND';
        })()
        """)
        print("token probe:", token)

        # Use the app's fetch with credentials to the sidecar — find the sidecar URL from app
        probe = await js(r"""
        (() => {
          const cands = [];
          try {
            // The app may expose a global sdk or use a known port from a config script tag
            const metas = Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent).filter(t => /5800|sidecar|token/i.test(t || ''));
            cands.push('inline:' + metas.join(' | ').slice(0, 300));
          } catch(e) {}
          return cands.join(' || ') || 'NONE';
        })()
        """)
        print("sidecar probe:", probe)

asyncio.run(main())
