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

# Sample the largest canvas: corner colors + near-black pixel count + widest
# contiguous near-black horizontal run (a black block = a wide dark run on the prompt line).
SAMPLE = """
(() => {
  const cvs = [...document.querySelectorAll('canvas')];
  if (!cvs.length) return {err:'no canvas'};
  const cv = cvs.sort((a,b)=>(b.width*b.height)-(a.width*a.height))[0];
  const ctx = cv.getContext('2d');
  const g = ctx.getImageData(0,0,cv.width,cv.height).data;
  const W = cv.width, H = cv.height;
  const px = (x,y)=>{const i=(y*W+x)*4;return [g[i],g[i+1],g[i+2]]};
  const corners = {tl:px(2,2), tr:px(W-3,2), bl:px(2,H-3), br:px(W-3,H-3)};
  let nearBlack=0, pureBlack=0, widestRun=0;
  for (let y=0;y<H;y++){
    let run=0;
    for (let x=0;x<W;x++){
      const i=(y*W+x)*4, r=g[i], gg=g[i+1], b=g[i+2];
      const nb = r<40&&gg<40&&b<40;
      if (nb){ nearBlack++; if(r<16&&gg<16&&b<16) pureBlack++; run++; if(run>widestRun)widestRun=run; }
      else run=0;
    }
  }
  return {W,H, corners, nearBlack, pureBlack, widestRunPx: widestRun};
})()
"""

async def main():
    targets = await http_json("http://127.0.0.1:9222/json")
    main = next((t for t in targets if t.get("type")=="page" and "5173" in t.get("url","")), None) \
           or next((t for t in targets if t.get("type")=="page"), None)
    print("MAIN:", main.get("title"), main.get("url"))
    ws = await websockets.connect(main["webSocketDebuggerUrl"], max_size=50_000_000)
    c = CDP(ws); await c.start()
    await c.send("Runtime.enable")
    await c.send("Input.enable")

    clicked = await c.eval("""
    (() => { const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='终端');
      if(!b) return 'NO_BTN'; b.click(); return 'CLICKED'; })()
    """)
    print("click:", clicked)
    await asyncio.sleep(4)

    # focus xterm helper textarea
    focus = await c.eval("""
    (() => { const ta=document.querySelector('.xterm-helper-textarea')||document.querySelector('textarea');
      if(ta){ta.focus(); return 'FOCUSED:'+(ta.className||'').toString().slice(0,40);} return 'NO_TEXTAREA'; })()
    """)
    print("focus:", focus)
    await asyncio.sleep(1)

    base = await c.eval(SAMPLE)
    print("BASELINE:", json.dumps(base))

    # Method A: CDP Input.dispatchKeyEvent spaces
    async def cdp_spaces(n):
        for _ in range(n):
            await c.send("Input.dispatchKeyEvent", {"type":"rawKeyDown","text":" ","key":" ","unmodifiedText":" ",
                        "windowsVirtualKeyCode":32,"nativeVirtualKeyCode":32,"code":"Space"})
            await c.send("Input.dispatchKeyEvent", {"type":"keyUp","key":" ","code":"Space",
                        "windowsVirtualKeyCode":32,"nativeVirtualKeyCode":32})
            await asyncio.sleep(60)
    await cdp_spaces(20)
    await asyncio.sleep(800)
    afterA = await c.eval(SAMPLE)
    print("AFTER_CDP_INPUT:", json.dumps(afterA))

    # Method B: dispatchEvent on textarea (cross-check)
    await c.eval("document.querySelector('.xterm-helper-textarea')?.focus()")
    async def dispatch_spaces(n):
        for _ in range(n):
            await c.eval("""
            (() => { const ta=document.querySelector('.xterm-helper-textarea'); if(!ta) return 'no_ta';
              const e=new KeyboardEvent('keydown',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,cancelable:true});
              ta.dispatchEvent(e); const u=new KeyboardEvent('keyup',{key:' ',code:'Space',keyCode:32,bubbles:true});
              ta.dispatchEvent(u); return 'sent'; })()
            """)
            await asyncio.sleep(60)
    await dispatch_spaces(20)
    await asyncio.sleep(800)
    afterB = await c.eval(SAMPLE)
    print("AFTER_DISPATCH_EVENT:", json.dumps(afterB))

    print("\n=== VERDICT ===")
    for name, s in [("baseline",base),("after_CDP",afterA),("after_dispatch",afterB)]:
        if isinstance(s,dict) and "W" in s:
            print(f"{name}: nearBlack={s['nearBlack']} pureBlack={s['pureBlack']} widestRunPx={s['widestRunPx']}")
    await ws.close()

asyncio.run(main())
