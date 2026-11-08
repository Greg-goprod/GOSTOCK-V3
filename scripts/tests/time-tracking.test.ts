// Contrôles du temps passé (sans affichage) : lecture et affichage des durées, chronomètre, messages d'erreur ; libellé d'un intervenant externe.
import { formatElapsed, formatMinutes, parseDuration, sumMinutes, timeError } from '../../src/lib/timeTracking';
import { externalError, externalLabel } from '../../src/lib/externals';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

// Lecture d'une durée saisie
eq('« 1:30 »', parseDuration('1:30'), 90);
eq('« 0:45 »', parseDuration('0:45'), 45);
eq('« 1 h 30 »', parseDuration('1 h 30'), 90);
eq('« 1h30 »', parseDuration('1h30'), 90);
eq('« 1h »', parseDuration('1h'), 60);
eq('« 2 H » (majuscule)', parseDuration('2 H'), 120);
eq('« 1,5 h » (heures décimales, virgule)', parseDuration('1,5 h'), 90);
eq('« 0.25h »', parseDuration('0.25h'), 15);
eq('« 45 min »', parseDuration('45 min'), 45);
eq('« 45min » et « 45 m »', [parseDuration('45min'), parseDuration('45 m')], [45, 45]);
eq('« 90 » seul = 90 minutes', parseDuration('90'), 90);
eq('« 1 h 30 min »', parseDuration('1 h 30 min'), 90);
eq('espaces autour', parseDuration('  2:00  '), 120);
eq('24 h pile accepté (1 440 min)', [parseDuration('24h'), parseDuration('24:00'), parseDuration('1440')], [1440, 1440, 1440]);
eq('plus de 24 h refusé', [parseDuration('24h01'), parseDuration('25h'), parseDuration('1441'), parseDuration('24:01')], [null, null, null, null]);
eq('zéro refusé', [parseDuration('0'), parseDuration('0:00'), parseDuration('0 min')], [null, null, null]);
eq('minutes ≥ 60 dans « h:mm » refusées', parseDuration('1:75'), null);
eq('minutes ≥ 60 dans « h mm » refusées', parseDuration('1h75'), null);
eq('décimal SANS unité refusé (on ne devine pas)', [parseDuration('1,5'), parseDuration('1.5')], [null, null]);
eq('heures décimales ET minutes refusées', parseDuration('1,5h30'), null);
eq('vide, texte, négatif refusés', [parseDuration(''), parseDuration('beaucoup'), parseDuration('-5'), parseDuration('1h-5')], [null, null, null, null]);
eq('un arrondi à la minute', parseDuration('0,02h'), 1);

// Affichage
eq('0 minute', formatMinutes(0), '0 min');
eq('45 minutes', formatMinutes(45), '45 min');
eq('59 minutes', formatMinutes(59), '59 min');
eq('60 minutes = 1 h', formatMinutes(60), '1 h');
eq('65 minutes = 1 h 05', formatMinutes(65), '1 h 05');
eq('150 minutes = 2 h 30', formatMinutes(150), '2 h 30');
eq('1 440 minutes = 24 h', formatMinutes(1440), '24 h');
eq('10 000 minutes', formatMinutes(10000), '166 h 40');
eq('négatif ramené à 0', formatMinutes(-5), '0 min');
eq('arrondi à la minute', formatMinutes(59.6), '1 h');
eq('chronomètre : 0 s', formatElapsed(0), '00:00:00');
eq('chronomètre : 59 s', formatElapsed(59), '00:00:59');
eq('chronomètre : 1 h 02 min 03 s', formatElapsed(3723), '01:02:03');
eq('chronomètre : plus de 24 h', formatElapsed(90061), '25:01:01');
eq('chronomètre : valeur négative (horloge décalée) ramenée à 0', formatElapsed(-4), '00:00:00');
eq('chronomètre : fraction ignorée', formatElapsed(61.9), '00:01:01');

// Totaux
eq('somme des minutes, chronomètre en cours ignoré', sumMinutes([{ minutes: 30 }, { minutes: null }, { minutes: 45 }]), 75);
eq('somme vide', sumMinutes([]), 0);

// Erreurs
eq('erreur : futur', timeError({ message: 'Pas de temps passé dans le futur' }), 'Pas de temps passé dans le futur');
eq('erreur : durée', timeError({ code: '23514', message: 'check' }), 'Durée refusée : de 1 minute à 24 heures');
eq('erreur : deux chronomètres', timeError({ code: '23505', message: 'duplicate key cp_time_one_running' }), 'Un chronomètre est déjà en cours : arrête-le d\'abord');
eq('erreur : pas de l\'équipe', timeError({ code: '42501', message: 'new row violates row-level security policy' }).startsWith('Tu ne peux pas saisir de temps'), true);
eq('erreur : message de la base conservé', timeError({ message: 'Élément introuvable' }), 'Élément introuvable');

// Intervenants
eq('libellé avec société', externalLabel({ name: 'Jean Prestataire', company: 'Sono SA' }), 'Jean Prestataire (Sono SA)');
eq('libellé sans société', externalLabel({ name: 'Marie', company: null }), 'Marie');
eq('erreur : doublon', externalError({ code: '23505', message: 'x' }), 'Cet intervenant existe déjà (même nom et même société)');
eq('erreur : longueur', externalError({ code: '23514', message: 'x' }).startsWith('Valeur refusée'), true);
eq('erreur : droit', externalError({ code: '42501', message: 'x' }), "Tu n'as pas le droit de modifier les intervenants");

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
