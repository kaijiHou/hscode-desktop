#!/usr/bin/env python3
"""P0: After successful input, scan canvas for black block location"""
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

    def shot(self, path):
        r = self.send("Page.captureScreenshot", {"format": "png"})
        data = r.get("result", {}).get("data", "") if r else ""
        if data:
            with open(path, "wb") as f:
                f.write(base64.b64decode(data))
            print("  Saved:", path, os.path.getsize(path), "bytes")
            return True
        return False

    def close(self):
        if self.sock:
            self.sock.close()


def dispatch_spaces(ce_js, n):
    """Dispatch n spaces via proper KeyboardEvent"""
    events = ""
    for i in range(n):
        events += """
        ce.dispatchEvent(new KeyboardEvent('keydown', {
            key: ' ', code: 'Space', keyCode: 32, which: 32, charCode: 32,
            bubbles: true, cancelable: true, composed: true, isComposing: false,
            ctrlKey: false, altKey: false, metaKey: false, shiftKey: false
        }));
        """
    return events


def main():
    os.makedirs(ARTIFACTS, exist_ok=True)
    cdp = CDP()
    cdp.connect()

    # Focus terminal
    panel = cdp.js("""(function(){
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

    # ===== STEP 1: Type 30 spaces =====
    print("=== Typing 30 spaces ===")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        """ + dispatch_spaces("ce", 30) + """
        return 'dispatched 30 spaces';
    })()""")
    time.sleep(1.0)

    # ===== STEP 2: Canvas deep scan =====
    print("\n=== Canvas deep scan ===")
    scan = cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        if (!c) return 'no canvas';
        var ctx = c.getContext('2d');
        var w = c.width, h = c.height;
        var bgR = 250, bgG = 251, bgB = 252;

        // Find ALL non-background runs >= 5px
        var allRuns = [];
        for (var y = 0; y < h; y++) {
            var row = ctx.getImageData(0, y, w, 1).data;
            var sx = -1, sl = 0;
            for (var x = 0; x < w; x++) {
                var r = row[x*4], g = row[x*4+1], b = row[x*4+2];
                var isBg = Math.abs(r-bgR)<10 && Math.abs(g-bgG)<10 && Math.abs(b-bgB)<10;
                if (!isBg) {
                    if (sx < 0) sx = x;
                    sl++;
                } else {
                    if (sl >= 5) allRuns.push({y:y, x:sx, len:sl, c:[row[sx*4],row[sx*4+1],row[sx*4+2]]});
                    sx = -1; sl = 0;
                }
            }
            if (sl >= 5) allRuns.push({y:y, x:sx, len:sl, c:[row[sx*4],row[sx*4+1],row[sx*4+2]]});
        }

        // Find runs with color < 30 (very dark / black)
        var blackRuns = allRuns.filter(function(r) {
            return r.c[0] < 30 && r.c[1] < 30 && r.c[2] < 30;
        });

        // Find the LARGEST black run
        var largestBlack = blackRuns.reduce(function(max, r) {
            return r.len > max.len ? r : max;
        }, {len: 0, y: -1, x: -1});

        // Find runs that are NOT text-colored (text is ~[28,32,38])
        var nonTextRuns = allRuns.filter(function(r) {
            return !(r.c[0] >= 20 && r.c[0] <= 40 && r.c[1] >= 20 && r.c[1] <= 45 && r.c[2] >= 20 && r.c[2] <= 50);
        });

        // Total dark pixels
        var totalDark = 0;
        for (var y = 0; y < h; y++) {
            var row = ctx.getImageData(0, y, w, 1).data;
            for (var x = 0; x < w; x++) {
                if (row[x*4] < 30 && row[x*4+1] < 30 && row[x*4+2] < 30) totalDark++;
            }
        }

        return JSON.stringify({
            totalRuns: allRuns.length,
            blackRuns: blackRuns.length,
            blackRunDetails: blackRuns.slice(0, 20),
            largestBlackRun: largestBlack,
            nonTextRuns: nonTextRuns.slice(0, 10),
            totalBlackPixels: totalDark,
            canvasSize: {w: w, h: h},
            lastContentRow: (function() {
                for (var y = h-1; y >= 0; y--) {
                    var row = ctx.getImageData(0, y, w, 1).data;
                    for (var x = 0; x < w; x++) {
                        if (!(Math.abs(row[x*4]-bgR)<10 && Math.abs(row[x*4+1]-bgG)<10 && Math.abs(row[x*4+2]-bgB)<10)) return y;
                    }
                }
                return -1;
            })()
        }, null, 2);
    })()""")
    print(scan)

    # ===== STEP 3: CDP screenshot =====
    print("\n=== CDP screenshot ===")
    cdp.shot(ARTIFACTS + "/black-block-after-30spaces-cdp.png")

    # ===== STEP 4: Canvas toDataURL =====
    print("\n=== Canvas toDataURL ===")
    canvas_url = cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        return c ? c.toDataURL('image/png') : null;
    })()""")
    if canvas_url and canvas_url.startswith("data:image/png;base64,"):
        with open(ARTIFACTS + "/black-block-after-30spaces-canvas.png", "wb") as f:
            f.write(base64.b64decode(canvas_url.split(",", 1)[1]))
        print("  Canvas saved:", os.path.getsize(ARTIFACTS + "/black-block-after-30spaces-canvas.png"), "bytes")

    # ===== STEP 5: Screenshot file sizes comparison =====
    print("\n=== File size comparison ===")
    cdp_size = os.path.getsize(ARTIFACTS + "/black-block-after-30spaces-cdp.png")
    canvas_size = os.path.getsize(ARTIFACTS + "/black-block-after-30spaces-canvas.png")
    print(f"  CDP screenshot: {cdp_size} bytes")
    print(f"  Canvas toDataURL: {canvas_size} bytes")
    print(f"  Ratio: {cdp_size/canvas_size:.2f}x")

    # ===== STEP 6: Check if contenteditable has visible text =====
    print("\n=== Contenteditable visible text ===")
    ce_state = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';
        var sel = window.getSelection();
        return JSON.stringify({
            innerText: (ce.innerText || '').substring(0, 200),
            textContent: (ce.textContent || '').substring(0, 200),
            childNodes: ce.childNodes.length,
            children: ce.children.length,
            selectionRange: sel?.rangeCount,
            selectionCollapsed: sel?.isCollapsed,
            selectionType: sel?.type
        });
    })()""")
    print("  ", ce_state)

    # ===== STEP 7: Key test - is the black block on canvas or DOM? =====
    print("\n=== BLACK BLOCK LOCATION TEST ===")
    # Hide canvas temporarily and check if black block remains
    cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        if (c) c.style.display = 'none';
        return 'canvas hidden';
    })()""")
    time.sleep(0.3)
    cdp.shot(ARTIFACTS + "/black-block-no-canvas.png")
    cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        if (c) c.style.display = '';
        return 'canvas restored';
    })()""")
    time.sleep(0.3)

    # Hide contenteditable text and check
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (ce) {
            ce.style.color = 'transparent';
            ce.style.caretColor = 'transparent';
        }
        return 'CE text hidden';
    })()""")
    time.sleep(0.3)
    cdp.shot(ARTIFACTS + "/black-block-no-ce-text.png")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (ce) {
            ce.style.color = '';
            ce.style.caretColor = '';
        }
        return 'CE text restored';
    })()""")

    print("\n=== Artifacts ===")
    for f in sorted(os.listdir(ARTIFACTS)):
        fp = os.path.join(ARTIFACTS, f)
        if os.path.isfile(fp) and "black-block" in f:
            print(f"  {f} ({os.path.getsize(fp)} bytes)")

    cdp.close()


if __name__ == "__main__":
    main()
