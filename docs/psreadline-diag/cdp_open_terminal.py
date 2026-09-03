"""Drive real HSCode UI via CDP: new session -> open terminal -> new terminal tab."""
import asyncio, json, sys, urllib.request

import websockets

WS_TIMEOUT = 20

def pages():
    data = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5).read().decode())
    return next(p for p in data if p.get("type") == "page")

async def main():
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    pg = pages()
    async with websockets.connect(pg["webSocketDebuggerUrl"], max_size=None) as ws:
        _id = 0
        async def send(method, params=None, timeout=WS_TIMEOUT):
            nonlocal _id
            _id += 1
            await ws.send(json.dumps({"id": _id, "method": method, "params": params or {}}))
            async with asyncio.timeout(timeout):
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == _id:
                        if "error" in msg:
                            raise RuntimeError(f"{method}: {msg['error']}")
                        return msg
        async def js(expr, timeout=WS_TIMEOUT):
            r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
            res = r.get("result", {}).get("result", {})
            return res.get("value")

        await send("Runtime.enable")
        await send("Page.enable")

        url = await js("location.href")
        print("URL:", url)

        if step in ("all", "session"):
            # Create/open a session: click 新建会话
            clicked = await js(r"""
            (() => {
              const b = document.querySelector('[data-action="home-new-session"]')
                || Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').trim() === '新建会话');
              if (!b) return 'NO_BTN';
              b.click(); return 'CLICKED';
            })()
            """)
            print("new-session:", clicked)
            await asyncio.sleep(4)
            print("URL after:", await js("location.href"))

        if step in ("all", "term"):
            # Open terminal panel: find toggle (aria/title contains terminal) or use keyboard
            clicked = await js(r"""
            (() => {
              const cands = Array.from(document.querySelectorAll('button, [role="button"]'));
              const t = cands.find(b => /terminal/i.test(b.getAttribute('aria-label')||'') || /terminal/i.test(b.getAttribute('title')||''));
              if (t) { t.click(); return 'CLICKED:' + (t.getAttribute('aria-label')||t.getAttribute('title')); }
              return 'NO_TOGGLE';
            })()
            """)
            print("term-toggle:", clicked)
            await asyncio.sleep(2)

            # New terminal tab
            clicked = await js(r"""
            (() => {
              const cands = Array.from(document.querySelectorAll('button, [role="button"]'));
              const t = cands.find(b => {
                const a = (b.getAttribute('aria-label')||'') + (b.getAttribute('title')||'');
                return /新建终端|新终端|New Terminal|terminal/i.test(a);
              });
              if (t) { t.click(); return 'CLICKED:' + (t.getAttribute('aria-label')||t.getAttribute('title')); }
              // fallback: any plus-small icon button
              const p = cands.find(b => /plus/i.test((b.className||'').toString()));
              if (p) { p.click(); return 'CLICKED_PLUS'; }
              return 'NO_NEWTERM';
            })()
            """)
            print("new-term:", clicked)
            await asyncio.sleep(3)
            print("DONE step", step)

asyncio.run(main())
