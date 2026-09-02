#!/usr/bin/env python3
"""P0: Decode CDP PNG and scan terminal area for black block"""
import json, http.client, os, socket, struct, base64, time, zlib

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


def parse_png_pixels(png_data):
    """Simple PNG parser - returns (width, height, pixels) where pixels is flat RGB"""
    # Find IHDR
    pos = 8  # skip PNG signature
    width = height = 0
    idat_data = b""

    while pos < len(png_data):
        length = struct.unpack(">I", png_data[pos:pos+4])[0]
        chunk_type = png_data[pos+4:pos+8]
        chunk_data = png_data[pos+8:pos+8+length]

        if chunk_type == b"IHDR":
            width = struct.unpack(">I", chunk_data[0:4])[0]
            height = struct.unpack(">I", chunk_data[4:8])[0]
            bit_depth = chunk_data[8]
            color_type = chunk_data[9]
        elif chunk_type == b"IDAT":
            idat_data += chunk_data

        pos += 12 + length

    # Decompress
    raw = zlib.decompress(idat_data)

    # Parse scanlines (assuming RGB, 8-bit, no interlace)
    # Filter byte at start of each scanline
    stride = 1 + width * 3  # filter + RGB pixels
    pixels = bytearray(width * height * 3)

    prev_row = bytearray(width * 3)
    for y in range(height):
        filter_type = raw[y * stride]
        row_start = y * stride + 1
        row_data = raw[row_start:row_start + width * 3]

        if filter_type == 0:  # None
            pass
        elif filter_type == 1:  # Sub
            for i in range(3, len(row_data)):
                row_data = bytearray(row_data)
                row_data[i] = (row_data[i] + row_data[i - 3]) % 256
                row_data = bytes(row_data)
        elif filter_type == 2:  # Up
            for i in range(len(row_data)):
                row_data = bytearray(row_data)
                row_data[i] = (row_data[i] + prev_row[i]) % 256
                row_data = bytes(row_data)
        elif filter_type == 3:  # Average
            for i in range(len(row_data)):
                row_data = bytearray(row_data)
                left = row_data[i - 3] if i >= 3 else 0
                up = prev_row[i]
                row_data[i] = (row_data[i] + (left + up) // 2) % 256
                row_data = bytes(row_data)
        elif filter_type == 4:  # Paeth
            for i in range(len(row_data)):
                row_data = bytearray(row_data)
                left = row_data[i - 3] if i >= 3 else 0
                up = prev_row[i]
                up_left = prev_row[i - 3] if i >= 3 else 0
                p = left + up - up_left
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - up_left)
                if pa <= pb and pa <= pc: pr = left
                elif pb <= pc: pr = up
                else: pr = up_left
                row_data[i] = (row_data[i] + pr) % 256
                row_data = bytes(row_data)

        dest_offset = y * width * 3
        pixels[dest_offset:dest_offset + width * 3] = row_data[:width * 3]
        prev_row = bytearray(row_data[:width * 3])

    return width, height, bytes(pixels)


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

    # Type 30 spaces via proper KeyboardEvent
    print("=== Typing 30 spaces ===")
    cdp.js("""(function(){
        var ce = document.querySelector('[data-component="terminal"]');
        for (var i = 0; i < 30; i++) {
            ce.dispatchEvent(new KeyboardEvent('keydown', {
                key: ' ', code: 'Space', keyCode: 32, which: 32, charCode: 32,
                bubbles: true, cancelable: true, composed: true, isComposing: false,
                ctrlKey: false, altKey: false, metaKey: false, shiftKey: false
            }));
        }
        return 'done';
    })()""")
    time.sleep(1.0)

    # Get terminal panel rect (in CSS pixels)
    panel_rect = cdp.js("""(function(){
        var p = document.querySelector('aside#terminal-panel');
        if (!p) return null;
        var r = p.getBoundingClientRect();
        return JSON.stringify({x: r.x, y: r.y, w: r.width, h: r.height});
    })()""")
    print("Panel rect:", panel_rect)

    # Get canvas rect
    canvas_rect = cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        if (!c) return null;
        var r = c.getBoundingClientRect();
        return JSON.stringify({x: r.x, y: r.y, w: r.width, h: r.height, cw: c.width, ch: c.height});
    })()""")
    print("Canvas rect:", canvas_rect)

    # Take CDP screenshot
    r = cdp.send("Page.captureScreenshot", {"format": "png"})
    img_b64 = r.get("result", {}).get("data", "") if r else ""
    if not img_b64:
        print("FAILED to get screenshot")
        cdp.close()
        return

    img_bytes = base64.b64decode(img_b64)
    with open(ARTIFACTS + "/black-block-cdp-decode.png", "wb") as f:
        f.write(img_bytes)

    # Parse PNG
    print("\n=== Decoding CDP screenshot ===")
    try:
        width, height, pixels = parse_png_pixels(img_bytes)
        print(f"  PNG: {width}x{height}, {len(pixels)} bytes pixel data")
    except Exception as e:
        print(f"  PNG decode error: {e}")
        cdp.close()
        return

    # Get DPR
    dpr = cdp.js("window.devicePixelRatio")
    print(f"  DPR: {dpr}")

    # Convert panel rect to pixel coordinates
    if panel_rect:
        pr = json.loads(panel_rect)
        px_x = int(pr["x"] * dpr)
        px_y = int(pr["y"] * dpr)
        px_w = int(pr["w"] * dpr)
        px_h = int(pr["h"] * dpr)
        print(f"  Panel pixels: ({px_x},{px_y}) {px_w}x{px_h}")

    # Scan the ENTIRE screenshot for dark runs
    print("\n=== Full screenshot scan ===")
    bg_threshold = 10
    dark_threshold = 30

    # Find all non-background runs
    all_runs = []
    for y in range(height):
        for x in range(width - 1):
            idx = (y * width + x) * 3
            r_val = pixels[idx]
            g_val = pixels[idx + 1]
            b_val = pixels[idx + 2]
            is_dark = r_val < dark_threshold and g_val < dark_threshold and b_val < dark_threshold
            if is_dark:
                # Find run length
                run_len = 1
                for xx in range(x + 1, min(x + 500, width)):
                    idx2 = (y * width + xx) * 3
                    if pixels[idx2] < dark_threshold and pixels[idx2+1] < dark_threshold and pixels[idx2+2] < dark_threshold:
                        run_len += 1
                    else:
                        break
                if run_len >= 10:
                    all_runs.append({"y": y, "x": x, "len": run_len, "c": [r_val, g_val, b_val]})
                x += run_len - 1  # skip ahead

    print(f"  Dark runs (>=10px): {len(all_runs)}")

    # Find the LARGEST dark run
    if all_runs:
        largest = max(all_runs, key=lambda r: r["len"])
        print(f"  Largest dark run: y={largest['y']}, x={largest['x']}, len={largest['len']}, color={largest['c']}")

        # Find runs in the terminal panel area
        if panel_rect:
            pr = json.loads(panel_rect)
            panel_runs = [r for r in all_runs if r["y"] >= px_y and r["y"] < px_y + px_h and r["x"] >= px_x and r["x"] < px_x + px_w]
            print(f"  Dark runs in terminal panel: {len(panel_runs)}")
            if panel_runs:
                largest_panel = max(panel_runs, key=lambda r: r["len"])
                print(f"  Largest in panel: y={largest_panel['y']}, x={largest_panel['x']}, len={largest_panel['len']}")

            # Find runs OUTSIDE the terminal panel
            outside_runs = [r for r in all_runs if not (r["y"] >= px_y and r["y"] < px_y + px_h and r["x"] >= px_x and r["x"] < px_x + px_w)]
            print(f"  Dark runs outside terminal panel: {len(outside_runs)}")
            if outside_runs:
                largest_outside = max(outside_runs, key=lambda r: r["len"])
                print(f"  Largest outside: y={largest_outside['y']}, x={largest_outside['x']}, len={largest_outside['len']}")

        # Show top 10 longest runs
        top_runs = sorted(all_runs, key=lambda r: r["len"], reverse=True)[:10]
        print("\n  Top 10 longest dark runs:")
        for r in top_runs:
            print(f"    y={r['y']}, x={r['x']}, len={r['len']}, color={r['c']}")
    else:
        print("  No dark runs found!")

    # Also scan canvas via toDataURL
    print("\n=== Canvas scan ===")
    canvas_url = cdp.js("""(function(){
        var c = document.querySelector('[data-component="terminal"] canvas');
        return c ? c.toDataURL('image/png') : null;
    })()""")
    if canvas_url and canvas_url.startswith("data:image/png;base64,"):
        canvas_bytes = base64.b64decode(canvas_url.split(",", 1)[1])
        with open(ARTIFACTS + "/black-block-canvas-decode.png", "wb") as f:
            f.write(canvas_bytes)
        try:
            cw, ch, cpixels = parse_png_pixels(canvas_bytes)
            print(f"  Canvas PNG: {cw}x{ch}")

            # Scan canvas for dark runs
            canvas_dark = 0
            canvas_runs = []
            for y in range(ch):
                for x in range(cw - 1):
                    idx = (y * cw + x) * 3
                    if cpixels[idx] < dark_threshold and cpixels[idx+1] < dark_threshold and cpixels[idx+2] < dark_threshold:
                        canvas_dark += 1
                        run_len = 1
                        for xx in range(x + 1, min(x + 500, cw)):
                            idx2 = (y * cw + xx) * 3
                            if cpixels[idx2] < dark_threshold and cpixels[idx2+1] < dark_threshold and cpixels[idx2+2] < dark_threshold:
                                run_len += 1
                            else:
                                break
                        if run_len >= 10:
                            canvas_runs.append({"y": y, "x": x, "len": run_len})
                        x += run_len - 1

            print(f"  Canvas dark pixels: {canvas_dark}")
            print(f"  Canvas dark runs (>=10px): {len(canvas_runs)}")
            if canvas_runs:
                largest_canvas = max(canvas_runs, key=lambda r: r["len"])
                print(f"  Largest canvas run: y={largest_canvas['y']}, x={largest_canvas['x']}, len={largest_canvas['len']}")
        except Exception as e:
            print(f"  Canvas decode error: {e}")

    cdp.close()


if __name__ == "__main__":
    main()
