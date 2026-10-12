import { readFileSync } from 'node:fs';
const terms=process.argv.slice(2).map(x=>x.toLowerCase());
if(!terms.length) { console.error('Usage: node find-job-types.mjs <keyword> [keyword...]'); process.exit(1); }
const data=JSON.parse(readFileSync(new URL('../references/boss-job-types.json',import.meta.url),'utf8'));
const rows=[];
for(const root of data.completed_roots) for(const group of root.groups) for(const type of group.types) {
 const path=[root.name,group.name,type]; const text=path.join(' / ').toLowerCase();
 const score=terms.reduce((n,t)=>n+(text.includes(t)?1:0)+(type.toLowerCase()===t?2:0),0);
 if(score)rows.push({path,score});
}
rows.sort((a,b)=>b.score-a.score);
console.log(JSON.stringify({captured_at:data.captured_at,matches:rows.length,paths:rows.slice(0,8).map(x=>x.path)},null,2));
