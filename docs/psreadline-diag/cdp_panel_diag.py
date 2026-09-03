"""Ensure terminal panel open, dump the terminal container HTML + screenshot, list plus/terminal elements."""
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

        # ensure panel open (idempotent)
        await js(r"""(() => {
          const b = Array.from(document.querySelectorAll('button,[role=button]'))
            .find(x => (x.getAttribute('aria-label')||'')==='终端' || (x.getAttribute('title')||'')==='终端');
          if (b) b.click(); return b?'clicked':'none';
        })()""")
        await asyncio.sleep(4)

        print("canvases:", await js("document.querySelectorAll('canvas').length"))
        # Find the terminal panel container (ghostty/xterm host) and dump
        html = await js(r"""(() => {
          // ghostty-web renders into a div with class containing 'ghostty' or a canvas parent
          const c = document.querySelector('canvas');
          if (c) {
            let host = c; for (let i=0;i<4;i++) host = host.parentElement;
            return 'CANVAS_HOST:' + host.outerHTML.slice(0,1500);
          }
          // else dump any element whose text includes 终端 N
          const els = Array.from(document.querySelectorAll('*')).filter(e => /终端\s*\d/.test(e.textContent||'') && e.children.length < 3);
          return 'NO_CANVAS. terminal-tab els: ' + els.slice(0,5).map(e=>e.tagName+'.'+e.className).join(' | ');
        })()""")
        print("HTML:", html)
        # list all elements with plus icon
        plus = await js(r"""(() => {
          return Array.from(document.querySelectorAll('[class*="plus"], [data-action*="terminal"], svg'))
            .map(e => e.tagName + '.' + (e.className.baseVal || e.className || '').toString().slice(0,40))
            .filter(x => /plus|terminal/i.test(x)).slice(0,15).join(' | ');
        })()""")
        print("PLUS/TERM els:", plus)
        print(await shot("panel_diag"))

asyncio.run(main())
