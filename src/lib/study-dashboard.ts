import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudyRow } from './studies';
import type { StudyParticipation } from './study-participation';
import { parseStudyStats } from './study-stats';
import type { DashboardStudy } from './study-dashboard-model';

async function pages<T>(query: (from: number, to: number) => PromiseLike<{data: T[] | null; error: {message: string} | null}>) {
  const rows: T[] = [];
  for(let from=0;;from+=1000) {
    const {data,error}=await query(from,from+999);
    if(error) throw new Error(error.message);
    rows.push(...(data??[]));
    if(!data || data.length<1000) return rows;
  }
}
const fields='id,slug,description,is_private,start_datetime_utc,end_datetime_utc';
export async function fetchStudyDashboard(client: SupabaseClient, profileId: string): Promise<{studies:DashboardStudy[]; error:boolean; progressError:boolean}> {
  try {
    const [publicStudies, participationResult] = await Promise.all([
      pages<StudyRow>((a,b)=>client.from('studies').select(fields).eq('is_private',false).order('id').range(a,b)),
      pages<StudyParticipation>((a,b)=>client.from('study_participations').select('profile_id,study_id,started_at,ended_at,completion_stats').eq('profile_id',profileId).order('study_id').range(a,b)).then(data=>({data,error:false})).catch(()=>({data:[] as StudyParticipation[],error:true})),
    ]);
    const byId=new Map(publicStudies.map(s=>[s.id,s]));
    const participation=new Map(participationResult.data.map(p=>[p.study_id,p]));
    // Include private studies only when this user already has a participation.
    const extra=participationResult.data.map(p=>p.study_id).filter(id=>!byId.has(id));
    for(let i=0;i<extra.length;i+=100){
      const rows=await pages<StudyRow>((a,b)=>client.from('studies').select(fields).in('id',extra.slice(i,i+100)).order('id').range(a,b));
      rows.forEach(s=>byId.set(s.id,s));
    }
    const mappings=new Map<number,{studyId:number;captionId:string}>();
    const totals=new Map<number,Set<string>>();
    const reviewed=new Map<number,Set<string>>();
    let countsKnown=true;
    try {
      const ids=[...byId.keys()];
      for(let i=0;i<ids.length;i+=100){
        const rows=await pages<{id:number;study_id:number;caption_id:string}>((a,b)=>client.from('study_caption_mappings').select('id,study_id,caption_id,captions!inner(id)').in('study_id',ids.slice(i,i+100)).order('id').range(a,b));
        rows.forEach(m=>{mappings.set(m.id,{studyId:m.study_id,captionId:m.caption_id});if(!totals.has(m.study_id))totals.set(m.study_id,new Set());totals.get(m.study_id)!.add(m.caption_id)});
      }
      if(participationResult.data.some(p=>!p.ended_at)){
        const events=await pages<{study_caption_mapping_id:number|null;caption_id:string}>((a,b)=>client.from('study_caption_navigation_events').select('study_caption_mapping_id,caption_id').eq('profile_id',profileId).order('id').range(a,b));
        events.forEach(event=>{const m=event.study_caption_mapping_id===null?undefined:mappings.get(event.study_caption_mapping_id);if(!m||!participation.has(m.studyId)||m.captionId!==event.caption_id)return;if(!reviewed.has(m.studyId))reviewed.set(m.studyId,new Set());reviewed.get(m.studyId)!.add(m.captionId)});
      }
    } catch { countsKnown=false; }
    const studies=[...byId.values()].map(study=>{
      const p=participation.get(study.id);const complete=Boolean(p?.started_at&&p.ended_at);const stats=complete?parseStudyStats(p?.completion_stats):null;
      return {...study,startedAt:p?.started_at??null,completedAt:p?.ended_at??null,participationKnown:!participationResult.error,
        total:complete?(stats?.viewedCount??null):countsKnown?(totals.get(study.id)?.size??0):null,
        reviewed:complete?(stats?.viewedCount??null):countsKnown&&!participationResult.error?(reviewed.get(study.id)?.size??0):null};
    });
    return {studies,error:false,progressError:participationResult.error||!countsKnown};
  } catch(error) {
    console.error('[Study dashboard] load failed',error);
    return {studies:[],error:true,progressError:false};
  }
}
