// Contrôles du matériel et des véhicules rattachés aux tâches (sans affichage) : quantités saisies, phrases d'avertissement, regroupement par tâche.
import { describeIssue, issuesByItem, parseQuantity, resourceError, type ResourceIssue } from '../../src/lib/resources';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

// Quantités
eq('1 accepté', parseQuantity('1'), 1);
eq('9 999 accepté (plafond)', parseQuantity('9999'), 9999);
eq('10 000 refusé', parseQuantity('10000'), null);
eq('0 refusé', parseQuantity('0'), null);
eq('vide refusé', parseQuantity('   '), null);
eq('espaces autour acceptés', parseQuantity(' 5 '), 5);
eq('décimale refusée', parseQuantity('1.5'), null);
eq('virgule refusée', parseQuantity('1,5'), null);
eq('négatif refusé', parseQuantity('-1'), null);
eq('texte refusé', parseQuantity('12a'), null);
eq('zéros devant acceptés (007 = 7)', parseQuantity('007'), 7);
eq('chiffres pleine chasse refusés', parseQuantity('１２'), null);
eq('exposant refusé', parseQuantity('1e3'), null);

// Phrases
const eqIssue: ResourceIssue = { resource_id: 'r1', item_id: 'i1', kind: 'equipment', ref_id: 'e1', name: 'Perceuse', needed: 3, available: 2, reason: null };
const veIssue: ResourceIssue = { resource_id: 'r2', item_id: 'i1', kind: 'vehicle', ref_id: 'v1', name: 'Camion', needed: 1, available: 0, reason: 'Camion est en maintenance' };
eq('matériel : demandé et disponible', describeIssue(eqIssue), 'Manque de « Perceuse » sur la période : 3 demandé(s), 2 disponible(s)');
eq('matériel : zéro disponible', describeIssue({ ...eqIssue, available: 0 }), 'Manque de « Perceuse » sur la période : 3 demandé(s), 0 disponible(s)');
eq('véhicule : la raison de la base', describeIssue(veIssue), 'Camion est en maintenance');
eq('véhicule sans raison : phrase de secours', describeIssue({ ...veIssue, reason: null }), "Camion n'est pas disponible");

// Par tâche
const by = issuesByItem([eqIssue, veIssue, { ...eqIssue, resource_id: 'r3', item_id: 'i2', name: 'Projecteur', needed: 1, available: 0 }]);
eq('regroupement : la tâche i1 a deux phrases, dans l\'ordre reçu', by.get('i1'), "Manque de « Perceuse » sur la période : 3 demandé(s), 2 disponible(s) · Camion est en maintenance");
eq('regroupement : la tâche i2 en a une', by.get('i2'), 'Manque de « Projecteur » sur la période : 1 demandé(s), 0 disponible(s)');
eq('une tâche sans problème est absente', by.has('i3'), false);
eq('aucun problème : table vide', issuesByItem([]).size, 0);

// Messages d'erreur
eq('erreur : déjà rattaché', resourceError({ code: '23505', message: 'duplicate key' }), 'Déjà rattaché à cette tâche : modifie sa quantité');
eq('erreur : droit refusé', resourceError({ code: '42501', message: 'new row violates row-level security policy' }), "Tu n'as pas le droit de modifier cette tâche");
eq('erreur : quantité refusée', resourceError({ code: '23514', message: 'check constraint' }), 'Quantité refusée : de 1 à 9 999 (un véhicule : 1)');
eq('erreur : message de la base conservé', resourceError({ message: 'Article introuvable' }), 'Article introuvable');

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
