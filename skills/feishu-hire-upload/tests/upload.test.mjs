import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync, cpSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyResumeUploadDedupe} from '../scripts/lib/resume-dedupe.mjs';

const fakeCli = `#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('--file --data --params');process.exit(0);}
const file=process.env.MOCK_HIRE_STATE;const state=JSON.parse(fs.readFileSync(file));
const i=args.indexOf('api');const method=args[i+1],url=args[i+2];
const stdin=fs.readFileSync(0,'utf8');const data=stdin?JSON.parse(stdin):{};
if(args.some(x=>x.includes('Synthetic')||x.includes('fixture@example.test')))throw Error('PII in argv');
if(args[0]!=='--profile'||args[1]!=='test-profile')throw Error('profile missing');
fs.appendFileSync(file+'.calls',JSON.stringify({method,url,stdin:!!stdin})+'\\n');
if(state.denyPermission&&(state.denyPermission==='read'||(url.endsWith('/applications')&&method==='POST'))){
 console.error(JSON.stringify({ok:false,error:{code:99991672,subtype:'permission_denied',
  message:'Synthetic private error must not escape',
  permission_violations:[{scope:state.denyPermission==='read'?'hire:job:readonly':'hire:application'}],
  console_url:'https://open.feishu.cn/app/cli_synthetic/auth?q=a%2Bb'}}));process.exit(1);
}
let out={};
if(url.endsWith('/jobs'))out={items:[{id:'job_test',title:'Test Role'}],has_more:false};
else if(url.endsWith('/resume_sources'))out={items:[{id:'source_test',zh_name:'Test Source',active_status:1,resume_source_type:'10003'}],has_more:false};
else if(url.endsWith('/batch_get_id'))out={talent_list:state.existing?[{talent_id:'talent_test'}]:[]};
else if(url.endsWith('/attachments')&&method==='POST'){state.name=path.basename(args[args.indexOf('--file')+1].split('=')[1]);out={id:'upload_test'};}
else if(url.endsWith('/combined_create')||url.endsWith('/combined_update'))out={talent_id:'talent_test'};
else if(url.endsWith('/applications')&&method==='POST'){
 state.application=state.loseResponse==='absent'?false:true;
 if(state.loseResponse){fs.writeFileSync(file,JSON.stringify(state));console.error(JSON.stringify({ok:false,error:{code:500}}));process.exit(1);}out={id:'application_test'};
}
else if(url.endsWith('/applications'))out={items:state.application?['application_test']:[],has_more:false};
else if(url.includes('/applications/'))out={application:{id:'application_test',talent_id:'talent_test',job_id:'job_test',resume_source_id:state.existing?'original_source':'source_test',stage:{id:'original_stage'}}};
else if(url.includes('/talents/'))out={talent_id:'talent_test',basic_info:{name:'Synthetic Candidate'},resume_attachment_id_list:['formal_test'],resume_attachment_list:[{id:'formal_test',name:state.name}]};
else if(url.includes('/attachments/'))out={attachment:{id:'formal_test',name:state.name}};
else throw Error('unexpected fake endpoint');
if(method==='POST'&&!url.endsWith('/batch_get_id'))fs.writeFileSync(file,JSON.stringify(state));console.log(JSON.stringify({ok:true,data:out}));
`;

