import type { StudyRow } from './studies';
export type DashboardStudy = StudyRow & { startedAt: string | null; completedAt: string | null; total: number | null; reviewed: number | null; participationKnown: boolean };
export function studyPeriod(study: DashboardStudy, now: number): 'current' | 'past' {
  return study.end_datetime_utc && Date.parse(study.end_datetime_utc) < now ? 'past' : 'current';
}
export function studyStatus(study: DashboardStudy, now: number) {
  if (!study.participationKnown) return 'Status unavailable';
  if (study.startedAt && study.completedAt) return 'Completed';
  if (studyPeriod(study, now) === 'past') return study.startedAt ? 'Ended · Incomplete' : 'Ended · Not started';
  if (study.start_datetime_utc && Date.parse(study.start_datetime_utc) > now) return 'Upcoming';
  return study.startedAt ? 'In progress' : 'Not started';
}
export function sortStudies(studies: DashboardStudy[], period: 'current' | 'past') {
  return [...studies].sort((a,b) => {
    if (!a.end_datetime_utc) return b.end_datetime_utc ? 1 : a.id-b.id;
    if (!b.end_datetime_utc) return -1;
    return (period === 'current' ? 1 : -1) * (Date.parse(a.end_datetime_utc)-Date.parse(b.end_datetime_utc)) || a.id-b.id;
  });
}
export function calendarDay(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}
