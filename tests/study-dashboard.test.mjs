import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path,imports={}){const out=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',out)(name=>imports[name],mod,mod.exports);return mod.exports}
const model=load('src/lib/study-dashboard-model.ts');
const loader=load('src/lib/study-dashboard.ts',{'./study-stats':load('src/lib/study-stats.ts')});
const study=(id,extra={})=>({id,slug:null,description:null,is_private:false,start_datetime_utc:null,end_datetime_utc:null,...extra});
const dashboard=(id,extra={})=>({...study(id),startedAt:null,completedAt:null,participationKnown:true,total:10,reviewed:0,...extra});
const now=Date.parse('2026-11-06T12:00:00Z');
test('deadline boundaries, unbounded studies and completion are independent',()=>{
 assert.equal(model.studyPeriod(dashboard(1,{end_datetime_utc:new Date(now).toISOString()}),now),'current');
 assert.equal(model.studyPeriod(dashboard(1,{end_datetime_utc:new Date(now-1).toISOString()}),now),'past');
 assert.equal(model.studyPeriod(dashboard(1),now),'current');
 assert.equal(model.studyStatus(dashboard(1,{reviewed:10}),now),'Not started');
 assert.equal(model.studyStatus(dashboard(1,{startedAt:'2026-11-01',reviewed:10}),now),'In progress');
 assert.equal(model.studyStatus(dashboard(1,{startedAt:'2026-11-01',completedAt:'2026-11-02'}),now),'Completed');
 assert.equal(model.studyStatus(dashboard(1,{participationKnown:false}),now),'Status unavailable');
});
test('current soonest first, past newest first, missing deadlines last',()=>{
 const rows=[dashboard(1),dashboard(2,{end_datetime_utc:'2026-11-07'}),dashboard(3,{end_datetime_utc:'2026-11-10'})];
 assert.deepEqual(model.sortStudies(rows,'current').map(s=>s.id),[2,3,1]);
 assert.deepEqual(model.sortStudies(rows,'past').map(s=>s.id),[3,2,1]);
});
test('calendar uses the participant timezone including daylight saving boundaries',()=>{
 assert.equal(model.calendarDay('2026-11-07T02:00:00Z','America/New_York'),'2026-11-06');
 assert.equal(model.calendarDay('2026-11-01T05:30:00Z','America/New_York'),'2026-11-01');
});
function client(tables,fail){return {from(table){const filters=[];let from=0,to=999;const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q},in:(k,v)=>{filters.push(r=>v.includes(r[k]));return q},order:()=>q,range:(a,b)=>{from=a;to=b;return q},then:(resolve,reject)=>Promise.resolve(fail===table?{data:null,error:{message:'test failure'}}:{data:(tables[table]??[]).filter(r=>filters.every(f=>f(r))).slice(from,to+1),error:null}).then(resolve,reject)};return q}}}
test('history, private scope, user isolation, duplicate review events and pagination',async()=>{
 const tables={studies:[study(1),study(2,{is_private:true}),study(3,{is_private:true}),study(4,{end_datetime_utc:'2026-10-01'})],study_participations:[{profile_id:'me',study_id:1,started_at:'2026-10-01',ended_at:null},{profile_id:'me',study_id:2,started_at:'2026-10-01',ended_at:null},{profile_id:'other',study_id:3,started_at:'2026-10-01'}],study_caption_mappings:[...Array.from({length:1001},(_,i)=>({id:i+1,study_id:1,caption_id:'c'+i})),{id:2000,study_id:1,caption_id:'c0'}],study_caption_navigation_events:[{profile_id:'me',study_caption_mapping_id:1,caption_id:'c0'},{profile_id:'me',study_caption_mapping_id:2000,caption_id:'c0'},{profile_id:'other',study_caption_mapping_id:2,caption_id:'c1'},{profile_id:'me',study_caption_mapping_id:null,caption_id:'c2'}]};
 const result=await loader.fetchStudyDashboard(client(tables),'me');
 assert.equal(result.error,false);assert.equal(result.progressError,false);
 assert.deepEqual(result.studies.map(s=>s.id),[1,4,2]);assert.equal(result.studies[0].total,1001);assert.equal(result.studies[0].reviewed,1);
 const failure=await loader.fetchStudyDashboard(client(tables,'study_caption_navigation_events'),'me');
 assert.equal(failure.progressError,true);assert.equal(failure.studies[0].reviewed,null);
});
test('completed snapshots survive study edits; absent snapshots stay unknown',async()=>{
 const tables={studies:[study(1),study(2)],study_participations:[{profile_id:'me',study_id:1,started_at:'2026-10-01',ended_at:'2026-10-02',completion_stats:{likedCount:2,viewedCount:4,medianVoteTimeMs:null,medianNavigationTimeMs:null}},{profile_id:'me',study_id:2,started_at:'2026-10-01',ended_at:'2026-10-02',completion_stats:null}]};
 const result=await loader.fetchStudyDashboard(client(tables),'me');assert.equal(result.studies[0].reviewed,4);assert.equal(result.studies[0].total,4);assert.equal(result.studies[1].reviewed,null);
});