function fixture(options={}) {
 const root=mkdtempSync(path.join(tmpdir(),'hire-independent-'));
 const skill=path.join(root,'skill');cpSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),skill,{recursive:true});
 const cli=path.join(root,'mock-cli.mjs');writeFileSync(cli,fakeCli,{mode:0o700});
 const state=path.join(root,'mock-state.json');writeFileSync(state,JSON.stringify({calls:[],existing:false,application:false,...options}));
 const cwd=path.join(root,'fresh-user');mkdirSync(cwd);const config=path.join(cwd,'.runtime/hire/config.json');
 const entry=path.join(skill,'scripts/hire-upload.mjs');
 function run(action,payload,extra=[]) {
  const result=spawnSync(process.execPath,[entry,action,'--config',config,...extra,...(payload===undefined?[]:['--payload','-'])],{
   cwd,encoding:'utf8',env:{...process.env,MOCK_HIRE_STATE:state},input:payload===undefined?undefined:JSON.stringify(payload),timeout:10000});
  assert.ifError(result.error);assert.ok(result.stdout||result.stderr.split('\n').find(x=>x.startsWith('{')),result.stderr);return {code:result.status,...JSON.parse(result.stdout||result.stderr.split('\n').find(x=>x.startsWith('{')))};
 }
 const initialized=run('init',{profile:'test-profile',cliBin:cli,resumeSourceId:'source_test',jobs:{test:'job_test'}});assert.equal(initialized.ok,true);
 const inbox=path.join(path.dirname(config),'inbox');mkdirSync(inbox);const resume=path.join(inbox,'synthetic.pdf');writeFileSync(resume,'Synthetic fixture only');const old=new Date(Date.now()-60000);utimesSync(resume,old,old);
 const intake=run('intake',{file:resume,candidateKey:'sha256:'+'a'.repeat(64),sourceChannel:'test',...(options.talentOnly?{talentOnly:true}:{roleKey:'test'})});assert.equal(intake.ok,true);
 const payload={resumeSha256:intake.result.resumeSha256,candidateName:'Synthetic Candidate',candidateEmail:'fixture@example.test',...(options.talentOnly?{talentOnly:true}:{})};
 return {root,config,run,payload,state,readState:()=>({...JSON.parse(readFileSync(state)),calls:(()=>{try{return readFileSync(state+'.calls','utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));}catch(e){if(e.code==='ENOENT')return [];throw e;}})()}),close:()=>rmSync(root,{recursive:true,force:true})};
}

test('isolated install config, doctor, intake and new talent upload work without private repo',()=>{
 const f=fixture();try{
  assert.equal(f.run('doctor',undefined,['--live']).readOnlyConnection,'verified');
  const prep=f.run('prepare',f.payload);assert.equal(prep.ok,true,JSON.stringify(prep));
  const result=f.run('execute',f.payload,['--confirmed-ref',prep.plan.confirmationRef]);assert.equal(result.result.status,'uploaded_verified');assert.equal(result.result.applicationId,'application_test');
  const calls=f.readState().calls;assert.equal(calls.filter(x=>x.method==='POST'&&x.url.endsWith('/applications')).length,1);
  assert.equal(calls.some(x=>x.url==='/open-apis/hire/v1/talents'),false);
  const duplicate=f.run('execute',f.payload,['--confirmed-ref',prep.plan.confirmationRef]);assert.equal(duplicate.ok,false);
  assert.equal(f.readState().calls.length,calls.length);
 }finally{f.close();}
});

test('existing talent and application use the pinned decision with the identical original CLI payload',()=>{
 const f=fixture({existing:true,application:true});try{
  const prep=f.run('prepare',f.payload);assert.equal(prep.ok,true,JSON.stringify(prep));
  const result=f.run('execute',f.payload,['--confirmed-ref',prep.plan.confirmationRef]);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.result.applicationId,'application_test');
  const calls=f.readState().calls;
  assert.equal(calls.filter(x=>x.url.endsWith('/combined_update')).length,1);
  assert.equal(calls.filter(x=>x.method==='POST'&&x.url.endsWith('/applications')).length,0);
  assert.ok(calls.some(x=>x.url.endsWith('/applications/application_test')));
 }finally{f.close();}
});

for(const loseResponse of ['absent','created'])test(`lost application response: ${loseResponse}, reconciliation stays read-only`,()=>{
 const f=fixture({loseResponse});try{
  const prep=f.run('prepare',f.payload);assert.equal(prep.ok,true,JSON.stringify(prep));
  assert.equal(f.run('execute',f.payload,['--confirmed-ref',prep.plan.confirmationRef]).ok,false);
  const before=f.readState().calls.length;
  const result=f.run('reconcile',{resumeSha256:f.payload.resumeSha256},['--confirmed-ref',prep.plan.confirmationRef]);
  assert.equal(result.ok,loseResponse==='created');
  const status=f.run('status',undefined,['--resume-sha256',f.payload.resumeSha256]);
  assert.equal(status.record.status,loseResponse==='created'?'uploaded_verified':'write_state_unknown');
  assert.ok(f.readState().calls.slice(before).every(x=>x.method==='GET'));
 }finally{f.close();}
});

test('explicit talent-only plan uploads without creating a job application',()=>{
 const f=fixture({talentOnly:true});try{
  const prep=f.run('prepare',f.payload);assert.equal(prep.ok,true,JSON.stringify(prep));
  const result=f.run('execute',f.payload,['--confirmed-ref',prep.plan.confirmationRef]);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.result.jobAssociated,false);
  assert.ok(!f.readState().calls.some(x=>x.url.includes('/applications')));
 }finally{f.close();}
});

test('config init does not overwrite, and a changed connection cannot reuse upload state',()=>{
 const f=fixture();try{
  assert.equal(f.run('init',{}).ok,false);
  const config=JSON.parse(readFileSync(f.config));config.profile='other-profile';writeFileSync(f.config,JSON.stringify(config));
  const result=f.run('prepare',f.payload);assert.equal(result.ok,false);assert.match(result.error,/different connection/);
  assert.equal(f.readState().calls.length,0);
 }finally{f.close();}
});

test('missing identity never falls back to a full talent scan',async()=>{
 const result=await verifyResumeUploadDedupe({ledger:{listCandidateEvents:()=>[]},client:{listTalents:()=>{throw Error('full scan');}},candidateKey:'sha256:'+'a'.repeat(64),candidateName:'Synthetic Candidate'});
 assert.equal(result.status,'needs_review');
});

test('altered candidate fields fail pinned plan checks before any write',()=>{
 const f=fixture();try{
  const prep=f.run('prepare',f.payload);const before=f.readState().calls.length;
  const result=f.run('execute',{...f.payload,candidateEmail:'changed@example.test'},['--confirmed-ref',prep.plan.confirmationRef]);
  assert.equal(result.ok,false);assert.match(result.error,/pinned plan/);assert.equal(f.readState().calls.length,before);
 }finally{f.close();}
});


test('first-time discovery works before source selection; tenant-required fields stop prepare',()=>{
 const f=fixture();try{
  const config=JSON.parse(readFileSync(f.config));config.resumeSourceId='';writeFileSync(f.config,JSON.stringify(config));
  const found=f.run('discover');assert.equal(found.ok,true);assert.equal(found.sources[0].name,'Test Source');
  assert.equal(f.run('doctor').ok,false);
  config.resumeSourceId='source_test';config.requiredCandidateFields=['candidateMobile'];writeFileSync(f.config,JSON.stringify(config));
  const before=f.readState().calls.length;
  const result=f.run('prepare',f.payload);assert.equal(result.ok,false);assert.match(result.error,/candidateMobile/);
  assert.equal(f.readState().calls.length,before);
 }finally{f.close();}
});

test('fresh install gives init then app and permissions guidance without remote calls',()=>{
 const f=fixture();try{
  rmSync(f.config);
  const first=f.run('onboard');assert.equal(first.ok,false);assert.equal(first.onboarding.stage,'local_config');
  assert.equal(first.onboarding.commands[0].argv[2],'init');
  const initialized=f.run('init');assert.equal(initialized.ok,true);assert.equal(initialized.onboarding.stage,'application');
  assert.deepEqual(initialized.onboarding.requiredScopes,['hire:attachment','hire:talent','hire:application','hire:job:readonly']);
  assert.ok(initialized.onboarding.commands.some(c=>c.argv.slice(-2).join(' ')==='profile list'));
  assert.ok(initialized.onboarding.consoleUrl.startsWith('https://open.feishu.cn/'));
  assert.equal(f.readState().calls.length,0);
 }finally{f.close();}
});

test('onboarding resumes only the missing configuration step and never claims permissions verified',()=>{
 const f=fixture();try{
  const config=JSON.parse(readFileSync(f.config));config.profile='';writeFileSync(f.config,JSON.stringify(config));
  assert.equal(f.run('onboard').onboarding.stage,'application');
  assert.equal(f.run('doctor').onboarding.stage,'application');
  config.profile='test-profile';config.resumeSourceId='';writeFileSync(f.config,JSON.stringify(config));
  assert.equal(f.run('onboard').onboarding.stage,'mapping');
  config.resumeSourceId='source_test';writeFileSync(f.config,JSON.stringify(config));
  const ready=f.run('onboard');assert.equal(ready.onboarding.stage,'verify');assert.equal(ready.readOnlyConnection,'not_checked');assert.equal(ready.writePermissions,'unverified');
  assert.equal(ready.onboarding.commands.length,1);assert.equal(ready.onboarding.commands[0].argv[2],'doctor');
  assert.equal(f.readState().calls.length,0);
 }finally{f.close();}
});

test('malformed existing config is repaired rather than overwritten or reinitialized',()=>{
 const f=fixture();try{
  writeFileSync(f.config,'{broken');
  const result=f.run('onboard');assert.equal(result.ok,false);assert.equal(result.onboarding.stage,'repair_config');
  assert.equal(result.onboarding.commands.some(c=>c.argv.includes('init')),false);
  assert.equal(readFileSync(f.config,'utf8'),'{broken');assert.equal(f.readState().calls.length,0);
 }finally{f.close();}
});

test('missing CLI provides environment guidance without remote calls',()=>{
 const f=fixture();try{
  const config=JSON.parse(readFileSync(f.config));config.cliBin=path.join(f.root,'missing-cli');writeFileSync(f.config,JSON.stringify(config));
  const result=f.run('onboard');assert.equal(result.ok,false);assert.equal(result.onboarding.stage,'environment');
  assert.match(result.onboarding.steps.join(' '),/github.com\/larksuite\/cli/);assert.equal(f.readState().calls.length,0);
 }finally{f.close();}
});

test('denied read points to the exact app console and missing scope without personal login',()=>{
 const f=fixture({denyPermission:'read'});try{
  const result=f.run('doctor',undefined,['--live']);assert.equal(result.ok,false);assert.equal(result.onboarding.stage,'permissions');
  assert.deepEqual(result.onboarding.missingScopes,['hire:job:readonly']);
  assert.equal(result.onboarding.consoleUrl,'https://open.feishu.cn/app/cli_synthetic/auth?q=a%2Bb');
  assert.equal(result.onboarding.profile,'test-profile');
  assert.equal(result.onboarding.commands.some(c=>c.argv.includes('login')),false);
  assert.equal(JSON.stringify(result).includes('Synthetic private error'),false);
  assert.ok(f.readState().calls.every(c=>c.method==='GET'));
 }finally{f.close();}
});

test('permission failure after partial upload preserves checkpoint and does not replay writes',()=>{
 const f=fixture({denyPermission:'write'});try{
  const prep=f.run('prepare',f.payload);assert.equal(prep.ok,true);
  const result=f.run('execute',f.payload,['--confirmed-ref',prep.plan.confirmationRef]);
  assert.equal(result.ok,false);assert.equal(result.onboarding.stage,'permissions');
  assert.deepEqual(result.onboarding.missingScopes,['hire:application']);assert.match(result.onboarding.resume,/原计划/);
  const calls=f.readState().calls;
  assert.equal(calls.filter(c=>c.method==='POST'&&c.url.endsWith('/attachments')).length,1);
  assert.equal(calls.filter(c=>c.method==='POST'&&c.url.endsWith('/applications')).length,1);
  const state=f.run('status',undefined,['--resume-sha256',f.payload.resumeSha256]);
  assert.equal(state.record.status,'blocked_permission');
  assert.equal(f.readState().calls.length,calls.length);
 }finally{f.close();}
});
