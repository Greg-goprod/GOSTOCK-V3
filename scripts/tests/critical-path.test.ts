/* eslint-disable @typescript-eslint/no-explicit-any */
// Contrôles du chemin critique (sans affichage). Lancer : node scripts/run-pilote-unit.cjs
import { criticalPath } from '../../src/lib/criticalPath';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const ST = [
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
  { id: 's2', name: 'Terminé', family: 'done', color: '#0a0', position: 2, is_system: true },
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
] as const;
const item = (id: string, name: string, s: string | null, e: string | null, extra: any = {}) => ({ id, project_id: extra.project ?? 'p1', parent_id: null, kind: extra.kind ?? 'task', name, description: null, status_id: extra.st ?? 's0', priority: null, starts_on: s, ends_on: e, position: 0 });
const link = (id: string, a: string, b: string) => ({ id, project_id: 'p1', predecessor_id: a, successor_id: b });
const mk = (items: any[], links: any[], calendarDays: any[] = []): GanttData => ({
  statuses: ST as any, sites: [], templates: [], members: [], itemMembers: [], capacities: [], calendarDays,
  projects: [{ id: 'p1' }, { id: 'p2' }] as any, items, links: links as any,
});
const ids = (c: ReturnType<typeof criticalPath>) => [[...c.items].sort(), [...c.links].sort()];

// 2027-03-01 = lundi. A (lun-mer) → B (jeu-ven) → C (lun 8 - mer 10) : la fin du projet est le 10, tout est serré (le week-end ne compte pas)
const A = item('a', 'A', '2027-03-01', '2027-03-03'), B = item('b', 'B', '2027-03-04', '2027-03-05'), C = item('c', 'C', '2027-03-08', '2027-03-10');
eq('chaîne serrée A → B → C (même à travers le week-end)', ids(criticalPath(mk([A, B, C], [link('l1', 'a', 'b'), link('l2', 'b', 'c')]))), [['a', 'b', 'c'], ['l1', 'l2']]);
eq('élément parallèle non lié : pas critique', ids(criticalPath(mk([A, B, C, item('d', 'D', '2027-03-01', '2027-03-04')], [link('l1', 'a', 'b'), link('l2', 'b', 'c')]))), [['a', 'b', 'c'], ['l1', 'l2']]);
eq('un jour ouvré libre entre B et C : la chaîne remonte seulement jusqu\'à C (lien non serré)', ids(criticalPath(mk([A, B, item('c', 'C', '2027-03-09', '2027-03-10')], [link('l1', 'a', 'b'), link('l2', 'b', 'c')]))), [[], []]);
eq('… mais A → B reste inutile à marquer si B n\'est pas sur la chaîne de la fin', ids(criticalPath(mk([A, B, item('c', 'C', '2027-03-09', '2027-03-10')], [link('l1', 'a', 'b')]))), [[], []]);
eq('jour férié le vendredi 5 : B (jeu 4) → C (lun 8) devient serré aussi, mais un férié le lundi 8 libère C : C commence mardi 9 = serré', ids(criticalPath(mk([A, B, item('c', 'C', '2027-03-09', '2027-03-10')], [link('l1', 'a', 'b'), link('l2', 'b', 'c')], [{ id: 'h', day: '2027-03-05', label: 'F', kind: 'holiday' }, { id: 'h2', day: '2027-03-08', label: 'F2', kind: 'holiday' }]))), [['a', 'b', 'c'], ['l1', 'l2']]);
eq('chevauchement ou même jour : serré', ids(criticalPath(mk([A, item('b', 'B', '2027-03-02', '2027-03-06')], [link('l1', 'a', 'b')]))), [['a', 'b'], ['l1']]);
eq('élément seul, sans lien : rien n\'est marqué', ids(criticalPath(mk([A, B, C], []))), [[], []]);
eq('un seul élément : rien', ids(criticalPath(mk([A], []))), [[], []]);

// Deux éléments finissent le même jour : les deux chaînes comptent
const X = item('x', 'X', '2027-03-01', '2027-03-02'), Y = item('y', 'Y', '2027-03-03', '2027-03-05'), Z = item('z', 'Z', '2027-03-04', '2027-03-05');
eq('deux fins le même jour : les deux chaînes sont critiques', ids(criticalPath(mk([X, Y, Z, item('w', 'W', '2027-03-02', '2027-03-03')], [link('l1', 'x', 'y'), link('l2', 'w', 'z')]))), [['w', 'x', 'y', 'z'], ['l1', 'l2']]);

// Exclusions
eq('prédécesseur terminé : ne tient plus rien', ids(criticalPath(mk([item('a', 'A', '2027-03-01', '2027-03-03', { st: 's2' }), B, C], [link('l1', 'a', 'b'), link('l2', 'b', 'c')]))), [['b', 'c'], ['l2']]);
eq('élément annulé : ignoré', ids(criticalPath(mk([item('a', 'A', '2027-03-01', '2027-03-03', { st: 's3' }), B, C], [link('l1', 'a', 'b'), link('l2', 'b', 'c')]))), [['b', 'c'], ['l2']]);
eq('élément sans date : ignoré', ids(criticalPath(mk([item('a', 'A', null, null), B, C], [link('l1', 'a', 'b'), link('l2', 'b', 'c')]))), [['b', 'c'], ['l2']]);
eq('une phase n\'est jamais critique', ids(criticalPath(mk([item('ph', 'Phase', '2027-03-01', '2027-03-20', { kind: 'phase' }), A, B, C], [link('l1', 'a', 'b'), link('l2', 'b', 'c')]))), [['a', 'b', 'c'], ['l1', 'l2']]);
eq('tout terminé : rien', ids(criticalPath(mk([item('a', 'A', '2027-03-01', '2027-03-03', { st: 's2' }), item('b', 'B', '2027-03-04', '2027-03-05', { st: 's2' })], [link('l1', 'a', 'b')]))), [[], []]);

// Deux projets indépendants
const P2 = [item('e', 'E', '2027-04-01', '2027-04-02', { project: 'p2' }), item('f', 'F', '2027-04-05', '2027-04-06', { project: 'p2' })];
eq('chaque projet a sa propre chaîne', ids(criticalPath(mk([A, B, C, ...P2], [link('l1', 'a', 'b'), link('l2', 'b', 'c'), { ...link('l3', 'e', 'f'), project_id: 'p2' }]))), [['a', 'b', 'c', 'e', 'f'], ['l1', 'l2', 'l3']]);
eq('la fin d\'un autre projet ne rend pas un élément critique', ids(criticalPath(mk([item('a', 'A', '2027-03-01', '2027-03-02'), item('b', 'B', '2027-03-03', '2027-03-04'), ...P2], [link('l1', 'a', 'b')]))), [['a', 'b'], ['l1']]);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
