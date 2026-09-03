"""Screenshot the HSCode page via CDP + dump page state."""
import asyncio, json, base64, urllib.request

import websockets

def pages():
    data = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5).read().decode())
    return next(p for p in data if p.get("type") == "page")

async def main():
    pg = pages()
    async with websockets.connect(pg["webSocketDebuggerUrl"], max_size=None) as ws:
        _id = 0
        async def send(method, params=None):
            nonlocal _id
            _id += 1
            await ws.send(json.dumps({"id": _id, "method": method, "params": params or {}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == _id:
                    return msg
        await send("Page.enable")
        await send("Runtime.enable")
        r = await send("Page.captureScreenshot", {"format": "png"})
        data = base64.b64decode(r["result"]["data"])
        out = "D:/hscode/docs/psreadline-diag/shot_state.png"
        open(out, "wb").write(data)
        print("saved", out, len(data))
        # dump visible text of body for orientation
        r = await send("Runtime.evaluate", {"expression": "document.body.innerText.slice(0, 800)", "returnByValue": True})
        print("BODY:", r.get("result", {}).get("result", {}).get("value", "")[:800])

asyncio.run(main())
