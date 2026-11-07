/* eslint-disable @typescript-eslint/no-explicit-any */
// Contrôles des vues Tableau (kanban) et Calendrier (sans affichage). Lancer :
//   npx esbuild scripts/tests/board-calendar.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/board-calendar.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/board-calendar.test.cjs
import { addDays, buildBoard, calendarEvents, layoutWeek, mondayOf, monthWeeks, orderStatuses, shiftMonth } from '../../src/lib/boardCalendarModel';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

const ST = [
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
  { id: 's2', name: 'Terminé', family: 'done', color: '#0a0', position: 2, is_system: true },
  { id: 's1b', name: 'En test', family: 'in_progress', color: '#09f', position: 5, is_system: false },
  { id: 's1', name: 'En cours', family: 'in_progress', color: '#39f', position: 1, is_system: true },
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
] as const;
const TODAY = '2027-06-10';
const item = (id: string, project_id: string, kind: any, name: string, status_id: string, starts_on: string | null, ends_on: string | null, priority: any = null) =>
  ({ id, project_id, parent_id: null, kind, name, description: null, status_id, priority, starts_on, ends_on, position: 0, updated_at: 'v-' + id });
const proj = (id: string, name: string, status_id: string, ends_on: string | null = null) =>
  ({ id, site_id: null, type: 'site', name, description: null, status_id, priority: null, color: '#0ea5e9', starts_on: null, ends_on, link_mode: 'overlap', link_skip_weekends: true, updated_at: 'v-' + id });
const data: GanttData = {
  statuses: ST as any, sites: [], templates: [], calendarDays: [], links: [],
  projects: [proj('p1', 'Festival', 's1', '2027-06-01'), proj('p2', 'Prototype', 's2', '2027-05-01')],
  members: [{ project_id: 'p1', user_id: 'u1', role: 'lead' }],
  items: [
    item('a', 'p1', 'task', 'Structures', 's1', '2027-06-01', '2027-06-05', 'high'),   // en retard
    item('b', 'p1', 'task', 'Éclairage', 's0', '2027-06-14', '2027-06-18'),
    item('c', 'p1', 'milestone', 'Ouverture', 's0', '2027-06-20', '2027-06-20'),
    item('d', 'p2', 'task', 'Essais', 's2', '2027-04-01', '2027-04-20'),               // terminé, passé : pas en retard
    item('e', 'p1', 'task', 'Sans date', 's0', null, null),
    item('x', 'ghost', 'task', 'Orphelin', 's0', '2027-06-01', '2027-06-02'),            // projet inconnu : ignoré
  ] as any,
  itemMembers: [{ item_id: 'a', user_id: 'u1' }, { item_id: 'a', user_id: 'u2' }],
};

// Colonnes : familles dans l'ordre, puis position
eq('ordre des colonnes : familles puis position', orderStatuses(ST as any).map(s => s.id), ['s0', 's1', 's1b', 's2', 's3']);
const items = buildBoard(data, 'items', TODAY);
eq('une colonne par état, même vide', items.map(c => [c.status.id, c.cards.length]), [['s0', 3], ['s1', 1], ['s1b', 0], ['s2', 1], ['s3', 0]]);
eq('cartes triées par fin puis nom (« Pas commencé » : Éclairage, Ouverture, Sans date en dernier)', items[0].cards.map(c => c.name), ['Éclairage', 'Ouverture', 'Sans date']);
eq('un élément d\'un projet inconnu n\'apparaît pas', items.flatMap(c => c.cards).some(c => c.name === 'Orphelin'), false);
const a = items[1].cards[0];
eq('carte : projet, assignés, priorité, version', [a.projectName, a.assignees, a.priority, a.version], ['Festival', ['u1', 'u2'], 'high', 'v-a']);
eq('retard : en cours et fin passée', a.overdue, true);
eq('retard : terminé jamais en retard', items[3].cards[0].overdue, false);
eq('retard : fin future pas en retard', items[0].cards[0].overdue, false);
const projects = buildBoard(data, 'projects', TODAY);
eq('mode projets : 1 projet en cours (en retard), 1 terminé', [projects[1].cards.map(c => [c.name, c.overdue, c.assignees]), projects[3].cards.map(c => c.name)], [[['Festival', true, ['u1']]], ['Prototype']]);
eq('mode projets : type de carte', projects[1].cards[0].kind, 'project');

