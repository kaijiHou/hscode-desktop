"""Robust: open terminal panel, dump panel container HTML, try multiple selectors for new-terminal plus, then report."""
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
        async def js(expr, timeout=30):
            r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
            return r.get("result", {}).get("result", {}).get("value")
        async def shot(name):
            r = await send("Page.captureScreenshot", {"format": "png"})
            p = f"D:/hscode/docs/psreadline-diag/{name}.png"
            open(p, "wb").write(base64.b64decode(r["result"]["data"]))
            return p
        await send("Page.enable"); await send("Runtime.enable")

        # Open terminal panel
        await js(r"""(() => {
          const b = Array.from(document.querySelectorAll('button,[role=button]'))
            .find(x => (x.getAttribute('aria-label')||'')==='终端' || (x.getAttribute('title')||'')==='终端');
          if (b) b.click(); return b?'clicked':'none';
        })()""")
        await asyncio.sleep(3)

        # Dump: find the terminal panel container = ancestor of the toggle is not it;
        # find region containing text 终端 and a plus/empty state. Search broadly.
        dump = await js(r"""(() => {
          const out = {};
          out.canvases = document.querySelectorAll('canvas').length;
          out.xtermish = document.querySelectorAll('[class*="xterm"],[class*="ghostty"],[class*="terminal-panel"],[data-slot*="terminal"]').length;
          // any button with plus icon anywhere
          out.plusBtns = Array.from(document.querySelectorAll('button,[role=button]'))
            .filter(b => /plus/i.test((b.getAttribute('aria-label')||'')+(b.className||'')))
            .map(b => (b.getAttribute('aria-label')||'') + '|' + (b.className||'').toString().slice(0,30));
          // text near '终端' in right panel
          const rightPanels = Array.from(document.querySelectorAll('aside, [class*="panel"], [data-panel]'));
          out.rightPanels = rightPanels.length;
          // Find element whose innerText starts with 终端 and is a panel
          const termPanel = Array.from(document.querySelectorAll('div,section,aside'))
            .find(e => {
              const t = (e.getAttribute('aria-label')||'') + (e.getAttribute('data-slot')||'') + (e.className||'');
              return /terminal/i.test(t) && e.querySelector('button');
            });
          out.termPanelCls = termPanel ? (termPanel.className||'').toString().slice(0,80) : 'NONE';
          out.termPanelHTML = termPanel ? termPanel.outerHTML.slice(0, 2000) : '(none)';
          return JSON.stringify(out);
        })()""")
        print(dump)
        print(await shot("panel2"))

asyncio.run(main())
