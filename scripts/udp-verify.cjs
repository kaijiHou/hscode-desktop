// UDP-only: start with port filter → send local UDP → click row → headers → stop
const http=require("http"),WebSocket=global.WebSocket,dgram=require("dgram"),fs=require("fs")
const get=p=>new Promise((res,rej)=>{http.get({host:"127.0.0.1",port:9222,path:p},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej)})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const ts=await get("/json/list"),page=ts.find(t=>t.type==="page"&&!/devtools/i.test(t.url))
  const ws=new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r=>ws.addEventListener("open",r))
  let id=0;const call=(m,p={})=>new Promise((res,rej)=>{const i=++id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id===i){ws.removeEventListener("message",h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id:i,method:m,params:p}))})
  const ev=async e=>{const r=await call("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,200));return r.result.value}

  // clear and set UDP port filter
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="清空"); b && b.click() })()`)
  await sleep(800)
  await ev(`(() => {
    const p=document.querySelector("#network-panel")
    const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set
    const ip=p.querySelector("input[aria-label=\\\"IP 筛选\\\"]")
    const port=p.querySelector("input[aria-label=\\\"端口筛选\\\"]")
    if(ip){s.call(ip,"127.0.0.1");ip.dispatchEvent(new Event("input",{bubbles:true}))}
    if(port){s.call(port,"8081");port.dispatchEvent(new Event("input",{bubbles:true}))}
  })()`)

  // start
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(2000)

  // send 3 UDP packets
  for(let i=0;i<3;i++){
    try{const sock=dgram.createSocket("udp4");await new Promise(res=>{sock.send(Buffer.from("HSCode-UDP-"+i+"-"+Date.now()),8081,"127.0.0.1",()=>setTimeout(()=>{sock.close();res()},200))})}catch{}
    await sleep(500)
  }
  await sleep(3000)
  console.log("state:", await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`))
  console.log("count:", await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`))
  const firstRow=await ev(`(() => { const r=[...document.querySelectorAll("#network-panel tbody tr")].find(tr=>{const c=[...tr.querySelectorAll("td")];return c[4]?.textContent.trim()==="UDP"}); return r?[...r.querySelectorAll("td")].map(td=>td.textContent.trim()):null })()`)
  console.log("first UDP row:", firstRow)

  // click UDP row → headers
  await ev(`(() => { const r=[...document.querySelectorAll("#network-panel tbody tr")].find(tr=>{const c=[...tr.querySelectorAll("td")];return c[4]?.textContent.trim()==="UDP"}); r && r.click() })()`)
  await sleep(1200)
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-headers]"); t && t.click() })()`)
  await sleep(1000)
  console.log("headers:", await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,1500)`))

  const s=await call("Page.captureScreenshot",{format:"png"})
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-udp-detail.png",Buffer.from(s.data,"base64"))

  // stop
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(3000)
  console.log("after stop:", await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`))
  process.exit(0)
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1)})