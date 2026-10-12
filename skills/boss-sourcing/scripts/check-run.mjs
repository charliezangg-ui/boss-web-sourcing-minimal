#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function assessRun(state, control={}) {
  const roles=Array.isArray(state?.roles)?state.roles:[];
  if(!roles.length || !state?.run_id) return {decision:'unknown',reason:'run_or_roles_missing'};
  const remainingByRole=[];
  for(const role of roles){
    const target=role.target, verified=role.verified;
    if(typeof role.name!=='string' || !Number.isInteger(target) || target<0 || !Number.isInteger(verified) || verified<0 || verified>target)
      return {decision:'unknown',reason:'role_counts_invalid'};
    remainingByRole.push({role:role.name,remaining:target-verified});
  }
  const remaining=remainingByRole.reduce((sum,x)=>sum+x.remaining,0);
  if(state.status==='stopped') return {decision:'stopped_by_boundary',remaining,remainingByRole};
  if(remaining===0) return {decision:'target_reached',remaining,remainingByRole};
  if(state.status==='completed') return {decision:'invalid_completion',reason:'quota_not_met',remaining,remainingByRole};
  if(control.security_block?.run_id===state.run_id && control.security_block.status!=='resolved')
    return {decision:'wait_external',reason:'security_verification',remaining,remainingByRole};
  if(state.blocking_reason) return {decision:'wait_external',reason:state.blocking_reason,remaining,remainingByRole};
  return {decision:'continue_same_run',remaining,remainingByRole};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const path=process.argv[2];
  if(!path){process.stderr.write('Usage: node check-run.mjs /absolute/path/to/state.json [control-plane.json]\n');process.exitCode=64;}
  else try{
    const state=JSON.parse(await readFile(resolve(path),'utf8'));
    const control=process.argv[3]?JSON.parse(await readFile(resolve(process.argv[3]),'utf8')):{};
    const result=assessRun(state,control);
    process.stdout.write(`${JSON.stringify({run_id:state.run_id,...result})}\n`);
    if(['continue_same_run','invalid_completion','unknown'].includes(result.decision))process.exitCode=2;
  }catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=2;}
}
