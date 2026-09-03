import asyncio, json, urllib.request, base64
import websockets

async def mj(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return json.loads(r.read().decode())

class CDP:
    def __init__(self, ws):
        self.ws=ws; self.id=0; self.pend={}
    async def start(self): self.rt=asyncio.create_task(self._rd())
    async def _rd(self):
        try:
            async for msg in self.ws:
                d=json.loads(msg)
                if d.get('id') in self.pend:
                    f=self.pend.pop(d['id'])
                    if not f.done(): f.set_result(d)
        except Exception: pass
    async def send(self, m, p=None, t=25):
        self.id+=1; mid=self.id
        f=asyncio.get_event_loop().create_future(); self.pend[mid]=f
        await self.ws.send(json.dumps({'id':mid,'method':m,'params':p or {}}))
        return await asyncio.wait_for(f, t)
    async def ev(self, expr, t=20):
        r=await self.send('Runtime.evaluate', {'expression':expr,'returnByValue':True,'awaitPromise':True}, t)
        return r.get('result',{}).get('result',{}).get('value')
    async def shot(self, path):
        r=await self.send('Page.captureScreenshot', {'format':'png','captureBeyondViewport':True})
        open(path,'wb').write(base64.b64decode(r.get('result',{}).get('data','')))
        return len(open(path,'rb').read())

SAMPLE = """
(() => {
  const cvs=[...document.querySelectorAll('canvas')];
  if(!cvs.length) return {err:'no canvas'};
  const cv=cvs.sort((a,b)=>(b.width*b.height)-(a.width*a.height))[0];
  const g=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
  const W=cv.width,H=cv.height;
  const px=(x,y)=>{const i=(y*W+x)*4;return [g[i],g[i+1],g[i+2]]};
  let nearBlack=0,pureBlack=0,widest=0;
  for(let y=0;y<H;y++){let run=0;for(let x=0;x<W;x++){const i=(y*W+x)*4;
    if(g[i]<40&&g[i+1]<40&&g[i+2]<40){nearBlack++;if(g[i]<16&&g[i+1]<16&&g[i+2]<16)pureBlack++;run++;if(run>widest)widest=run;}
    else run=0;}}
  return {W,H,corners:{tl:px(2,2),br:px(W-3,H-3)},nearBlack,pureBlack,widestRunPx:widest};
})()
"""

async def main():
    ts=await mj('http://127.0.0.1:9222/json')
    m=next((t for t in ts if t.get('type')=='page' and '5173' in t.get('url','')),None) or next((t for t in ts if t.get('type')=='page'),None)
    ws=await websockets.connect(m['webSocketDebuggerUrl'], max_size=50_000_000)
    c=CDP(ws); await c.start()
    await c.send('Page.enable'); await c.send('Runtime.enable')
    P='D:/hscode/docs/psreadline-diag/'

    # open terminal panel (toggle)
    print('click:', await c.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='终端');if(!b)return 'NO_BTN';b.click();return 'CLICKED'})()"""))

    # poll for canvas up to 20s
    cvinfo=None
    for i in range(20):
        await asyncio.sleep(1)
        cvinfo=await c.ev("""(()=>{const cv=document.querySelector('canvas');return cv?{w:cv.width,h:cv.height}:'none'})()""")
        if cvinfo != 'none':
            print('canvas up after', i + 1, 's', cvinfo)
            break
    if cvinfo=='none': print('NO CANVAS after 20s'); await c.shot(P+'shot_no_canvas.png'); await ws.close(); return
    await asyncio.sleep(2)

    # focus the terminal input (ghostty-web uses a textarea helper)
    print('focus:', await c.ev("""(()=>{const ta=document.querySelector('.xterm-helper-textarea')||document.querySelector('textarea')||document.querySelector('.xterm');if(ta){ta.focus();return 'OK:'+(ta.className||ta.tagName).toString().slice(0,40)}return 'NONE'})()"""))
    await asyncio.sleep(1)

    print('BASELINE:', await c.ev(SAMPLE))
    await c.shot(P+'shot_before_spaces.png')

    # send 20 spaces via dispatchEvent (CDP Input does NOT reach ghostty)
    for i in range(20):
        await c.ev("""(()=>{const ta=document.querySelector('.xterm-helper-textarea')||document.querySelector('textarea');if(!ta)return 'no_ta';
          ta.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,cancelable:true}));
          ta.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,cancelable:true}));return 'sent'})()""")
        await asyncio.sleep(50)
    await asyncio.sleep(1.5)

    print('AFTER_20SPACES:', await c.ev(SAMPLE))
    await c.shot(P+'shot_after_spaces.png')
    await ws.close()

asyncio.run(main())
