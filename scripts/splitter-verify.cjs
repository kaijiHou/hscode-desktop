// CHANGE-026: Real flex splitter + wall-clock timestamp verification
const http=require("http"),WebSocket=global.WebSocket,fs=require("fs"),dgram=require("dgram")
const get=p=>new Promise((res,rej)=>{http.get({host:"127.0.0.1",port:9222,path:p},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej)})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const ts=await get("/json/list"),page=ts.find(t=>t.type==="page"&&!/devtools/i.test(t.url))
  const ws=new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r=>ws.addEventListener("open",r))
  let id=0;const call=(m,p={})=>new Promise((res,rej)=>{const i=++id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id===i){ws.removeEventListener("message",h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id:i,method:m,params:p}))})
  const ev=async e=>{const r=await call("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,200));return r.result.value}
  let fail=0;const failAssert=(msg)=>{console.error("FAIL:",msg);fail++};const assert=(c,msg)=>{if(!c)failAssert(msg)}

  // 1. Find splitter (div with cursor:col-resize, width:8px)
  const splitter=await ev(`(() => { const els=[...document.querySelectorAll("div")].filter(el=>el.style.cursor==="col-resize" && el.style.width==="8px"); if(!els.length) return null; const r=els[0].getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)} })()`)
  console.log("Splitter:", JSON.stringify(splitter))
  assert(splitter, "splitter not found")
  assert(splitter && splitter.w>=6, "splitter width < 6px")
  assert(splitter && splitter.h>100, "splitter height < 100px")

  // 2. Network before
  const netBefore=await ev(`(() => { const el=document.querySelector("#network-panel"); if(!el) return null; return Math.round(el.getBoundingClientRect().width) })()`)
  console.log("Network before:", netBefore)
  assert(netBefore && netBefore>100, "network width < 100px")

  // 3. Drag LEFT (splitter moves left → network wider)
  const cx=splitter.x+splitter.w/2,cy=splitter.y+splitter.h/2
  await call("Input.dispatchMouseEvent",{type:"mousePressed",x:cx,y:cy,button:"left",clickCount:1})
  for(let dx=0;dx>=-200;dx-=20){await call("Input.dispatchMouseEvent",{type:"mouseMoved",x:cx+dx,y:cy,button:"left",buttons:1});await sleep(30)}
  await call("Input.dispatchMouseEvent",{type:"mouseReleased",x:cx-200,y:cy,button:"left"})
  await sleep(500)
  const netAfterLeft=await ev(`(() => { const el=document.querySelector("#network-panel"); return el?Math.round(el.getBoundingClientRect().width):null })()`)
  console.log("Network after left:", netAfterLeft, "delta:", netAfterLeft-netBefore)
  assert(netAfterLeft-netBefore>=80, "drag left delta < 80")

  // 4. Drag RIGHT (splitter moves right → network narrower)
  await call("Input.dispatchMouseEvent",{type:"mousePressed",x:cx-200,y:cy,button:"left",clickCount:1})
  for(let dx=-200;dx<=50;dx+=20){await call("Input.dispatchMouseEvent",{type:"mouseMoved",x:cx+dx,y:cy,button:"left",buttons:1});await sleep(30)}
  await call("Input.dispatchMouseEvent",{type:"mouseReleased",x:cx+50,y:cy,button:"left"})
  await sleep(500)
  const netAfterRight=await ev(`(() => { const el=document.querySelector("#network-panel"); return el?Math.round(el.getBoundingClientRect().width):null })()`)
  console.log("Network after right:", netAfterRight, "delta:", netAfterLeft-netAfterRight)
  assert(netAfterLeft-netAfterRight>=80, "drag right delta < 80")

  // 5. Timestamp check
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(3000)
  const packetTime=await ev(`(() => { const row=document.querySelector("#network-panel tbody tr"); if(!row) return null; const cells=[...row.querySelectorAll("td")]; return cells[0]?.textContent?.trim() })()`)
  console.log("Packet time:", packetTime)
  const now=new Date();const currentHour=String(now.getHours()).padStart(2,"0")
  assert(packetTime && !packetTime.startsWith("1969"), "timestamp shows 1969")
  assert(packetTime && !packetTime.startsWith("1970"), "timestamp shows 1970")
  assert(packetTime && packetTime.split(":")[0]===currentHour, "hour mismatch")

  // 6. Capture regression
  await sleep(2000)
  const tcpCount=await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`)
  console.log("TCP:", tcpCount)

  // UDP
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(3000)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="清空"); b && b.click() })()`)
  await sleep(800)
  await ev(`(() => { const p=document.querySelector("#network-panel"); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set; const port=p.querySelector("input[aria-label=\\\"端口筛选\\\"]"); if(port){s.call(port,"8081");port.dispatchEvent(new Event("input",{bubbles:true}))} })()`)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(2000)
  for(let i=0;i<2;i++){try{const sock=dgram.createSocket("udp4");await new Promise(res=>{sock.send(Buffer.from("HSCode-UDP-"+i),8081,"127.0.0.1",()=>setTimeout(()=>{sock.close();res()},200))})}catch{};await sleep(400)}
  await sleep(2000)
  const udpCount=await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`)
  console.log("UDP:", udpCount)
  assert(udpCount && udpCount!=="0 个数据包", "no UDP packets")

  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(2000)

  const s=await call("Page.captureScreenshot",{format:"png"})
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-resize-final.png",Buffer.from(s.data,"base64"))

  console.log("\n=== RESULT ===")
  if(fail>0){console.error("FAILURES:",fail);process.exit(1)}
  else{console.log("ALL PASS");process.exit(0)}
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1)})