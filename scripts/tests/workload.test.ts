/* eslint-disable @typescript-eslint/no-explicit-any */
// Contrôles de la charge par personne (sans affichage). Lancer :
//   npx esbuild scripts/tests/workload.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/workload.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/workload.test.cjs
import { computeWorkload, levelOf } from '../../src/lib/workload';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const near = (name: string, got: number, want: number) => eq(name, Math.round(got * 1000) / 1000, want);

const ST = [
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
  { id: 's1', name: 'En cours', family: 'in_progress', color: '#39f', position: 1, is_system: true },
  { id: 's2', name: 'Terminé', family: 'done', color: '#0a0', position: 2, is_system: true },
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
] as const;
// 2027-03-01 = lundi
const item = (id: string, kind: any, name: string, status_id: string, starts_on: string | null, ends_on: string | null, estimate_hours: number | null, parent_id: string | null = null) =>
  ({ id, project_id: 'p1', parent_id, kind, name, description: null, status_id, priority: null, starts_on, ends_on, position: 0, estimate_hours });
const base = (items: any[], members: any[], extra: Partial<GanttData> = {}): GanttData => ({
  statuses: ST as any, sites: [], templates: [], links: [], calendarDays: [], capacities: [], members: [],
  projects: [{ id: 'p1', site_id: null, type: 'site', name: 'Festival', description: null, status_id: 's1', priority: null, color: '#0ea5e9', starts_on: null, ends_on: null, link_mode: 'overlap', link_skip_weekends: true }] as any,
  items: items as any, itemMembers: members, ...extra,
});
const W1 = '2027-03-01';
const cell = (r: ReturnType<typeof computeWorkload>, user: string, w: number) => r.rows.find(x => x.userId === user)!.cells[w];

// Niveaux
eq('niveau : aucune heure', levelOf(0, 40), 'none');
eq('niveau : 80 % exactement = ok', levelOf(32, 40), 'ok');
eq('niveau : 80,1 % = warn', levelOf(32.04, 40), 'warn');
eq('niveau : 100 % exactement = warn (à la limite, pas encore en surcharge)', levelOf(40, 40), 'warn');
eq('niveau : au-dessus de 100 % = over', levelOf(40.5, 40), 'over');
eq('niveau : capacité nulle avec des heures = over', levelOf(1, 0), 'over');

// 40 h sur lundi-vendredi, une personne
let r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-05', 40)], [{ item_id: 'a', user_id: 'u1' }]), W1, 4, ['u1']);
near('40 h sur une semaine ouvrée : 40 h cette semaine', cell(r, 'u1', 0).hours, 40);
eq('… niveau « warn » (100 %), capacité 40, autres semaines vides', [cell(r, 'u1', 0).level, cell(r, 'u1', 0).capacity, cell(r, 'u1', 1).hours, cell(r, 'u1', 1).level], ['warn', 40, 0, 'none']);
eq('détail de la case : l\'élément, son projet, ses heures', cell(r, 'u1', 0).parts.map(p => [p.name, p.projectName, Math.round(p.hours)]), [['T', 'Festival', 40]]);
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-05', 41)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
eq('41 h : surcharge', cell(r, 'u1', 0).level, 'over');

// Partage entre assignés
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-05', 40)], [{ item_id: 'a', user_id: 'u1' }, { item_id: 'a', user_id: 'u2' }]), W1, 1, ['u1', 'u2']);
near('deux assignés : 20 h chacun', cell(r, 'u1', 0).hours, 20);
near('… (u2 aussi)', cell(r, 'u2', 0).hours, 20);
eq('… niveau « ok » (50 %)', cell(r, 'u1', 0).level, 'ok');

// Sur deux semaines : 10 jours ouvrés, 20 h → 10 h par semaine
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-12', 20)], [{ item_id: 'a', user_id: 'u1' }]), W1, 2, ['u1']);
eq('20 h sur 10 jours ouvrés : 10 h puis 10 h', [cell(r, 'u1', 0).hours, cell(r, 'u1', 1).hours], [10, 10]);
// Week-end exclu : lundi à dimanche = 5 jours ouvrés
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-07', 10)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
near('période lundi-dimanche : 10 h réparties sur 5 jours ouvrés (le week-end ne reçoit rien)', cell(r, 'u1', 0).hours, 10);
// Férié exclu et capacité réduite
const holiday = { calendarDays: [{ id: 'c', day: '2027-03-05', label: 'Férié', kind: 'holiday' }] as any };
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-05', 32)], [{ item_id: 'a', user_id: 'u1' }], holiday), W1, 1, ['u1']);
near('un férié le vendredi : 32 h sur 4 jours ouvrés', cell(r, 'u1', 0).hours, 32);
eq('… et la capacité de la semaine passe à 32 h (4/5 de 40) : exactement à la limite', [cell(r, 'u1', 0).capacity, cell(r, 'u1', 0).level], [32, 'warn']);
// Période entièrement non travaillée : l'estimation n'est pas perdue
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-06', '2027-03-07', 8)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
near('élément posé sur un week-end : les 8 h comptent quand même', cell(r, 'u1', 0).hours, 8);
// Capacité saisie
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-05', 25)], [{ item_id: 'a', user_id: 'u1' }], { capacities: [{ user_id: 'u1', hours_per_week: 20 }] }), W1, 1, ['u1']);
eq('capacité saisie 20 h/semaine : 25 h = surcharge', [r.rows[0].capacityPerWeek, cell(r, 'u1', 0).capacity, cell(r, 'u1', 0).level], [20, 20, 'over']);
r = computeWorkload(base([], []), W1, 1, ['u9']);
eq('personne sans capacité saisie : 40 h par défaut', r.rows[0].capacityPerWeek, 40);

