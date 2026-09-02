#!/usr/bin/env python3
"""P0: Simulate real keyboard input via JS dispatchEvent + capture state"""
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

    # ===== METHOD 1: CDP Input.dispatchKeyEvent (known not to work) =====
    print("=== METHOD 1: CDP Input.dispatchKeyEvent ===")
    # Focus via mouse click
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
        time.sleep(0.3)

    for i in range(5):
        cdp.send("Input.dispatchKeyEvent", {"type": "keyDown", "key": " ", "code": "Space", "text": " "})
        cdp.send("Input.dispatchKeyEvent", {"type": "keyUp", "key": " ", "code": "Space"})
    time.sleep(0.5)

    ce_text_1 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        var ta = ce ? ce.querySelector('textarea') : null;
        return JSON.stringify({ce: ce?.innerText?.substring(0,100), ta: ta?.value?.substring(0,100), taLen: ta?.value?.length});
    })()""")
    print("  After CDP events:", ce_text_1)

    # ===== METHOD 2: JS dispatchEvent on contenteditable =====
    print("\n=== METHOD 2: JS dispatchEvent on contenteditable ===")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        ce.focus();
        for (var i = 0; i < 5; i++) {
            ce.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true}));
            ce.dispatchEvent(new InputEvent('beforeinput', {data: ' ', inputType: 'insertText', bubbles: true}));
            ce.dispatchEvent(new InputEvent('input', {data: ' ', inputType: 'insertText', bubbles: true}));
            ce.dispatchEvent(new KeyboardEvent('keyup', {key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true}));
        }
        return document.querySelector('[data-component="terminal"]')?.innerText?.substring(0,100) || 'empty';
    })()""")
    time.sleep(0.5)
    ce_text_2 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        var ta = ce ? ce.querySelector('textarea') : null;
        return JSON.stringify({ce: ce?.innerText?.substring(0,100), ta: ta?.value?.substring(0,100), taLen: ta?.value?.length});
    })()""")
    print("  After JS dispatch:", ce_text_2)

    # ===== METHOD 3: JS dispatchEvent on hidden textarea =====
    print("\n=== METHOD 3: JS dispatchEvent on textarea ===")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        var ta = ce.querySelector('textarea');
        if (!ta) return 'no textarea';
        ta.focus();
        for (var i = 0; i < 5; i++) {
            ta.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true}));
            ta.dispatchEvent(new InputEvent('beforeinput', {data: ' ', inputType: 'insertText', bubbles: true}));
            ta.dispatchEvent(new InputEvent('input', {data: ' ', inputType: 'insertText', bubbles: true}));
            ta.dispatchEvent(new KeyboardEvent('keyup', {key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true}));
        }
        return ta.value;
    })()""")
    time.sleep(0.5)
    ce_text_3 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        var ta = ce ? ce.querySelector('textarea') : null;
        return JSON.stringify({ce: ce?.innerText?.substring(0,100), ta: ta?.value?.substring(0,100), taLen: ta?.value?.length});
    })()""")
    print("  After textarea dispatch:", ce_text_3)

    # ===== METHOD 4: Simulate real input via document.execCommand =====
    print("\n=== METHOD 4: document.execCommand insertText ===")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        ce.focus();
        document.execCommand('insertText', false, '     ');
        return ce.innerText?.substring(0,100) || 'empty';
    })()""")
    time.sleep(0.5)
    ce_text_4 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        var ta = ce ? ce.querySelector('textarea') : null;
        return JSON.stringify({ce: ce?.innerText?.substring(0,100), ta: ta?.value?.substring(0,100), taLen: ta?.value?.length});
    })()""")
    print("  After execCommand:", ce_text_4)

    # ===== METHOD 5: Check ghostty Terminal write method =====
    print("\n=== METHOD 5: Ghostty Terminal instance ===")
    # Try to find the terminal instance
    term_info = cdp.js("""(function(){
        // Check if there's a global terminal reference
        var keys = Object.keys(window).filter(function(k) { return k.toLowerCase().indexOf('terminal') >= 0 || k.toLowerCase().indexOf('ghostty') >= 0; });
        return JSON.stringify({windowKeys: keys.slice(0, 20)});
    })()""")
    print("  Window keys:", term_info)

    # ===== METHOD 6: Use ghostty's own input handler =====
    print("\n=== METHOD 6: Ghostty input via textarea.value manipulation ===")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        var ta = ce.querySelector('textarea');
        if (!ta) return 'no textarea';
        // Set textarea value and dispatch input event
        ta.value = '     ';
        ta.dispatchEvent(new Event('input', {bubbles: true}));
        return 'set value + dispatched input';
    })()""")
    time.sleep(0.5)
    ce_text_6 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        var ta = ce ? ce.querySelector('textarea') : null;
        return JSON.stringify({ce: ce?.innerText?.substring(0,100), ta: ta?.value?.substring(0,100), taLen: ta?.value?.length});
    })()""")
    print("  After textarea.value:", ce_text_6)

    # ===== CANVAS SCAN after all methods =====
    print("\n=== CANVAS SCAN after input attempts ===")
    canvas_scan = cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        if (!c) return 'no canvas';
        var ctx = c.getContext('2d');
        var w = c.width, h = c.height;
        var bgR = 250, bgG = 251, bgB = 252;
        var totalDark = 0;
        for (var y = 0; y < h; y++) {
            var row = ctx.getImageData(0, y, w, 1).data;
            for (var x = 0; x < w; x++) {
                if (row[x*4] < 30 && row[x*4+1] < 30 && row[x*4+2] < 30) totalDark++;
            }
        }
        return 'Dark pixels (< 30): ' + totalDark;
    })()""")
    print("  ", canvas_scan)

    # ===== FINAL: Check what the terminal actually rendered =====
    print("\n=== FINAL: Terminal render state ===")
    render_state = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';
        // Check contenteditable children for text nodes
        var textNodes = [];
        function walk(el, depth) {
            if (depth > 5) return;
            for (var i = 0; i < el.childNodes.length; i++) {
                var n = el.childNodes[i];
                if (n.nodeType === 3 && n.textContent.trim()) {
                    textNodes.push({parent: el.tagName, text: n.textContent.substring(0,50)});
                }
                if (n.nodeType === 1) walk(n, depth+1);
            }
        }
        walk(ce, 0);

        // Check if there are any visible text elements
        var visibleText = [];
        var all = ce.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var cs = window.getComputedStyle(el);
            if (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0') {
                if (el.textContent && el.textContent.trim() && el.children.length === 0) {
                    visibleText.push({tag: el.tagName, text: el.textContent.substring(0,50)});
                }
            }
        }

        return JSON.stringify({textNodes: textNodes, visibleText: visibleText.slice(0,10)}, null, 2);
    })()""")
    print("  ", render_state)

    cdp.close()


if __name__ == "__main__":
    main()
