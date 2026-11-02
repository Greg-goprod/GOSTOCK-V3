// Contrôles du modèle du Gantt (sans affichage). Lancer :
//   npx esbuild scripts/tests/gantt-model.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/gantt-model.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/gantt-model.test.cjs
import { buildGantt, visibleRows, defaultExpanded, undatedRows, progressOf, makeScale, barBox, makeHeader, weekendBoxes, xOfDay } from '../../src/lib/ganttModel';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

const ST = [
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
  { id: 's1', name: 'En cours', family: 'in_progress', color: '#39f', position: 1, is_system: true },
  { id: 's2', name: 'Terminé', family: 'done', color: '#0a0', position: 2, is_system: true },
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
] as const;
const item = (id: string, project_id: string, parent_id: string | null, kind: any, name: string, status_id: string, starts_on: string | null, ends_on: string | null, position = 0) =>
  ({ id, project_id, parent_id, kind, name, description: null, status_id, priority: null, starts_on, ends_on, position });
const data: GanttData = {
  statuses: ST as any, sites: [], members: [], itemMembers: [],
  programs: [{ id: 'g1', name: 'Festivals 2027', description: null, color: '#639', starts_on: null, ends_on: null }],
  projects: [
    { id: 'p1', program_id: 'g1', site_id: null, type: 'site', name: 'Festival', description: null, status_id: 's1', priority: null, color: '#0ea5e9', starts_on: null, ends_on: null },
    { id: 'p2', program_id: null, site_id: null, type: 'rd', name: 'Prototype', description: null, status_id: 's2', priority: null, color: '#10b981', starts_on: '2027-02-01', ends_on: '2027-03-31' },
    { id: 'p3', program_id: 'g1', site_id: null, type: 'admin', name: 'Sans élément', description: null, status_id: 's0', priority: null, color: '#f00', starts_on: '2027-09-01', ends_on: null },
  ],
  items: [
    item('a', 'p1', null, 'phase', 'Montage', 's1', null, null, 0),
    item('b', 'p1', 'a', 'task', 'Structures', 's2', '2027-06-01', '2027-06-05'),
    item('c', 'p1', 'a', 'task', 'Éclairage', 's1', '2027-06-04', '2027-06-10'),
    item('d', 'p1', 'c', 'subtask', 'Câblage', 's2', '2027-06-04', '2027-06-06'),
    item('e', 'p1', 'c', 'subtask', 'Réglage', 's3', null, null),
    item('f', 'p1', null, 'milestone', 'Ouverture', 's0', '2027-06-20', '2027-06-20', 1),
    item('g', 'p1', 'a', 'task', 'À dater', 's0', null, null),
    item('h', 'p1', null, 'phase', 'Exploitation', 's0', null, null, 2),
  ],
};

const m = buildGantt(data, 'program');
const keys = m.rows.map(r => r.key);
eq('ordre : programme, ses projets, éléments', keys, ['g:g1', 'p:p1', 'i:a', 'i:b', 'i:c', 'i:d', 'i:e', 'i:g', 'i:f', 'i:h', 'p:p3', 'g:none', 'p:p2']);
const r = (k: string) => m.rows.find(x => x.key === k)!;
eq('niveaux', m.rows.map(x => x.level), [0, 1, 2, 3, 3, 4, 4, 3, 2, 2, 1, 0, 1]);
eq('phase sans dates : calculée sur ses enfants', [r('i:a').start, r('i:a').end], ['2027-06-01', '2027-06-10']);
eq('tâche : dates propres gardées (le sous-élément déborde pas)', [r('i:c').start, r('i:c').end], ['2027-06-04', '2027-06-10']);
eq('projet sans dates : calculé sur ses éléments (jalon compris)', [r('p:p1').start, r('p:p1').end], ['2027-06-01', '2027-06-20']);
eq('programme sans dates : calculé sur ses projets (le projet à date unique compte)', [r('g:g1').start, r('g:g1').end], ['2027-06-01', '2027-09-01']);
eq('projet avec début seul : repère d\'un jour', [r('p:p3').start, r('p:p3').end, r('p:p3').partial], ['2027-09-01', '2027-09-01', true]);
eq('programme : le projet partiel étend sa fin', r('g:g1').end, '2027-09-01');
eq('jalon : un jour', [r('i:f').start, r('i:f').end], ['2027-06-20', '2027-06-20']);
// Avancement : feuilles Structures(done) Câblage(done) Réglage(annulé, ne compte pas) À dater(0) Ouverture(0) Exploitation(0 : feuille sans enfant)
eq('avancement tâche Éclairage : Câblage fait, Réglage annulé exclu', [r('i:c').done, r('i:c').total, progressOf(r('i:c'))], [1, 1, 1]);
eq('avancement phase Montage', [r('i:a').done, r('i:a').total], [2, 3]);
eq('avancement projet Festival : 5 éléments comptés (Réglage annulé exclu)', [r('p:p1').done, r('p:p1').total], [2, 5]);
eq('projet sans élément et « Pas commencé » : 0 sur 1', [r('p:p3').done, r('p:p3').total], [0, 1]);
eq('projet sans élément et « Terminé » : 1 sur 1', [r('p:p2').done, r('p:p2').total], [1, 1]);
eq('programme : somme de ses projets', [r('g:g1').done, r('g:g1').total], [2, 6]);
eq('éléments sans date', undatedRows(m).map(x => x.key), ['i:e', 'i:g', 'i:h']);
eq('plage de dates', m.range, { min: '2027-02-01', max: '2027-09-01' });
eq('lignes dépliables', m.expandable, ['g:g1', 'p:p1', 'i:a', 'i:c', 'g:none']);

