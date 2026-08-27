// TCP-only: start → packets → click row → headers tab → screenshot → stop → state
const http=require("http"),WebSocket=global.WebSocket,fs=require("fs")
const get=p=>new Promise((res,rej)=>{http.get({host:"127.0.0.1",port:9222,path:p},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej)})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const ts=await get("/json/list"),page=ts.find(t=>t.type==="page"&&!/devtools/i.test(t.url))
  const ws=new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r=>ws.addEventListener("open",r))
  let id=0;const call=(m,p={})=>new Promise((res,rej)=>{const i=++id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id===i){ws.removeEventListener("message",h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id:i,method:m,params:p}))})
  const ev=async e=>{const r=await call("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,200));return r.result.value}

  // 1. start
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(5000)
  console.log("state:", await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`))
  console.log("count:", await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`))

  // 2. click first row
  await ev(`(() => { const r=document.querySelector("#network-panel tbody tr"); r && r.click() })()`)
  await sleep(1500)

  // 3. headers tab
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-headers]"); t && t.click() })()`)
  await sleep(1000)
  const headers = await ev(`document.querySelector("[data-slot=network-detail-body]")?.textContent?.slice(0,2000)`)
  console.log("headers:", headers)

  // 4. screenshot
  const s = await call("Page.captureScreenshot",{format:"png"})
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-tcp-detail.png", Buffer.from(s.data,"base64"))
  console.log("screenshot saved")

  // 5. stop
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); b && b.click() })()`)
  await sleep(3000)
  console.log("after stop:", await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`))

  process.exit(0)
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1)})