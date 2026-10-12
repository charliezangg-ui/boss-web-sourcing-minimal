#!/usr/bin/env python3
import argparse, json, pathlib, subprocess, time, hashlib, os

DEFAULT_OCR_CACHE = pathlib.Path(os.environ.get('XDG_CACHE_HOME', pathlib.Path.home() / '.cache')) / 'boss-web-sourcing' / 'ocr-cache'

def validate_ocr(rows, name):
    text='\n'.join(r['text'] for r in rows)
    head=''.join(r['text'] for r in rows[:12]).replace(' ','')
    identity=name.replace(' ','') in head
    bottom=any(t in text for t in ('妥善保护牛人','在线浏览牛人简历'))
    folded='查看全部' in text.split('牛人分析器')[0]
    status='blocked_read' if not text.strip() else ('ready_for_review' if identity and bottom and not folded else 'needs_visual_check')
    return dict(status=status,identity_matched=identity,bottom_seen=bottom,folded_text=folded,text=text)

def parse_payload(stdout, stderr):
    for line in reversed((stdout+'\n'+stderr).splitlines()):
        try:
            value=json.loads(line)
            if isinstance(value,dict) and 'status' in value:return value
        except ValueError:pass
    raise ValueError('No reader JSON result in either CLI stream')

def ocr_command(source, cache):
    cache=pathlib.Path(cache);cache.mkdir(parents=True,exist_ok=True)
    key=hashlib.sha256(source.read_bytes()).hexdigest()[:16]
    binary=cache/('ocr-'+key)
    if not binary.exists():
        temp=cache/('ocr-'+key+'-'+str(os.getpid())+'.tmp')
        subprocess.run(['swiftc','-O',str(source),'-o',str(temp)],capture_output=True,text=True,check=True,timeout=60)
        temp.replace(binary)
    return str(binary)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['card','resume']);ap.add_argument('--space',type=int,required=True);ap.add_argument('--page',required=True);ap.add_argument('--output',required=True);ap.add_argument('--selector');ap.add_argument('--name');ap.add_argument('--open-selector');ap.add_argument('--ocr-cache', default=str(DEFAULT_OCR_CACHE));ap.add_argument('--message-selector');ap.add_argument('--role');a=ap.parse_args()
    if a.mode=='card' and not a.selector:ap.error('card requires observed --selector')
    if a.mode=='resume' and not a.name:ap.error('resume requires verified --name')
    out=pathlib.Path(a.output).resolve();image=out.with_suffix('.png')
    package_root=pathlib.Path(__file__).resolve().parents[3]
    if out.is_relative_to(package_root):ap.error('Write candidate artifacts to a private run directory outside the skill package')
    out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists() or image.exists() or out.with_suffix('.intent.json').exists():ap.error('Existing attempt: reuse or inspect, never overwrite')
    cfg=dict(mode=a.mode,space=a.space,page=a.page,selector=a.selector,image=str(image),openSelector=a.open_selector,name=a.name,messageSelector=a.message_selector,role=a.role)
    out.with_suffix('.intent.json').write_text(json.dumps(cfg))
    script='globalThis.bossRead='+json.dumps(cfg)+';\n'+pathlib.Path(__file__).with_name('read-page.mjs').read_text()
    start=time.monotonic()
    try:
        r=subprocess.run(['ego-browser','nodejs'],input=script,text=True,capture_output=True,check=True,timeout=30)
        payload=parse_payload(r.stdout,r.stderr)
        if a.mode=='resume':
            ocr=pathlib.Path(__file__).resolve().parents[2]/'boss-candidate-screen/scripts/ocr-resume.swift'
            t=time.monotonic();cmd=[ocr_command(ocr,a.ocr_cache)];payload['ocr_setup_ms']=round((time.monotonic()-t)*1000)
            t=time.monotonic();raw=subprocess.run(cmd+[str(image)],text=True,capture_output=True,check=True,timeout=30)
            rows=json.loads(raw.stdout);out.with_suffix('.ocr.json').write_text(raw.stdout)
            payload['ocr_backend']='compiled_swift_vision';payload.update(validate_ocr(rows,a.name));payload['ocr_ms']=round((time.monotonic()-t)*1000)
        payload['total_ms']=round((time.monotonic()-start)*1000)
        out.write_text(json.dumps(payload,ensure_ascii=False,indent=2));out.chmod(0o600)
        print(json.dumps(payload,ensure_ascii=False))
    except Exception as exc:
        out.write_text(json.dumps({'status':'blocked_read','error':str(exc),'diagnostic':getattr(exc,'stderr',None),'external_actions':0},ensure_ascii=False));raise
if __name__=='__main__':main()
