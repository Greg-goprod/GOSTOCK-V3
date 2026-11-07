/* eslint-disable @typescript-eslint/no-explicit-any */
// Contrôles des exports PILOTE : lignes Excel, CSV, calendrier .ics (sans affichage). Lancer :
//   npx esbuild scripts/tests/pilote-exports.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/pilote-exports.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/pilote-exports.test.cjs
import { buildExportRows, buildIcs, toCsv } from '../../src/lib/piloteExports';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

const ST = [
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
  { id: 's1', name: 'En cours', family: 'in_progress', color: '#39f', position: 1, is_system: true },
  { id: 's2', name: 'Terminé', family: 'done', color: '#0a0', position: 2, is_system: true },
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
] as const;
const item = (id: string, project_id: string, parent_id: string | null, kind: any, name: string, status_id: string, starts_on: string | null, ends_on: string | null, extra: any = {}) =>
  ({ id, project_id, parent_id, kind, name, description: null, status_id, priority: null, starts_on, ends_on, position: 0, ...extra });
const data: GanttData = {
  statuses: ST as any, sites: [], templates: [], links: [],
  calendarDays: [{ id: 'c1', day: '2027-03-05', label: 'Férié', kind: 'holiday' }],
  projects: [{ id: 'p1', site_id: null, type: 'site', name: 'Festival; été', description: 'Ligne 1\nLigne 2', status_id: 's1', priority: 'high', color: '#0ea5e9', starts_on: null, ends_on: null, link_mode: 'overlap', link_skip_weekends: true }] as any,
  members: [{ project_id: 'p1', user_id: 'u1', role: 'lead' }, { project_id: 'p1', user_id: 'u2', role: 'member' }],
  items: [
    item('a', 'p1', null, 'phase', 'Montage', 's1', null, null),
    item('b', 'p1', 'a', 'task', 'Structures', 's2', '2027-03-01', '2027-03-07'),
    item('c', 'p1', 'a', 'task', 'Éclairage, son et vidéo avec une désignation vraiment très longue pour forcer le pliage de ligne', 's1', '2027-03-08', '2027-03-12', { priority: 'low', description: 'À prévoir;\navec "guillemets"' }),
    item('d', 'p1', null, 'milestone', 'Ouverture', 's0', '2027-03-31', '2027-03-31'),
    item('e', 'p1', null, 'task', 'Annulée', 's3', '2027-04-01', '2027-04-02'),
    item('f', 'p1', null, 'task', 'Sans date', 's0', null, null),
    item('g', 'p1', 'c', 'subtask', '=SUM(A1)', 's0', '2027-03-02', '2027-03-02'),
  ] as any,
  itemMembers: [{ item_id: 'c', user_id: 'u1' }, { item_id: 'c', user_id: 'u2' }],
};
const name = (id: string) => ({ u1: 'Ana Test', u2: 'Bob Test' } as Record<string, string>)[id] ?? '?';
const TODAY = '2027-03-20';

// Lignes
const { projects, items } = buildExportRows(data, name, TODAY);
eq('une ligne de projet, une ligne par élément (phases comprises)', [projects.length, items.length], [1, 7]);
eq('projet : dates calculées sur ses éléments, jours ouvrés, retard, responsables, équipe', [projects[0]['Début'], projects[0]['Fin'], projects[0]['Jours ouvrés'], projects[0]['En retard'], projects[0]['Responsables'], projects[0]['Équipe']],
  ['01.03.2027', '02.04.2027', 24, 'Non', 'Ana Test', 'Ana Test (Responsable), Bob Test (Membre)']);