const exp = defaultExpanded(m);
eq('ouverture sur 2 niveaux : groupes dépliés, projets repliés', visibleRows(m, exp).map(x => x.key), ['g:g1', 'p:p1', 'p:p3', 'g:none', 'p:p2']);
exp.add('p:p1');
eq('déplier un projet montre ses phases et ses tâches directes', visibleRows(m, exp).map(x => x.key), ['g:g1', 'p:p1', 'i:a', 'i:f', 'i:h', 'p:p3', 'g:none', 'p:p2']);
exp.add('i:a'); exp.add('i:c');
eq('tout déplier', visibleRows(m, exp).length, 13);
exp.delete('p:p1');
eq('replier un projet cache toute sa descendance', visibleRows(m, exp).map(x => x.key), ['g:g1', 'p:p1', 'p:p3', 'g:none', 'p:p2']);

eq('regroupement par état : un groupe par état utilisé', buildGantt(data, 'status').rows.filter(x => x.kind === 'group').map(x => x.name), ['Pas commencé', 'En cours', 'Terminé']);
eq('regroupement par type', buildGantt(data, 'type').rows.filter(x => x.kind === 'group').map(x => x.name), ['Chantier', 'R&D', 'Administratif']);
eq('sans données : modèle vide', buildGantt({ ...data, projects: [], items: [], programs: [] }, 'program'), { rows: [], expandable: [], range: null });

// Échelle
const sc = makeScale({ min: '2027-02-01', max: '2027-09-01' }, '2027-06-15', 'month');
eq('échelle : commence un lundi', new Date(sc.startDay * 86_400_000).getUTCDay(), 1);
eq('échelle : multiple de 7 jours', sc.days % 7, 0);
const b = barBox(sc, '2027-02-01', '2027-02-01');
eq('une barre d\'un jour = 1 jour de large', b.width, sc.px);
eq('barre de 5 jours inclusifs', barBox(sc, '2027-06-01', '2027-06-05').width, 5 * sc.px);
eq('x de la date de début', xOfDay(sc, sc.startDay), 0);
eq('échelle sans plan : centrée sur aujourd\'hui', makeScale(null, '2027-06-15', 'year').days >= 520, true);
const h = makeHeader(sc, 'fr-CH');
eq('en-tête : la somme des mois couvre la fenêtre', Math.round(h.top.reduce((n, c) => n + c.width, 0)), Math.round(sc.days * sc.px));
eq('en-tête : un jour par colonne en zoom mois', h.bottom.length, sc.days);
eq('week-ends : 2 jours chacun', weekendBoxes(sc).every(w => w.width === 2 * sc.px || w.width === sc.px), true);
const sy = makeScale({ min: '2027-02-01', max: '2027-09-01' }, '2027-06-15', 'year');
eq('zoom année : en-tête en années / mois', [makeHeader(sy, 'fr-CH').top[0].label.length, makeHeader(sy, 'fr-CH').bottom.length > 12], [4, true]);
console.log(fails ? `\n${fails} échec(s)` : '\nTous les contrôles passent');
process.exit(fails ? 1 : 0);
