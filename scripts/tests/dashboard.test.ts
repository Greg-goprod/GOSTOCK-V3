/* eslint-disable @typescript-eslint/no-explicit-any */
// Contrôles de la synthèse des projets (sans affichage). Lancer : node scripts/run-pilote-unit.cjs
import { buildDashboard } from '../../src/lib/dashboardModel';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const ST = [
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
  { id: 's1', name: 'En cours', family: 'in_progress', color: '#39f', position: 1, is_system: true },
  { id: 's2', name: 'Terminé', family: 'done', color: '#0a0', position: 2, is_system: true },
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
] as const;
const TODAY = '2027-03-10';   // mercredi
const proj = (id: string, name: string, st: string, s: string | null, e: string | null) => ({ id, site_id: null, type: 'site', name, description: null, status_id: st, priority: null, color: '#0ea5e9', starts_on: s, ends_on: e, link_mode: 'overlap', link_skip_weekends: true });
const item = (id: string, project_id: string, name: string, st: string, s: string | null, e: string | null, extra: any = {}) => ({ id, project_id, parent_id: null, kind: extra.kind ?? 'task', name, description: null, status_id: st, priority: null, starts_on: s, ends_on: e, position: 0, estimate_hours: extra.h ?? null });
const link = (id: string, p: string, a: string, b: string) => ({ id, project_id: p, predecessor_id: a, successor_id: b });
const mk = (projects: any[], items: any[], extra: Partial<GanttData> = {}): GanttData => ({ statuses: ST as any, sites: [], templates: [], members: [], itemMembers: [], links: [], calendarDays: [], capacities: [], baselines: [], projects, items: items as any, ...extra });

// Vert : tout dans les temps
let d = buildDashboard(mk([proj('p', 'Vert', 's1', '2027-03-01', '2027-03-31')], [item('a', 'p', 'A', 's1', '2027-03-08', '2027-03-20')]), TODAY, []);
eq('projet dans les temps : vert, aucune raison', [d.projects[0].health, d.projects[0].reasons], ['green', []]);
// Orange : un élément en retard (hors chemin critique)
d = buildDashboard(mk([proj('p', 'Orange', 's1', '2027-03-01', '2027-03-31')], [item('a', 'p', 'A', 's1', '2027-03-01', '2027-03-05'), item('b', 'p', 'B', 's1', '2027-03-08', '2027-03-31')]), TODAY, []);
eq('un élément en retard hors chemin critique : orange', [d.projects[0].health, d.projects[0].overdueItems, d.projects[0].criticalOverdue, d.projects[0].reasons], ['orange', 1, 0, ['1 autre élément en retard']]);
// Rouge : projet en retard
d = buildDashboard(mk([proj('p', 'Rouge', 's1', '2027-02-01', '2027-03-05')], [item('a', 'p', 'A', 's1', '2027-02-01', '2027-03-05')]), TODAY, []);
eq('fin du projet dépassée : rouge', [d.projects[0].health, d.projects[0].reasons[0]], ['red', 'Projet en retard']);
// Rouge : élément critique en retard (projet pas encore en retard)
d = buildDashboard(mk([proj('p', 'Critique', 's1', null, null)], [item('a', 'p', 'A', 's1', '2027-03-01', '2027-03-05'), item('b', 'p', 'B', 's0', '2027-03-08', '2027-03-20')], { links: [link('l', 'p', 'a', 'b')] as any }), TODAY, []);
eq('élément du chemin critique en retard : rouge', [d.projects[0].health, d.projects[0].criticalOverdue, d.projects[0].reasons], ['red', 1, ['1 élément en retard sur le chemin critique']]);
// Écart avec la ligne de base
d = buildDashboard(mk([proj('p', 'Base', 's1', '2027-03-01', '2027-03-31')], [item('a', 'p', 'A', 's1', '2027-03-08', '2027-03-31')], { baselines: [{ project_id: 'p', item_id: null, starts_on: '2027-03-01', ends_on: '2027-03-26', taken_at: 'x' }] }), TODAY, []);
eq('fin décalée de 5 jours sur la ligne de base : orange avec la raison', [d.projects[0].health, d.projects[0].baselineVariance, d.projects[0].reasons], ['orange', 5, ['Fin décalée de 5 j par rapport à la ligne de base']]);
d = buildDashboard(mk([proj('p', 'Base2', 's1', '2027-03-01', '2027-03-20')], [item('a', 'p', 'A', 's1', '2027-03-08', '2027-03-20')], { baselines: [{ project_id: 'p', item_id: null, starts_on: '2027-03-01', ends_on: '2027-03-26', taken_at: 'x' }] }), TODAY, []);
eq('fin avancée sur la ligne de base (−6 j) : vert', [d.projects[0].health, d.projects[0].baselineVariance], ['green', -6]);
// Clos
d = buildDashboard(mk([proj('p', 'Fini', 's2', '2027-02-01', '2027-02-28'), proj('q', 'Annulé', 's3', '2027-02-01', '2027-02-28')], [item('a', 'p', 'A', 's1', '2027-02-01', '2027-02-10')]), TODAY, []);
eq('terminé ou annulé : « clos », pas de retard compté', [d.projects.map(p => p.health), d.kpis.running, d.kpis.overdueItems], [['closed', 'closed'], 0, 0]);
// Tri : rouge, orange, vert, clos ; à égalité par fin puis nom
d = buildDashboard(mk([proj('v', 'Vert', 's1', null, '2027-04-30'), proj('c', 'Clos', 's2', null, '2027-01-01'), proj('r', 'Rouge', 's1', null, '2027-03-01'), proj('o', 'Orange', 's1', null, '2027-05-31')], [item('x', 'o', 'X', 's1', '2027-03-01', '2027-03-05')]), TODAY, []);
eq('tri : rouge, orange, vert, clos', d.projects.map(p => p.project.name), ['Rouge', 'Orange', 'Vert', 'Clos']);
// Compteurs
d = buildDashboard(mk([proj('a', 'A', 's1', null, '2027-03-05'), proj('b', 'B', 's1', null, '2027-06-30')], [item('t1', 'b', 'T1', 's1', '2027-03-01', '2027-03-08'), item('t2', 'b', 'T2', 's1', '2027-03-01', '2027-03-09')]), TODAY, []);
eq('compteurs : 2 en cours, 1 projet en retard, 2 éléments en retard', [d.kpis.running, d.kpis.late, d.kpis.overdueItems], [2, 1, 2]);

