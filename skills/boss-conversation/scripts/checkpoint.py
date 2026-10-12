#!/usr/bin/env python3
"""Local per-candidate checkpoint. Never operates browsers or sends messages."""
import argparse,json,pathlib,time,hashlib,os

def save(path,value):
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2));tmp.chmod(0o600);tmp.replace(path)

def transition(state,event,now):
    kind=event['event'];key=event['candidate_key'];rows=state.setdefault('candidates',{})
    if kind=='begin':
        if key in rows:raise ValueError('candidate already recorded; do not reopen')
        if any(r['status']=='processing' for r in rows.values()):raise ValueError('finish current candidate first')
        if not event.get('unread_evidence'):raise ValueError('unread evidence required')
        rows[key]={**event,'status':'processing','started_at':now}
    elif kind=='resume':
        r=rows[key]
        if r['status'] not in ('processing','waiting_resume','blocked','unknown'):
            raise ValueError('only recorded unfinished transactions may resume')
        if any(x['status']=='processing' for k,x in rows.items() if k!=key):
            raise ValueError('finish current candidate first')
        if not event.get('recovery_evidence'):
            raise ValueError('recovery evidence required')
        for field in ('run_id','role_ref'):
            if r.get(field) and event.get(field)!=r[field]:
                raise ValueError('run or role mismatch')
        r.update(status='processing',resumed_at=now,recovery_evidence=event['recovery_evidence'])
    elif kind=='complete':
        r=rows[key]
        if r['status']!='processing':raise ValueError('terminal result immutable')
        if not event.get('decision') or not event.get('evidence'):raise ValueError('decision and evidence required')
        r.update(event);r.update(status=event.get('outcome','no_action'),ended_at=now,total_seconds=round(now-r['started_at'],3))
    else:raise ValueError('unknown event')
    return state

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--state',required=True);p.add_argument('--event-file',required=True);a=p.parse_args()
    path=pathlib.Path(a.state).resolve();path.parent.mkdir(parents=True,exist_ok=True)
    state=json.loads(path.read_text()) if path.exists() else {}
    save(path,transition(state,json.loads(pathlib.Path(a.event_file).read_text()),time.time()))