eq('projet : en retard une fois sa fin (02.04) passée', buildExportRows(data, name, '2027-04-03').projects[0]['En retard'], 'Oui');
eq('projet : avancement = feuilles terminées / feuilles comptées (Structures terminée, =SUM, Ouverture, Sans date non terminées ; la tâche Éclairage compte par sa sous-tâche, l\'annulée et les phases ne comptent pas) = 1 sur 4', projects[0]['Avancement (%)'], 25);
const byName = (n: string) => items.find(r => r['Nom'] === n)!;
eq('élément : parent, type, état, priorité', [byName('Éclairage, son et vidéo avec une désignation vraiment très longue pour forcer le pliage de ligne')['Parent'], byName('Structures')['Type'], byName('Structures')['État'], byName('Éclairage, son et vidéo avec une désignation vraiment très longue pour forcer le pliage de ligne')['Priorité']], ['Montage', 'Tâche', 'Terminé', 'Basse']);
eq('jours ouvrés : 01.03 au 07.03 = 5 jours moins le férié du 05.03 (vendredi) = 4', byName('Structures')['Jours ouvrés'], 4);
eq('terminé et passé : pas en retard', byName('Structures')['En retard'], 'Non');
eq('élément en cours dont la fin (12.03) est passée : en retard', byName('Éclairage, son et vidéo avec une désignation vraiment très longue pour forcer le pliage de ligne')['En retard'], 'Oui');
eq('assignés listés', byName('Éclairage, son et vidéo avec une désignation vraiment très longue pour forcer le pliage de ligne')['Assignés'], 'Ana Test, Bob Test');
eq('élément sans date : cellules de dates vides', [byName('Sans date')['Début'], byName('Sans date')['Jours ouvrés'], byName('Sans date')['En retard']], ['', '', 'Non']);
eq('phase : dates calculées sur ses enfants', [byName('Montage')['Début'], byName('Montage')['Fin']], ['01.03.2027', '12.03.2027']);

// CSV
const csv = toCsv(projects);
eq('CSV : BOM UTF-8 puis en-têtes séparés par « ; », lignes terminées par CRLF', [csv.startsWith('﻿Projet;Type;'), csv.endsWith('\r\n'), csv.split('\r\n').length === 3], [true, true, true]);
eq('CSV : texte avec « ; » et retour ligne mis entre guillemets', [csv.includes('"Festival; été"'), csv.includes('"Ligne 1\nLigne 2"')], [true, true]);
const csvItems = toCsv(items);
eq('CSV : guillemets doublés', csvItems.includes('"À prévoir;\navec ""guillemets"""'), true);
eq('CSV : une cellule qui commence par « = » est protégée contre l\'interprétation en formule', [csvItems.includes(";'=SUM(A1);"), csvItems.includes(';=SUM(A1);')], [true, false]);
eq('CSV : un nombre négatif n\'est pas « protégé »', toCsv([{ a: -5, b: 'x' }]), '﻿a;b\r\n-5;x\r\n');
eq('CSV vide : seulement le BOM', toCsv([]), '﻿');

// .ics
const ics = buildIcs(data, name, '20270320T100000Z');
const unfolded = ics.replace(/\r\n /g, '');
eq('ics : enveloppe et version', [ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'), ics.trimEnd().endsWith('END:VCALENDAR')], [true, true]);
eq('ics : tâches, sous-tâches, jalons datés seulement (Structures, Éclairage, Ouverture, Annulée, =SUM) — pas la phase ni l\'élément sans date', (ics.match(/BEGIN:VEVENT/g) ?? []).length, 5);
eq('ics : fin exclusive (dernier jour + 1) : Structures du 01 au 07 mars → DTEND 20270308', unfolded.includes('DTSTART;VALUE=DATE:20270301\r\nDTEND;VALUE=DATE:20270308'), true);
eq('ics : un jalon d\'un jour finit le lendemain ; fin de mois : 31 mars → 1er avril', unfolded.includes('DTSTART;VALUE=DATE:20270331\r\nDTEND;VALUE=DATE:20270401'), true);
eq('ics : identifiant stable par élément', unfolded.includes('UID:gomat-item-b@gomat'), true);
eq('ics : caractères spéciaux échappés (virgule, point-virgule, retour ligne)', [unfolded.includes('SUMMARY:Éclairage\\, son et vidéo'), unfolded.includes('À prévoir\\;\\navec "guillemets"')], [true, true]);
eq('ics : un élément annulé est « CANCELLED »', unfolded.split('BEGIN:VEVENT').find(b => b.includes('SUMMARY:Annulée'))!.includes('STATUS:CANCELLED'), true);
eq('ics : toutes les lignes font 75 octets au plus (accents comptés en octets)', ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75), true);
eq('ics : les lignes pliées recommencent par une espace', (ics.match(/\r\n [^\r]/g) ?? []).length > 0, true);
eq('ics : toutes les fins de ligne sont CRLF', !/[^\r]\n/.test(ics), true);
eq('ics sans élément daté : calendrier vide mais valide', buildIcs({ ...data, items: [] }, name, '20270320T100000Z').includes('BEGIN:VEVENT'), false);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
