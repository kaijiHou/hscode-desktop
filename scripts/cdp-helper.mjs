// CDP helper - focus terminal, type spaces, screenshot
import http from 'http';
import net from 'net';
import crypto from 'crypto';
import fs from 'fs';

const CDP_PORT = 9222;

function getTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)[0]));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.url = new URL(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.buf = Buffer.alloc(0);
    this.upgraded = false;
  }

  connect() {
    return new Promise((resolve) => {
      const key = crypto.randomBytes(16).toString('base64');
      this.sock = net.createConnection({
        host: this.url.hostname,
        port: parseInt(this.url.port)
      });
      this.sock.once('connect', () => {
        this.sock.write(`GET ${this.url.pathname} HTTP/1.1\r\nHost: ${this.url.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      this.sock.on('data', (chunk) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        if (!this.upgraded) {
          const s = this.buf.toString();
          if (s.includes('\r\n\r\n')) {
            this.upgraded = true;
            this.buf = this.buf.slice(s.indexOf('\r\n\r\n') + 4);
            resolve();
          }
          return;
        }
        this._parseFrames();
      });
    });
  }

  _parseFrames() {
    while (this.buf.length >= 2) {
      const b1 = this.buf[1] & 0x7f;
      let off = 2, pl = b1;
      if (b1 === 126) {
        if (this.buf.length < 4) return;
        pl = this.buf.readUInt16BE(2);
        off = 4;
      } else if (b1 === 127) {
        if (this.buf.length < 10) return;
        pl = Number(this.buf.readBigUInt64BE(2));
        off = 10;
      }
      if (this.buf.length < off + pl) return;
      const payload = this.buf.slice(off, off + pl).toString();
      this.buf = this.buf.slice(off + pl);
      try {
        const obj = JSON.parse(payload);
        if (obj.id && this.pending.has(obj.id)) {
          this.pending.get(obj.id)(obj);
          this.pending.delete(obj.id);
        }
      } catch (e) {}
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, resolve);
      const msg = JSON.stringify({ id, method, params });
      const payload = Buffer.from(msg);
      const mask = crypto.randomBytes(4);
      const masked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
      let hdr;
      if (payload.length <= 125) {
        hdr = Buffer.alloc(6);
        hdr[0] = 0x81; hdr[1] = 0x80 | payload.length;
        mask.copy(hdr, 2);
      } else {
        hdr = Buffer.alloc(8);
        hdr[0] = 0x81; hdr[1] = 0x80 | 126;
        hdr.writeUInt16BE(payload.length, 2);
        mask.copy(hdr, 4);
      }
      this.sock.write(Buffer.concat([hdr, masked]));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('timeout'));
        }
      }, 5000);
    });
  }

  close() { this.sock.destroy(); }
}

async function main() {
  const action = process.argv[2] || 'screenshot';
  const tab = await getTab();
  const cdp = new CDPClient(tab.webSocketDebuggerUrl);
  await cdp.connect();

  if (action === 'screenshot') {
    // Focus terminal, type spaces, wait, screenshot
    await cdp.send('Runtime.evaluate', { expression: `
      document.querySelector("[data-component='terminal']").focus();
      true;
    `});
    // Type 5 spaces
    for (let i = 0; i < 5; i++) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ' });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
    }
    // Wait for render
    await new Promise(r => setTimeout(r, 500));
    // Screenshot
    const resp = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const imgData = resp.result?.data;
    if (imgData) {
      fs.writeFileSync('D:/hscode/artifacts/black-block-spaces.png', Buffer.from(imgData, 'base64'));
      console.log('Screenshot saved: D:/hscode/artifacts/black-block-spaces.png');
    } else {
      console.log('Error:', JSON.stringify(resp));
    }
  } else if (action === 'check') {
    // Check active element and caret
    const resp = await cdp.send('Runtime.evaluate', { expression: `
      JSON.stringify({
        activeTag: document.activeElement?.tagName,
        activeCE: document.activeElement?.getAttribute('data-component'),
        caretColor: window.getComputedStyle(document.activeElement).caretColor,
        outline: window.getComputedStyle(document.activeElement).outline,
      })
    `});
    console.log(resp.result?.result?.value);
  }

  cdp.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
