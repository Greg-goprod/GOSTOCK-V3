// Contrôles du calcul des périodes affichées (1 jour … 1 année, période libre). Lancer :
//   npx esbuild scripts/tests/view-period.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/view-period.test.cjs --log-level=error && node /tmp/view-period.test.cjs
import { makePeriod, shiftPeriod, periodDays, periodAround, containsDay } from '../../src/lib/viewPeriod';
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const se = (p: { start: string; end: string }) => [p.start, p.end];
// 2026-11-04 est un mercredi
eq('1 jour', se(makePeriod('1d', '2026-11-04')), ['2026-11-04', '2026-11-04']);
eq('1 semaine : lundi à dimanche', se(makePeriod('1w', '2026-11-04')), ['2026-11-02', '2026-11-08']);
eq('1 semaine : un dimanche reste dans sa semaine', se(makePeriod('1w', '2026-11-08')), ['2026-11-02', '2026-11-08']);
eq('2 semaines', se(makePeriod('2w', '2026-11-04')), ['2026-11-02', '2026-11-15']);
eq('1 mois : mois civil (30 jours)', se(makePeriod('1m', '2026-11-04')), ['2026-11-01', '2026-11-30']);
eq('1 mois : février 2028 (année bissextile)', se(makePeriod('1m', '2028-02-10')), ['2028-02-01', '2028-02-29']);
eq('3 mois', se(makePeriod('3m', '2026-11-04')), ['2026-11-01', '2027-01-31']);
eq('6 mois à cheval sur l\'année', se(makePeriod('6m', '2026-11-04')), ['2026-11-01', '2027-04-30']);
eq('1 année : année civile', se(makePeriod('1y', '2026-11-04')), ['2026-01-01', '2026-12-31']);
eq('1 année : 365 jours', periodDays(makePeriod('1y', '2027-06-01')), 365);
eq('1 année bissextile : 366 jours', periodDays(makePeriod('1y', '2028-06-01')), 366);
eq('suivant : 1 jour', se(shiftPeriod(makePeriod('1d', '2026-11-30'), 1)), ['2026-12-01', '2026-12-01']);
eq('précédent : 1 jour au 1er du mois', se(shiftPeriod(makePeriod('1d', '2026-12-01'), -1)), ['2026-11-30', '2026-11-30']);
eq('suivant : 1 semaine', se(shiftPeriod(makePeriod('1w', '2026-11-04'), 1)), ['2026-11-09', '2026-11-15']);
eq('précédent : 2 semaines', se(shiftPeriod(makePeriod('2w', '2026-11-04'), -1)), ['2026-10-19', '2026-11-01']);
eq('suivant : 1 mois (novembre → décembre)', se(shiftPeriod(makePeriod('1m', '2026-11-04'), 1)), ['2026-12-01', '2026-12-31']);
eq('précédent : 1 mois (janvier → décembre)', se(shiftPeriod(makePeriod('1m', '2027-01-10'), -1)), ['2026-12-01', '2026-12-31']);
eq('suivant : 3 mois', se(shiftPeriod(makePeriod('3m', '2026-11-04'), 1)), ['2027-02-01', '2027-04-30']);
eq('précédent : 6 mois', se(shiftPeriod(makePeriod('6m', '2026-11-04'), -1)), ['2026-05-01', '2026-10-31']);
eq('suivant : 1 année', se(shiftPeriod(makePeriod('1y', '2026-11-04'), 1)), ['2027-01-01', '2027-12-31']);
eq('période libre : décalage de sa durée', se(shiftPeriod({ preset: 'custom', start: '2026-11-10', end: '2026-11-16' }, 1)), ['2026-11-17', '2026-11-23']);
eq('période libre : précédent', se(shiftPeriod({ preset: 'custom', start: '2026-11-10', end: '2026-11-16' }, -1)), ['2026-11-03', '2026-11-09']);
eq('autour d\'un jour : préréglage', se(periodAround(makePeriod('1m', '2026-11-04'), '2027-03-20')), ['2027-03-01', '2027-03-31']);
eq('autour d\'un jour : période libre de 7 jours, centrée', se(periodAround({ preset: 'custom', start: '2026-11-10', end: '2026-11-16' }, '2027-03-20')), ['2027-03-17', '2027-03-23']);
eq('contient un jour', [containsDay(makePeriod('1w', '2026-11-04'), '2026-11-08'), containsDay(makePeriod('1w', '2026-11-04'), '2026-11-09')], [true, false]);
console.log(fails ? `\n${fails} échec(s)` : '\nTous les contrôles passent');
process.exit(fails ? 1 : 0);
