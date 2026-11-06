// Contrôles du modèle du Gantt (sans affichage). Lancer :
//   npx esbuild scripts/tests/gantt-model.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/gantt-model.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/gantt-model.test.cjs
import { buildGantt, visibleRows, defaultExpanded, undatedRows, withAddRows, linkPaths, progressOf, makeScale, barBox, clipBar, makeHeader, weekendBoxes, xOfDay } from '../../src/lib/ganttModel';
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
  statuses: ST as any, sites: [], members: [], itemMembers: [], links: [],
  projects: [
    { id: 'p1', site_id: null, type: 'site', name: 'Festival', description: null, status_id: 's1', priority: null, color: '#0ea5e9', starts_on: null, ends_on: null, link_mode: 'overlap', link_skip_weekends: true },
    { id: 'p2', site_id: null, type: 'rd', name: 'Prototype', description: null, status_id: 's2', priority: null, color: '#10b981', starts_on: '2027-02-01', ends_on: '2027-03-31', link_mode: 'overlap', link_skip_weekends: true },
    { id: 'p3', site_id: null, type: 'admin', name: 'Sans élément', description: null, status_id: 's0', priority: null, color: '#f00', starts_on: '2027-09-01', ends_on: null, link_mode: 'overlap', link_skip_weekends: true },
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

const m = buildGantt(data, 'status');
const keys = m.rows.map(r => r.key);
eq('ordre : groupe d\'état, ses projets, éléments', keys, ['g:s0', 'p:p3', 'g:s1', 'p:p1', 'i:a', 'i:b', 'i:c', 'i:d', 'i:e', 'i:g', 'i:f', 'i:h', 'g:s2', 'p:p2']);
const r = (k: string) => m.rows.find(x => x.key === k)!;
eq('niveaux', m.rows.map(x => x.level), [0, 1, 0, 1, 2, 3, 3, 4, 4, 3, 2, 2, 0, 1]);
eq('phase sans dates : calculée sur ses enfants', [r('i:a').start, r('i:a').end], ['2027-06-01', '2027-06-10']);
eq('tâche : dates propres gardées (le sous-élément déborde pas)', [r('i:c').start, r('i:c').end], ['2027-06-04', '2027-06-10']);
eq('projet sans dates : calculé sur ses éléments (jalon compris)', [r('p:p1').start, r('p:p1').end], ['2027-06-01', '2027-06-20']);
eq('groupe : dates calculées sur ses projets', [r('g:s1').start, r('g:s1').end], ['2027-06-01', '2027-06-20']);
eq('projet avec début seul : repère d\'un jour', [r('p:p3').start, r('p:p3').end, r('p:p3').partial], ['2027-09-01', '2027-09-01', true]);
eq('groupe : le projet à date unique compte (repère d\'un jour)', [r('g:s0').start, r('g:s0').end], ['2027-09-01', '2027-09-01']);
eq('jalon : un jour', [r('i:f').start, r('i:f').end], ['2027-06-20', '2027-06-20']);
// Avancement : feuilles Structures(done) Câblage(done) Réglage(annulé, ne compte pas) À dater(0) Ouverture(0) Exploitation(0 : feuille sans enfant)
eq('avancement tâche Éclairage : Câblage fait, Réglage annulé exclu', [r('i:c').done, r('i:c').total, progressOf(r('i:c'))], [1, 1, 1]);
eq('avancement phase Montage', [r('i:a').done, r('i:a').total], [2, 3]);
eq('avancement projet Festival : 5 éléments comptés (Réglage annulé exclu)', [r('p:p1').done, r('p:p1').total], [2, 5]);
eq('projet sans élément et « Pas commencé » : 0 sur 1', [r('p:p3').done, r('p:p3').total], [0, 1]);
eq('projet sans élément et « Terminé » : 1 sur 1', [r('p:p2').done, r('p:p2').total], [1, 1]);
eq('groupe : somme de ses projets', [[r('g:s1').done, r('g:s1').total], [r('g:s0').done, r('g:s0').total], [r('g:s2').done, r('g:s2').total]], [[2, 5], [0, 1], [1, 1]]);
eq('éléments sans date', undatedRows(m).map(x => x.key), ['i:e', 'i:g', 'i:h']);
eq('plage de dates', m.range, { min: '2027-02-01', max: '2027-09-01' });
eq('lignes dépliables', m.expandable, ['g:s0', 'g:s1', 'p:p1', 'i:a', 'i:c', 'g:s2']);

const exp = defaultExpanded(m);
eq('ouverture sur 2 niveaux : groupes dépliés, projets repliés', visibleRows(m, exp).map(x => x.key), ['g:s0', 'p:p3', 'g:s1', 'p:p1', 'g:s2', 'p:p2']);
exp.add('p:p1');
eq('déplier un projet montre ses phases et ses tâches directes', visibleRows(m, exp).map(x => x.key), ['g:s0', 'p:p3', 'g:s1', 'p:p1', 'i:a', 'i:f', 'i:h', 'g:s2', 'p:p2']);
exp.add('i:a'); exp.add('i:c');
eq('tout déplier', visibleRows(m, exp).length, 14);
exp.delete('p:p1');
eq('replier un projet cache toute sa descendance', visibleRows(m, exp).map(x => x.key), ['g:s0', 'p:p3', 'g:s1', 'p:p1', 'g:s2', 'p:p2']);

// Dates propres (gestes) et lignes « + Nouveau »
eq('dates propres : phase sans dates (calculées), tâche avec dates', [r('i:a').ownStart, r('i:a').ownEnd, r('i:c').ownStart, r('i:c').ownEnd], [null, null, '2027-06-04', '2027-06-12'.replace('2027-06-12', '2027-06-10')]);
eq('dates propres : un jalon a la même date des deux côtés', [r('i:f').ownStart, r('i:f').ownEnd], ['2027-06-20', '2027-06-20']);
eq('dates propres : projet sans dates, projet avec dates', [r('p:p1').ownStart, r('p:p1').ownEnd, r('p:p2').ownStart, r('p:p2').ownEnd], [null, null, '2027-02-01', '2027-03-31']);
const expAll = new Set(m.expandable);
const withAdd = withAddRows(visibleRows(m, expAll), expAll);
eq('« + Nouveau » : une ligne après le dernier enfant de chaque projet, phase et tâche dépliés (les parents sans enfant n\'en ont pas)', withAdd.filter(x => x.kind === 'add').map(x => x.key), ['add:i:c', 'add:i:a', 'add:p:p1']);
eq('« + Nouveau » : placée juste après les enfants (sous-tâches de « Éclairage » puis la ligne)', withAdd.map(x => x.key).slice(withAdd.findIndex(x => x.key === 'i:d'), withAdd.findIndex(x => x.key === 'i:d') + 3), ['i:d', 'i:e', 'add:i:c']);
eq('« + Nouveau » : parent et type', [withAdd.find(x => x.key === 'add:i:a')!.parentId, withAdd.find(x => x.key === 'add:i:a')!.addTo, withAdd.find(x => x.key === 'add:p:p1')!.parentId, withAdd.find(x => x.key === 'add:p:p1')!.addTo], ['a', 'phase', null, 'project']);
eq('« + Nouveau » : niveau = parent + 1', withAdd.find(x => x.key === 'add:i:c')!.level, r('i:c').level + 1);
eq('« + Nouveau » : rien pour un parent replié', withAddRows(visibleRows(m, defaultExpanded(m)), defaultExpanded(m)).filter(x => x.kind === 'add').length, 0);
eq('« + Nouveau » : jamais dans le bac « Sans date »', undatedRows(m).some(x => x.kind === 'add'), false);

// Flèches des dépendances
const scL = makeScale({ start: '2027-06-01', end: '2027-06-30' }, 900);   // 30 px par jour
const showAll = new Set(m.expandable);
const rowsAll = visibleRows(m, showAll);
const idx = (k: string) => rowsAll.findIndex(x => x.key === k);
const arrows = linkPaths(rowsAll, [{ id: 'l1', predecessor_id: 'b', successor_id: 'c' }], scL, 36);
eq('flèche : une pour une dépendance dont les deux lignes sont visibles', arrows.length, 1);
eq('flèche : du bord droit du prédécesseur (fin le 5 juin → x = 5 × 30) au début du successeur (4 juin → x = 3 × 30) : contournement, jamais « en arrière » sans détour', arrows[0].d.startsWith('M 150 '), true);
eq('flèche : le successeur commence avant la fin du prédécesseur → signalée en conflit', arrows[0].violated, true);
const ok1 = linkPaths(rowsAll, [{ id: 'l2', predecessor_id: 'd', successor_id: 'c' }], scL, 36);
eq('flèche : successeur après le prédécesseur (Câblage 4→6 juin, puis Éclairage qui commence le 4) = conflit aussi si ça se chevauche', ok1[0].violated, true);
const far = linkPaths(rowsAll, [{ id: 'l3', predecessor_id: 'b', successor_id: 'f' }], scL, 36);
eq('flèche : successeur loin après (Ouverture le 20 juin) : trajet simple en trois segments, pas en conflit', [far[0].violated, far[0].d.split(' ').filter(t => t === 'H' || t === 'V').join('')], [false, 'HVH']);
eq('flèche : y du prédécesseur et du successeur = milieu de leurs lignes', [far[0].d.includes(`M 150 ${idx('i:b') * 36 + 18}`), far[0].d.includes(`V ${idx('i:f') * 36 + 18}`)], [true, true]);
eq('flèche : ligne repliée (non visible) : pas de flèche', linkPaths(visibleRows(m, defaultExpanded(m)), [{ id: 'l4', predecessor_id: 'b', successor_id: 'c' }], scL, 36).length, 0);
eq('flèche : élément sans date : pas de flèche', linkPaths(rowsAll, [{ id: 'l5', predecessor_id: 'b', successor_id: 'h' }], scL, 36).length, 0);
eq('flèche : entièrement hors de la fenêtre : pas de flèche', linkPaths(rowsAll, [{ id: 'l6', predecessor_id: 'b', successor_id: 'c' }], makeScale({ start: '2028-01-01', end: '2028-01-30' }, 900), 36).length, 0);

eq('regroupement par état : un groupe par état utilisé', buildGantt(data, 'status').rows.filter(x => x.kind === 'group').map(x => x.name), ['Pas commencé', 'En cours', 'Terminé']);
eq('regroupement par type', buildGantt(data, 'type').rows.filter(x => x.kind === 'group').map(x => x.name), ['Chantier', 'R&D', 'Administratif']);
// Couleur des barres : par état (défaut) ou par projet
const colorsOf = (by?: 'status' | 'project') => Object.fromEntries(buildGantt(data, 'status', by).rows.filter(x => x.kind === 'project').map(x => [x.name, x.color]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
eq('couleur par état (défaut) : un projet prend la couleur de son état', colorsOf(), { Festival: '#39f', Prototype: '#0a0', 'Sans élément': '#999' });
eq('couleur par projet : un projet garde sa propre couleur', colorsOf('project'), { Festival: '#0ea5e9', Prototype: '#10b981', 'Sans élément': '#f00' });
const itemColors = (by?: 'status' | 'project') => buildGantt(data, 'status', by).rows.filter(x => x.kind === 'task' || x.kind === 'phase').map(x => [x.name, x.color]);
eq('couleur par état : un élément prend la couleur de SON état, pas celle du projet', itemColors().every(([, c]) => ['#999', '#39f', '#0a0', '#d00'].includes(c as string)), true);
eq('couleur par projet : les éléments héritent de la couleur du projet', itemColors('project').every(([, c]) => ['#0ea5e9', '#10b981', '#f00'].includes(c as string)), true);
eq('sans données : modèle vide', buildGantt({ ...data, projects: [], items: [] }, 'status'), { rows: [], expandable: [], range: null });

// Échelle : la période tient dans la largeur
const sc = makeScale({ start: '2027-06-01', end: '2027-06-30' }, 900);
eq('échelle : 30 jours dans 900 px = 30 px par jour', [sc.days, sc.px], [30, 30]);
eq('une barre d\'un jour = 1 jour de large', barBox(sc, '2027-06-01', '2027-06-01').width, sc.px);
eq('barre de 5 jours inclusifs', barBox(sc, '2027-06-01', '2027-06-05').width, 5 * sc.px);
eq('x du premier jour', xOfDay(sc, '2027-06-01'), 0);
eq('x du dernier jour', xOfDay(sc, '2027-06-30'), 29 * sc.px);
eq('une période d\'un jour occupe toute la largeur', makeScale({ start: '2027-06-01', end: '2027-06-01' }, 900).px, 900);
eq('une très longue période garde au moins 0,6 px par jour', makeScale({ start: '2020-01-01', end: '2030-12-31' }, 900).px, 0.6);
eq('barre entièrement avant la fenêtre : absente', clipBar(sc, '2027-05-01', '2027-05-31'), null);
eq('barre entièrement après la fenêtre : absente', clipBar(sc, '2027-07-01', '2027-07-05'), null);
eq('barre qui déborde à gauche : coupée', clipBar(sc, '2027-05-25', '2027-06-03'), { left: 0, width: 3 * 30, clippedLeft: true, clippedRight: false });
eq('barre qui déborde à droite : coupée', clipBar(sc, '2027-06-28', '2027-07-10'), { left: 27 * 30, width: 3 * 30, clippedLeft: false, clippedRight: true });
eq('barre dans la fenêtre : intacte', clipBar(sc, '2027-06-10', '2027-06-12'), { left: 9 * 30, width: 90, clippedLeft: false, clippedRight: false });
eq('barre qui touche le dernier jour : visible', clipBar(sc, '2027-06-30', '2027-07-02')?.width, 30);
const h = makeHeader(sc, 'fr-CH');
eq('en-tête 30 jours : un mois en haut, un jour par colonne', [h.top.length, h.bottom.length], [1, 30]);
eq('en-tête : la somme des mois couvre la fenêtre', Math.round(h.top.reduce((n, c) => n + c.width, 0)), Math.round(sc.days * sc.px));
const w = makeScale({ start: '2027-06-07', end: '2027-06-13' }, 1000);
eq('en-tête 1 semaine : nom du jour + numéro', makeHeader(w, 'fr-CH').bottom.map(c => c.label.length > 3), [true, true, true, true, true, true, true]);
const q = makeScale({ start: '2027-04-01', end: '2027-06-30' }, 1000);
eq('en-tête 3 mois : des semaines (13 ou 14 colonnes)', [makeHeader(q, 'fr-CH').bottom.length >= 13, makeHeader(q, 'fr-CH').top.length], [true, 3]);
const y = makeScale({ start: '2027-01-01', end: '2027-12-31' }, 1000);
eq('en-tête 1 année : années en haut, 12 mois en bas', [makeHeader(y, 'fr-CH').top.length, makeHeader(y, 'fr-CH').bottom.length], [1, 12]);
const y2 = makeScale({ start: '2027-07-01', end: '2028-06-30' }, 1000);
eq('1 année glissante : 2 années en haut', makeHeader(y2, 'fr-CH').top.length, 2);
eq('week-ends : un samedi + dimanche par semaine (jusqu\'à 5 pour juin 2027)', weekendBoxes(sc).length, 4);
eq('très longue période : pas de week-ends dessinés', weekendBoxes(makeScale({ start: '2020-01-01', end: '2030-12-31' }, 900)).length, 0);
console.log(fails ? `\n${fails} échec(s)` : '\nTous les contrôles passent');
process.exit(fails ? 1 : 0);
