// Contrôles des jours fériés proposés et du calcul des jours ouvrés (sans affichage). Lancer :
//   npx esbuild scripts/tests/holidays.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/holidays.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/holidays.test.cjs
import { easterSunday, HOLIDAY_PRESETS, presetDays, workingDaysBetween } from '../../src/lib/holidays';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const preset = (key: string) => HOLIDAY_PRESETS.find(p => p.key === key)!;

// Dimanches de Pâques connus (calendrier officiel)
eq('Pâques 2024', easterSunday(2024), '2024-03-31');
eq('Pâques 2025', easterSunday(2025), '2025-04-20');
eq('Pâques 2026', easterSunday(2026), '2026-04-05');
eq('Pâques 2027', easterSunday(2027), '2027-03-28');
eq('Pâques 2038 (le plus tardif de la période)', easterSunday(2038), '2038-04-25');

// Fêtes mobiles 2026 (Pâques 5 avril)
eq('Vendredi saint 2026', preset('good-friday').date(2026), '2026-04-03');
eq('Lundi de Pâques 2026', preset('easter-monday').date(2026), '2026-04-06');
eq('Ascension 2026', preset('ascension').date(2026), '2026-05-14');
eq('Lundi de Pentecôte 2026', preset('whit-monday').date(2026), '2026-05-25');
eq('Fête-Dieu 2026', preset('corpus-christi').date(2026), '2026-06-04');
eq('Ascension 2027', preset('ascension').date(2027), '2027-05-06');
// Jeûnes de septembre : 2026 → 1er dimanche le 6, 3e dimanche le 20
eq('Jeûne genevois 2026 (jeudi après le 1er dimanche de septembre)', preset('jeune-geneve').date(2026), '2026-09-10');
eq('Lundi du Jeûne 2026 (lendemain du Jeûne fédéral du 20)', preset('lundi-jeune').date(2026), '2026-09-21');
eq('Jeûne genevois 2027 (1er dimanche le 5)', preset('jeune-geneve').date(2027), '2027-09-09');
eq('Lundi du Jeûne 2027 (3e dimanche le 19)', preset('lundi-jeune').date(2027), '2027-09-20');
// Un mois qui commence un dimanche : le 1er dimanche est le 1er
eq('Jeûne genevois 2025 (le 1er septembre est un lundi, 1er dimanche le 7)', preset('jeune-geneve').date(2025), '2025-09-11');
eq('Dates fixes', [preset('national-day').date(2027), preset('christmas').date(2027), preset('new-year').date(2027)], ['2027-08-01', '2027-12-25', '2027-01-01']);
eq('toutes les propositions ont une date valide en 2027', HOLIDAY_PRESETS.every(p => /^2027-\d\d-\d\d$/.test(p.date(2027)) && !Number.isNaN(Date.parse(p.date(2027)))), true);
eq('clés uniques', new Set(HOLIDAY_PRESETS.map(p => p.key)).size, HOLIDAY_PRESETS.length);

// Sélection pour une année
const common = new Set(HOLIDAY_PRESETS.filter(p => p.common).map(p => p.key));
const days2027 = presetDays(2027, common, new Set());
eq('fériés courants 2027 : 7 jours, triés par date', days2027.map(d => d.day), ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-06', '2027-05-17', '2027-08-01', '2027-12-25']);
eq('un jour déjà au calendrier n\'est pas proposé deux fois', presetDays(2027, common, new Set(['2027-01-01', '2027-08-01'])).map(d => d.day), ['2027-03-26', '2027-03-29', '2027-05-06', '2027-05-17', '2027-12-25']);
eq('aucune sélection : rien', presetDays(2027, new Set(), new Set()), []);
eq('tous de type « férié »', days2027.every(d => d.kind === 'holiday'), true);
eq('deux propositions le même jour : une seule ligne', presetDays(2027, new Set(['new-year', 'berchtold']), new Set()).length, 2);

// Jours ouvrés (2027-03-01 = lundi)
const none = new Set<string>();
eq('lundi à vendredi : 5 jours ouvrés', workingDaysBetween('2027-03-01', '2027-03-05', none), 5);
eq('semaine entière avec le week-end : 5', workingDaysBetween('2027-03-01', '2027-03-07', none), 5);
eq('un samedi : 0', workingDaysBetween('2027-03-06', '2027-03-06', none), 0);
eq('un jour : 1', workingDaysBetween('2027-03-02', '2027-03-02', none), 1);
eq('jour férié exclu', workingDaysBetween('2027-03-01', '2027-03-05', new Set(['2027-03-05'])), 4);
eq('férié un samedi : sans effet', workingDaysBetween('2027-03-01', '2027-03-07', new Set(['2027-03-06'])), 5);
eq('fin avant début : 0', workingDaysBetween('2027-03-05', '2027-03-01', none), 0);
eq('deux semaines : 10', workingDaysBetween('2027-03-01', '2027-03-14', none), 10);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
