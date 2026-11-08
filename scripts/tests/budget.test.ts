/* eslint-disable @typescript-eslint/no-explicit-any */
// Contrôles du budget par projet (sans affichage) : montants, totaux, niveaux d'alerte, valorisation des heures, export.
import { actualLabor, budgetError, budgetLevel, buildBudgetRows, formatChf, laborByProject, laborOf, parseAmount, remainingToCommit, sumLines, totalsByProject, usedRatio, variance, type CpBudgetLine } from '../../src/lib/budget';
import { toCsv } from '../../src/lib/piloteExports';
import type { GanttData } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

// Montants affichés
eq('milliers avec apostrophe, sans centimes', formatChf(12000), "12'000");
eq('centimes affichés quand ils existent', formatChf(12000.5), "12'000.50");
eq('centimes forcés', formatChf(5, true), '5.00');
eq('grand montant', formatChf(99999999.99), "99'999'999.99");
eq('zéro', formatChf(0), '0');
eq('négatif : vrai signe moins', formatChf(-1250.4), "−1'250.40");
eq('arrondi au centime', formatChf(0.1 + 0.2, true), '0.30');
eq('999 : pas de séparateur', formatChf(999), '999');
eq('1000 : séparateur', formatChf(1000), "1'000");

// Montants saisis
eq('saisie simple', parseAmount('12000'), 12000);
eq('saisie avec virgule', parseAmount('12000,5'), 12000.5);
eq('saisie suisse avec apostrophe', parseAmount("12'000.50"), 12000.5);
eq('saisie avec espaces (même insécables)', parseAmount('12 000 ,5'), 12000.5);
eq('saisie vide refusée', parseAmount('  '), null);
eq('texte refusé', parseAmount('douze'), null);
eq('négatif refusé', parseAmount('-5'), null);
eq('3 décimales refusées', parseAmount('1.234'), null);
eq('plafond accepté', parseAmount('99999999.99'), 99999999.99);
eq('au-dessus du plafond refusé', parseAmount('100000000'), null);
eq('plafond du taux horaire', [parseAmount('9999.99', 9999.99), parseAmount('10000', 9999.99)], [9999.99, null]);
eq('0 accepté', parseAmount('0'), 0);
eq('point seul refusé', parseAmount('.'), null);
eq('exposant refusé', parseAmount('1e3'), null);

// Totaux
const line = (id: string, project_id: string, category: string, planned: number, committed: number, actual: number, note: string | null = null): CpBudgetLine =>
  ({ id, project_id, category, planned, committed, actual, note, position: 0, updated_at: '2027-01-01T00:00:00Z' });
eq('somme sans dérive des virgules (0,1 + 0,2)', sumLines([line('a', 'p', 'x', 0.1, 0.1, 0.1), line('b', 'p', 'y', 0.2, 0.2, 0.2)]), { planned: 0.3, committed: 0.3, actual: 0.3 });
eq('somme de 1,15 + 0,57 = 1,72 exactement (en flottants : 1,7199999999999998)', sumLines([line('a', 'p', 'x', 1.15, 1.15, 1.15), line('b', 'p', 'y', 0.57, 0.57, 0.57)]), { planned: 1.72, committed: 1.72, actual: 1.72 });
eq('somme vide', sumLines([]), { planned: 0, committed: 0, actual: 0 });
const t = { planned: 10000, committed: 7000, actual: 4000.5 };
eq('écart = prévu − réel', variance(t), 5999.5);
eq('reste à engager = prévu − engagé', remainingToCommit(t), 3000);
eq('écart négatif quand le réel dépasse', variance({ planned: 100, committed: 0, actual: 130 }), -30);

// Niveaux
eq('niveau : rien de saisi', budgetLevel({ planned: 0, committed: 0, actual: 0 }), 'none');
eq('niveau : à l\'aise (50 %)', budgetLevel({ planned: 100, committed: 50, actual: 0 }), 'ok');
eq('niveau : 89 % = ok', budgetLevel({ planned: 100, committed: 89, actual: 0 }), 'ok');
eq('niveau : 90 % pile = vigilance', budgetLevel({ planned: 100, committed: 90, actual: 0 }), 'warn');
eq('niveau : 100 % pile = vigilance, pas dépassement', budgetLevel({ planned: 100, committed: 0, actual: 100 }), 'warn');
eq('niveau : engagé au-dessus du prévu = dépassement', budgetLevel({ planned: 100, committed: 100.01, actual: 0 }), 'over');
eq('niveau : réel au-dessus du prévu = dépassement', budgetLevel({ planned: 100, committed: 0, actual: 101 }), 'over');
eq('niveau : dépense sans prévu = dépassement', budgetLevel({ planned: 0, committed: 0, actual: 5 }), 'over');
eq('niveau : le plus grand de l\'engagé et du réel compte', budgetLevel({ planned: 100, committed: 95, actual: 20 }), 'warn');
eq('part consommée', usedRatio({ planned: 200, committed: 50, actual: 150 }), 0.75);
eq('part consommée sans prévu', usedRatio({ planned: 0, committed: 0, actual: 0 }), null);

