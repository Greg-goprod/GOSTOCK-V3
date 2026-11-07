import React, { useState } from 'react';
import { AlertTriangle, BookmarkPlus, ChevronDown, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import MenuButton from '../common/MenuButton';
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

// Barre de recherche et de filtres du Gantt : un champ de recherche, un menu « Filtres », le raccourci « En retard » et les vues enregistrées
const GanttFilterBar: React.FC<Props> = ({ filters, onChange, people, overdueCount, views, onApplyView, onSaveView, onDeleteView }) => {
  const set = (patch: Partial<GanttFilters>) => onChange({ ...filters, ...patch });
  // Téléphone : la recherche reste visible, les filtres se déplient à la demande (sur grand écran, tout est toujours visible)
  const [expanded, setExpanded] = useState(false);
  const active = filterCount(filters) - (filters.query.trim() !== '' ? 1 : 0);
  const pick = <T extends string>(current: T | null, all: string, values: { id: T; label: string }[], apply: (v: T | null) => void) => [
    { id: 'all', label: all, checked: current === null, onSelect: () => apply(null) },
    ...values.map(v => ({ id: v.id, label: v.label, checked: current === v.id, onSelect: () => apply(v.id) })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Rechercher et filtrer le Gantt">
      <label className="relative">
        <span className="sr-only">Rechercher dans le Gantt</span>
        <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="search" value={filters.query} onChange={e => set({ query: e.target.value })} placeholder="Rechercher"
          className="min-h-[44px] w-44 rounded-md border border-gray-300 bg-white py-1 pl-8 pr-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 lg:min-h-[28px]" />
      </label>

      <button type="button" aria-expanded={expanded} aria-controls="gantt-filter-panel" onClick={() => setExpanded(v => !v)}
        className="mx-btn mx-btn-secondary flex min-h-[44px] items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[length:calc(12.5px*var(--mx-scale,1))] sm:hidden">
        <SlidersHorizontal size={14} aria-hidden />
        {active > 0 ? `Filtres (${active})` : 'Filtres'}
        <ChevronDown size={14} aria-hidden className={expanded ? 'rotate-180' : ''} />
      </button>
      <div id="gantt-filter-panel" className={`${expanded ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 sm:contents`}>
      <MenuButton id="gantt-person" menuLabel="Personne" prefix="Personne :" value={people.find(p => p.id === filters.userId)?.name ?? 'Toutes'}
        groups={[{ id: 'person', items: pick<string>(filters.userId, 'Toutes', people.map(p => ({ id: p.id, label: p.name })), v => set({ userId: v })) }]} />
      <MenuButton id="gantt-family" menuLabel="État" prefix="État :" value={filters.family ? FAMILY_LABEL[filters.family] : 'Tous'}
        groups={[{ id: 'family', items: pick<StatusFamily>(filters.family, 'Tous', FAMILY_ORDER.map(f => ({ id: f, label: FAMILY_LABEL[f] })), v => set({ family: v })) }]} />
      <MenuButton id="gantt-priority" menuLabel="Priorité" prefix="Priorité :" value={filters.priority ? PRIORITY_LABEL[filters.priority] : 'Toutes'}
        groups={[{ id: 'priority', items: pick<ProjectPriority>(filters.priority, 'Toutes', PRIORITIES.map(p => ({ id: p, label: PRIORITY_LABEL[p] })), v => set({ priority: v })) }]} />
      <MenuButton id="gantt-type" menuLabel="Type de projet" prefix="Type :" value={filters.type ? TYPE_LABEL[filters.type] : 'Tous'}
        groups={[{ id: 'type', items: pick<ProjectType>(filters.type, 'Tous', TYPE_ORDER.map(t => ({ id: t, label: TYPE_LABEL[t] })), v => set({ type: v })) }]} />

      <button type="button" aria-pressed={filters.overdueOnly} onClick={() => set({ overdueOnly: !filters.overdueOnly })}
        className={`mx-btn mx-btn-secondary flex min-h-[44px] items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[length:calc(12.5px*var(--mx-scale,1))] lg:min-h-[28px] ${filters.overdueOnly ? 'ring-2 ring-danger-500' : ''}`}>
        <AlertTriangle size={14} aria-hidden className={overdueCount > 0 ? 'text-danger-600' : undefined} />
        {`En retard (${overdueCount})`}
      </button>

      <MenuButton id="gantt-views" menuLabel="Vues enregistrées" value={views.length > 0 ? `Vues (${views.length})` : 'Vues'}
        header={<p className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">Enregistrées sur cet appareil</p>}
        groups={views.length > 0 ? [{ id: 'views', label: 'Appliquer', items: views.map(v => ({ id: v.id, label: v.name, onSelect: () => onApplyView(v) })) }] : []}
        actions={[
          { id: 'save', label: 'Enregistrer la vue actuelle…', icon: BookmarkPlus, onSelect: onSaveView },
          ...views.map(v => ({ id: `del-${v.id}`, label: `Supprimer « ${v.name} »`, icon: Trash2, tone: 'danger' as const, onSelect: () => onDeleteView(v) })),
        ]} />

      </div>

      {hasFilters(filters) && (
        <button type="button" onClick={() => onChange(NO_FILTERS)} className="text-sm font-medium text-primary-700 underline dark:text-primary-300">Tout afficher</button>
      )}
    </div>
  );
};

export default GanttFilterBar;
