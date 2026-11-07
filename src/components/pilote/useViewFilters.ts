import { useState } from 'react';
import toast from 'react-hot-toast';
import { confirmAction, promptAction } from '../../lib/confirm';
import { NO_FILTERS, parseSavedViews, SAVED_VIEWS_KEY, type GanttFilters, type SavedView } from '../../lib/ganttFilters';
import type { Grouping } from '../../lib/ganttModel';

// Recherche, filtres et vues enregistrées, communs au Gantt, au Tableau et au Calendrier (mêmes vues sur cet appareil).
// Le regroupement n'a de sens que pour le Gantt : les autres vues passent « grouping » et « setGrouping » vides et enregistrent « état » par défaut.
export function useViewFilters(grouping: Grouping = 'status', setGrouping?: (g: Grouping) => void) {
  const [filters, setFilters] = useState<GanttFilters>(NO_FILTERS);
  const [views, setViews] = useState<SavedView[]>(() => { try { return parseSavedViews(localStorage.getItem(SAVED_VIEWS_KEY)); } catch { return []; } });

  const store = (next: SavedView[]) => {
    setViews(next);
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch { toast.error('Impossible d\'enregistrer la vue sur cet appareil'); }
  };
  const saveView = async () => {
    const name = (await promptAction('Nom de la vue', ''))?.trim();
    if (!name) return;
    if (views.some(v => v.name.toLowerCase() === name.toLowerCase()) && !(await confirmAction(`Remplacer la vue « ${name} » ?`))) return;
    store([...views.filter(v => v.name.toLowerCase() !== name.toLowerCase()), { id: crypto.randomUUID(), name, filters, grouping }]);
    toast.success('Vue enregistrée');
  };
  const deleteView = async (v: SavedView) => {
    if (!(await confirmAction(`Supprimer la vue « ${v.name} » ?`))) return;
    store(views.filter(x => x.id !== v.id));
  };
  const applyView = (v: SavedView) => { setGrouping?.(v.grouping); setFilters(v.filters); };

  return { filters, setFilters, views, saveView, deleteView, applyView };
}
