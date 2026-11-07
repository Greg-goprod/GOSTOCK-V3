/* eslint-disable @typescript-eslint/no-explicit-any */
// Contrôles des filtres du Gantt (sans affichage). Lancer :
//   npx esbuild scripts/tests/gantt-filters.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/gantt-filters.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/gantt-filters.test.cjs
import { filterGantt, filterCount, hasFilters, isOverdue, NO_FILTERS, parseSavedViews, type GanttFilters } from '../../src/lib/ganttFilters';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

const ST = [
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
  { id: 's1', name: 'En cours', family: 'in_progress', color: '#39f', position: 1, is_system: true },
  { id: 's2', name: 'Terminé', family: 'done', color: '#0a0', position: 2, is_system: true },
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
] as const;
const TODAY = '2027-06-10';
const item = (id: string, project_id: string, parent_id: string | null, kind: any, name: string, status_id: string, starts_on: string | null, ends_on: string | null, priority: any = null) =>
  ({ id, project_id, parent_id, kind, name, description: null, status_id, priority, starts_on, ends_on, position: 0 });
const proj = (id: string, type: any, name: string, status_id: string, ends_on: string | null = null) =>
  ({ id, site_id: null, type, name, description: null, status_id, priority: null, color: '#0ea5e9', starts_on: null, ends_on, link_mode: 'overlap', link_skip_weekends: true });

const data: GanttData = {
  statuses: ST as any, sites: [],
  projects: [proj('p1', 'site', 'Festival Été', 's1'), proj('p2', 'rd', 'Prototype', 's1', '2027-05-01'), proj('p3', 'admin', 'Archives', 's2', '2027-01-01')],
  members: [{ project_id: 'p1', user_id: 'u1', role: 'lead' }, { project_id: 'p2', user_id: 'u2', role: 'member' }],
  items: [
    item('a', 'p1', null, 'phase', 'Montage', 's1', null, null),
    item('b', 'p1', 'a', 'task', 'Structures', 's2', '2027-06-01', '2027-06-05', 'high'),
    item('c', 'p1', 'a', 'task', 'Éclairage', 's1', '2027-06-04', '2027-06-08', 'high'),     // en retard (fin < aujourd'hui, en cours)
    item('d', 'p1', 'c', 'subtask', 'Câblage', 's1', '2027-06-04', '2027-06-06'),            // en retard
    item('e', 'p1', null, 'milestone', 'Ouverture', 's0', '2027-06-20', '2027-06-20'),
    item('f', 'p2', null, 'task', 'Essais', 's2', '2027-04-01', '2027-04-20'),               // terminé : pas en retard
  ],
  itemMembers: [{ item_id: 'c', user_id: 'u1' }, { item_id: 'f', user_id: 'u2' }],
  links: [{ id: 'l1', project_id: 'p1', predecessor_id: 'b', successor_id: 'c' }, { id: 'l2', project_id: 'p1', predecessor_id: 'c', successor_id: 'e' }],
};
const ids = (d: GanttData) => ({ p: d.projects.map(p => p.id), i: d.items.map(i => i.id) });
const F = (o: Partial<GanttFilters>): GanttFilters => ({ ...NO_FILTERS, ...o });

// Retard
eq('retard : fin passée et en cours', isOverdue('2027-06-08', 'in_progress', TODAY), true);
eq('retard : terminé jamais en retard', isOverdue('2027-06-08', 'done', TODAY), false);
eq('retard : annulé jamais en retard', isOverdue('2027-06-08', 'cancelled', TODAY), false);
eq('retard : sans fin jamais en retard', isOverdue(null, 'in_progress', TODAY), false);
eq('retard : fin aujourd\'hui pas en retard', isOverdue(TODAY, 'in_progress', TODAY), false);

// Aucun filtre : mêmes données, même objet
eq('aucun filtre = données inchangées', filterGantt(data, NO_FILTERS, TODAY) === data, true);
eq('hasFilters vide', hasFilters(NO_FILTERS), false);
eq('hasFilters texte blanc ignoré', hasFilters(F({ query: '   ' })), false);
eq('filterCount', filterCount(F({ query: 'x', overdueOnly: true, userId: 'u1' })), 3);

// Recherche : insensible à la casse et aux accents ; le chemin jusqu'au projet reste
eq('recherche « eclairage » (sans accent) garde Éclairage et ses parents', ids(filterGantt(data, F({ query: 'eclairage' }), TODAY)), { p: ['p1'], i: ['a', 'c'] });
eq('recherche sur le nom du projet garde tous ses éléments', ids(filterGantt(data, F({ query: 'festival' }), TODAY)), { p: ['p1'], i: ['a', 'b', 'c', 'd', 'e'] });
eq('recherche sans résultat', ids(filterGantt(data, F({ query: 'zzz' }), TODAY)), { p: [], i: [] });

// En retard
eq('en retard seulement : projet p2 (fin passée) et tâches Éclairage, Câblage', ids(filterGantt(data, F({ overdueOnly: true }), TODAY)), { p: ['p1', 'p2'], i: ['a', 'c', 'd'] });

// Personne
eq('personne u1 : équipe de p1 et tâche Éclairage', ids(filterGantt(data, F({ userId: 'u1' }), TODAY)), { p: ['p1'], i: ['a', 'c'] });
eq('personne u2 : équipe de p2 et tâche Essais', ids(filterGantt(data, F({ userId: 'u2' }), TODAY)), { p: ['p2'], i: ['f'] });

// État, priorité, type
eq('famille terminé : projet p3 seul + éléments terminés', ids(filterGantt(data, F({ family: 'done' }), TODAY)), { p: ['p1', 'p2', 'p3'], i: ['a', 'b', 'f'] });
eq('priorité haute', ids(filterGantt(data, F({ priority: 'high' }), TODAY)), { p: ['p1'], i: ['a', 'b', 'c'] });
eq('type rd : projet entier', ids(filterGantt(data, F({ type: 'rd' }), TODAY)), { p: ['p2'], i: ['f'] });

// Combinaison : en retard ET personne u1
eq('en retard + u1', ids(filterGantt(data, F({ overdueOnly: true, userId: 'u1' }), TODAY)), { p: ['p1'], i: ['a', 'c'] });

// Dépendances : seulement entre éléments gardés
eq('liens gardés seulement si les deux bouts restent', filterGantt(data, F({ overdueOnly: true }), TODAY).links.map(l => l.id), []);
eq('liens gardés (recherche sur le projet)', filterGantt(data, F({ query: 'festival' }), TODAY).links.map(l => l.id), ['l1', 'l2']);
eq('responsables d\'éléments filtrés', filterGantt(data, F({ userId: 'u1' }), TODAY).itemMembers.map(m => m.item_id), ['c']);

// Vues enregistrées
eq('vues : vide', parseSavedViews(null), []);
eq('vues : JSON cassé', parseSavedViews('{oups'), []);
eq('vues : pas une liste', parseSavedViews('{"a":1}'), []);
eq('vues : entrée invalide ignorée, filtres complétés', parseSavedViews(JSON.stringify([{ id: '1', name: 'Retards', grouping: 'status', filters: { overdueOnly: true } }, { id: 2 }])),
  [{ id: '1', name: 'Retards', grouping: 'status', filters: { ...NO_FILTERS, overdueOnly: true } }]);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