// Par projet
const lines = [line('1', 'pA', 'Matériel', 1000, 600, 300), line('2', 'pA', 'Prestataires', 500, 0, 0), line('3', 'pB', 'Divers', 50, 50, 50)];
const by = totalsByProject(lines);
eq('totaux par projet : A', by.get('pA'), { planned: 1500, committed: 600, actual: 300 });
eq('totaux par projet : B', by.get('pB'), { planned: 50, committed: 50, actual: 50 });
eq('projet sans ligne : absent', by.has('pC'), false);

// Valorisation des heures
const ST = [
  { id: 's0', name: 'Pas commencé', family: 'not_started', color: '#999', position: 0, is_system: true },
  { id: 's1', name: 'En cours', family: 'in_progress', color: '#39f', position: 1, is_system: true },
  { id: 's3', name: 'Annulé', family: 'cancelled', color: '#d00', position: 3, is_system: true },
] as const;
const item = (id: string, project_id: string, status_id: string, estimate_hours: number | null, parent_id: string | null = null) =>
  ({ id, project_id, parent_id, kind: 'task', name: id, description: null, status_id, priority: null, starts_on: '2027-03-01', ends_on: '2027-03-05', position: 0, estimate_hours });
const data = (items: any[], members: any[]): GanttData => ({
  statuses: ST as any, sites: [], templates: [], links: [], calendarDays: [], capacities: [], members: [], baselines: [],
  projects: [{ id: 'pA', name: 'A' }, { id: 'pB', name: 'B' }] as any, items: items as any, itemMembers: members,
});
const rates = [{ user_id: 'u1', hourly_rate: 100 }, { user_id: 'u2', hourly_rate: 60 }];
const L1 = laborByProject(data([item('i1', 'pA', 's1', 10)], [{ item_id: 'i1', user_id: 'u1' }]), rates);
eq('une personne : 10 h × 100 = 1000', laborOf(L1, 'pA'), { hours: 10, valuedHours: 10, cost: 1000, unvaluedHours: 0, unassignedHours: 0 });
const L2 = laborByProject(data([item('i1', 'pA', 's1', 10)], [{ item_id: 'i1', user_id: 'u1' }, { item_id: 'i1', user_id: 'u2' }]), rates);
eq('deux personnes : 5 h à 100 + 5 h à 60 = 800', laborOf(L2, 'pA'), { hours: 10, valuedHours: 10, cost: 800, unvaluedHours: 0, unassignedHours: 0 });
const L3 = laborByProject(data([item('i1', 'pA', 's1', 10)], [{ item_id: 'i1', user_id: 'u1' }, { item_id: 'i1', user_id: 'u9' }]), rates);
eq('un assigné sans taux : sa moitié est non valorisée, jamais devinée', laborOf(L3, 'pA'), { hours: 10, valuedHours: 5, cost: 500, unvaluedHours: 5, unassignedHours: 0 });
const L4 = laborByProject(data([item('i1', 'pA', 's1', 8)], []), rates);
eq('sans assigné : heures à part, aucun coût', laborOf(L4, 'pA'), { hours: 8, valuedHours: 0, cost: 0, unvaluedHours: 0, unassignedHours: 8 });
const L5 = laborByProject(data([item('i1', 'pA', 's3', 10), item('i2', 'pA', 's1', null), item('i3', 'pA', 's1', 0)], [{ item_id: 'i1', user_id: 'u1' }]), rates);
eq('élément annulé, non estimé ou à 0 h : ignorés', L5.has('pA'), false);
const L6 = laborByProject(data([item('i1', 'pA', 's1', 4), item('i2', 'pB', 's1', 6)], [{ item_id: 'i1', user_id: 'u1' }, { item_id: 'i2', user_id: 'u2' }]), rates);
eq('séparé par projet', [laborOf(L6, 'pA').cost, laborOf(L6, 'pB').cost], [400, 360]);
eq('projet sans heures : tout à zéro', laborOf(L6, 'pZ'), { hours: 0, valuedHours: 0, cost: 0, unvaluedHours: 0, unassignedHours: 0 });
const L7 = laborByProject(data([item('i1', 'inconnu', 's1', 10)], [{ item_id: 'i1', user_id: 'u1' }]), rates);
eq('élément d\'un projet inconnu (ex. modèle) : ignoré', L7.size, 0);
const L8 = laborByProject(data([item('ph', 'pA', 's1', 20), item('t1', 'pA', 's1', 8, 'ph')], [{ item_id: 'ph', user_id: 'u1' }, { item_id: 't1', user_id: 'u1' }]), rates);
eq('phase ET tâche estimées : les deux comptent (comme la Charge)', laborOf(L8, 'pA').hours, 28);
const L9 = laborByProject(data([item('i1', 'pA', 's1', 1)], [{ item_id: 'i1', user_id: 'u1' }, { item_id: 'i1', user_id: 'u2' }, { item_id: 'i1', user_id: 'u1x' }]), [{ user_id: 'u1', hourly_rate: 100 }, { user_id: 'u2', hourly_rate: 100 }]);
eq('1 h partagée entre 3 : arrondi au centime, total cohérent', [laborOf(L9, 'pA').hours, laborOf(L9, 'pA').cost, laborOf(L9, 'pA').unvaluedHours], [1, 66.67, 0.33]);
const L10 = laborByProject(data([item('i1', 'pA', 's1', 10)], [{ item_id: 'i1', user_id: 'u1' }]), [{ user_id: 'u1', hourly_rate: 0 }]);
eq('taux à 0 (bénévole) : valorisé à 0, pas « sans taux »', laborOf(L10, 'pA'), { hours: 10, valuedHours: 10, cost: 0, unvaluedHours: 0, unassignedHours: 0 });

