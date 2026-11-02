import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { dayFromNumber, dayNumberOf } from '../../lib/ganttModel';
import { clipBar, isWeekend, makeHeader, makeScale, progressOf, weekendBoxes, xOfDay, type GanttRow } from '../../lib/ganttModel';
import { formatDay } from '../../lib/zurichTime';
import { allowedKinds, ITEM_KIND_LABEL, type ItemKind } from '../../lib/pilote';

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
  // Gestes (réservés à qui a le droit de modifier) : déplacer l'élément et ce qu'il contient, ou changer ses dates propres
  canEdit: boolean;
  onMove: (row: GanttRow, days: number) => Promise<void>;
  onResize: (row: GanttRow, start: string, end: string) => Promise<void>;
  // Création directe dans la liste (ligne « + Nouveau »)
  onCreate: (row: GanttRow, name: string, kind: ItemKind) => Promise<boolean>;
}

const BAR_H: Record<GanttRow['kind'], number> = { group: 8, program: 10, project: 22, phase: 18, task: 20, subtask: 14, milestone: 14, add: 0 };
const kindLabel = (r: GanttRow) => (r.kind === 'add' ? 'Nouveau' : r.kind === 'group' ? 'Groupe' : r.kind === 'program' ? 'Programme' : r.kind === 'project' ? 'Projet' : ITEM_KIND_LABEL[r.kind as ItemKind]);
const canAddTo = (r: GanttRow) => r.kind === 'project' || r.kind === 'phase' || r.kind === 'task';

// Diagramme de Gantt : liste en arbre à gauche (fixe), barres à droite. Une seule zone de défilement pour que la liste et les barres restent alignées.
// Ce qu'un geste peut faire d'une ligne : tout se déplace (avec son contenu) ; seules les barres à dates propres complètes se redimensionnent
const movable = (r: GanttRow) => (['project', 'phase', 'task', 'subtask', 'milestone'] as string[]).includes(r.kind) && !!r.start && !!r.end;
const resizable = (r: GanttRow) => (['project', 'phase', 'task', 'subtask'] as string[]).includes(r.kind) && !!r.ownStart && !!r.ownEnd;
const addKinds = (r: GanttRow): ItemKind[] => (r.addTo === 'project' ? allowedKinds(null).filter(k => k !== 'subtask') : r.addTo === 'phase' ? allowedKinds('phase') : allowedKinds('task'));

interface DragState { key: string; kind: 'move' | 'start' | 'end'; startX: number; moved: boolean; row: GanttRow; descendants: Set<string> }
interface DragView { key: string; kind: 'move' | 'start' | 'end'; days: number; descendants: Set<string> }

// Ligne « + Nouveau » de la liste : un clic ouvre une saisie (nom + type), Entrée crée et garde la saisie ouverte pour enchaîner
const InlineAdd: React.FC<{ row: GanttRow; onCreate: Props['onCreate'] }> = ({ row, onCreate }) => {
  const kinds = addKinds(row);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ItemKind>(kinds[0]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const submit = async () => {
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    const ok = await onCreate(row, value, kind);
    setBusy(false);
    if (ok) { setName(''); setTimeout(() => input.current?.focus(), 0); }
  };
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="flex h-6 items-center gap-1 rounded px-1.5 text-[12px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"><Plus size={13} aria-hidden />Nouveau</button>;
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input ref={input} aria-label="Nom du nouvel élément" value={name} onChange={e => setName(e.target.value)} disabled={busy} placeholder="Nom, puis Entrée"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } else if (e.key === 'Escape') { setOpen(false); setName(''); } }}
        className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[12px] text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
      {kinds.length > 1 && (
        <select aria-label="Type du nouvel élément" value={kind} onChange={e => setKind(e.target.value as ItemKind)} disabled={busy}
          className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[12px] text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
          {kinds.map(k => <option key={k} value={k}>{ITEM_KIND_LABEL[k]}</option>)}
        </select>
      )}
    </div>
  );
};

