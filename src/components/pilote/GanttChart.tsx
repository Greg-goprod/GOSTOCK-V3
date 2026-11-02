import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { clipBar, isWeekend, makeHeader, makeScale, progressOf, weekendBoxes, xOfDay, type GanttRow } from '../../lib/ganttModel';
import { formatDay } from '../../lib/zurichTime';
import { ITEM_KIND_LABEL, type ItemKind } from '../../lib/pilote';

export const ROW_H = 36;
const NAME_W_WIDE = 300;
const NAME_W_NARROW = 150;
const HEAD_H = 24;

interface Props {
  rows: GanttRow[];
  period: { start: string; end: string };
  today: string;
  locale: string;
  expanded: ReadonlySet<string>;
  canCreate: boolean;
  onToggle: (key: string) => void;
  onOpen: (row: GanttRow) => void;
  onAdd: (row: GanttRow) => void;
}

const BAR_H: Record<GanttRow['kind'], number> = { group: 8, program: 10, project: 22, phase: 18, task: 20, subtask: 14, milestone: 14 };
const kindLabel = (r: GanttRow) => (r.kind === 'group' ? 'Groupe' : r.kind === 'program' ? 'Programme' : r.kind === 'project' ? 'Projet' : ITEM_KIND_LABEL[r.kind as ItemKind]);
const canAddTo = (r: GanttRow) => r.kind === 'project' || r.kind === 'phase' || r.kind === 'task';

