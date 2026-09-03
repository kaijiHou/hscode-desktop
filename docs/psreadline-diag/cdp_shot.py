import asyncio, json, urllib.request, base64
import websockets

async def mj(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return json.loads(r.read().decode())

async def main():
    ts = await mj('http://127.0.0.1:9222/json')
    m = next((t for t in ts if t.get('type')=='page' and '5173' in t.get('url','')), None) \
        or next((t for t in ts if t.get('type')=='page'), None)
    print('MAIN:', m.get('title'), m.get('url'))
    ws = await websockets.connect(m['webSocketDebuggerUrl'], max_size=50_000_000)
    c_id = [0]
    pend = {}
    async def rd():
        async for msg in ws:
            d = json.loads(msg)
            if d.get('id') in pend:
                f = pend.pop(d['id'])
                if not f.done(): f.set_result(d)
    rt = asyncio.create_task(rd())
    async def send(method, params=None, timeout=20):
        c_id[0]+=1; mid=c_id[0]
        f=asyncio.get_event_loop().create_future(); pend[mid]=f
        await ws.send(json.dumps({'id':mid,'method':method,'params':params or {}}))
        return await asyncio.wait_for(f, timeout)
    async def ev(expr, timeout=15):
        r = await send('Runtime.evaluate', {'expression':expr,'returnByValue':True,'awaitPromise':True}, timeout)
        return r.get('result',{}).get('result',{}).get('value')

    await send('Page.enable')
    await asyncio.sleep(2)
    # dump UI structure: all buttons with aria-label / title, and any canvas / xterm presence
    info = await ev("""
    (() => {
      const btns=[...document.querySelectorAll('button')].map(b=>({
        al:b.getAttribute('aria-label')||'', ti:(b.title||''), tx:(b.innerText||'').slice(0,12)
      })).filter(b=>b.al||b.ti||b.tx);
      return {
        title: document.title,
        canvas: document.querySelectorAll('canvas').length,
        xterm: document.querySelectorAll('.xterm').length,
        xtermHelper: document.querySelectorAll('.xterm-helper-textarea').length,
        buttons: btns
      };
    })()
    """)
    print('INFO:', json.dumps(info, ensure_ascii=False))

    # full-page screenshot
    r = await send('Page.captureScreenshot', {'format':'png','captureBeyondViewport':True})
    png = base64.b64decode(r.get('result',{}).get('data',''))
    with open('D:/hscode/docs/psreadline-diag/shot_initial.png','wb') as f:
        f.write(png)
    print('SAVED shot_initial.png', len(png), 'bytes')
    await ws.close()

asyncio.run(main())
