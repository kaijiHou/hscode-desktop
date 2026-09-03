"""Click 新建终端 in the open terminal panel."""
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
        async def js(expr, timeout=25):
            r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
            return r.get("result", {}).get("result", {}).get("value")
        await send("Runtime.enable")
        clicked = await js(r"""
        (() => {
          const b = Array.from(document.querySelectorAll('button, [role="button"]'))
            .find(x => (x.getAttribute('aria-label')||'') === '新建终端' || (x.textContent||'').trim() === '新建终端');
          if (!b) return 'NO_BTN';
          b.click(); return 'CLICKED';
        })()
        """)
        print("new-terminal:", clicked)

asyncio.run(main())
