import asyncio, json, urllib.request
import websockets

async def http_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())

class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.id = 0
        self.pending = {}
        self.reader_task = None
    async def start(self):
        self.reader_task = asyncio.create_task(self._reader())
    async def _reader(self):
        try:
            async for msg in self.ws:
                data = json.loads(msg)
                if data.get("id") in self.pending:
                    fut = self.pending.pop(data["id"])
                    if not fut.done():
                        fut.set_result(data)
        except Exception:
            pass
    async def send(self, method, params=None, timeout=30):
        self.id += 1
        mid = self.id
        fut = asyncio.get_event_loop().create_future()
        self.pending[mid] = fut
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        return await asyncio.wait_for(fut, timeout)
    async def eval(self, expr, timeout=30):
        r = await self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
        res = r.get("result", {}).get("result", {})
        if "value" in res: return res["value"]
        return res

async def main():
    targets = await http_json("http://127.0.0.1:9222/json")
    # find the main renderer (HSCode)
    main = None
    for t in targets:
        if t.get("type") == "page" and "5173" in t.get("url", ""):
            main = t; break
    if not main:
        for t in targets:
            if t.get("type") == "page":
                main = t; break
    print("MAIN:", main.get("title"), main.get("url"))
    ws = await websockets.connect(main["webSocketDebuggerUrl"], max_size=50_000_000)
    cdp = CDP(ws); await cdp.start()
    await cdp.send("Runtime.enable")
    # Explore: find buttons / terminal trigger / canvas
    probe = """
    (() => {
      const out = {};
      out.buttons = [...document.querySelectorAll('button')].slice(0,40).map(b => ({
        txt: (b.textContent||'').trim().slice(0,30),
        title: b.title||'',
        aria: b.getAttribute('aria-label')||'',
        cls: (b.className||'').toString().slice(0,60)
      }));
      out.canvases = document.querySelectorAll('canvas').length;
      out.title = document.title;
      out.bodyTextLen = (document.body.innerText||'').length;
      // look for terminal-related text
      out.terminalWords = [...document.querySelectorAll('*')].filter(e=>
        /terminal|终端|shell|powershell/i.test(e.textContent||'') && e.children.length<3
      ).slice(0,10).map(e=>({t:(e.textContent||'').trim().slice(0,40), tag:e.tagName}));
      return out;
    })()
    """
    res = await cdp.eval(probe)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    await ws.close()

asyncio.run(main())
