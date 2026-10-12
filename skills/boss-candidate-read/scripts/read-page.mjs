// Executed by ego-browser nodejs. No navigation or external writes.
const cfg = globalThis.bossRead;
const fs = await import('node:fs/promises');
const crypto = await import('node:crypto');
const p = (await taskSpace(cfg.space)).page(cfg.page);
// This callback is self-contained: only current rendered DOM/canvas is accessed.
function probe(arg) {
  const canvases = [], cards = [];
  const visible = e => {
    const r=e.getBoundingClientRect(), s=e.ownerDocument.defaultView.getComputedStyle(e);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' && r.bottom>0 && r.right>0;
  };
  function walk(doc,x=0,y=0) {
    if (arg.selector) for (const e of doc.querySelectorAll(arg.selector)) if(visible(e)) cards.push(e.innerText);
    for(const c of doc.querySelectorAll('canvas')) if(visible(c)) {
      const r=c.getBoundingClientRect();
      canvases.push({c,x:x+r.x,y:y+r.y,width:r.width,height:r.height,total:c.parentElement.scrollHeight});
    }
    for(const f of doc.querySelectorAll('iframe')) if(visible(f)) {
      try {if(f.contentDocument) {const r=f.getBoundingClientRect();walk(f.contentDocument,x+r.x,y+r.y);}} catch {}
    }
  }
  if(document.body.innerText.includes('您的账号可能存在异常访问行为')) throw Error('security_verification');
  walk(document);
  if(arg.selector) return {cards,messages:arg.messageSelector?document.querySelector(arg.messageSelector)?.innerText:null};
  if(canvases.length!==1) {
    if(arg.waitForReady) return false;
    throw Error('Expected one visible resume canvas; got '+canvases.length);
  }
  const {c,...rect}=canvases[0];
  if(arg.waitForReady && (!c.width || !c.height)) return false;
  const sample=document.createElement('canvas'); sample.width=128;sample.height=128;
  const ctx=sample.getContext('2d');ctx.drawImage(c,0,0,128,128);
  let pixels;try {pixels=ctx.getImageData(0,0,128,128).data;} catch(e) {
    if(e.name!=='SecurityError')throw e;
    return {...rect,ink:null,tainted:true,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
  }
  let ink=0;
  for(let i=0;i<pixels.length;i+=4) if(pixels[i+3]>100 && Math.min(pixels[i],pixels[i+1],pixels[i+2])<220) ink++;
  if(arg.waitForReady) return ink>=15;
  if(arg.exportImage && (rect.height<rect.total-2 || ink<15)) throw Error('Incomplete canvas export');
  return {...rect,ink,...(arg.exportImage?{data:c.toDataURL('image/png').split(',')[1]}:{}),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
}
function fitsViewport(before) { return before.x>=0 && before.y>=0 && before.x+before.width<=before.viewport.width && before.y+before.height<=before.viewport.height && before.height>=before.total-2 && before.ink>=15; }
const start=Date.now();
if(cfg.openSelector) {
  await p.click(cfg.openSelector,{timeout:5000});
  if(cfg.mode==='card') await p.waitForFunction(({selector,name,role})=>{
    const e=document.querySelector(selector); const text=e?.innerText||'';
    return !!text && (!name||text.includes(name)) && (!role||text.includes(role));
  },{selector:cfg.selector,name:cfg.name,role:cfg.role},{timeout:8000});
}
if(cfg.mode==='card') {
  const result=await p.evaluate(probe,{selector:cfg.selector,messageSelector:cfg.messageSelector});
  if(result.cards.length!==1) throw Error('Expected one visible card');
  if(cfg.name&&!result.cards[0].includes(cfg.name))throw Error('Candidate identity mismatch');
  if(cfg.role&&!result.cards[0].includes(cfg.role))throw Error('Role mismatch');
  console.log(JSON.stringify({status:'card_read',...result,elapsed_ms:Date.now()-start}));
} else {
  // Use the capture predicate itself: hidden or off-screen frames cannot make
  // readiness pass while the subsequent capture sees no visible canvas.
  await p.waitForFunction(probe,{waitForReady:true},{timeout:8000});
  const before=await p.evaluate(probe,{});
  if(before.total<=0 || before.total>16000) throw Error('Bounded full capture unavailable; section read required');
  const short=fitsViewport(before);
  let resized=false;
  try {
    if(!short) {
    resized=true;
    await p.cdp('Emulation.setDeviceMetricsOverride',{width:before.viewport.width,height:Math.ceil(before.total+Math.max(180,before.y+60)),deviceScaleFactor:before.viewport.dpr,mobile:false});
    }
    let rect;
    for(let attempt=0;attempt<3;attempt++) {
      // Wait for browser paint, not a blind sleep or repeated screenshot.
      await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))));
      rect=await p.evaluate(probe,{});
      if(rect.height>=rect.total-2 && (rect.ink>=15 || rect.tainted)) break;
      rect=null;
    }
    if(!rect) throw Error('Canvas not fully painted; no screenshot or OCR produced');
    const {x,y,width,height}=rect;
    const screenshot=short||rect.tainted;
    const shot=screenshot ? await p.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x,y,width,height,scale:1}}) : await p.evaluate(probe,{exportImage:true});
    const bytes=Buffer.from(shot.data,'base64');
    await fs.writeFile(cfg.image,bytes,{flag:'wx',mode:0o600});
    console.log(JSON.stringify({status:'captured',method:rect.tainted?'tainted_canvas_screenshot':short?'viewport_capture':'rendered_canvas_export',image:cfg.image,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),rect:{x,y,width,height},elapsed_ms:Date.now()-start}));
  } finally {
    if(resized) await p.cdp('Emulation.setDeviceMetricsOverride',{width:before.viewport.width,height:before.viewport.height,deviceScaleFactor:before.viewport.dpr,mobile:false});
  }
}
