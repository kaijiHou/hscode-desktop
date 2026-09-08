"""Navigate HSCode to a session route, open terminal, create terminal tab. Screenshot each step."""
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
        async def js(expr, timeout=25):
            r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
            return r.get("result", {}).get("result", {}).get("value")
        async def shot(name):
            r = await send("Page.captureScreenshot", {"format": "png"})
            p = f"D:/hscode/docs/psreadline-diag/{name}.png"
            open(p, "wb").write(base64.b64decode(r["result"]["data"]))
            return p

        await send("Page.enable"); await send("Runtime.enable")

        # Navigate to a session route
        await js("location.href = 'http://localhost:5173/session'; 'nav'")
        await asyncio.sleep(5)
        print("URL:", await js("location.href"))
        print(await shot("nav_session"))
        print("BODY:", (await js("document.body.innerText.slice(0,500)")) or "")

asyncio.run(main())
