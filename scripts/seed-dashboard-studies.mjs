// Creates only new, clearly identified studies in the configured teaching DB.
// Uses the existing public API key and normal database permissions, never a service key.
import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(url!=='https://pcqtipefoxzsdccgjwwa.supabase.co')throw new Error('Refusing to seed a different database. Verify the teaching project before editing this guard.');
const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const source=122;
const {data:sourceStudy,error:sourceError}=await client.from('studies').select('id,is_private').eq('id',source).single();
if(sourceError||sourceStudy.is_private!==false)throw new Error('Source study unavailable');
const {data:mappings,error:mapError}=await client.from('study_caption_mappings').select('caption_id,captions!inner(id,images(url))').eq('study_id',source).order('id').limit(100);
if(mapError)throw new Error(mapError.message);
const ids=[...new Set(mappings.filter(m=>m.captions?.images?.url).map(m=>m.caption_id))];
if(ids.length<12)throw new Error('Source must contain at least 12 captions with images');
// Fixed Eastern-time windows keep the November 12 review scenarios reproducible.
// Participation is created only through the actual app; this script seeds no responses.
const scenarios = [
 {key:'6-captions',size:6,start:'2026-11-06T18:16:27.498Z',end:'2026-11-13T19:16:27.500Z'},
 {key:'12-captions',size:12,start:'2026-11-06T18:16:27.882Z',end:'2026-11-20T19:16:27.882Z'},
 {key:'past-short',size:3,start:'2026-11-06T05:00:00Z',end:'2026-11-11T04:59:00Z'},
 {key:'past-partial',size:6,start:'2026-11-06T05:00:00Z',end:'2026-11-11T04:59:00Z'},
 {key:'thursday-short',size:6,start:'2026-11-06T05:00:00Z',end:'2026-11-13T04:59:00Z'},
 {key:'thursday-long',size:9,start:'2026-11-06T05:00:00Z',end:'2026-11-13T04:59:00Z'},
 {key:'upcoming',size:6,start:'2026-11-14T05:00:00Z',end:'2026-11-21T04:59:00Z'},
];
for(const {key,size,start,end} of scenarios){
 const slug=`semester-ux-test-2026-11-06-${key}`;
 const {data:existing,error:lookupError}=await client.from('studies').select('id,start_datetime_utc,end_datetime_utc').eq('slug',slug);
 if(lookupError)throw new Error(lookupError.message);
 if(existing.length){console.log(JSON.stringify({status:'already_exists',...existing[0]}));continue}
 const {data:created,error}=await client.from('studies').insert({slug,description:`Semester UX test: ${size} captions copied from Study ${source}.`,start_datetime_utc:start,end_datetime_utc:end,is_private:false,is_hidden:false}).select('id,start_datetime_utc,end_datetime_utc').single();
 if(error)throw new Error('Study insert rejected: '+error.message);
 const {error:insertError}=await client.from('study_caption_mappings').insert(ids.slice(0,size).map(caption_id=>({study_id:created.id,caption_id})));
 if(insertError)throw new Error(`Study ${created.id} was created but mappings failed: ${insertError.message}. Repair this study before rerunning.`);
 const {count,error:countError}=await client.from('study_caption_mappings').select('id',{count:'exact',head:true}).eq('study_id',created.id);
 if(countError||count!==size)throw new Error('Mapping verification failed for '+created.id);
 console.log(JSON.stringify({status:'created',...created,captions:count,source}));
}
