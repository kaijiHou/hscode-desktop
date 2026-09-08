"""Full flow: nav to /session, wait for header, open terminal panel, click new terminal."""
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
        await send("Page.enable"); await send("Runtime.enable")

        # nav + wait for terminal toggle button to appear (session header rendered)
        await js("location.href='http://localhost:5173/session'; 'nav'")
        toggle = None
        for _ in range(20):
            await asyncio.sleep(1)
            toggle = await js(r"""
            (() => {
              const b = Array.from(document.querySelectorAll('button,[role="button"]'))
                .find(x => (x.getAttribute('aria-label')||'').includes('终端') && (x.getAttribute('data-action')||'').includes('toggle') )
                || Array.from(document.querySelectorAll('button,[role="button"]'))
                .find(x => (x.getAttribute('aria-label')||'') === '终端' || (x.getAttribute('title')||'') === '终端');
              return b ? 'FOUND' : 'WAITING';
            })()
            """)
            if toggle == 'FOUND':
                print("terminal toggle found"); break
        print("toggle state:", toggle)

        # open terminal panel
        opened = await js(r"""
        (() => {
          const b = Array.from(document.querySelectorAll('button,[role="button"]'))
            .find(x => (x.getAttribute('aria-label')||'') === '终端' || (x.getAttribute('title')||'') === '终端');
          if (!b) return 'NO_TOGGLE';
          b.click(); return 'TOGGLE_CLICKED';
        })()
        """)
        print("open panel:", opened)
        await asyncio.sleep(2)

        # click new terminal
        newt = await js(r"""
        (() => {
          const b = Array.from(document.querySelectorAll('button,[role="button"]'))
            .find(x => (x.getAttribute('aria-label')||'') === '新建终端' || (x.textContent||'').trim() === '新建终端');
          if (!b) return 'NO_NEWTERM';
          b.click(); return 'NEWTERM_CLICKED';
        })()
        """)
        print("new terminal:", newt)
        await asyncio.sleep(2)
        print("canvases:", await js("document.querySelectorAll('canvas').length"))

asyncio.run(main())