const GanttChart: React.FC<Props> = ({ rows, period, today, locale, expanded, canCreate, onToggle, onOpen, onAdd, canEdit, onMove, onResize, onCreate }) => {
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

  // Glisser : la barre suit la souris au jour près ; on envoie la modification au relâchement (et la barre reste en place le temps de l'enregistrement)
  const dragRef = useRef<DragState | null>(null);
  const [dragView, setDragView] = useState<DragView | null>(null);
  const descendantsOf = (key: string): Set<string> => {
    const out = new Set<string>();
    for (const r of rows) { if (r.parentKey && (r.parentKey === key || out.has(r.parentKey))) out.add(r.key); }
    return out;
  };
  const press = (e: React.PointerEvent, row: GanttRow, kind: DragState['kind']) => {
    if (!canEdit || e.button !== 0 || !movable(row) || (kind !== 'move' && !resizable(row))) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { key: row.key, kind, startX: e.clientX, moved: false, row, descendants: kind === 'move' ? descendantsOf(row.key) : new Set() };
  };
  const daysFor = (e: React.PointerEvent, d: DragState) => {
    const raw = Math.round((e.clientX - d.startX) / scale.px);
    if (d.kind === 'start' && d.row.ownStart && d.row.ownEnd) return Math.min(raw, dayNumberOf(d.row.ownEnd) - dayNumberOf(d.row.ownStart));
    if (d.kind === 'end' && d.row.ownStart && d.row.ownEnd) return Math.max(raw, dayNumberOf(d.row.ownStart) - dayNumberOf(d.row.ownEnd));
    return raw;
  };
  const dragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    d.moved = true;
    setDragView({ key: d.key, kind: d.kind, days: daysFor(e, d), descendants: d.descendants });
  };
  const dragEnd = async (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) { setDragView(null); onOpen(d.row); return; }
    const days = daysFor(e, d);
    if (days === 0) { setDragView(null); return; }
    setDragView({ key: d.key, kind: d.kind, days, descendants: d.descendants });
    try {
      if (d.kind === 'move') await onMove(d.row, days);
      else if (d.row.ownStart && d.row.ownEnd) {
        await onResize(d.row, d.kind === 'start' ? dayFromNumber(dayNumberOf(d.row.ownStart) + days) : d.row.ownStart, d.kind === 'end' ? dayFromNumber(dayNumberOf(d.row.ownEnd) + days) : d.row.ownEnd);
      }
    } finally { setDragView(null); }
  };
  // Clavier : flèches gauche/droite = déplacer d'un jour (avec le contenu) ; Maj + flèche = changer la fin d'un jour ; Entrée = ouvrir la fiche
  const keys = (e: React.KeyboardEvent, row: GanttRow) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(row); return; }
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir || !canEdit || !movable(row)) return;
    e.preventDefault();
    if (e.shiftKey) {
      if (resizable(row) && row.ownStart && row.ownEnd) {
        const end = dayFromNumber(dayNumberOf(row.ownEnd) + dir);
        if (end >= row.ownStart) void onResize(row, row.ownStart, end);
      }
    } else void onMove(row, dir);
  };

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
            const clickable = r.kind !== 'group' && r.kind !== 'program' && r.kind !== 'add';
            if (r.kind === 'add') {
              return (
                <div key={r.key} className="flex items-center border-b border-gray-100 dark:border-gray-700/60 pr-2" style={{ height: ROW_H, paddingLeft: 6 + r.level * 16 + 30 }}>
                  <InlineAdd row={r} onCreate={onCreate} />
                </div>
              );
            }
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
            if (r.kind === 'add' || !r.start || !r.end) return null;
            const top = i * ROW_H;
            const h = BAR_H[r.kind];
            const clipped = clipBar(scale, r.start, r.end);
            if (!clipped) return null;
            let { left, width: barW } = clipped;
            // Aperçu du geste en cours : la barre (et ce qu'elle contient) suit la souris
            const view = dragView && (dragView.key === r.key || dragView.descendants.has(r.key)) ? dragView : null;
            if (view) {
              const dx = view.days * scale.px;
              if (view.kind === 'move' || (view.kind === 'start' && view.key === r.key)) left += dx;
              if (view.kind === 'start' && view.key === r.key) barW = Math.max(scale.px, barW - dx);
              if (view.kind === 'end' && view.key === r.key) barW = Math.max(scale.px, barW + dx);
            }
            const pct = progressOf(r);
            const title = `${kindLabel(r)} · ${r.name} · ${datesOf(r)}${pct === null ? '' : ` · ${Math.round(pct * 100)} %`}`;
            const clickable = r.kind !== 'group' && r.kind !== 'program';
            const draggable = canEdit && movable(r);
            const common = { 'aria-label': title, title, role: clickable ? 'button' : undefined, tabIndex: clickable ? 0 : undefined } as const;
            // Sans droit de modification : un simple clic ouvre la fiche ; avec le droit, c'est le relâchement du geste qui ouvre (clic sans mouvement) ou déplace
            const handle = clickable
              ? (draggable
                ? { onPointerDown: (e: React.PointerEvent) => press(e, r, 'move'), onPointerMove: dragMove, onPointerUp: (e: React.PointerEvent) => void dragEnd(e), onKeyDown: (e: React.KeyboardEvent) => keys(e, r) }
                : { onClick: () => onOpen(r), onKeyDown: (e: React.KeyboardEvent) => keys(e, r) })
              : {};
            if (r.kind === 'milestone') {
              if (clipped.clippedLeft || clipped.clippedRight) return null;
              const cx = left + barW / 2;
              return (
                <div key={r.key} className={`absolute flex items-center ${view ? 'z-[8]' : 'z-[6]'}`} style={{ left: cx - 8, top: top + (ROW_H - 16) / 2, height: 16 }}>
                  <div {...common} {...handle} className={`h-3.5 w-3.5 shrink-0 rotate-45 ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} rounded-[2px] outline-offset-2 focus-visible:outline focus-visible:outline-2`} style={{ background: r.color, marginLeft: 1, marginRight: 8, opacity: r.family === 'done' ? 0.55 : 1, touchAction: draggable ? 'none' : undefined }} />
                  <span className="whitespace-nowrap text-[11px] text-gray-700 dark:text-gray-300">{r.name}</span>
                </div>
              );
            }
            const summary = r.kind === 'group' || r.kind === 'program';
            return (
              <div key={r.key} className={`absolute flex items-center ${view ? 'z-[8]' : 'z-[6]'}`} style={{ left, top: top + (ROW_H - h) / 2, height: h }}>
                <div {...common} {...handle}
                  className={`group/bar relative select-none overflow-hidden ${draggable ? 'cursor-grab active:cursor-grabbing' : clickable ? 'cursor-pointer' : ''} ${clickable ? 'outline-offset-2 focus-visible:outline focus-visible:outline-2' : ''} ${view ? 'ring-2 ring-white/70 shadow-md' : ''}`}
                  style={{ touchAction: draggable ? 'none' : undefined, width: barW, height: h, background: `${r.color}${summary ? '66' : '40'}`, border: `1px solid ${r.color}`, opacity: r.family === 'cancelled' ? 0.45 : 1, borderRadius: `${clipped.clippedLeft ? 0 : 6}px ${clipped.clippedRight ? 0 : 6}px ${clipped.clippedRight ? 0 : 6}px ${clipped.clippedLeft ? 0 : 6}px` }}>
                  {pct !== null && !summary && <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${Math.round(pct * 100)}%`, background: r.color, opacity: 0.6 }} />}
                  {summary && pct !== null && <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${Math.round(pct * 100)}%`, background: r.color }} />}
                  {!summary && barW >= 90 && <span className="pointer-events-none relative z-[1] block truncate px-1.5 text-[11px] font-medium leading-[inherit] text-gray-900 dark:text-white" style={{ lineHeight: `${h - 2}px` }}>{r.name}</span>}
                  {draggable && resizable(r) && !clipped.clippedLeft && (
                    <span aria-hidden data-handle="start" onPointerDown={e => press(e, r, 'start')} onPointerMove={dragMove} onPointerUp={e => void dragEnd(e)} className="absolute inset-y-0 left-0 z-[2] w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20" style={{ touchAction: 'none' }} />
                  )}
                  {draggable && resizable(r) && !clipped.clippedRight && (
                    <span aria-hidden data-handle="end" onPointerDown={e => press(e, r, 'end')} onPointerMove={dragMove} onPointerUp={e => void dragEnd(e)} className="absolute inset-y-0 right-0 z-[2] w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20" style={{ touchAction: 'none' }} />
                  )}
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
