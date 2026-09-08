import json, urllib.request

def cdp_pages():
    data = urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5).read().decode()
    return json.loads(data)

for p in cdp_pages():
    print(p.get("type"), "|", p.get("title"), "|", p.get("url", "")[:120], "|", p.get("webSocketDebuggerUrl", "")[:60])
