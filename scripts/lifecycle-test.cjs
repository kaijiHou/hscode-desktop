// Simple lifecycle test: start → wait → count → stop → wait → state
const http=require("http"),WebSocket=global.WebSocket
const get=p=>new Promise((res,rej)=>{http.get({host:"127.0.0.1",port:9222,path:p},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej)})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const ts=await get("/json/list"),page=ts.find(t=>t.type==="page"&&!/devtools/i.test(t.url))
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener("open",r))
  let id=0;const call=(m,p={})=>new Promise((res,rej)=>{const i=++id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id===i){ws.removeEventListener("message",h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id:i,method:m,params:p}))})
  const ev=async e=>{const r=await call("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,200));return r.result.value}

  // click start
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); if(b){b.click();return "clicked"}; return "no-btn" })()`)
  console.log("T+0: clicked start")
  await sleep(3000)
  console.log("T+3: state=", await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`), "count=", await ev(`document.querySelector("#network-panel [data-slot=network-count]")?.textContent`))
  // click stop
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="停止抓包"); if(b){b.click();return "clicked"}; return "no-btn" })()`)
  console.log("T+3: clicked stop")
  await sleep(2000)
  console.log("T+5: state=", await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`))
  await sleep(2000)
  console.log("T+7: state=", await ev(`document.querySelector("#network-panel [data-slot=network-state]")?.textContent`))
  process.exit(0)
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1)})