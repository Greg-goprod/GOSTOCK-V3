// Contrôles de la répétition (sans affichage). Les cas de dates sont les MÊMES que ceux de supabase/tests/p13.sql : l'aperçu de l'écran
// doit donner exactement les dates que la base calcule.
import { cannotRepeat, maxRepeatFor, nextWorkingDay, previewOccurrences, seriesInfo, shiftDate, type Freq } from '../../src/lib/recurrence';
import type { CpItem } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const line = (start: string | null, end: string | null, freq: Freq, count: number) => previewOccurrences(start, end, freq, count).map(o => `${o.start ?? '-'}→${o.end ?? '-'}`).join(' | ');

// Calcul des dates
eq('chaque semaine : +7 jours', [1, 2, 3].map(k => shiftDate('2027-03-01', 'weekly', k)), ['2027-03-08', '2027-03-15', '2027-03-22']);
eq('chaque semaine : passage de mois et d\'année', shiftDate('2026-12-28', 'weekly', 1), '2027-01-04');
eq('chaque mois : 31 janvier → 28 février', shiftDate('2027-01-31', 'monthly', 1), '2027-02-28');
eq('chaque mois : pas de dérive (31 mars, 30 avril)', [shiftDate('2027-01-31', 'monthly', 2), shiftDate('2027-01-31', 'monthly', 3)], ['2027-03-31', '2027-04-30']);
eq('chaque mois : année bissextile (31 janvier 2028 → 29 février)', shiftDate('2028-01-31', 'monthly', 1), '2028-02-29');
eq('chaque mois : passage d\'année (15 novembre + 3 mois)', shiftDate('2026-11-15', 'monthly', 3), '2027-02-15');
eq('chaque mois : 12 mois = un an plus tard', shiftDate('2027-03-31', 'monthly', 12), '2028-03-31');
eq('chaque année : 29 février 2028 → 28 février 2029, 29 février 2032', [shiftDate('2028-02-29', 'yearly', 1), shiftDate('2028-02-29', 'yearly', 4)], ['2029-02-28', '2032-02-29']);
eq('chaque année : date ordinaire', shiftDate('2027-06-15', 'yearly', 2), '2029-06-15');
eq('rang 0 : la même date', [shiftDate('2027-03-01', 'weekly', 0), shiftDate('2027-01-31', 'monthly', 0), shiftDate('2028-02-29', 'yearly', 0)], ['2027-03-01', '2027-01-31', '2028-02-29']);

// Occurrences (durée conservée)
eq('hebdomadaire ×3, du lundi au mercredi', line('2027-03-01', '2027-03-03', 'weekly', 3), '2027-03-08→2027-03-10 | 2027-03-15→2027-03-17 | 2027-03-22→2027-03-24');
eq('mensuelle depuis le 31 janvier, 2 jours de durée', line('2027-01-31', '2027-02-02', 'monthly', 3), '2027-02-28→2027-03-02 | 2027-03-31→2027-04-02 | 2027-04-30→2027-05-02');
eq('mensuelle du 30 au 31 janvier : la durée d\'un jour est conservée (28 février → 1er mars, pas 28 → 28)', line('2027-01-30', '2027-01-31', 'monthly', 2), '2027-02-28→2027-03-01 | 2027-03-30→2027-03-31');
eq('annuelle depuis le 29 février 2028 (un jour)', line('2028-02-29', '2028-02-29', 'yearly', 2), '2029-02-28→2029-02-28 | 2030-02-28→2030-02-28');
eq('jalon : même jour au début et à la fin', line('2027-03-10', '2027-03-10', 'weekly', 2), '2027-03-17→2027-03-17 | 2027-03-24→2027-03-24');
eq('seulement un début', line('2027-03-01', null, 'weekly', 1), '2027-03-08→-');
eq('seulement une fin', line(null, '2027-03-05', 'weekly', 1), '-→2027-03-12');
eq('52 répétitions hebdomadaires : la dernière est 52 semaines plus tard', previewOccurrences('2027-01-04', '2027-01-05', 'weekly', 52).slice(-1)[0], { start: '2028-01-03', end: '2028-01-04' });
eq('aucune répétition : liste vide', previewOccurrences('2027-03-01', '2027-03-02', 'weekly', 0), []);

