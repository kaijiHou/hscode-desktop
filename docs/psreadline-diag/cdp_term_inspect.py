"""Deep-inspect the ghostty terminal canvas: find text layer / JS API / any DOM mirror of terminal content."""
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
            return r.get("result", {}).get("result", {}).get("value")
        await send("Runtime.enable")

        dump = await js(r"""(() => {
          const out = {};
          const c = document.querySelector('canvas');
          out.canvasCount = document.querySelectorAll('canvas').length;
          if (!c) { out.note = 'no canvas'; return JSON.stringify(out); }
          // walk up to the terminal host container
          let host = c;
          for (let i=0;i<6 && host.parentElement;i++) host = host.parentElement;
          out.hostCls = (host.className||'').toString().slice(0,120);
          out.hostHTML = host.outerHTML.slice(0, 2500);
          // sibling text nodes / hidden textareas
          const tas = Array.from(host.querySelectorAll('textarea, [contenteditable], [aria-label*="terminal"], [role="textbox"]'));
          out.textareas = tas.map(t => t.tagName + ':' + (t.value || t.textContent || '').slice(0,200));
          // any element whose text looks like a PS prompt
          const promptEls = Array.from(host.querySelectorAll('*')).filter(e => /PS[\\\\/]|Microsoft.PowerShell|>/.test(e.textContent||'') && e.children.length===0).slice(0,8);
          out.promptTexts = promptEls.map(e => (e.textContent||'').slice(0,80));
          return JSON.stringify(out);
        })()""")
        print(dump)

asyncio.run(main())