// Hors période, annulé, sans assigné, sans date, sans estimation, zéro heure
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-08', '2027-03-12', 40)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
eq('élément après la période : rien', cell(r, 'u1', 0).hours, 0);
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-04', '2027-03-11', 40)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
near('élément à cheval sur la fin de la période : seule la part dans la période (jeudi, vendredi : 2 jours sur 6 jours ouvrés)', cell(r, 'u1', 0).hours, 13.333);
r = computeWorkload(base([item('a', 'task', 'T', 's3', '2027-03-01', '2027-03-05', 40)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
eq('élément annulé : ne charge personne', cell(r, 'u1', 0).hours, 0);
r = computeWorkload(base([item('a', 'task', 'T', 's2', '2027-03-01', '2027-03-05', 40)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
eq('élément terminé : compte (charge réalisée de la période)', cell(r, 'u1', 0).hours, 40);
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-05', 40)], []), W1, 1, ['u1']);
eq('élément sans assigné : ne charge personne', cell(r, 'u1', 0).hours, 0);
r = computeWorkload(base([item('a', 'task', 'T', 's1', null, null, 40)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
eq('élément sans date : ne charge personne', cell(r, 'u1', 0).hours, 0);
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-01', '2027-03-05', 0)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
eq('0 heure : aucune charge', [cell(r, 'u1', 0).hours, r.unestimated.length], [0, 0]);
r = computeWorkload(base([item('a', 'task', 'T', 's1', '2027-03-04', '2027-03-04', 8)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
near('un seul jour : 8 h ce jour-là', cell(r, 'u1', 0).hours, 8);

// Une seule date : l'élément tient sur ce jour
r = computeWorkload(base([item('a', 'task', 'T', 's1', null, '2027-03-03', 6)], [{ item_id: 'a', user_id: 'u1' }]), W1, 1, ['u1']);
near('fin seule : 6 h sur ce jour', cell(r, 'u1', 0).hours, 6);

// Éléments à estimer
const items = [
  item('t1', 'task', 'Sans estimation', 's1', '2027-03-01', '2027-03-05', null),
  item('t2', 'task', 'Terminée sans estimation', 's2', '2027-03-01', '2027-03-05', null),
  item('ph', 'phase', 'Phase', 's1', '2027-03-01', '2027-03-05', null),
  item('t3', 'task', 'Avec enfant', 's1', '2027-03-01', '2027-03-05', null),
  item('st', 'subtask', 'Sous-tâche', 's1', '2027-03-01', '2027-03-05', null, 't3'),
  item('t4', 'task', 'Hors période', 's1', '2027-05-01', '2027-05-05', null),
  item('ms', 'milestone', 'Jalon', 's1', '2027-03-02', '2027-03-02', null),
  item('t5', 'task', 'Non assignée', 's1', '2027-03-01', '2027-03-05', null),
];
r = computeWorkload(base(items, ['t1', 't2', 'ph', 't3', 'st', 't4', 'ms'].map(i => ({ item_id: i, user_id: 'u1' }))), W1, 1, ['u1']);
eq('à estimer : tâches feuilles assignées, pas terminées, dans la période (ni phase, ni tâche qui a des enfants, ni jalon, ni hors période, ni non assignée)', r.unestimated.map(x => x.name), ['Sans estimation', 'Sous-tâche']);

// Plusieurs personnes : l'ordre et la sélection suivent la liste donnée
r = computeWorkload(base([], []), W1, 3, ['u2', 'u1']);
eq('lignes dans l\'ordre demandé, une case par semaine, semaines consécutives', [r.rows.map(x => x.userId), r.weeks], [['u2', 'u1'], ['2027-03-01', '2027-03-08', '2027-03-15']]);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