// Option « jours ouvrés » : MÊMES cas que supabase/tests/p13.sql (82, 81) ; 31 mai 2027 = jour fermé du calendrier, 30 mai = dimanche
const closed = new Set(['2027-05-31']);
const lineSkip = (start: string | null, end: string | null, freq: Freq, count: number, nw?: ReadonlySet<string>) => previewOccurrences(start, end, freq, count, nw).map(o => `${o.start ?? '-'}→${o.end ?? '-'}`).join(' | ');
eq('sans l\'option : dimanche et jour fermé ne sont pas évités', lineSkip('2027-04-30', '2027-05-04', 'monthly', 2), '2027-05-30→2027-06-03 | 2027-06-30→2027-07-04');
eq('avec l\'option : dimanche 30 mai → lundi 31 (fermé) → mardi 1er juin ; durée de 4 jours conservée ; le 30 juin (mercredi) ne bouge pas', lineSkip('2027-04-30', '2027-05-04', 'monthly', 2, closed), '2027-06-01→2027-06-05 | 2027-06-30→2027-07-04');
eq('avec l\'option mais sans jour fermé : dimanche → lundi', lineSkip('2027-04-30', '2027-05-04', 'monthly', 1, new Set()), '2027-05-31→2027-06-04');
eq('avec l\'option : une fin seule est avancée elle aussi', lineSkip(null, '2027-05-02', 'weekly', 1, new Set()), '-→2027-05-10');
eq('avec l\'option : un début seul', lineSkip('2027-05-01', null, 'weekly', 1, new Set()), '2027-05-10→-');
eq('nextWorkingDay : un jour ouvré reste lui-même', nextWorkingDay('2027-06-02', new Set()), '2027-06-02');
eq('nextWorkingDay : samedi → lundi', nextWorkingDay('2027-05-29', new Set()), '2027-05-31');
eq('nextWorkingDay : dimanche + lundi fermé → mardi', nextWorkingDay('2027-05-30', closed), '2027-06-01');
eq('nextWorkingDay : plusieurs jours fermés de suite', nextWorkingDay('2027-06-02', new Set(['2027-06-02', '2027-06-03', '2027-06-04'])), '2027-06-07');
{ const all = new Set<string>(); for (let n = 0; n < 500; n++) all.add(new Date(Date.UTC(2027, 0, 1 + n)).toISOString().slice(0, 10));
  eq('nextWorkingDay : aucun jour ouvré dans l\'année qui suit → la date telle quelle (comme la base)', nextWorkingDay('2027-01-01', all), '2027-01-01'); }

// Éléments qu'on ne répète pas
const item = (extra: Partial<CpItem>): CpItem => ({ id: 'i', project_id: 'p', parent_id: null, kind: 'task', name: 'T', description: null, status_id: 's', priority: null, starts_on: '2027-03-01', ends_on: '2027-03-02', position: 0, ...extra });
eq('tâche datée : répétable', cannotRepeat(item({})), null);
eq('phase : refusée', cannotRepeat(item({ kind: 'phase' }))?.startsWith('Une phase ne se répète pas'), true);
eq('avec sous-tâches : répétable (elles sont copiées, migration 75)', cannotRepeat(item({})), null);
eq('sans aucune date : refusée', cannotRepeat(item({ starts_on: null, ends_on: null }))?.startsWith('Donne d\'abord une date'), true);
eq('une seule date : répétable', [cannotRepeat(item({ ends_on: null })), cannotRepeat(item({ starts_on: null }))], [null, null]);
eq('jalon : répétable', cannotRepeat(item({ kind: 'milestone' })), null);
eq('sous-tâche : répétable', cannotRepeat(item({ kind: 'subtask' })), null);

// Séries
const s = (id: string, idx: number | null, series = 'S1') => item({ id, series_id: idx === null ? null : series, series_index: idx });
const all = [s('a', 1), s('b', 2), s('c', 3), s('x', null), s('z', 1, 'S2')];
eq('élément hors série : pas de série', seriesInfo(all, all[3]), null);
eq('rang 2 sur 3 : pas le dernier, 1 occurrence après', seriesInfo(all, all[1]), { index: 2, total: 3, isLast: false, laterCount: 1 });
eq('dernier rang : prolongeable, rien après', seriesInfo(all, all[2]), { index: 3, total: 3, isLast: true, laterCount: 0 });
eq('une autre série ne se mélange pas', seriesInfo(all, all[4]), { index: 1, total: 1, isLast: true, laterCount: 0 });
eq('répétitions encore possibles : 52 au plus, 200 occurrences au plus', [maxRepeatFor(null), maxRepeatFor({ index: 1, total: 150, isLast: true, laterCount: 0 }), maxRepeatFor({ index: 1, total: 199, isLast: true, laterCount: 0 }), maxRepeatFor({ index: 1, total: 200, isLast: true, laterCount: 0 })], [52, 50, 1, 0]);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
