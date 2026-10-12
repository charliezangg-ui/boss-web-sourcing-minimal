import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessRun} from './check-run.mjs';
const run=(verified,status='running')=>({run_id:'r',status,roles:[{name:'A',target:20,verified}]});
test('unfinished goal continues',()=>assert.equal(assessRun(run(12)).decision,'continue_same_run'));
test('premature completion is invalid',()=>assert.equal(assessRun(run(12,'completed')).decision,'invalid_completion'));
test('security pause retains remaining',()=>assert.deepEqual(assessRun(run(12),{security_block:{run_id:'r',status:'active'}}).remainingByRole,[{role:'A',remaining:8}]));
test('target reached only with exact count',()=>assert.equal(assessRun(run(20)).decision,'target_reached'));
test('missing and overshot counts are unknown',()=>{assert.equal(assessRun(run(undefined)).decision,'unknown');assert.equal(assessRun(run(21)).decision,'unknown')});
