const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');

const OUTPUT = 'D:/hscode/artifacts/ui-redesign/phase2e-light-main.png';

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const wsUrl = pages[0].webSocketDebuggerUrl;
    const url = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    
    const socket = net.createConnection({ host: url.hostname, port: parseInt(url.port) });
    
    socket.once('connect', () => {
      socket.write(`GET ${url.pathname} HTTP/1.1\r\nHost: ${url.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    
    let upgraded = false;
    let buf = Buffer.alloc(0);
    let done = false;
    
    socket.on('data', (chunk) => {
      if (done) return;
      buf = Buffer.concat([buf, chunk]);
      
      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        upgraded = true;
        buf = buf.slice(idx + 4);
        // Send screenshot command
        sendWs(socket, {id:1, method:'Page.captureScreenshot', params:{format:'png'}});
      }
      
      // Parse WS frame
      while (buf.length >= 2 && !done) {
        const b1 = buf[1];
        let plen = b1 & 0x7f;
        let off = 2;
        if (plen === 126) { if (buf.length < 4) return; plen = buf.readUInt16BE(2); off = 4; }
        else if (plen === 127) { if (buf.length < 10) return; plen = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + plen) return;
        const payload = buf.slice(off, off + plen).toString();
        buf = buf.slice(off + plen);
        try {
          const j = JSON.parse(payload);
          if (j.id === 1 && j.result && j.result.data) {
            done = true;
            const img = Buffer.from(j.result.data, 'base64');
            fs.writeFileSync(OUTPUT, img);
            console.log('SAVED ' + img.length + ' bytes -> ' + OUTPUT);
            socket.end();
            process.exit(0);
          }
        } catch(e) {}
      }
    });
    
    socket.on('error', (e) => { console.error('ERR: ' + e.message); process.exit(1); });
    setTimeout(() => { if (!done) { console.error('TIMEOUT'); process.exit(1); } }, 15000);
  });
});

function sendWs(socket, obj) {
  const payload = Buffer.from(JSON.stringify(obj));
  const mask = crypto.randomBytes(4);
  let hdr;
  if (payload.length < 126) {
    hdr = Buffer.alloc(6);
    hdr[0] = 0x81; hdr[1] = 0x80 | payload.length;
    mask.copy(hdr, 2);
  } else {
    hdr = Buffer.alloc(8);
    hdr[0] = 0x81; hdr[1] = 0x80 | 126;
    hdr.writeUInt16BE(payload.length, 2);
    mask.copy(hdr, 4);
  }
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  socket.write(Buffer.concat([hdr, masked]));
}
