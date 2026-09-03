"""Inspect session route DOM: find terminal toggle, terminal panel, new-terminal button."""
import asyncio, json, base64, urllib.request
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
        async def shot(name):
            r = await send("Page.captureScreenshot", {"format": "png"})
            p = f"D:/hscode/docs/psreadline-diag/{name}.png"
            open(p, "wb").write(base64.b64decode(r["result"]["data"]))
            return p

        await send("Page.enable"); await send("Runtime.enable")

        info = await js(r"""
        (() => {
          const out = { url: location.href, buttons: [], canvases: 0, xterm: 0, iframes: [] };
          out.canvases = document.querySelectorAll('canvas').length;
          out.xterm = document.querySelectorAll('.xterm, [class*="ghostty"], [class*="terminal"]').length;
          document.querySelectorAll('button, [role="button"]').forEach(b => {
            const a = ((b.getAttribute('aria-label')||'') + '|' + (b.getAttribute('title')||'') + '|' + (b.getAttribute('data-action')||'') + '|' + (b.textContent||'').trim()).slice(0,80);
            if (a.replace(/[|]/g,'').length > 1) out.buttons.push(a);
          });
          out.buttons = out.buttons.slice(0, 40);
          document.querySelectorAll('iframe').forEach(f => out.iframes.push(f.src.slice(0,80)));
          return JSON.stringify(out);
        })()
        """)
        print(info)
        print(await shot("session_dom"))

asyncio.run(main())
