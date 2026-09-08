"""Find the new-terminal plus button in the tab list and click it. Dump the trailing tablist HTML to locate it."""
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

        # dump tail of tablist to find plus button markup
        tail = await js(r"""(() => {
          const list = document.querySelector('[data-slot="tabs-list"]');
          if (!list) return 'NO_LIST';
          return list.outerHTML.slice(-1200);
        })()""")
        print("TAIL:", tail)

        # Click plus (aria-label = 新建终端) inside the tab list
        clicked = await js(r"""(() => {
          const list = document.querySelector('[data-slot="tabs-list"]');
          if (!list) return 'NO_LIST';
          // the plus is the last button in list (not a tab, not a close button)
          const btns = Array.from(list.querySelectorAll('button'));
          const plus = btns.find(b => (b.getAttribute('aria-label')||'').includes('新建') )
            || btns.filter(b => !(b.getAttribute('aria-label')||'').includes('关闭') && b.querySelector('svg') && !b.getAttribute('data-value'))[0];
          if (!plus) return 'NO_PLUS: buttons=' + btns.map(b=>(b.getAttribute('aria-label')||b.getAttribute('data-value')||'?')).join(',');
          plus.click();
          return 'CLICKED_PLUS: ' + (plus.getAttribute('aria-label')||'');
        })()""")
        print("plus:", clicked)
        await asyncio.sleep(3)
        # count tabs now
        tabs = await js(r"""(() => {
          const list = document.querySelector('[data-slot="tabs-list"]');
          return Array.from(list.querySelectorAll('[data-slot="terminal-tab-title"]')).map(t => t.textContent).join(',');
        })()""")
        print("tabs now:", tabs)

asyncio.run(main())
