import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { DEFAULT_CONFIG, firstUsefulDay, issueText, planningError, type PlanIntervention, type PlanSite, type PlanningRights, type SitePlanningData } from '../../lib/sitePlanning';
import { dayToNumber, minutesToTime, MINUTES_PER_DAY, mondayOf, numberToDay, assignLanes, shiftIso, snap, toWallPoint } from '../../lib/timelineMath';
import { formatDay } from '../../lib/zurichTime';
import { getLanguage } from '../../i18n/translator';
import Button from '../common/Button';
import DateInput from '../common/DateInput';
import { MxEmpty } from '../mx/MxEmpty';
import { MxSegmented } from '../mx/MxSegmented';
import InterventionForm, { type InterventionTarget } from './InterventionForm';
import CopyDayModal from './CopyDayModal';

interface Props {
  site: PlanSite;
  data: SitePlanningData;
  rights: PlanningRights;
  locked: boolean;
  onChanged: () => Promise<void>;
  teamLabel: (teamId: string) => string;
}

type Mode = 'zone' | 'team';
type Scale = 'day' | 'week';
type DragKind = 'move' | 'start' | 'end';

interface DragState { item: PlanIntervention; kind: DragKind; startX: number; startY: number; startAbs: number; moved: boolean }
interface DragView { id: string; kind: DragKind; deltaMin: number; dy: number; rowKey: string | null }

const LABEL_W = 176;
const LANE_H = 40;
const BLOCK_H = 34;
const HEADER_H = 34;
const readStored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try { const v = localStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; }
};

