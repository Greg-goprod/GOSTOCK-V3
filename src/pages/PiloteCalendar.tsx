import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { getLanguage } from '../i18n/translator';
import { filterGantt, hasFilters } from '../lib/ganttFilters';
import { addDays, calendarEvents, layoutWeek, mondayOf, monthWeeks, shiftMonth } from '../lib/boardCalendarModel';
import { loadGantt, loadPiloteRights, piloteError, type GanttData, type PiloteRights } from '../lib/pilote';
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxSegmented } from '../components/mx/MxSegmented';
import Button from '../components/common/Button';
import ItemDrawer, { type ItemTarget } from '../components/pilote/ItemDrawer';
import GanttFilterBar from '../components/pilote/GanttFilterBar';
import ExportMenu from '../components/pilote/ExportMenu';
import { useViewFilters } from '../components/pilote/useViewFilters';

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const EMPTY: GanttData = { statuses: [], projects: [], templates: [], members: [], sites: [], items: [], itemMembers: [], links: [], calendarDays: [] };
const LOCALES = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' } as const;
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const LANE_H = 22;
const HEAD_H = 24;

// PILOTE › Projets › Calendrier : les tâches, phases et jalons datés sur un mois ou une semaine, sur des lignes qui suivent
// chaque élément d'un bout à l'autre. Week-ends et jours du calendrier de travail sont teintés. Mêmes recherche et filtres que le Gantt.
const PiloteCalendar: React.FC = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  const today = todayZurich();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const { filters, setFilters, views, saveView, deleteView, applyView } = useViewFilters();
  const { users } = useApp();
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const locale = LOCALES[getLanguage()];

  const reload = useCallback(async () => {
    try { setData(await loadGantt()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? EMPTY); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); }, [reload]);

  const userNames = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  const people = useMemo(() => users.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim() })).sort((a, b) => a.name.localeCompare(b.name, 'fr')), [users]);
  const shown = useMemo(() => filterGantt(data ?? EMPTY, filters, today), [data, filters, today]);
  const events = useMemo(() => calendarEvents(shown, today), [shown, today]);
  const overdueCount = useMemo(() => calendarEvents(data ?? EMPTY, today).filter(e => e.overdue && e.kind !== 'phase').length, [data, today]);
  const holidays = useMemo(() => new Map((data?.calendarDays ?? []).map(d => [d.day, d.label])), [data]);

  const weeks = view === 'month' ? monthWeeks(month) : [weekStart];
  const maxLanes = view === 'month' ? 3 : 8;
  const title = view === 'month'
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))
    : `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${weekStart}T12:00:00Z`))} – ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${addDays(weekStart, 6)}T12:00:00Z`))}`;
  const weekdayNames = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${addDays('2027-01-04', i)}T12:00:00Z`))), [locale]);

  const go = (delta: number) => (view === 'month' ? setMonth(m => shiftMonth(m, delta)) : setWeekStart(w => addDays(w, 7 * delta)));
  const goToday = () => { setMonth(today.slice(0, 7)); setWeekStart(mondayOf(today)); };
  const openWeek = (start: string) => { setWeekStart(start); setView('week'); };

  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => go(-1)} ariaLabel={view === 'month' ? 'Mois précédent' : 'Semaine précédente'} icon={<ChevronLeft size={14} />} />
          <Button variant="outline" size="sm" onClick={goToday}>Aujourd'hui</Button>
          <Button variant="outline" size="sm" onClick={() => go(1)} ariaLabel={view === 'month' ? 'Mois suivant' : 'Semaine suivante'} icon={<ChevronRight size={14} />} />
          <h2 className="ml-1 text-base font-bold capitalize text-gray-900 dark:text-white" aria-live="polite" data-calendar-title>{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={shown} userName={id => userNames.get(id) ?? '—'} today={today} printable />
          <MxSegmented aria-label="Période du calendrier" value={view} onChange={v => { if (v === 'week') setWeekStart(mondayOf(month === today.slice(0, 7) ? today : `${month}-01`)); setView(v as 'month' | 'week'); }}
            options={[{ value: 'month', label: 'Mois' }, { value: 'week', label: 'Semaine' }]} />
        </div>
      </div>

      <GanttFilterBar filters={filters} onChange={setFilters} people={people} overdueCount={overdueCount} views={views}
        onApplyView={applyView} onSaveView={() => void saveView()} onDeleteView={v => void deleteView(v)} />

      {events.length === 0 && hasFilters(filters) && <MxEmpty icon={CalendarDays} title="Aucun résultat" description="Aucun élément ne correspond à ces filtres. Utilise « Tout afficher » pour revenir à la liste complète." />}

      <div data-print-area>
      <h2 className="print-only hidden mb-2 text-lg font-bold capitalize">{`PILOTE — Calendrier · ${title}`}</h2>
      <div data-print-expand className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700" role="grid" aria-label={title}>
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" role="row">
            {weekdayNames.map(n => <div key={n} className="py-1.5" role="columnheader">{n}</div>)}
          </div>
          {weeks.map(ws => {
            const layout = layoutWeek(events, ws, maxLanes);
            const lanes = Math.max(1, layout.bars.reduce((m, b) => Math.max(m, b.lane + 1), 0));
            const bodyH = (view === 'month' ? maxLanes : Math.max(lanes, 3)) * LANE_H;
            const rowH = HEAD_H + bodyH + (layout.hidden.some(h => h > 0) ? 18 : 4);
            return (
              <div key={ws} className="relative border-b border-gray-100 last:border-b-0 dark:border-gray-700/60" style={{ height: rowH }} role="row" data-week={ws}>
                <div className="absolute inset-0 grid grid-cols-7">
                  {Array.from({ length: 7 }, (_, c) => {
                    const day = addDays(ws, c);
                    const weekend = c >= 5, holiday = holidays.get(day), isToday = day === today, outside = view === 'month' && !day.startsWith(month);
                    return (
                      <div key={day} role="gridcell" aria-label={`${day}${holiday ? ` · ${holiday}` : ''}`} data-day={day}
                        className={`border-r border-gray-100 px-1 pt-0.5 last:border-r-0 dark:border-gray-700/60 ${holiday ? 'bg-amber-500/10' : weekend ? 'bg-gray-500/5 dark:bg-white/5' : ''} ${outside ? 'opacity-50' : ''}`} title={holiday}>
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${isToday ? 'bg-danger-500 font-bold text-white' : 'text-gray-700 dark:text-gray-300'}`}>{Number(day.slice(8))}</span>
                          {holiday && <span className="ml-1 truncate text-[10px] text-amber-700 dark:text-amber-300">{holiday}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-x-px" style={{ top: HEAD_H, gridAutoRows: LANE_H }}>
                  {layout.bars.map(b => (
                    <button key={b.event.key} type="button" onClick={() => setItemTarget({ mode: 'edit', itemId: b.event.id })} data-event={b.event.id}
                      title={`${b.event.name} · ${b.event.projectName}${b.event.overdue ? ' · En retard' : ''}`}
                      className={`pointer-events-auto mx-0.5 my-px flex items-center gap-1 truncate px-1.5 text-left text-[11px] font-medium text-gray-900 dark:text-white ${b.continuesLeft ? 'rounded-l-none' : 'rounded-l'} ${b.continuesRight ? 'rounded-r-none' : 'rounded-r'} ${b.event.family === 'done' ? 'line-through opacity-70' : ''}`}
                      style={{ gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.lane + 1, background: `${b.event.color}40`, borderLeft: b.continuesLeft ? undefined : `3px solid ${b.event.color}`, boxShadow: b.event.overdue ? 'inset 0 0 0 1.5px #dc2626' : undefined }}>
                      {b.event.overdue && <AlertTriangle size={11} aria-hidden className="shrink-0 text-danger-600" />}
                      {b.event.kind === 'milestone' && <span aria-hidden className="h-2 w-2 shrink-0 rotate-45" style={{ background: b.event.color }} />}
                      <span className="truncate">{b.event.name}</span>
                    </button>
                  ))}
                </div>
                {layout.hidden.some(h => h > 0) && (
                  <div className="absolute inset-x-0 bottom-0 grid grid-cols-7" style={{ height: 18 }}>
                    {layout.hidden.map((h, c) => (
                      <div key={c} className="px-1.5 text-[11px]">
                        {h > 0 && <button type="button" onClick={() => openWeek(ws)} className="font-medium text-primary-700 hover:underline dark:text-primary-300" aria-label={`${h} autres éléments ce jour, ouvrir la semaine`}>{`+${h}`}</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">Les éléments sans date n'apparaissent pas ici : place-les depuis le Gantt (« Sans date »). Les jours fériés et fermetures du calendrier de travail sont teintés en ambre.</p>

      <ItemDrawer data={data} target={itemTarget} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete} onClose={() => setItemTarget(null)} onSaved={reload} />
    </div>
  );
};

export default PiloteCalendar;
