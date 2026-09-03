import asyncio, json, urllib.request
import websockets

async def http_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())

class CDP:
    def __init__(self, ws):
        self.ws = ws; self.id = 0; self.pending = {}
    async def start(self):
        self.rt = asyncio.create_task(self._reader())
    async def _reader(self):
        try:
            async for msg in self.ws:
                d = json.loads(msg)
                if d.get("id") in self.pending:
                    f = self.pending.pop(d["id"])
                    if not f.done(): f.set_result(d)
        except Exception: pass
    async def send(self, method, params=None, timeout=30):
        self.id += 1; mid = self.id
        f = asyncio.get_event_loop().create_future(); self.pending[mid] = f
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        return await asyncio.wait_for(f, timeout)
    async def eval(self, expr, timeout=30):
        r = await self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
        return r.get("result", {}).get("result", {}).get("value")

async def main():
    targets = await http_json("http://127.0.0.1:9222/json")
    main = next((t for t in targets if t.get("type")=="page" and "5173" in t.get("url","")), None) \
           or next((t for t in targets if t.get("type")=="page"), None)
    ws = await websockets.connect(main["webSocketDebuggerUrl"], max_size=50_000_000)
    c = CDP(ws); await c.start()
    await c.send("Runtime.enable")

    # 1. click the terminal button
    clicked = await c.eval("""
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'')==='终端');
      if (!b) return 'NO_TERMINAL_BTN';
      b.click();
      return 'CLICKED:' + (b.className||'').toString().slice(0,40);
    })()
    """)
    print("terminal click:", clicked)
    await asyncio.sleep(3)

    # 2. canvas + input target info
    info = await c.eval("""
    (() => {
      const out = {};
      const cvs = [...document.querySelectorAll('canvas')];
      out.canvases = cvs.map(cv => ({w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight,
                                     cls:(cv.className||'').toString().slice(0,50)}));
      // input target: element with tabindex, or canvas parent
      const tab = document.querySelector('[tabindex]:not([tabindex="-1"])');
      out.tabEl = tab ? {tag: tab.tagName, cls:(tab.className||'').toString().slice(0,60)} : null;
      out.active = document.activeElement ? {tag: document.activeElement.tagName,
                     cls:(document.activeElement.className||'').toString().slice(0,60)} : null;
      // sample corner colors of the largest canvas
      const cv = cvs.sort((a,b)=>(b.width*b.height)-(a.width*a.height))[0];
      if (cv) {
        try {
          const ctx = cv.getContext('2d');
          const g = ctx.getImageData(0,0,cv.width,cv.height).data;
          const px = (x,y)=>{const i=(y*cv.width+x)*4;return [g[i],g[i+1],g[i+2]]};
          out.corners = {tl: px(2,2), tr: px(cv.width-3,2), bl: px(2,cv.height-3), br: px(cv.width-3,cv.height-3)};
          // dark pixel count (all channels < 16)
          let dark=0; for(let i=0;i<g.length;i+=4){ if(g[i]<16&&g[i+1]<16&&g[i+2]<16) dark++; }
          out.darkPixels = dark;
          out.totalPx = (cv.width*cv.height);
        } catch(e){ out.pxErr = String(e); }
      }
      return out;
    })()
    """)
    print(json.dumps(info, ensure_ascii=False, indent=1))
    await ws.close()

asyncio.run(main())
