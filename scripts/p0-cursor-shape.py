#!/usr/bin/env python3
"""P0: Direct canvas getImageData scan at cursor position"""
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


def dispatch_spaces(ce_js, n):
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

    # Type 30 spaces
    print("=== Typing 30 spaces ===")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        """ + dispatch_spaces("ce", 30) + """
        return 'done';
    })()""")
    time.sleep(1.0)

    # ===== Check renderer cursorStyle =====
    print("\n=== Renderer cursorStyle ===")
    cursor_info = cdp.js("""(function(){
        // Try to find the renderer through the terminal element
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';

        // Check the canvas context for any cursor-related state
        var c = ce.querySelector('canvas');
        if (!c) return 'no canvas';

        // The renderer stores cursorStyle as a property
        // We can't access it directly, but we can check what's drawn

        // Scan the LAST ROW of the canvas (where the cursor should be)
        var ctx = c.getContext('2d');
        var w = c.width, h = c.height;
        var bgR = 250, bgG = 251, bgB = 252;

        // Find the last content row
        var lastRow = -1;
        for (var y = h-1; y >= 0; y--) {
            var row = ctx.getImageData(0, y, w, 1).data;
            for (var x = 0; x < w; x++) {
                if (!(Math.abs(row[x*4]-bgR)<10 && Math.abs(row[x*4+1]-bgG)<10 && Math.abs(row[x*4+2]-bgB)<10)) {
                    lastRow = y;
                    break;
                }
            }
            if (lastRow >= 0) break;
        }

        // Check the row AFTER last content (cursor might be there)
        var cursorArea = [];
        if (lastRow >= 0 && lastRow + 1 < h) {
            var row = ctx.getImageData(0, lastRow + 1, w, 1).data;
            for (var x = 0; x < w; x++) {
                var r = row[x*4], g = row[x*4+1], b = row[x*4+2];
                if (!(Math.abs(r-bgR)<10 && Math.abs(g-bgG)<10 && Math.abs(b-bgB)<10)) {
                    cursorArea.push({x: x, r: r, g: g, b: b});
                }
            }
        }

        // Also check the last content row itself
        var lastRowPixels = [];
        if (lastRow >= 0) {
            var row = ctx.getImageData(0, lastRow, w, 1).data;
            for (var x = 0; x < w; x++) {
                var r = row[x*4], g = row[x*4+1], b = row[x*4+2];
                if (!(Math.abs(r-bgR)<10 && Math.abs(g-bgG)<10 && Math.abs(b-bgB)<10)) {
                    lastRowPixels.push({x: x, r: r, g: g, b: b});
                }
            }
        }

        return JSON.stringify({
            lastContentRow: lastRow,
            cursorAreaPixels: cursorArea.length,
            cursorAreaSample: cursorArea.slice(0, 20),
            lastRowPixels: lastRowPixels.length,
            lastRowSample: lastRowPixels.slice(0, 20)
        }, null, 2);
    })()""")
    print(cursor_info)

    # ===== Check: is there a cursor bar or block? =====
    print("\n=== Cursor shape analysis ===")
    cursor_shape = cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        if (!c) return 'no canvas';
        var ctx = c.getContext('2d');
        var w = c.width, h = c.height;
        var bgR = 250, bgG = 251, bgB = 252;

        // Find cursor position by looking for non-background pixels
        // that are NOT text-colored (text is ~[28,32,38])
        var cursorPixels = [];
        for (var y = 0; y < h; y++) {
            var row = ctx.getImageData(0, y, w, 1).data;
            for (var x = 0; x < w; x++) {
                var r = row[x*4], g = row[x*4+1], b = row[x*4+2];
                if (Math.abs(r-bgR)<10 && Math.abs(g-bgG)<10 && Math.abs(b-bgB)<10) continue;
                // Not background. Is it text-colored?
                var isText = (r >= 20 && r <= 40 && g >= 20 && g <= 45 && b >= 20 && b <= 50);
                if (!isText) {
                    cursorPixels.push({x: x, y: y, r: r, g: g, b: b});
                }
            }
        }

        // Find the cursor color (most common non-text, non-bg color)
        var colorCounts = {};
        for (var i = 0; i < cursorPixels.length; i++) {
            var key = cursorPixels[i].r + ',' + cursorPixels[i].g + ',' + cursorPixels[i].b;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
        var sortedColors = Object.entries(colorCounts).sort(function(a,b) { return b[1] - a[1]; });

        return JSON.stringify({
            cursorPixelCount: cursorPixels.length,
            topColors: sortedColors.slice(0, 10),
            sample: cursorPixels.slice(0, 30)
        }, null, 2);
    })()""")
    print(cursor_shape)

    # ===== Check: what does the contenteditable text look like? =====
    print("\n=== Contenteditable innerHTML ===")
    ce_html = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';
        return ce.innerHTML.substring(0, 500);
    })()""")
    print(ce_html)

    cdp.close()


if __name__ == "__main__":
    main()