// Export
const rows = buildBudgetRows([{ id: 'pA', name: 'Festival' }, { id: 'pZ', name: 'Vide' }], lines, L1);
eq('export : 2 lignes + total pour le projet A, rien pour un projet sans ligne', rows.map(r => `${r['Projet']}|${r['Catégorie']}`), ['Festival|Matériel', 'Festival|Prestataires', 'Festival|TOTAL']);
eq('export : écart par ligne', rows[0]['Écart (CHF)'], 700);
eq('export : total du projet', [rows[2]['Prévu (CHF)'], rows[2]['Engagé (CHF)'], rows[2]['Réel (CHF)'], rows[2]['Écart (CHF)']], [1500, 600, 300, 1200]);
eq('export : main-d\'œuvre estimée dans la note du total', rows[2]['Note'], "Main-d'œuvre estimée : 1'000 CHF");
const csv = toCsv(buildBudgetRows([{ id: 'pA', name: '=EVIL()' }], [line('1', 'pA', '+cmd', 1, 0, 2, 'ok; "note"')], new Map()));
eq('export CSV : une catégorie ou un nom qui commence par = ou + est protégé', [csv.includes("'=EVIL()"), csv.includes("'+cmd")], [true, true]);
eq('export CSV : point-virgule et guillemets dans la note', csv.includes('"ok; ""note"""'), true);
eq('export CSV : écart négatif reste un nombre (pas de apostrophe)', csv.includes(';-1;'), true);

// Messages d'erreur
eq('erreur : droit refusé', budgetError({ code: '42501', message: 'new row violates row-level security policy for table "cp_budget_lines"' }), "Tu n'as pas le droit de modifier le budget");
eq('erreur : valeur refusée', budgetError({ code: '23514', message: 'violates check constraint' }).startsWith('Valeur refusée'), true);
eq('erreur : inconnue', budgetError({ message: 'Projet introuvable' }), 'Projet introuvable');

// Temps réellement passé : minutes par personne × taux horaire (centimes arrondis personne par personne)
{ const rates = [{ user_id: 'u1', hourly_rate: 80 }, { user_id: 'u2', hourly_rate: 55.5 }] as any;
  eq('temps réel : 2 h à 80 + 90 min à 55,50 = 160 + 83,25', actualLabor([{ user_id: 'u1', minutes: 120 }, { user_id: 'u2', minutes: 90 }], rates), { minutes: 210, valuedMinutes: 210, unvaluedMinutes: 0, cost: 243.25 });
  eq('temps réel : une personne sans taux est comptée à part, jamais valorisée', actualLabor([{ user_id: 'u1', minutes: 60 }, { user_id: 'u9', minutes: 45 }], rates), { minutes: 105, valuedMinutes: 60, unvaluedMinutes: 45, cost: 80 });
  eq('temps réel : aucun temps', actualLabor([], rates), { minutes: 0, valuedMinutes: 0, unvaluedMinutes: 0, cost: 0 });
  eq('temps réel : un taux de 0 (bénévolat) est valorisé à 0, pas « sans taux »', actualLabor([{ user_id: 'u3', minutes: 60 }], [{ user_id: 'u3', hourly_rate: 0 }] as any), { minutes: 60, valuedMinutes: 60, unvaluedMinutes: 0, cost: 0 });
  eq('temps réel : arrondi au centime par personne (7 min à 33,33 /h = 3,89)', actualLabor([{ user_id: 'u1', minutes: 7 }], [{ user_id: 'u1', hourly_rate: 33.33 }] as any).cost, 3.89);
  eq('temps réel : minutes négatives ou illisibles ignorées (jamais de montant négatif)', actualLabor([{ user_id: 'u1', minutes: -30 }, { user_id: 'u2', minutes: NaN }], rates), { minutes: 0, valuedMinutes: 0, unvaluedMinutes: 0, cost: 0 }); }

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
