const http=require("http"),WebSocket=global.WebSocket
const get=p=>new Promise((res,rej)=>{http.get({host:"127.0.0.1",port:9222,path:p},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej)})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const ts=await get("/json/list"),page=ts.find(t=>t.type==="page"&&!/devtools/i.test(t.url))
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener("open",r))
  let id=0;const call=(m,p={})=>new Promise((res,rej)=>{const i=++id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id===i){ws.removeEventListener("message",h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id:i,method:m,params:p}))})
  const ev=async e=>{const r=await call("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,200));return r.result.value}

  // start capture (no filter)
  await ev(`(() => { const b=[...document.querySelectorAll("#network-panel button")].find(b=>b.textContent.trim()==="开始抓包"); b && b.click() })()`)
  await sleep(5000)

  // click first row
  await ev(`(() => { const r=document.querySelector("#network-panel tbody tr"); if(r) r.click() })()`)
  await sleep(1500)

  // switch to headers tab
  await ev(`(() => { const t=document.querySelector("[data-slot=detail-tab-headers]"); t && t.click() })()`)
  await sleep(1500)

  // read detail
  const detail = await ev(`(() => {
    const body = document.querySelector("[data-slot=network-detail-body]")
    const sections = [...(body?.querySelectorAll("[data-slot=detail-section]") || [])].map(s => ({
      title: s.getAttribute("data-section"),
      text: s.textContent?.slice(0, 200)
    }))
    return { text: body?.textContent?.slice(0, 1500), sections }
  })()`)
  console.log(JSON.stringify(detail, null, 2))
  process.exit(0)
})().catch(e=>{console.error("FATAL:",e.message);process.exit(1)})