// Calendrier : événements
const ev = calendarEvents(data, TODAY);
eq('événements : les 4 éléments datés d\'un projet connu, triés par début', ev.map(e => e.name), ['Essais', 'Structures', 'Éclairage', 'Ouverture']);
eq('un élément sans date ou sans projet est ignoré', ev.some(e => e.name === 'Sans date' || e.name === 'Orphelin'), false);
eq('couleur = celle de l\'état', ev.find(e => e.name === 'Structures')!.color, '#39f');
eq('retard marqué', ev.find(e => e.name === 'Structures')!.overdue, true);
const oneDate = calendarEvents({ ...data, items: [item('z', 'p1', 'task', 'Fin seule', 's0', null, '2027-07-01')] as any }, TODAY);
eq('élément avec une seule date : tient sur ce jour', [oneDate[0].start, oneDate[0].end], ['2027-07-01', '2027-07-01']);

// Dates du calendrier (2027-06-10 = jeudi)
eq('lundi d\'une semaine', mondayOf('2027-06-10'), '2027-06-07');
eq('lundi d\'un dimanche = lundi précédent', mondayOf('2027-06-13'), '2027-06-07');
eq('lundi d\'un lundi', mondayOf('2027-06-07'), '2027-06-07');
eq('addDays', addDays('2027-06-28', 5), '2027-07-03');
eq('juin 2027 : 5 semaines (31 mai au 4 juillet)', monthWeeks('2027-06'), ['2027-05-31', '2027-06-07', '2027-06-14', '2027-06-21', '2027-06-28']);
eq('février 2027 (28 jours, commence un lundi) : 4 semaines', monthWeeks('2027-02'), ['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22']);
eq('mai 2027 (commence un samedi, finit un lundi) : 6 semaines', monthWeeks('2027-05').length, 6);
eq('mois suivant / précédent, changement d\'année', [shiftMonth('2027-12', 1), shiftMonth('2027-01', -1), shiftMonth('2027-06', 0)], ['2028-01', '2026-12', '2027-06']);

// Mise en page d'une semaine (lundi 7 juin 2027)
const E = (name: string, start: string, end: string) => ({ key: name, id: name, kind: 'task', name, start, end, color: '#000', family: 'in_progress', overdue: false, projectName: 'P' }) as any;
const week = '2027-06-07';
const lay = layoutWeek([E('long', '2027-06-07', '2027-06-11'), E('court', '2027-06-08', '2027-06-09'), E('plus tard', '2027-06-10', '2027-06-10')], week, 3);
eq('un élément long garde la ligne 0 sur 5 jours ; le court passe en ligne 1 ; un troisième tient en ligne 0 après le long',
  lay.bars.map(b => [b.event.name, b.col, b.span, b.lane]), [['long', 0, 5, 0], ['court', 1, 2, 1], ['plus tard', 3, 1, 1]]);
const ov = layoutWeek([E('a', '2027-06-07', '2027-06-07'), E('b', '2027-06-07', '2027-06-07'), E('c', '2027-06-07', '2027-06-07'), E('d', '2027-06-07', '2027-06-07')], week, 2);
eq('au-delà de 2 lignes : 2 affichés, 2 comptés « +2 » ce jour-là', [ov.bars.length, ov.hidden[0], ov.hidden[1]], [2, 2, 0]);
const cl = layoutWeek([E('à cheval', '2027-06-04', '2027-06-09'), E('déborde', '2027-06-11', '2027-06-20')], week, 3);
eq('coupé aux bords de la semaine, avec indicateur de suite', cl.bars.map(b => [b.col, b.span, b.continuesLeft, b.continuesRight]), [[0, 3, true, false], [4, 3, false, true]]);
eq('hors semaine : rien', layoutWeek([E('avant', '2027-05-01', '2027-06-06'), E('après', '2027-06-14', '2027-06-15')], week, 3).bars.length, 0);
eq('un jour seul le dimanche (col 6)', layoutWeek([E('dim', '2027-06-13', '2027-06-13')], week, 3).bars.map(b => [b.col, b.span]), [[6, 1]]);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
