'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccountMenu } from './AccountMenu';
import { LocalDateTime } from './LocalDateTime';
import { calendarDay, sortStudies, studyPeriod, studyStatus, type DashboardStudy } from '@/lib/study-dashboard-model';
import './study-dashboard.css';
const subscribe=()=>()=>{};
const deviceZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone=()=>'UTC';
export function StudyDashboard({studies,error,progressError,now:initialNow,displayName,email,signOutAction}:{studies:DashboardStudy[];error:boolean;progressError:boolean;now:string;displayName:string;email?:string;signOutAction:()=>Promise<void>}) {
  const [view,setView]=useState<'progress'|'calendar'>('progress');
  const [period,setPeriod]=useState<'current'|'past'>('current');
  const [now,setNow]=useState(Date.parse(initialNow));
  const zone=useSyncExternalStore(subscribe,deviceZone,serverZone);
  const today=calendarDay(new Date(now).toISOString(),zone);
  const [selection,setSelection]=useState<string|null>(null);
  const selectedDay=selection??today;
  const [month,setMonth]=useState<string|null>(null);
  const shownMonth=month??today.slice(0,7);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const cardRefs=useRef(new Map<number,HTMLElement>());
  const listRef=useRef<HTMLDivElement>(null);
  const current=sortStudies(studies.filter(s=>studyPeriod(s,now)==='current'),'current');
  const past=sortStudies(studies.filter(s=>studyPeriod(s,now)==='past'),'past');
  const visible=period==='current'?current:past;
  const dayStudies=studies.filter(s=>s.end_datetime_utc&&calendarDay(s.end_datetime_utc,zone)===selectedDay).sort((a,b)=>Date.parse(a.end_datetime_utc!)-Date.parse(b.end_datetime_utc!)||a.id-b.id);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[]);
  useEffect(()=>{
    if(view!=='progress'||selectedId===null)return;
    const frame=requestAnimationFrame(()=>{const card=cardRefs.current.get(selectedId);const list=listRef.current;if(card&&list)list.scrollTo({top:card.getBoundingClientRect().top-list.getBoundingClientRect().top+list.scrollTop-4,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
    return()=>cancelAnimationFrame(frame);
  },[view,period,selectedId]);
  const monthDate=new Date(shownMonth+'-01T12:00:00Z');
  const first=new Date(monthDate);first.setUTCDate(1-(first.getUTCDay()+6)%7);
  const days=Array.from({length:42},(_,i)=>{const d=new Date(first);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)});
  function changeMonth(delta:number){const d=new Date(monthDate);d.setUTCMonth(d.getUTCMonth()+delta);setMonth(d.toISOString().slice(0,7))}
  function locate(s:DashboardStudy){setSelectedId(s.id);setPeriod(studyPeriod(s,now));setView('progress')}
  return <div className="study-dashboard" id="home-root">
    <header className="sd-header"><span className="sd-brand">Humor Study</span><nav aria-label="View" className="sd-views">{(['progress','calendar'] as const).map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{v==='progress'?'Progress':'Calendar'}</button>)}</nav><AccountMenu displayName={displayName} email={email} signOutAction={signOutAction} placement="header"/></header>
    <main id="home-content" className="sd-main">
      {error?<div role="alert" className="glass-panel sd-empty"><h1>We couldn&apos;t load studies</h1><button onClick={()=>window.location.reload()}>Try again</button></div>:<>
      {progressError&&<p role="alert" className="sd-error">Some progress information couldn&apos;t be loaded. <button onClick={()=>window.location.reload()}>Try again</button></p>}
      {view==='progress'?<section className="sd-progress" aria-label="Study progress"><div className="sd-tabs" role="tablist" aria-label="Study period">{(['current','past'] as const).map(p=><button role="tab" id={'tab-'+p} aria-controls="study-cards" aria-selected={period===p} key={p} onClick={()=>{setPeriod(p);setSelectedId(null);listRef.current?.scrollTo({top:0})}}>{p==='current'?'Current':'Past'} <span>{p==='current'?current.length:past.length}</span></button>)}</div><div className="sd-cards" id="study-cards" role="tabpanel" aria-labelledby={'tab-'+period} ref={listRef}>
        {!visible.length?<div className="glass-panel sd-empty"><h2>{period==='current'?'No current studies':'No past studies'}</h2></div>:visible.map(s=>{const status=studyStatus(s,now);const complete=status==='Completed';const countKnown=s.total!==null&&s.reviewed!==null;const pct=countKnown&&s.total!>0?Math.min(100,Math.round(s.reviewed!/s.total!*100)):complete?100:0;const canStart=s.participationKnown&&studyPeriod(s,now)==='current'&&status!=='Upcoming';return <article key={s.id} ref={el=>{if(el)cardRefs.current.set(s.id,el);else cardRefs.current.delete(s.id)}} className={'glass-panel sd-card'+(selectedId===s.id?' sd-selected':'')}>
          <div className="sd-card-top"><h2>Study ID: {s.id}</h2><span className="sd-badge">{status}</span></div>
          <dl className="sd-dates"><div className="sd-metric"><dt>Total caption</dt><dd>{s.total??'—'}</dd></div><div className="sd-date"><dt>Start</dt><dd>{s.start_datetime_utc?<LocalDateTime value={s.start_datetime_utc}/>: 'No start date'}</dd></div><div className="sd-date"><dt>End</dt><dd>{s.end_datetime_utc?<LocalDateTime value={s.end_datetime_utc}/>: 'No end date'}</dd></div></dl>
          {countKnown?<><div className="sd-count"><span className="sd-progress-label">Progress</span><span>{s.reviewed} of {s.total} reviewed</span></div><div className="sd-bar" role="progressbar" aria-label={'Study '+s.id+' progress'} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span aria-hidden>{pct}%</span><div className="sd-bar-fill" style={{clipPath:`inset(0 ${100-pct}% 0 0)`}}><span aria-hidden>{pct}%</span></div></div></>:<p className="sd-muted">Progress unavailable</p>}
          <div className="sd-card-bottom">{complete&&s.completedAt?<span className="sd-completed">Completed <LocalDateTime value={s.completedAt}/></span>:<span/>}{(complete||canStart)&&<Link prefetch={false} className={'sd-action'+(!complete?' sd-primary':'')} href={'/study/'+s.id}>{complete?'View stats':s.startedAt?'Continue study':'Start study'} →</Link>}</div>
        </article>})}
      </div></section>:<section className="sd-calendar-layout" aria-label="Study calendar"><div className="glass-panel sd-calendar"><div className="sd-calendar-heading"><div><span className="sd-year">{monthDate.getUTCFullYear()}</span><h1>{monthDate.toLocaleDateString('en-US',{month:'long',timeZone:'UTC'})}</h1></div><div className="sd-calendar-controls"><button onClick={()=>{setMonth(today.slice(0,7));setSelection(today)}}>Today</button><button aria-label="Previous month" onClick={()=>changeMonth(-1)}>‹</button><button aria-label="Next month" onClick={()=>changeMonth(1)}>›</button></div></div><div className="sd-week" aria-hidden>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d}>{d}</span>)}</div><div className="sd-days">{days.map(d=>{const count=studies.filter(s=>s.end_datetime_utc&&calendarDay(s.end_datetime_utc,zone)===d).length;return <button key={d} className={(d.slice(0,7)!==shownMonth?'sd-out ':'')+(d===selectedDay?'sd-day-selected ':'')+(d===today?'sd-today':'')} aria-current={d===today?'date':undefined} aria-pressed={d===selectedDay} aria-label={d+(count?`, ${count} study deadlines`:'')} onClick={()=>{setSelection(d);setMonth(d.slice(0,7))}}><span className="sd-day-num">{Number(d.slice(-2))}</span>{count>0&&<span className="sd-dot" aria-hidden><i/>{count>1&&<i/>}</span>}</button>})}</div></div><aside className="sd-day-studies"><h2>{new Date(selectedDay+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',timeZone:'UTC'})}</h2>{dayStudies.length?dayStudies.map(s=><button className="glass-panel sd-day-study" key={s.id} onClick={()=>locate(s)}><span><strong>Study {s.id}</strong><small>{studyStatus(s,now)}</small></span><span aria-hidden>↗</span></button>):<p className="sd-muted">No studies due</p>}</aside></section>}
      </>}
    </main>
  </div>;
}
