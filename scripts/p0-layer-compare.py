#!/usr/bin/env python3
"""P0: Canvas vs CDP comparison - scan for black block location"""
import json, http.client, os, socket, struct, base64, time

ARTIFACTS = "D:/hscode/artifacts/runtime"

class CDP:
    def __init__(self):
        self.sock = None
        self.id = 0
        self.buf = b""

    def connect(self):
        conn = http.client.HTTPConnection("127.0.0.1", 9222, timeout=3)
        conn.request("GET", "/json")
        tabs = json.loads(conn.getresponse().read())
        conn.close()
        url = tabs[0]["webSocketDebuggerUrl"].replace("ws://", "")
        host, rest = url.split(":")
        port, path = rest.split("/", 1)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((host, int(port)))
        self.sock.send(("GET /%s HTTP/1.1\r\nHost: %s:%s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, host, port, key)).encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(4096)

    def send(self, method, params=None):
        self.id += 1
        mid = self.id
        d = {"id": mid, "method": method}
        if params:
            d["params"] = params
        msg = json.dumps(d).encode()
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(msg))
        if len(msg) <= 125:
            hdr = struct.pack("BB", 0x81, 0x80 | len(msg)) + mask
        else:
            hdr = struct.pack("!BBH", 0x81, 0x80 | 126, len(msg)) + mask
        self.sock.send(hdr + masked)
        self.sock.settimeout(10)
        while True:
            chunk = self.sock.recv(65536)
            if not chunk:
                break
            self.buf += chunk
            while len(self.buf) >= 2:
                b1 = self.buf[1] & 0x7F
                off = 2
                if b1 == 126:
                    if len(self.buf) < 4:
                        break
                    plen = struct.unpack(">H", self.buf[2:4])[0]
                    off = 4
                elif b1 == 127:
                    if len(self.buf) < 10:
                        break
                    plen = struct.unpack(">Q", self.buf[2:10])[0]
                    off = 10
                else:
                    plen = b1
                if len(self.buf) < off + plen:
                    break
                payload = self.buf[off : off + plen]
                self.buf = self.buf[off + plen :]
                try:
                    obj = json.loads(payload)
                    if obj.get("id") == mid:
                        return obj
                except:
                    pass
        return None

    def js(self, expr):
        r = self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        if r and "result" in r and "result" in r["result"]:
            return r["result"]["result"].get("value")
        return r

    def close(self):
        if self.sock:
            self.sock.close()


def main():
    os.makedirs(ARTIFACTS, exist_ok=True)
    cdp = CDP()
    cdp.connect()

    # Focus via mouse click
    panel = cdp.js("""
(function(){
    var p = document.querySelector('aside#terminal-panel');
    if (!p) return null;
    var r = p.getBoundingClientRect();
    return JSON.stringify({x: r.left+r.width/2, y: r.top+r.height/2});
})()""")
    if panel:
        info = json.loads(panel)
        cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": info["x"], "y": info["y"], "button": "left", "clickCount": 1})
        cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": info["x"], "y": info["y"], "button": "left", "clickCount": 1})
        time.sleep(0.5)

    print("Active:", cdp.js("document.activeElement?.tagName + '.' + (document.activeElement?.className||'').substring(0,50)"))

    # Type 30 spaces
    for i in range(30):
        cdp.send("Input.dispatchKeyEvent", {"type": "keyDown", "key": " ", "code": "Space", "text": " "})
        cdp.send("Input.dispatchKeyEvent", {"type": "keyUp", "key": " ", "code": "Space"})
    time.sleep(1.0)

    # ===== Canvas deep scan =====
    print("\n=== CANVAS DEEP SCAN ===")
    result = cdp.js("""
(function(){
    var c = document.querySelector('[data-component="terminal"] canvas');
    if (!c) return JSON.stringify({error: 'no canvas'});
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var bgR = 250, bgG = 251, bgB = 252;

    // Total dark pixels on ENTIRE canvas
    var totalDark = 0;
    var darkRunsAll = [];
    for (var y = 0; y < h; y++) {
        var row = ctx.getImageData(0, y, w, 1).data;
        var sx = -1, sl = 0;
        for (var x = 0; x < w; x++) {
            var r = row[x*4], g = row[x*4+1], b = row[x*4+2];
            if (r < 30 && g < 30 && b < 30) {
                totalDark++;
                if (sx < 0) sx = x;
                sl++;
            } else {
                if (sl >= 10) darkRunsAll.push({y:y, x:sx, len:sl});
                sx = -1; sl = 0;
            }
        }
        if (sl >= 10) darkRunsAll.push({y:y, x:sx, len:sl});
    }

    // Last content row
    var lastRow = -1;
    for (var y = h-1; y >= 0; y--) {
        var row = ctx.getImageData(0, y, w, 1).data;
        for (var x = 0; x < w; x++) {
            var r = row[x*4], g = row[x*4+1], b = row[x*4+2];
            if (!(Math.abs(r-bgR)<10 && Math.abs(g-bgG)<10 && Math.abs(b-bgB)<10)) {
                lastRow = y; break;
            }
        }
        if (lastRow >= 0) break;
    }

    return JSON.stringify({
        canvasW: w, canvasH: h, dpr: window.devicePixelRatio,
        totalDarkPixels: totalDark,
        darkRuns10plus: darkRunsAll,
        lastContentRow: lastRow
    }, null, 2);
})()""")
    print(result)

    # ===== CDP screenshot scan =====
    print("\n=== CDP SCREENSHOT SCAN ===")
    r = cdp.send("Page.captureScreenshot", {"format": "png"})
    img_b64 = r.get("result", {}).get("data", "") if r else ""
    if img_b64:
        img_bytes = base64.b64decode(img_b64)
        with open(ARTIFACTS + "/black-block-cdp-full.png", "wb") as f:
            f.write(img_bytes)
        print("CDP screenshot:", len(img_bytes), "bytes")

    # ===== elementsFromPoint at cursor area =====
    print("\n=== elementsFromPoint ===")
    efp = cdp.js("""
(function(){
    var c = document.querySelector('[data-component="terminal"] canvas');
    if (!c) return 'no canvas';
    var cr = c.getBoundingClientRect();
    // Check points at different locations
    var pts = [];
    var testY = cr.top + cr.height - 30;
    for (var dx of [20, 100, 200, 300, cr.width-20]) {
        var px = cr.left + dx;
        var els = document.elementsFromPoint(px, testY);
        pts.push({x: Math.round(px), y: Math.round(testY), top: els[0]?.tagName + (els[0]?.id ? '#'+els[0]?.id : ''), all: els.slice(0,4).map(function(e){return e.tagName+(e.id?'#'+e.id:'')})});
    }
    return JSON.stringify(pts, null, 2);
})()""")
    print(efp)

    # ===== Check: is the contenteditable actually receiving the typed text? =====
    print("\n=== CONTENTEDITABLE TEXT CHECK ===")
    ce_text = cdp.js("""
(function(){
    var ce = document.querySelector('[data-component="terminal"]');
    var ta = ce ? ce.querySelector('textarea') : null;
    return JSON.stringify({
        ceInnerText: (ce?.innerText || '').substring(0, 200),
        ceTextContent: (ce?.textContent || '').substring(0, 200),
        taValue: (ta?.value || '').substring(0, 200),
        taValueLen: ta?.value?.length || 0
    });
})()""")
    print(ce_text)

    # ===== CRITICAL: What does the contenteditable children look like? =====
    print("\n=== CONTENTEDITABLE DOM TREE ===")
    tree = cdp.js("""
(function(){
    var ce = document.querySelector('[data-component="terminal"]');
    if (!ce) return 'no CE';
    var children = [];
    for (var i = 0; i < ce.children.length; i++) {
        var ch = ce.children[i];
        var cs = window.getComputedStyle(ch);
        children.push({
            tag: ch.tagName,
            cls: (ch.className||'').substring(0,80),
            text: ch.textContent?.substring(0,100),
            childCount: ch.children?.length,
            display: cs.display,
            position: cs.position,
            bg: cs.backgroundColor,
            color: cs.color,
            rect: ch.getBoundingClientRect()
        });
    }
    return JSON.stringify(children, null, 2);
})()""")
    print(tree)

    cdp.close()


if __name__ == "__main__":
    main()