// Diagramme de Gantt : liste en arbre à gauche (fixe), barres à droite. Une seule zone de défilement pour que la liste et les barres restent alignées.
const GanttChart: React.FC<Props> = ({ rows, period, today, locale, expanded, canCreate, onToggle, onOpen, onAdd }) => {
  const box = useRef<HTMLDivElement>(null);
  // Colonne des noms plus étroite sur téléphone, pour laisser de la place aux barres
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(q.matches);
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  const NAME_W = narrow ? NAME_W_NARROW : NAME_W_WIDE;
  // La période affichée tient dans la largeur : on mesure la zone, un jour = largeur disponible / nombre de jours
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scale = useMemo(() => makeScale(period, Math.max(width - NAME_W - 2, 120)), [period, width, NAME_W]);
  const header = useMemo(() => makeHeader(scale, locale), [scale, locale]);
  const weekends = useMemo(() => weekendBoxes(scale), [scale]);
  const totalW = scale.days * scale.px;
  const bodyH = rows.length * ROW_H;
  const todayInside = today >= period.start && today <= period.end;
  const todayX = xOfDay(scale, today) + scale.px / 2;

  const datesOf = (r: GanttRow) => (r.start && r.end ? (r.start === r.end ? formatDay(r.start) : `${formatDay(r.start)} → ${formatDay(r.end)}`) : 'Sans date');

  return (
    <div ref={box} className="relative overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" style={{ maxHeight: 'calc(100vh - 300px)', minHeight: 220 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `${NAME_W}px ${totalW}px`, width: NAME_W + totalW }}>
        {/* En-tête : coin fixe + deux étages de dates */}
        <div className="sticky left-0 top-0 z-30 flex items-end border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 pb-1 text-xs font-semibold uppercase text-gray-600 dark:text-gray-400" style={{ height: HEAD_H * 2 }}>Nom</div>
        <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" style={{ height: HEAD_H * 2 }}>
          <div className="relative" style={{ height: HEAD_H }}>
            {header.top.map((c, i) => (
              <div key={i} className="absolute top-0 flex items-center overflow-hidden whitespace-nowrap border-l border-gray-200 dark:border-gray-700 px-2 text-xs font-semibold capitalize text-gray-700 dark:text-gray-300" style={{ left: c.left, width: c.width, height: HEAD_H }}>{c.label}</div>
            ))}
          </div>
          <div className="relative" style={{ height: HEAD_H }}>
            {header.bottom.map((c, i) => {
              const n = scale.startDay + Math.round(c.left / scale.px);
              return (
                <div key={i} className={`absolute top-0 flex items-center justify-center overflow-hidden whitespace-nowrap border-l border-gray-100 dark:border-gray-800 text-[11px] ${scale.px >= 14 && isWeekend(n) ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`} style={{ left: c.left, width: c.width, height: HEAD_H }}>{c.width >= 14 ? c.label : ''}</div>
              );
            })}
          </div>
        </div>

        {/* Liste en arbre */}
        <div className="sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" style={{ height: bodyH }}>
          {rows.map(r => {
            const isOpen = expanded.has(r.key);
            const clickable = r.kind !== 'group' && r.kind !== 'program';
            return (
              <div key={r.key} className="group/row flex items-center border-b border-gray-100 dark:border-gray-700/60 pr-2 hover:bg-gray-50 dark:hover:bg-gray-700/40" style={{ height: ROW_H, paddingLeft: 6 + r.level * 16 }}>
                {r.hasChildren ? (
                  <button type="button" onClick={() => onToggle(r.key)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Replier' : 'Déplier'} ${r.name}`} className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600">
                    {isOpen ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
                  </button>
                ) : <span className="mr-1 inline-block h-6 w-6 shrink-0" />}
                <span aria-hidden className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <button type="button" onClick={() => (clickable ? onOpen(r) : onToggle(r.key))} title={`${kindLabel(r)} · ${r.name}`}
                  className={`min-w-0 flex-1 truncate text-left text-[13px] ${r.kind === 'group' || r.kind === 'program' ? 'font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200' : r.kind === 'project' ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                  {r.name}
                </button>
                {r.start === null && clickable && <span className="ml-1 shrink-0 rounded bg-gray-100 dark:bg-gray-700 px-1.5 text-[10px] text-gray-600 dark:text-gray-300">Sans date</span>}
                {canCreate && canAddTo(r) && (
                  <button type="button" onClick={() => onAdd(r)} aria-label={`Ajouter dans ${r.name}`} title="Ajouter" className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 opacity-0 hover:bg-gray-200 focus:opacity-100 group-hover/row:opacity-100 dark:hover:bg-gray-600">
                    <Plus size={14} aria-hidden />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Barres */}
        <div className="relative" style={{ height: bodyH, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_H - 1}px, rgba(148,163,184,.25) ${ROW_H - 1}px, rgba(148,163,184,.25) ${ROW_H}px)` }}>
          {weekends.map((w, i) => <div key={i} aria-hidden className="absolute top-0 bg-gray-500/5 dark:bg-white/5" style={{ left: w.left, width: w.width, height: bodyH }} />)}
          {todayInside && <div aria-hidden className="absolute top-0 z-[5] w-px bg-danger-500" style={{ left: todayX, height: bodyH }} />}
          {rows.map((r, i) => {
            if (!r.start || !r.end) return null;
            const top = i * ROW_H;
            const h = BAR_H[r.kind];
            const clipped = clipBar(scale, r.start, r.end);
            if (!clipped) return null;
            const { left, width: barW } = clipped;
            const pct = progressOf(r);
            const title = `${kindLabel(r)} · ${r.name} · ${datesOf(r)}${pct === null ? '' : ` · ${Math.round(pct * 100)} %`}`;
            const clickable = r.kind !== 'group' && r.kind !== 'program';
            const common = { 'aria-label': title, title, role: clickable ? 'button' : undefined, tabIndex: clickable ? 0 : undefined } as const;
            const handle = clickable ? { onClick: () => onOpen(r), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(r); } } } : {};
            if (r.kind === 'milestone') {
              if (clipped.clippedLeft || clipped.clippedRight) return null;
              const cx = left + barW / 2;
              return (
                <div key={r.key} className="absolute z-[6] flex items-center" style={{ left: cx - 8, top: top + (ROW_H - 16) / 2, height: 16 }}>
                  <div {...common} {...handle} className="h-3.5 w-3.5 shrink-0 rotate-45 cursor-pointer rounded-[2px] outline-offset-2 focus-visible:outline focus-visible:outline-2" style={{ background: r.color, marginLeft: 1, marginRight: 8, opacity: r.family === 'done' ? 0.55 : 1 }} />
                  <span className="whitespace-nowrap text-[11px] text-gray-700 dark:text-gray-300">{r.name}</span>
                </div>
              );
            }
            const summary = r.kind === 'group' || r.kind === 'program';
            return (
              <div key={r.key} className="absolute z-[6] flex items-center" style={{ left, top: top + (ROW_H - h) / 2, height: h }}>
                <div {...common} {...handle}
                  className={`relative overflow-hidden ${clickable ? 'cursor-pointer outline-offset-2 focus-visible:outline focus-visible:outline-2' : ''}`}
                  style={{ width: barW, height: h, background: `${r.color}${summary ? '66' : '40'}`, border: `1px solid ${r.color}`, opacity: r.family === 'cancelled' ? 0.45 : 1, borderRadius: `${clipped.clippedLeft ? 0 : 6}px ${clipped.clippedRight ? 0 : 6}px ${clipped.clippedRight ? 0 : 6}px ${clipped.clippedLeft ? 0 : 6}px` }}>
                  {pct !== null && !summary && <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${Math.round(pct * 100)}%`, background: r.color, opacity: 0.6 }} />}
                  {summary && pct !== null && <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${Math.round(pct * 100)}%`, background: r.color }} />}
                  {!summary && barW >= 90 && <span className="relative z-[1] block truncate px-1.5 text-[11px] font-medium leading-[inherit] text-gray-900 dark:text-white" style={{ lineHeight: `${h - 2}px` }}>{r.name}</span>}
                </div>
                {!summary && barW < 90 && !clipped.clippedRight && <span className="ml-1.5 whitespace-nowrap text-[11px] text-gray-700 dark:text-gray-300">{r.name}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
