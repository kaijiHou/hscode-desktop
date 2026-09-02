#!/usr/bin/env python3
"""P0 Black Block Investigation - CDP Client"""
import json, http.client, os, socket, struct, base64, time, sys

CDP_PORT = 9222
ARTIFACTS = "D:/hscode/artifacts/runtime"

class CDP:
    def __init__(self):
        self.sock = None
        self.id = 0
        self.buf = b""

    def connect(self):
        conn = http.client.HTTPConnection("127.0.0.1", CDP_PORT, timeout=3)
        conn.request("GET", "/json")
        tabs = json.loads(conn.getresponse().read())
        conn.close()
        tab = tabs[0]
        print("Tab:", tab["title"])
        url = tab["webSocketDebuggerUrl"].replace("ws://", "")
        host, rest = url.split(":")
        port, path = rest.split("/", 1)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((host, int(port)))
        self.sock.send(("GET /%s HTTP/1.1\r\nHost: %s:%s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, host, port, key)).encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(4096)
        print("WS connected")

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
                    if len(self.buf) < 4: break
                    plen = struct.unpack(">H", self.buf[2:4])[0]
                    off = 4
                elif b1 == 127:
                    if len(self.buf) < 10: break
                    plen = struct.unpack(">Q", self.buf[2:10])[0]
                    off = 10
                else:
                    plen = b1
                if len(self.buf) < off + plen: break
                payload = self.buf[off:off+plen]
                self.buf = self.buf[off+plen:]
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

    def shot(self, path, clip=None):
        p = {"format": "png"}
        if clip:
            p["clip"] = clip
        r = self.send("Page.captureScreenshot", p)
        data = r.get("result", {}).get("data", "") if r else ""
        if data:
            with open(path, "wb") as f:
                f.write(base64.b64decode(data))
            print("  Saved:", path, os.path.getsize(path), "bytes")
            return True
        print("  FAILED:", path)
        return False

    def close(self):
        if self.sock:
            self.sock.close()


def spaces(cdp, n):
    for i in range(n):
        cdp.send("Input.dispatchKeyEvent", {"type": "keyDown", "key": " ", "code": "Space", "text": " "})
        cdp.send("Input.dispatchKeyEvent", {"type": "keyUp", "key": " ", "code": "Space"})


def canvas_dark_count(cdp):
    r = cdp.js("""
(function(){
    var c = document.querySelector('[data-component="terminal"] canvas');
    if (!c) return 'no canvas';
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var cnt = 0;
    for (var y = 0; y < h; y++) {
        var row = ctx.getImageData(0, y, w, 1).data;
        for (var x = 0; x < w; x++) {
            if (row[x*4] < 50 && row[x*4+1] < 50 && row[x*4+2] < 50) cnt++;
        }
    }
    return cnt;
})()""")
    return r


def main():
    os.makedirs(ARTIFACTS, exist_ok=True)
    cdp = CDP()
    cdp.connect()

    # ---- STEP 1: Focus + type 30 spaces + capture 3 layers ----
    print("\n=== STEP 1: Focus + 30 spaces + 3 layers ===")
    # Click in terminal panel center
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
    print("  Active:", cdp.js("document.activeElement?.getAttribute('data-component') || document.activeElement?.tagName"))
    print("  Typing 30 spaces...")
    spaces(cdp, 30)
    time.sleep(1.0)

    # A: Canvas backing-store
    print("\n--- A: Canvas backing-store ---")
    canvas_url = cdp.js("""
(function(){
    var c = document.querySelector('[data-component="terminal"] canvas');
    return c ? c.toDataURL('image/png') : null;
})()""")
    if canvas_url and canvas_url.startswith("data:image/png;base64,"):
        with open(ARTIFACTS + "/black-block-layer-canvas.png", "wb") as f:
            f.write(base64.b64decode(canvas_url.split(",", 1)[1]))
        print("  Canvas saved:", os.path.getsize(ARTIFACTS + "/black-block-layer-canvas.png"), "bytes")
    else:
        print("  Canvas FAILED")

    # B: CDP screenshot
    print("\n--- B: CDP Page.captureScreenshot ---")
    cdp.shot(ARTIFACTS + "/black-block-layer-cdp.png")

    # ---- STEP 2: Canvas pixel analysis ----
    print("\n=== STEP 2: Canvas pixel analysis ===")
    analysis = cdp.js("""
(function(){
    var c = document.querySelector('[data-component="terminal"] canvas');
    if (!c) return JSON.stringify({error: 'no canvas'});
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var dpr = window.devicePixelRatio;
    var bgR = 250, bgG = 251, bgB = 252;
    var darkRuns = [];
    for (var y = 0; y < h; y++) {
        var row = ctx.getImageData(0, y, w, 1).data;
        var sx = -1, sl = 0;
        for (var x = 0; x < w; x++) {
            var r = row[x*4], g = row[x*4+1], b = row[x*4+2];
            if (r < 50 && g < 50 && b < 50) {
                if (sx < 0) sx = x;
                sl++;
            } else {
                if (sl >= 3) darkRuns.push({y:y, x:sx, len:sl, c:[row[sx*4],row[sx*4+1],row[sx*4+2]]});
                sx = -1; sl = 0;
            }
        }
        if (sl >= 3) darkRuns.push({y:y, x:sx, len:sl, c:[row[sx*4],row[sx*4+1],row[sx*4+2]]});
    }
    return JSON.stringify({w:w, h:h, dpr:dpr, darkRuns:darkRuns.length, details:darkRuns.slice(0,30)}, null, 2);
})()""")
    print("  ", analysis)

    # ---- STEP 3: Input target dump ----
    print("\n=== STEP 3: Input target dump ===")
    dump = cdp.js("""
(function(){
    var ae = document.activeElement;
    var sel = window.getSelection();
    var ce = document.querySelector('[data-component="terminal"]');
    var ta = ce ? ce.querySelector('textarea') : null;
    var cvs = ce ? ce.querySelector('canvas') : null;
    var anc = [];
    var p = ce;
    for (var i=0; i<8 && p; i++) {
        var cs = window.getComputedStyle(p);
        anc.push({tag:p.tagName, id:p.id||'', pos:cs.position, z:cs.zIndex,
            tf:cs.transform, wc:cs.willChange, cnt:cs.contain, iso:cs.isolation,
            ov:cs.overflow, op:cs.opacity, fl:cs.filter, mb:cs.mixBlendMode});
        p = p.parentElement;
    }
    return JSON.stringify({
        active: {tag:ae?.tagName, dc:ae?.getAttribute('data-component'), ce:ae?.getAttribute('contenteditable')},
        sel: {range:sel?.rangeCount, collapsed:sel?.isCollapsed, type:sel?.type},
        ce: ce ? {caret:window.getComputedStyle(ce).caretColor, ov:window.getComputedStyle(ce).overflow} : null,
        ta: ta ? {exists:true, focused:ae===ta, caret:window.getComputedStyle(ta).caretColor, op:window.getComputedStyle(ta).opacity, vis:window.getComputedStyle(ta).visibility, bg:window.getComputedStyle(ta).backgroundColor, rect:ta.getBoundingClientRect()} : null,
        cvs: cvs ? {caret:window.getComputedStyle(cvs).caretColor, cursor:window.getComputedStyle(cvs).cursor} : null,
        ancestors: anc
    }, null, 2);
})()""")
    print("  ", dump)
    with open(ARTIFACTS + "/black-block-diagnostics.json", "w") as f:
        f.write(dump)

    # ---- STEP 4: PTY SGR ----
    print("\n=== STEP 4: PTY SGR ===")
    pty = cdp.js("""
(function(){
    var ce = document.querySelector('[data-component="terminal"]');
    var t = ce ? ce.innerText : '';
    return JSON.stringify({len:t.length, sample:t.substring(0,200),
        hasBg:/\\x1b\\[4[0-9]m/.test(t), hasReverse:/\\x1b\\[7m/.test(t)});
})()""")
    print("  ", pty)

    # ---- STEP 5: Selection ----
    print("\n=== STEP 5: Selection ===")
    sel = cdp.js("""
(function(){
    var s = window.getSelection();
    return JSON.stringify({range:s?.rangeCount, collapsed:s?.isCollapsed, type:s?.type, text:s?.toString()?.substring(0,100)});
})()""")
    print("  ", sel)

    # ---- STEP 6: Compositing CSS ----
    print("\n=== STEP 6: Compositing CSS ===")
    comp = cdp.js("""
(function(){
    var sels = ['aside#terminal-panel','[data-component="terminal"]','[data-component="terminal"] canvas','[data-component="terminal"] textarea'];
    var r = {};
    for (var i=0;i<sels.length;i++) {
        var el = document.querySelector(sels[i]);
        if (!el) continue;
        var cs = window.getComputedStyle(el);
        r[sels[i]] = {pos:cs.position,z:cs.zIndex,tf:cs.transform,wc:cs.willChange,cnt:cs.contain,iso:cs.isolation,ov:cs.overflow,op:cs.opacity,fl:cs.filter,mb:cs.mixBlendMode,cp:cs.clipPath};
    }
    return JSON.stringify(r, null, 2);
})()""")
    print("  ", comp)

    # ---- STEP 7: Contenteditable A/B ----
    print("\n=== STEP 7: Contenteditable A/B (remove CE) ===")
    cdp.js("document.querySelector('[data-component=\"terminal\"]').removeAttribute('contenteditable'); 'removed'")
    time.sleep(0.3)
    spaces(cdp, 30)
    time.sleep(0.5)
    dc = canvas_dark_count(cdp)
    print("  Dark pixels (no CE):", dc)
    cdp.shot(ARTIFACTS + "/black-block-no-contenteditable.png")
    cdp.js("document.querySelector('[data-component=\"terminal\"]').setAttribute('contenteditable','true'); 'restored'")

    # ---- STEP 8: Textarea A/B ----
    print("\n=== STEP 8: Textarea A/B (hide textarea) ===")
    cdp.js("""
var ta = document.querySelector('[data-component="terminal"] textarea');
if(ta) ta.style.display='none'; 'hidden'""")
    time.sleep(0.3)
    spaces(cdp, 30)
    time.sleep(0.5)
    dc2 = canvas_dark_count(cdp)
    print("  Dark pixels (no textarea):", dc2)
    cdp.shot(ARTIFACTS + "/black-block-no-textarea.png")
    cdp.js("var ta2 = document.querySelector('[data-component=\"terminal\"] textarea'); if(ta2) ta2.style.display=''; 'restored'")

    # ---- Summary ----
    print("\n=== SUMMARY ===")
    head = os.popen("cd /d/hscode && git rev-parse HEAD").read().strip()
    print("HEAD:", head)
    for f in sorted(os.listdir(ARTIFACTS)):
        fp = os.path.join(ARTIFACTS, f)
        if os.path.isfile(fp):
            print("  %s (%d bytes)" % (f, os.path.getsize(fp)))

    cdp.close()

if __name__ == "__main__":
    main()
