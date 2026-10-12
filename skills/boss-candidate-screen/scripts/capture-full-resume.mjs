// Run inside ego-browser nodejs; resume the already authorized TaskSpace.
const spaceId = Number(globalThis.bossResumeCapture?.spaceId);
const pageLabel = globalThis.bossResumeCapture?.pageLabel;
const outputPath = globalThis.bossResumeCapture?.outputPath;
if (!Number.isInteger(spaceId) || spaceId <= 0 || !pageLabel || !outputPath?.startsWith('/')) throw new Error('Supply bossResumeCapture spaceId, pageLabel and absolute outputPath');
const t = await taskSpace(spaceId);
const p = t.page(pageLabel);
const before = await p.evaluate(() => {
  const host = [...document.querySelectorAll('iframe')].find(f => f.contentDocument?.querySelector('.resume-detail-wrap'));
  const wrap = host?.contentDocument.querySelector('.resume-detail-wrap');
  const inner = wrap?.querySelector('iframe');
  const canvas = inner?.contentDocument?.querySelector('canvas');
  if (!canvas || !wrap.getBoundingClientRect().height) throw new Error('Current visible resume canvas missing');
  return {width:innerWidth, height:innerHeight, dpr:devicePixelRatio, resumeHeight:canvas.parentElement.scrollHeight};
});
if (before.resumeHeight <= 0 || before.resumeHeight > 16000) throw new Error('Resume exceeds bounded capture height; use section captures');
try {
  await p.cdp('Emulation.setDeviceMetricsOverride', {width:before.width,height:before.resumeHeight+140,deviceScaleFactor:before.dpr,mobile:false});
  await p.waitForFunction(() => {
    const host = [...document.querySelectorAll('iframe')].find(f => f.contentDocument?.querySelector('.resume-detail-wrap'));
    const wrap = host?.contentDocument.querySelector('.resume-detail-wrap');
    const canvas = wrap?.querySelector('iframe')?.contentDocument?.querySelector('canvas');
    return canvas && canvas.getBoundingClientRect().height >= canvas.parentElement.scrollHeight;
  }, undefined, {timeout:10000});
  const rect = await p.evaluate(() => {
    const host=[...document.querySelectorAll('iframe')].find(f=>f.contentDocument?.querySelector('.resume-detail-wrap'));
    const inner=host.contentDocument.querySelector('.resume-detail-wrap iframe');
    const canvas=inner.contentDocument.querySelector('canvas');
    const a=host.getBoundingClientRect(),b=inner.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    return {x:a.x+b.x+c.x,y:a.y+b.y+c.y,width:c.width,height:c.height};
  });
  const capture=await p.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...rect,scale:1}});
  const fs = await import('node:fs/promises');
  await fs.mkdir((await import('node:path')).dirname(outputPath), {recursive:true});
  await fs.writeFile(outputPath,Buffer.from(capture.data,'base64'), {mode:0o600});
  console.log(JSON.stringify({path:outputPath,rect,originalHeight:before.height}));
} finally {
  await p.cdp('Emulation.setDeviceMetricsOverride', {width:before.width,height:before.height,deviceScaleFactor:before.dpr,mobile:false});
}
