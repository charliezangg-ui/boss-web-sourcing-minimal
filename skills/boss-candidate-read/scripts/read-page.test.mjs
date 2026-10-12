import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./read-page.mjs',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function probe('),source.indexOf('\nconst start='));
function doc({nested=false,blank=false,hidden=false,multiple=false}={}) {
  const r={x:0,y:0,width:800,height:1200,bottom:1200,right:800};
  const d={body:{innerText:''},defaultView:{getComputedStyle:e=>({visibility:'visible',display:e.hidden?'none':'block'})}};
  const c={ownerDocument:d,getBoundingClientRect:()=>r,parentElement:{scrollHeight:1200},toDataURL:()=> 'data:image/png;base64,cGl4ZWxz'};
  const child={...d,querySelectorAll:s=>s==='canvas'?[c]:[]};
  const f={ownerDocument:d,contentDocument:child,hidden,getBoundingClientRect:()=>r};
  d.querySelectorAll=s=>s==='canvas'?nested?[]:multiple?[c,c]:[c]:s==='iframe'&&nested?[f]:[];
  d.createElement=()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(Array.from({length:65536},(_,i)=>i%4===3?255:blank?255:0))})})});return d;
}
function run(d){return vm.runInNewContext(fn+';probe({})',{document:d,innerWidth:1000,innerHeight:700,devicePixelRatio:2});}
test('direct chat canvas',()=>assert.equal(run(doc()).total,1200));
test('nested recommendation canvas',()=>assert.equal(run(doc({nested:true})).total,1200));
test('blank painting detectable',()=>assert.equal(run(doc({blank:true})).ink,0));
test('ambiguous and hidden canvas stop',()=>{assert.throws(()=>run(doc({multiple:true})));assert.throws(()=>run(doc({nested:true,hidden:true})));});
test('security page stops extraction',()=>{const d=doc();d.body.innerText='您的账号可能存在异常访问行为';assert.throws(()=>run(d),/security_verification/);});

test('short path only when full canvas fits viewport',()=>{
 const fits=r=>vm.runInNewContext(fn+';fitsViewport(input)',{input:r});
 const r={x:0,y:0,width:800,height:600,total:600,ink:50,viewport:{width:1000,height:700}};
 assert.equal(fits(r),true);
 assert.equal(fits({...r,total:1200}),false);
 assert.equal(fits({...r,y:200}),false);
 assert.equal(fits({...r,ink:0}),false);
});
test('canvas export rejects blank pixels',()=>{
 const go=d=>vm.runInNewContext(fn+';probe({exportImage:true})',{document:d,innerWidth:1000,innerHeight:700,devicePixelRatio:2});
 assert.equal(go(doc()).data,'cGl4ZWxz');
 assert.throws(()=>go(doc({blank:true})),/Incomplete/);
});
