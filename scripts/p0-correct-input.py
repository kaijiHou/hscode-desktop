#!/usr/bin/env python3
"""P0: Dispatch correct keyboard events to ghostty contenteditable"""
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

    # Focus terminal via mouse click
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

    print("Active:", cdp.js("document.activeElement?.tagName"))

    # ===== METHOD A: Proper KeyboardEvent with all correct properties =====
    print("\n=== METHOD A: Full KeyboardEvent on contenteditable ===")
    result = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';

        // First check if isComposing is true on the input handler
        // We can't access the handler directly, but we can check composition state

        // Dispatch 5 proper KeyboardEvents
        for (var i = 0; i < 5; i++) {
            var kd = new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                charCode: 32,
                bubbles: true,
                cancelable: true,
                composed: true,
                isComposing: false,
                ctrlKey: false,
                altKey: false,
                metaKey: false,
                shiftKey: false
            });
            var dispatched = ce.dispatchEvent(kd);

            // Also dispatch keypress (some handlers listen for this)
            var kp = new KeyboardEvent('keypress', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                charCode: 32,
                bubbles: true,
                cancelable: true,
                composed: true,
                isComposing: false
            });
            ce.dispatchEvent(kp);

            // Also dispatch keyup
            var ku = new KeyboardEvent('keyup', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                charCode: 32,
                bubbles: true,
                cancelable: true,
                composed: true,
                isComposing: false,
                ctrlKey: false,
                altKey: false,
                metaKey: false,
                shiftKey: false
            });
            ce.dispatchEvent(ku);
        }

        // Check results
        var ta = ce.querySelector('textarea');
        return JSON.stringify({
            ceInnerText: (ce.innerText || '').substring(0, 200),
            taValue: (ta?.value || '').substring(0, 200),
            taLen: ta?.value?.length || 0
        });
    })()""")
    print("  Result:", result)

    # Check canvas
    canvas_dark = cdp.js("""(function(){
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
    print("  Canvas dark pixels:", canvas_dark)

    # ===== METHOD B: Use ghostty's input() method directly =====
    print("\n=== METHOD B: Ghostty input() via terminal instance ===")
    # Try to find terminal instance through React fiber
    result2 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';

        // Try to find React fiber
        var fiberKey = Object.keys(ce).find(function(k) { return k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'); });
        if (!fiberKey) return 'no react fiber on CE';

        var fiber = ce[fiberKey];
        // Walk up fiber tree to find terminal reference
        var found = null;
        var p = fiber;
        for (var i = 0; i < 30 && p; i++) {
            var state = p.memoizedState;
            while (state) {
                if (state.memoizedState && typeof state.memoizedState === 'object') {
                    var s = state.memoizedState;
                    if (s && s.current && typeof s.current.write === 'function') {
                        found = 'write method found at fiber depth ' + i;
                        break;
                    }
                }
                state = state.next;
            }
            if (found) break;

            // Also check stateNode
            if (p.stateNode && typeof p.stateNode === 'object' && p.stateNode !== ce) {
                var sn = p.stateNode;
                if (typeof sn.write === 'function') {
                    found = 'write on stateNode at depth ' + i;
                    break;
                }
            }
            p = p.return;
        }

        return found || 'terminal instance not found in fiber tree';
    })()""")
    print("  ", result2)

    # ===== METHOD C: Override isComposing check =====
    print("\n=== METHOD C: Patch isComposing + dispatch ===")
    result3 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';

        // Find the ghostty input handler by checking event listeners
        // Alternative: use ghostty's internal API

        // Check if ghostty terminal has exposed methods
        var keys = [];
        for (var k in ce) {
            if (typeof ce[k] === 'function' && k.indexOf('handle') === -1 && k.indexOf('webkit') === -1) {
                keys.push(k);
            }
        }

        return JSON.stringify({ceMethods: keys.slice(0, 30)});
    })()""")
    print("  ", result3)

    # ===== METHOD D: Try paste event (known to work in some ghostty builds) =====
    print("\n=== METHOD D: Paste event ===")
    result4 = cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        if (!ce) return 'no CE';

        // Create a paste event with data
        var pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clipboardData: new DataTransfer()
        });
        pasteEvent.clipboardData.setData('text/plain', '     ');

        var dispatched = ce.dispatchEvent(pasteEvent);
        var ta = ce.querySelector('textarea');

        return JSON.stringify({
            dispatched: dispatched,
            ceInnerText: (ce.innerText || '').substring(0, 200),
            taValue: (ta?.value || '').substring(0, 200)
        });
    })()""")
    print("  ", result4)

    canvas_dark2 = cdp.js("""(function(){
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
    print("  Canvas dark pixels:", canvas_dark2)

    # ===== METHOD E: Direct terminal.input() via window.__GHOSTTY__ =====
    print("\n=== METHOD E: Search for terminal reference ===")
    result5 = cdp.js("""(function(){
        // Search all objects in window for ghostty terminal
        var found = [];
        try {
            // Check React root
            var root = document.getElementById('root') || document.getElementById('app');
            if (root) {
                var rk = Object.keys(root).find(function(k) { return k.startsWith('__reactContainer'); });
                if (rk) {
                    var container = root[rk];
                    // Walk the fiber tree
                    var queue = [container];
                    var visited = new Set();
                    while (queue.length > 0 && found.length < 5) {
                        var fiber = queue.shift();
                        if (!fiber || visited.has(fiber)) continue;
                        visited.add(fiber);

                        // Check memoizedState chain
                        var state = fiber.memoizedState;
                        while (state) {
                            var ms = state.memoizedState;
                            if (ms && typeof ms === 'object' && ms !== null) {
                                if (typeof ms.write === 'function' && typeof ms.input === 'function') {
                                    found.push({depth: visited.size, methods: ['write', 'input']});
                                    // Try to use it
                                    try {
                                        ms.input('     ');
                                        found.push({inputCalled: true});
                                    } catch(e) {
                                        found.push({inputError: e.message});
                                    }
                                }
                            }
                            state = state.next;
                        }

                        if (fiber.child) queue.push(fiber.child);
                        if (fiber.sibling) queue.push(fiber.sibling);
                    }
                }
            }
        } catch(e) {
            found.push({error: e.message});
        }
        return JSON.stringify(found);
    })()""")
    print("  ", result5)

    time.sleep(0.5)
    canvas_dark3 = cdp.js("""(function(){
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
    print("  Canvas dark pixels:", canvas_dark3)

    cdp.close()


if __name__ == "__main__":
    main()
