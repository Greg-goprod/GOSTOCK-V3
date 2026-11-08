import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, BookmarkPlus, ChevronDown, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { filterCount, hasFilters, NO_FILTERS, type GanttFilters, type SavedView } from '../../lib/ganttFilters';
import { FAMILY_LABEL, FAMILY_ORDER, PRIORITY_LABEL, TYPE_LABEL, TYPE_ORDER, type ProjectPriority, type ProjectType, type StatusFamily } from '../../lib/pilote';

interface Props {
  filters: GanttFilters;
  onChange: (f: GanttFilters) => void;
  people: { id: string; name: string }[];
  overdueCount: number;
  views: SavedView[];
  onApplyView: (v: SavedView) => void;
  onSaveView: () => void;
  onDeleteView: (v: SavedView) => void;
}

const PRIORITIES: ProjectPriority[] = ['high', 'medium', 'low'];
const selectClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const labelClass = 'block text-xs font-semibold text-gray-700 dark:text-gray-300';

// Recherche et filtres du Gantt, du Tableau et du Calendrier, en deux éléments de la barre d'outils : un champ de recherche et UN bouton « Filtres »
// qui ouvre un panneau (personne, état, priorité, type, « en retard », vues enregistrées). Le nombre de filtres actifs se lit sur le bouton.
const GanttFilterBar: React.FC<Props> = ({ filters, onChange, people, overdueCount, views, onApplyView, onSaveView, onDeleteView }) => {
  const set = (patch: Partial<GanttFilters>) => onChange({ ...filters, ...patch });
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const box = useRef<HTMLDivElement>(null);
  const active = filterCount(filters) - (filters.query.trim() !== '' ? 1 : 0);

  // Le panneau se ferme d'un clic à côté ou d'Échap (Échap ne ferme que lui : pas la fiche ouverte derrière)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const pickOf = <T extends string>(value: T | null, apply: (v: T | null) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => apply(e.target.value === '' ? null : e.target.value as T);

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Rechercher et filtrer">
      <label className="relative">
        <span className="sr-only">Rechercher</span>
        <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="search" value={filters.query} onChange={e => set({ query: e.target.value })} placeholder="Rechercher"
          className="min-h-[44px] w-40 rounded-md border border-gray-300 bg-white py-1 pl-8 pr-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 lg:min-h-[28px] lg:w-28 2xl:w-44" />
      </label>

      <div ref={box} className="sm:relative">
        <button type="button" aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog" onClick={() => setOpen(v => !v)}
          className={`mx-btn mx-btn-secondary flex min-h-[44px] items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[length:calc(12.5px*var(--mx-scale,1))] lg:min-h-[28px] ${active > 0 ? 'ring-2 ring-primary-400' : ''}`}>
          <SlidersHorizontal size={14} aria-hidden />
          {active > 0 ? `Filtres (${active})` : 'Filtres'}
          <ChevronDown size={14} aria-hidden className={open ? 'rotate-180' : ''} />
        </button>
        {open && (
          <div id={panelId} role="dialog" aria-label="Filtres" data-filter-panel
            className="absolute inset-x-0 top-full z-50 mt-1 space-y-3 rounded-lg sm:inset-x-auto sm:left-0 sm:w-[21rem] border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>Personne
                <select className={selectClass} value={filters.userId ?? ''} onChange={pickOf<string>(filters.userId, v => set({ userId: v }))}>
                  <option value="">Toutes</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className={labelClass}>État
                <select className={selectClass} value={filters.family ?? ''} onChange={pickOf<StatusFamily>(filters.family, v => set({ family: v }))}>
                  <option value="">Tous</option>
                  {FAMILY_ORDER.map(f => <option key={f} value={f}>{FAMILY_LABEL[f]}</option>)}
                </select>
              </label>
              <label className={labelClass}>Priorité
                <select className={selectClass} value={filters.priority ?? ''} onChange={pickOf<ProjectPriority>(filters.priority, v => set({ priority: v }))}>
                  <option value="">Toutes</option>
                  {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </label>
              <label className={labelClass}>Type de projet
                <select className={selectClass} value={filters.type ?? ''} onChange={pickOf<ProjectType>(filters.type, v => set({ type: v }))}>
                  <option value="">Tous</option>
                  {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={filters.overdueOnly} onChange={e => set({ overdueOnly: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
              <AlertTriangle size={14} aria-hidden className={overdueCount > 0 ? 'text-danger-600' : 'text-gray-500'} />
              {`En retard seulement (${overdueCount})`}
            </label>

            <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
              <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Vues enregistrées <span className="font-normal text-gray-500">(sur cet appareil)</span></p>
              {views.length === 0 ? (
                <p className="text-xs text-gray-600 dark:text-gray-400">Aucune pour l'instant.</p>
              ) : (
                <ul className="space-y-0.5">
                  {views.map(v => (
                    <li key={v.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => { onApplyView(v); setOpen(false); }} className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700">{v.name}</button>
                      <button type="button" aria-label={`Supprimer « ${v.name} »`} onClick={() => onDeleteView(v)} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-danger-600 dark:hover:bg-gray-700"><Trash2 size={13} aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => { onSaveView(); setOpen(false); }} className="mt-1 inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-gray-700">
                <BookmarkPlus size={14} aria-hidden /> Enregistrer la vue actuelle…
              </button>
            </div>

          </div>
        )}
      </div>

      {hasFilters(filters) && (
        <button type="button" onClick={() => onChange(NO_FILTERS)} className="whitespace-nowrap text-sm font-medium text-primary-700 underline dark:text-primary-300">Tout afficher</button>
      )}

      {/* Raccourci visible seulement quand il y a quelque chose de en retard (ou que le filtre est actif) : un coup d'œil, un clic */}
      {(overdueCount > 0 || filters.overdueOnly) && (
        <button type="button" aria-pressed={filters.overdueOnly} onClick={() => set({ overdueOnly: !filters.overdueOnly })}
          className={`mx-btn mx-btn-secondary flex min-h-[44px] items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[length:calc(12.5px*var(--mx-scale,1))] lg:min-h-[28px] ${filters.overdueOnly ? 'ring-2 ring-danger-500' : ''}`}>
          <AlertTriangle size={14} aria-hidden className="text-danger-600" />
          {`En retard (${overdueCount})`}
        </button>
      )}
    </div>
  );
};

export default GanttFilterBar;
