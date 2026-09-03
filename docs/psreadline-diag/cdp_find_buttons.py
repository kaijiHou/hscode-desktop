"""CDP driver: open a new terminal tab in HSCode, then dump the PTY create log."""
import asyncio, json, sys, urllib.request, re

async def main():
    data = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5).read().decode())
    page = next(p for p in data if p.get("type") == "page")
    ws_url = page["webSocketDebuggerUrl"]

    import websockets
    async with websockets.connect(ws_url, max_size=None) as ws:
        _id = 0
        async def send(method, params=None):
            nonlocal _id
            _id += 1
            await ws.send(json.dumps({"id": _id, "method": method, "params": params or {}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == _id:
                    return msg
        await send("Runtime.enable")
        await send("Page.enable")

        # 1) Find the new-terminal trigger in the DOM
        expr = r"""
        (() => {
          const btns = Array.from(document.querySelectorAll('button, [role="button"], [data-action]'));
          const hits = btns.map(b => ({
            action: b.getAttribute('data-action'),
            title: b.getAttribute('title') || b.getAttribute('aria-label'),
            text: (b.textContent || '').trim().slice(0, 40),
            cls: (b.className || '').toString().slice(0, 60)
          })).filter(h => h.action || h.title || /terminal/i.test(h.text));
          return JSON.stringify(hits.slice(0, 30));
        })()
        """
        r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        print("BUTTONS:", r.get("result", {}).get("result", {}).get("value", "?"))

asyncio.run(main())
