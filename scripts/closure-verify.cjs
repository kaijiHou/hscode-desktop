// CHANGE-025 Final Closure: TCP/UDP capture + stop preserves data + payload >512B
const http=require("http"),WebSocket=global.WebSocket,dgram=require("dgram"),fs=require("fs")
const get=p=>new Promise((res,rej)=>{http.get({host:"127.0.0.1",port:9222,path:p},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej)})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const ts=await get("/json/list"),page=ts.find(t=>t.type==="page"&&!/devtools/i.test(t.url))
  const ws=new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r=>ws.addEventListener("open",r))
  let id=0;const call=(m,p={})=>new Promise((res,rej)=>{const i=++id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id===i){ws.removeEventListener("message",h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id:i,method:m,params:p}))})
  const ev=async e=>{const r=await call("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,200));return r.result.value}
  const R={};let fail=0
  const failAssert=(msg)=>{console.error("FAIL:",msg);fail++}

  // 1. Start TCP capture (no filter)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(5000)
  R.tcpState=await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`)
  R.tcpCount=await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`)
  console.log("TCP:", R.tcpState, R.tcpCount)

  // 2. Click first row, check detail loads
  await ev(`(() => { const r=document.querySelector("#network-panel tbody tr"); r && r.click() })()`)
  await sleep(1500)
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-headers]"); t && t.click() })()`)
  await sleep(1000)
  R.tcpHeaders=await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,500)`)
  console.log("TCP headers:", R.tcpHeaders?.slice(0,100))
  if (!R.tcpHeaders || R.tcpHeaders.includes("选择一个")) failAssert("TCP detail not loaded")

  // 3. STOP — data must be preserved
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(3000)
  R.stopState=await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`)
  console.log("After stop:", R.stopState)

  // 4. Click a DIFFERENT row after stop — detail must still load
  await ev(`(() => { const rows=[...document.querySelectorAll("#network-panel tbody tr")]; if(rows.length>5) rows[5].click() })()`)
  await sleep(1500)
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-payload]"); t && t.click() })()`)
  await sleep(1000)
  R.afterStopPayload=await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,200)`)
  console.log("After stop payload:", R.afterStopPayload?.slice(0,80))
  if (!R.afterStopPayload || R.afterStopPayload.includes("选择一个")) failAssert("Detail not available after stop")

  // 5. CLEAR — data must be gone
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="清空"); b && b.click() })()`)
  await sleep(800)
  R.clearRows=await ev(`document.querySelectorAll("#network-panel tbody tr").length`)
  console.log("After clear rows:", R.clearRows)
  if (R.clearRows > 0) failAssert("Rows not cleared")

  // 6. UDP: send >512B payload with end marker
  await ev(`(() => {
    const p=document.querySelector("#network-panel")
    const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set
    const port=p.querySelector("input[aria-label=\\\"端口筛选\\\"]")
    if(port){s.call(port,"8081");port.dispatchEvent(new Event("input",{bubbles:true}))}
  })()`)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(2000)

  // Send 1024-byte payload with end marker
  const bigPayload="B".repeat(900)+"HSCode_PAYLOAD_END_MARKER_2048"
  for(let i=0;i<2;i++){
    try{const sock=dgram.createSocket("udp4");await new Promise(res=>{sock.send(Buffer.from(bigPayload),8081,"127.0.0.1",()=>setTimeout(()=>{sock.close();res()},200))})}catch{}
    await sleep(500)
  }
  await sleep(3000)
  R.udpCount=await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`)
  console.log("UDP count:", R.udpCount)

  // Click UDP row → payload tab
  await ev(`(() => { const r=[...document.querySelectorAll("#network-panel tbody tr")].find(tr=>{const c=[...tr.querySelectorAll("td")];return c[4]?.textContent.trim()==="UDP"}); r && r.click() })()`)
  await sleep(1200)
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-payload]"); t && t.click() })()`)
  await sleep(1000)
  R.udpPayload=await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent`)
  console.log("UDP payload length:", R.udpPayload?.length)
  console.log("UDP payload has end marker:", R.udpPayload?.includes("HSCode_PAYLOAD_END_MARKER_2048"))
  if (!R.udpPayload?.includes("HSCode_PAYLOAD_END_MARKER_2048")) failAssert("Payload end marker not visible (>512B truncation)")

  // Screenshot
  const s=await call("Page.captureScreenshot",{format:"png"})
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-final-closure.png",Buffer.from(s.data,"base64"))

  // Stop
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(2000)

  console.log("\n=== RESULT ===")
  if(fail>0){console.error("FAILURES:",fail);process.exit(1)}
  else{console.log("ALL PASS");process.exit(0)}
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1)})