// Frise horaire du planning : une ligne par zone ou par équipe, déplacement et redimensionnement à la souris (au pas du chantier)
const Timeline: React.FC<Props> = ({ site, data, rights, locked, onChanged, teamLabel }) => {
  const { zones, teams, config, interventions, blockedDays } = data;
  const cfg = config ?? { ...DEFAULT_CONFIG, site_id: site.id };
  const step = cfg.step_minutes;
  const startMin = cfg.all_day ? 0 : Number(cfg.day_start.slice(0, 2)) * 60 + Number(cfg.day_start.slice(3, 5));
  const endMin = cfg.all_day ? MINUTES_PER_DAY : Number(cfg.day_end.slice(0, 2)) * 60 + Number(cfg.day_end.slice(3, 5));
  const span = Math.max(60, endMin - startMin);
  const canEdit = rights.update && !locked;
  const canCreate = rights.create && !locked;

  const [mode, setModeState] = useState<Mode>(() => readStored('gomat-timeline-mode', ['zone', 'team'] as const, 'zone'));
  const [scale, setScaleState] = useState<Scale>(() => readStored('gomat-timeline-scale', ['day', 'week'] as const, 'day'));
  const [day, setDay] = useState(() => {
    const first = interventions[0] ? toWallPoint(interventions[0].starts_at).day : null;
    return first !== null ? numberToDay(first) : firstUsefulDay(site);
  });
  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem('gomat-timeline-mode', m); } catch { /* préférence facultative */ } };
  const setScale = (s: Scale) => { setScaleState(s); try { localStorage.setItem('gomat-timeline-scale', s); } catch { /* préférence facultative */ } };

  const [overrides, setOverrides] = useState<Map<string, PlanIntervention>>(new Map());
  const [dragView, setDragView] = useState<DragView | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [target, setTarget] = useState<InterventionTarget | null>(null);
  const [copying, setCopying] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackW, setTrackW] = useState(900);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackW(Math.max(200, el.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const firstDay = dayToNumber(scale === 'week' ? mondayOf(day) : day);
  const columns = scale === 'week' ? 7 : 1;
  const colW = trackW / columns;
  const ppm = colW / span;

  const blocked = useMemo(() => new Map(blockedDays.map(b => [dayToNumber(b.day), b.reason])), [blockedDays]);
  const periodStart = site.start_on ? dayToNumber(site.start_on) : -Infinity;
  const periodEnd = site.end_on ? dayToNumber(site.end_on) : Infinity;

  // Lignes de la frise : zones, ou équipes classées par prestataire
  const rows = useMemo(() => {
    if (mode === 'zone') return zones.map(z => ({ key: z.id, label: z.name, sub: null as string | null, color: z.color }));
    const sorted = [...teams].sort((a, b) => teamLabel(a.id).localeCompare(teamLabel(b.id), 'fr'));
    return sorted.map(t => {
      const full = teamLabel(t.id);
      const sub = full.startsWith(`${t.name} (`) ? full.slice(t.name.length + 2, -1) : 'Équipe interne';
      return { key: t.id, label: t.name, sub, color: t.color };
    });
  }, [mode, zones, teams, teamLabel]);

  const items = useMemo(() => interventions.map(i => overrides.get(i.id) ?? i), [interventions, overrides]);
  const rowKeyOf = useCallback((i: PlanIntervention) => (mode === 'zone' ? i.zone_id : i.team_id), [mode]);
  const colorOf = (i: PlanIntervention) => (mode === 'zone' ? teams.find(t => t.id === i.team_id)?.color : zones.find(z => z.id === i.zone_id)?.color) ?? '#6366f1';

  // Position horizontale de la souris → minute absolue (jour × 1440 + minute)
  const pointerAbs = (clientX: number): number => {
    const left = trackRef.current?.getBoundingClientRect().left ?? 0;
    const rel = clientX - left;
    const col = Math.min(columns - 1, Math.max(0, Math.floor(rel / colW)));
    return (firstDay + col) * MINUTES_PER_DAY + startMin + (rel - col * colW) / ppm;
  };

  const rowKeyAt = (x: number, y: number): string | null => {
    const el = document.elementsFromPoint(x, y).find(e => e.getAttribute('data-row-key'));
    return el?.getAttribute('data-row-key') ?? null;
  };

  const commit = async (item: PlanIntervention, patch: Partial<PlanIntervention>) => {
    setOverrides(prev => new Map(prev).set(item.id, { ...item, ...patch }));
    const { error } = await supabase.from('cp_site_interventions').update(patch).eq('id', item.id);
    if (error) toast.error(planningError(error));
    await onChanged();
    setOverrides(prev => { const next = new Map(prev); next.delete(item.id); return next; });
  };

  // Ce que donne un glissement : nouvelles heures (et nouvelle ligne si elle change)
  const patchFor = (item: PlanIntervention, kind: DragKind, deltaMin: number, rowKey: string | null): Partial<PlanIntervention> | null => {
    const patch: Partial<PlanIntervention> = {};
    if (kind === 'move' && deltaMin !== 0) { patch.starts_at = shiftIso(item.starts_at, deltaMin); patch.ends_at = shiftIso(item.ends_at, deltaMin); }
    if (kind === 'start' && deltaMin !== 0) {
      const next = shiftIso(item.starts_at, deltaMin);
      if (new Date(next) >= new Date(shiftIso(item.ends_at, -step))) return null;
      patch.starts_at = next;
    }
    if (kind === 'end' && deltaMin !== 0) {
      const next = shiftIso(item.ends_at, deltaMin);
      if (new Date(next) <= new Date(shiftIso(item.starts_at, step))) return null;
      patch.ends_at = next;
    }
    if (kind === 'move' && rowKey && rowKey !== rowKeyOf(item)) { if (mode === 'zone') patch.zone_id = rowKey; else patch.team_id = rowKey; }
    return Object.keys(patch).length ? patch : null;
  };

  const onPointerDown = (e: React.PointerEvent, item: PlanIntervention, kind: DragKind) => {
    if (!canEdit || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { item, kind, startX: e.clientX, startY: e.clientY, startAbs: pointerAbs(e.clientX), moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(e.clientX - d.startX) + Math.abs(dy) < 4) return;
    d.moved = true;
    setDragView({ id: d.item.id, kind: d.kind, deltaMin: snap(pointerAbs(e.clientX) - d.startAbs, step), dy: d.kind === 'move' ? dy : 0, rowKey: d.kind === 'move' ? rowKeyAt(e.clientX, e.clientY) : null });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const view = dragView;
    setDragView(null);
    if (!d.moved) { if (canEdit) setTarget({ mode: 'edit', row: d.item }); return; }
    const delta = snap(pointerAbs(e.clientX) - d.startAbs, step);
    const patch = patchFor(d.item, d.kind, delta, d.kind === 'move' ? (view?.rowKey ?? rowKeyAt(e.clientX, e.clientY)) : null);
    if (patch) void commit(d.item, patch);
  };

  // Clavier : flèches gauche/droite = déplacer d'un pas ; Maj = changer la fin ; haut/bas = changer de ligne ; Entrée = ouvrir
  const onKeyDown = (e: React.KeyboardEvent, item: PlanIntervention) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (canEdit) setTarget({ mode: 'edit', row: item }); return; }
    if (!canEdit) return;
    const horizontal = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
    if (horizontal) {
      e.preventDefault();
      const patch = patchFor(item, e.shiftKey ? 'end' : 'move', horizontal, null);
      if (patch) void commit(item, patch);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const index = rows.findIndex(r => r.key === rowKeyOf(item));
      const next = rows[index + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) void commit(item, mode === 'zone' ? { zone_id: next.key } : { team_id: next.key });
    }
  };

  const createAt = (e: React.MouseEvent<HTMLDivElement>, rowKey: string) => {
    if (!canCreate) return;
    const abs = snap(pointerAbs(e.clientX), step);
    const dayNumber = Math.floor(abs / MINUTES_PER_DAY);
    const minute = Math.min(endMin - step, Math.max(startMin, abs - dayNumber * MINUTES_PER_DAY));
    const end = Math.min(endMin, minute + Math.max(60, step));
    const start = minutesToTime(minute), finish = minutesToTime(end === minute ? minute + step : end);
    setTarget({ mode: 'new', prefill: { day: numberToDay(dayNumber), endDay: numberToDay(dayNumber), start, end: finish, ...(mode === 'zone' ? { zone_id: rowKey } : { team_id: rowKey }) } });
  };

  const goto = (delta: number) => setDay(numberToDay(dayToNumber(day) + delta * (scale === 'week' ? 7 : 1)));
  const LOCALES = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' } as const;
  const dayLabel = (n: number) => new Date(n * 86_400_000).toLocaleDateString(LOCALES[getLanguage()], { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const tickEvery = ppm * 60 < 44 ? 120 : 60;
  const ticks: number[] = [];
  for (let m = Math.ceil(startMin / tickEvery) * tickEvery; m <= endMin; m += tickEvery) ticks.push(m);

  const shade = (n: number): { reason: string } | null => {
    if (n < periodStart || n > periodEnd) return { reason: 'Hors période du chantier' };
    if (blocked.has(n)) return { reason: blocked.get(n) || 'Jour bloqué' };
    return null;
  };

  if (rows.length === 0) {
    return <MxEmpty icon={CalendarClock} title={mode === 'zone' ? 'Aucune zone' : 'Aucune équipe'} description="Ajoute d'abord des zones et des équipes (onglets Zones et Équipes) : la frise s'affichera ici." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MxSegmented aria-label="Lignes de la frise" value={mode} onChange={v => setMode(v as Mode)} options={[{ value: 'zone', label: 'Par zone' }, { value: 'team', label: 'Par prestataire' }]} />
          <MxSegmented aria-label="Échelle de la frise" value={scale} onChange={v => setScale(v as Scale)} options={[{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }]} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" ariaLabel={scale === 'week' ? 'Semaine précédente' : 'Jour précédent'} icon={<ChevronLeft size={14} />} onClick={() => goto(-1)} />
          <div className="w-44"><DateInput aria-label="Aller au jour" value={day} onChange={e => e.target.value && setDay(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" /></div>
          <Button size="sm" variant="outline" ariaLabel={scale === 'week' ? 'Semaine suivante' : 'Jour suivant'} icon={<ChevronRight size={14} />} onClick={() => goto(1)} />
          <Button size="sm" variant="outline" onClick={() => setDay(firstUsefulDay(site))}>Aujourd'hui</Button>
          {canCreate && <Button size="sm" variant="outline" icon={<Copy size={14} />} onClick={() => setCopying(true)}>Copier un jour</Button>}
        </div>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {canEdit ? `Glisse une intervention pour la déplacer (même d'une ligne à l'autre), tire ses bords pour changer sa durée, clique dans une zone vide pour en créer une. Pas de ${step} minutes. Au clavier : flèches pour déplacer, Maj + flèche pour la durée.` : 'Lecture seule : tu ne peux pas modifier ce planning.'}
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div style={{ minWidth: 640 }}>
          <div className="flex border-b border-gray-200 dark:border-gray-700" style={{ height: HEADER_H }}>
            <div className="shrink-0 border-r border-gray-200 dark:border-gray-700 px-3 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center" style={{ width: LABEL_W }}>
              {scale === 'week' ? `Semaine du ${formatDay(numberToDay(firstDay))}` : formatDay(day)}
            </div>
            <div ref={trackRef} className="relative flex-1" aria-hidden>
              {scale === 'week'
                ? Array.from({ length: 7 }, (_, c) => (
                  <div key={c} className="absolute top-0 bottom-0 flex items-center justify-center border-l border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300"
                    style={{ left: c * colW, width: colW }}>{dayLabel(firstDay + c)}</div>
                ))
                : ticks.map(m => (
                  <div key={m} className="absolute top-0 bottom-0 flex items-center border-l border-gray-200 dark:border-gray-700 pl-1 text-xs text-gray-600 dark:text-gray-400" style={{ left: (m - startMin) * ppm }}>{minutesToTime(m % MINUTES_PER_DAY)}</div>
                ))}
            </div>
          </div>

          {rows.map(row => {
            const rowItems = items.filter(i => rowKeyOf(i) === row.key);
            // Segments visibles de chaque intervention (une par jour affiché)
            const segments = rowItems.flatMap(i => {
              const a = toWallPoint(i.starts_at), b = toWallPoint(i.ends_at);
              const s = a.day * MINUTES_PER_DAY + a.minute, e = b.day * MINUTES_PER_DAY + b.minute;
              const out: { item: PlanIntervention; col: number; from: number; to: number; first: boolean; last: boolean }[] = [];
              for (let c = 0; c < columns; c++) {
                const base = (firstDay + c) * MINUTES_PER_DAY;
                const from = Math.max(s, base + startMin), to = Math.min(e, base + endMin);
                if (to > from) out.push({ item: i, col: c, from: from - base, to: to - base, first: s >= base + startMin, last: e <= base + endMin });
              }
              return out;
            });
            const { lanes, count } = assignLanes(segments.map(sg => ({ id: `${sg.item.id}:${sg.col}`, start: sg.col * MINUTES_PER_DAY + sg.from, end: sg.col * MINUTES_PER_DAY + sg.to })));
            const height = count * LANE_H + 8;
            const highlighted = dragView?.rowKey === row.key && dragView.kind === 'move';
            return (
              <div key={row.key} className="flex border-b border-gray-100 dark:border-gray-700/60 last:border-b-0" style={{ minHeight: height }}>
                <div className="shrink-0 border-r border-gray-200 dark:border-gray-700 px-3 py-2" style={{ width: LABEL_W }}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: row.color }} /><span className="truncate">{row.label}</span></p>
                  {row.sub && <p className="truncate text-xs text-gray-600 dark:text-gray-400">{row.sub}</p>}
                </div>
                <div data-row-key={row.key} role="group" aria-label={row.label} className={`relative flex-1 ${highlighted ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`} style={{ height }}
                  onClick={e => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.shade !== undefined) createAt(e, row.key); }}>
                  {Array.from({ length: columns }, (_, c) => {
                    const s = shade(firstDay + c);
                    return (
                      <div key={c} data-shade="" className="absolute top-0 bottom-0 border-l border-gray-100 dark:border-gray-700/60" title={s?.reason}
                        style={{ left: c * colW, width: colW, backgroundImage: s ? 'repeating-linear-gradient(45deg, rgba(148,163,184,.28) 0 6px, transparent 6px 12px)' : undefined }} />
                    );
                  })}
                  {segments.map(sg => {
                    const id = `${sg.item.id}:${sg.col}`;
                    const view = dragView?.id === sg.item.id ? dragView : null;
                    const delta = view?.deltaMin ?? 0;
                    const from = sg.from + (view && (view.kind === 'move' || view.kind === 'start') ? delta : 0);
                    const to = sg.to + (view && (view.kind === 'move' || view.kind === 'end') ? delta : 0);
                    const left = sg.col * colW + (Math.max(from, startMin) - startMin) * ppm;
                    const width = Math.max(10, (Math.min(to, endMin) - Math.max(from, startMin)) * ppm);
                    const w = toWallPoint(sg.item.starts_at), z = toWallPoint(sg.item.ends_at);
                    const time = `${minutesToTime(w.minute)}–${minutesToTime(z.minute)}`;
                    const lane = lanes.get(id) ?? 0;
                    const sub = mode === 'zone' ? teamLabel(sg.item.team_id) : (zones.find(zn => zn.id === sg.item.zone_id)?.name ?? '');
                    const warns = data.issues.filter(x => x.intervention_id === sg.item.id).map(issueText);
                    return (
                      <div key={id} role="button" tabIndex={0} aria-label={`${sg.item.title}, ${time}, ${sub}`} title={`${sg.item.title}\n${time} · ${sub}${warns.length ? `\n${warns.join('\n')}` : ''}`}
                        onPointerDown={e => onPointerDown(e, sg.item, 'move')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onKeyDown={e => onKeyDown(e, sg.item)}
                        className={`absolute select-none overflow-hidden rounded-md text-white shadow-sm ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${view ? 'z-20 opacity-90 ring-2 ring-white' : warns.length ? 'z-10 ring-2 ring-amber-400' : 'z-10'}`}
                        style={{ left, width, top: 4 + lane * LANE_H, height: BLOCK_H, background: colorOf(sg.item), transform: view && view.dy ? `translateY(${view.dy}px)` : undefined, touchAction: canEdit ? 'none' : undefined, transition: view ? 'none' : 'left .12s, width .12s' }}>
                        {canEdit && sg.first && <span aria-hidden data-handle="start" onPointerDown={e => onPointerDown(e, sg.item, 'start')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/20" />}
                        {width >= 54 && (
                          <div className="px-2.5 py-0.5 leading-tight pointer-events-none">
                            <p className="truncate text-xs font-semibold">{warns.length > 0 && <AlertTriangle size={11} aria-hidden className="mr-1 inline align-[-1px]" />}{sg.item.title}</p>
                            <p className="truncate text-[11px] opacity-90">{time} · {sub}</p>
                          </div>
                        )}
                        {canEdit && sg.last && <span aria-hidden data-handle="end" onPointerDown={e => onPointerDown(e, sg.item, 'end')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/20" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <InterventionForm site={site} data={data} target={target} onClose={() => setTarget(null)} onSaved={onChanged} teamLabel={teamLabel} />
      <CopyDayModal site={site} data={data} open={copying} defaultDay={day} onClose={() => setCopying(false)} onDone={onChanged} />
    </div>
  );
};

export default Timeline;