// Échéances sur 14 jours
d = buildDashboard(mk([proj('p', 'P', 's1', null, null)], [
  item('a', 'p', 'Aujourd\'hui', 's1', '2027-03-09', '2027-03-10'), item('b', 'p', 'Dans 13 jours', 's0', '2027-03-20', '2027-03-23'), item('c', 'p', 'Dans 14 jours', 's0', '2027-03-20', '2027-03-24'),
  item('d', 'p', 'Passée', 's1', '2027-03-01', '2027-03-09'), item('e', 'p', 'Terminée', 's2', '2027-03-11', '2027-03-12'), item('f', 'p', 'Phase', 's1', '2027-03-11', '2027-03-12', { kind: 'phase' }), item('g', 'p', 'Sans date', 's1', null, null),
], { itemMembers: [{ item_id: 'a', user_id: 'u1' }] }), TODAY, []);
eq('échéances : aujourd\'hui inclus, 13 jours inclus, 14 jours exclus, ni passée, ni terminée, ni phase, ni sans date', d.upcoming.map(u => u.name), ['Aujourd\'hui', 'Dans 13 jours']);
eq('échéance : assignés et projet', [d.upcoming[0].assignees, d.upcoming[0].projectName], [['u1'], 'P']);
eq('compteur des échéances', d.kpis.dueSoon, 2);

// Surcharge sur les 4 prochaines semaines (semaine du 8.03 : 50 h sur 40)
d = buildDashboard(mk([proj('p', 'P', 's1', null, null)], [item('a', 'p', 'Gros', 's1', '2027-03-08', '2027-03-12', { h: 50 }), item('z', 'p', 'Sans estimation', 's1', '2027-03-15', '2027-03-19')], { itemMembers: [{ item_id: 'a', user_id: 'u1' }, { item_id: 'z', user_id: 'u1' }] }), TODAY, ['u1', 'u2']);
eq('surcharge : u1 la semaine du 08.03 (50 h / 40 h)', d.overloads.map(o => [o.userId, o.weekStart, Math.round(o.hours), o.capacity]), [['u1', '2027-03-08', 50, 40]]);
eq('compteurs : 1 personne en surcharge, 1 tâche à estimer', [d.kpis.overloaded, d.kpis.toEstimate], [1, 1]);
eq('projet sans élément : il compte lui-même comme une feuille non terminée, avancement 0', buildDashboard(mk([proj('p', 'Vide', 's1', null, null)], []), TODAY, []).projects[0].progress, 0);
eq('projet sans élément mais terminé : avancement 1', buildDashboard(mk([proj('p', 'Fini', 's2', null, null)], []), TODAY, []).projects[0].progress, 1);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
