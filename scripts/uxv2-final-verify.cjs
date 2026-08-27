const http=require("http"),WebSocket=global.WebSocket,dgram=require("dgram"),{execSync}=require("child_process"),fs=require("fs")
const get=p=>new Promise((res,rej)=>{http.get({host:"127.0.0.1",port:9222,path:p},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej)})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const ts=await get("/json/list"),page=ts.find(t=>t.type==="page"&&!/devtools/i.test(t.url))
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener("open",r))
  let id=0;const call=(m,p={})=>new Promise((res,rej)=>{const i=++id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id===i){ws.removeEventListener("message",h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id:i,method:m,params:p}))})
  const ev=async e=>{const r=await call("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,200));return r.result.value}

  // stop + clear
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(1200)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="清空"); b && b.click() })()`)
  await sleep(800)

  // start with no filter
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(5000)

  const R={}
  R.state=await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`)
  R.count=await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`)
  // screenshot
  const s1=await call("Page.captureScreenshot",{format:"png"})
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-default.png",Buffer.from(s1.data,"base64"))

  // click first row
  const clicked=await ev(`(() => { const r=document.querySelector("#network-panel tbody tr"); if(r){r.click();return "ok"} return "no-row" })()`)
  console.log("row click:", clicked)
  await sleep(1500)

  // switch to headers tab
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-headers]"); t && t.click() })()`)
  await sleep(1000)

  const detailText=await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,2000)`)
  R.headers=detailText

  const s2=await call("Page.captureScreenshot",{format:"png"})
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-tcp-detail.png",Buffer.from(s2.data,"base64"))

  // switch to payload tab
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-payload]"); t && t.click() })()`)
  await sleep(500)
  R.payload=await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,500)`)

  // switch to hex tab
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-hex]"); t && t.click() })()`)
  await sleep(500)
  R.hex=await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,300)`)

  // stop + clear + local UDP test
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(1200)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="清空"); b && b.click() })()`)
  await sleep(800)

  // set port filter for UDP
  await ev(`(() => {
    const p=document.querySelector("#network-panel")
    const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set
    const port=p.querySelector("input[aria-label=\\\"端口筛选\\\"]")
    s.call(port,"8081");port.dispatchEvent(new Event("input",{bubbles:true}))
  })()`)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(2000)

  // send local UDP
  for(let i=0;i<3;i++){
    try{
      const sock=dgram.createSocket("udp4")
      await new Promise(res=>{sock.send(Buffer.from("HSCode-UDP-"+i+"-"+Date.now()),8081,"127.0.0.1",()=>setTimeout(()=>{sock.close();res()},200))})
    }catch{}
    await sleep(400)
  }
  await sleep(3000)

  R.udpState=await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`)
  R.udpCount=await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`)
  R.udpFirstRow=await ev(`(() => { const r=[...document.querySelectorAll("#network-panel tbody tr")].find(tr=>{const cells=[...tr.querySelectorAll("td")];return cells[4]?.textContent.trim()==="UDP"}); return r?[...r.querySelectorAll("td")].map(td=>td.textContent.trim()):null })()`)

  // click UDP row → headers
  await ev(`(() => { const r=[...document.querySelectorAll("#network-panel tbody tr")].find(tr=>{const cells=[...tr.querySelectorAll("td")];return cells[4]?.textContent.trim()==="UDP"}); r && r.click() })()`)
  await sleep(1200)
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-headers]"); t && t.click() })()`)
  await sleep(800)
  R.udpHeaders=await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,1200)`)
  const s3=await call("Page.captureScreenshot",{format:"png"})
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-udp-detail.png",Buffer.from(s3.data,"base64"))

  // stop + clear regression
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(1500)
  R.stopState=await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="清空"); b && b.click() })()`)
  await sleep(800)
  R.clearRows=await ev(`document.querySelectorAll("#network-panel tbody tr").length`)

  console.log(JSON.stringify(R,null,2))
  process.exit(0)
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1)})