// Contrôles des mentions @ (sans affichage) : mention en cours de frappe, suggestions, insertion, surlignage, réglage de l'heure du récapitulatif.
import { insertMention, mentionQuery, splitMentions, suggestPeople, type Person } from '../../src/lib/mentions';
import { parseDigestHour } from '../../src/lib/digestHour';
import { piloteNotificationPath } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

// Mention en cours de frappe
eq('« @ » seul', mentionQuery('Salut @', 7), { start: 6, query: '' });
eq('début de prénom', mentionQuery('Salut @An', 9), { start: 6, query: 'An' });
eq('nom complet en cours (espace permis)', mentionQuery('Salut @Anne Du', 14), { start: 6, query: 'Anne Du' });
eq('au début du texte', mentionQuery('@Br', 3), { start: 0, query: 'Br' });
eq('après un saut de ligne', mentionQuery('Ligne 1\n@Br', 11), { start: 8, query: 'Br' });
eq('collé à une lettre (adresse e-mail) : pas une mention', mentionQuery('contact@exemple', 15), null);
eq('collé à un chiffre : pas une mention', mentionQuery('a1@x', 4), null);
eq('pas de « @ » : rien', mentionQuery('Bonjour', 7), null);
eq('trois mots tapés : plus un nom', mentionQuery('@Anne Du Pont', 13), null);
eq('retour à la ligne après le « @ » : plus une mention', mentionQuery('@Anne\nsuite', 11), null);
eq('trop long (41 caractères) : plus une mention', mentionQuery('@' + 'a'.repeat(41), 42), null);
eq('40 caractères : encore une mention', mentionQuery('@' + 'a'.repeat(40), 41), { start: 0, query: 'a'.repeat(40) });
eq('le curseur avant le « @ » : rien', mentionQuery('Salut @An', 3), null);
eq('un second « @ » plus loin gagne', mentionQuery('@Anne et @Br', 12), { start: 9, query: 'Br' });
eq('deux espaces de suite : plus un nom', mentionQuery('@Anne  D', 8), null);

// Suggestions
const people: Person[] = [
  { id: '1', name: 'Anne Dupont' }, { id: '2', name: 'Anne Dupont-Martin' }, { id: '3', name: 'Bruno Meier' }, { id: '4', name: 'Émilie Zürcher' },
  { id: '5', name: 'Jean-Marc Anne' }, { id: '6', name: '  ' }, { id: '7', name: 'Zoé Bernard' },
];
eq('vide : tout le monde (6 au plus), sans nom vide', suggestPeople(people, '').map(p => p.id), ['1', '2', '3', '4', '5', '7']);
eq('début du nom complet d\'abord, puis début d\'un mot, puis contient', suggestPeople(people, 'anne').map(p => p.id), ['1', '2', '5']);
eq('début du nom de famille', suggestPeople(people, 'meier').map(p => p.id), ['3']);
eq('accents et casse indifférents', suggestPeople(people, 'EMILIE').map(p => p.id), ['4']);
eq('accent tapé alors que le nom n\'en a pas', suggestPeople(people, 'zoé').map(p => p.id), ['7']);
eq('contient (au milieu d\'un mot)', suggestPeople(people, 'ernard').map(p => p.id), ['7']);
eq('aucun résultat', suggestPeople(people, 'xyz'), []);
eq('limite de résultats', suggestPeople(people, '', 2).length, 2);
eq('nom complet exact', suggestPeople(people, 'Anne Dupont').map(p => p.id), ['1', '2']);

// Insertion
eq('remplace « @An » par le nom et une espace', insertMention('Salut @An', 6, 9, 'Anne Dupont'), { text: 'Salut @Anne Dupont ', caret: 19 });
eq('garde le texte après le curseur', insertMention('Salut @An, merci', 6, 9, 'Anne Dupont'), { text: 'Salut @Anne Dupont , merci', caret: 19 });
eq('au début', insertMention('@', 0, 1, 'Bruno Meier'), { text: '@Bruno Meier ', caret: 13 });

// Surlignage (seulement les personnes que la base a retenues)
const seg = (body: string, mentioned: string[]) => splitMentions(body, people, mentioned).map(s => (s.mention ? `[${s.text}]` : s.text)).join('');
eq('une mention surlignée', seg('Salut @Anne Dupont, ok ?', ['1']), 'Salut [@Anne Dupont], ok ?');
eq('texte sans mention : inchangé', splitMentions('Rien ici', people, ['1']), [{ text: 'Rien ici', mention: false }]);
eq('personne non retenue par la base : pas surlignée', seg('Salut @Bruno Meier', ['1']), 'Salut @Bruno Meier');
eq('le nom le plus long gagne (Dupont-Martin avant Dupont)', seg('Pour @Anne Dupont-Martin', ['1', '2']), 'Pour [@Anne Dupont-Martin]');
eq('préfixe seul : « @Anne Dupont » suivi d\'un tiret n\'est pas surligné si seule Anne Dupont est retenue', seg('Pour @Anne Dupont-Martin', ['1']), 'Pour @Anne Dupont-Martin');
eq('majuscules indifférentes, texte d\'origine conservé', seg('Coucou @anne DUPONT !', ['1']), 'Coucou [@anne DUPONT] !');
eq('collé à une lettre : pas surligné', seg('contact@Anne Dupont', ['1']), 'contact@Anne Dupont');
eq('suivi d\'une lettre : pas surligné', seg('@Anne Dupontx', ['1']), '@Anne Dupontx');
eq('ponctuation après : surligné', seg('@Anne Dupont.', ['1']), '[@Anne Dupont].');
eq('deux personnes et du texte autour', seg('@Anne Dupont et @Bruno Meier, merci', ['1', '3']), '[@Anne Dupont] et [@Bruno Meier], merci');
eq('accents (Émilie Zürcher)', seg('Merci @Émilie Zürcher', ['4']), 'Merci [@Émilie Zürcher]');
eq('« @ » seul ou en fin de texte', seg('Email : a@ et @', ['1']), 'Email : a@ et @');
const nested: Person[] = [{ id: '8', name: 'Anne De' }, { id: '9', name: 'Anne De Luca' }];
eq('nom en préfixe d\'un autre suivi d\'une espace : le plus long gagne', splitMentions('Pour @Anne De Luca', nested, ['8', '9']).map(s => (s.mention ? `[${s.text}]` : s.text)).join(''), 'Pour [@Anne De Luca]');
eq('et le plus court seul reste surligné quand le texte s\'arrête là', splitMentions('Pour @Anne De, merci', nested, ['8']).map(s => (s.mention ? `[${s.text}]` : s.text)).join(''), 'Pour [@Anne De], merci');
eq('les segments recomposent le message à l\'identique', splitMentions('Salut @Anne Dupont, ok ?', people, ['1']).map(s => s.text).join(''), 'Salut @Anne Dupont, ok ?');

// Heure du récapitulatif
eq('heure valide', parseDigestHour('9'), 9);
eq('0 accepté', parseDigestHour('0'), 0);
eq('23 accepté', parseDigestHour('23'), 23);
eq('24 refusé : 7', parseDigestHour('24'), 7);
eq('texte refusé : 7', parseDigestHour('abc'), 7);
eq('vide ou absent : 7', [parseDigestHour(''), parseDigestHour(null), parseDigestHour(undefined)], [7, 7, 7]);
eq('espaces autour acceptés', parseDigestHour(' 8 '), 8);
eq('décimale refusée', parseDigestHour('7.5'), 7);
eq('négatif refusé', parseDigestHour('-1'), 7);

// Où mène un clic sur un avis
eq('mention avec tâche : ouvre la fiche sur la discussion', piloteNotificationPath({ kind: 'cp_mention', cpProjectId: 'p1', cpItemId: 'i1' }), '/pilote/projets?item=i1&focus=discussion');
eq('mention sur un projet : ouvre le projet sur la discussion', piloteNotificationPath({ kind: 'cp_mention', cpProjectId: 'p1' }), '/pilote/projets?project=p1&focus=discussion');
eq('nouveau message : inchangé', piloteNotificationPath({ kind: 'cp_comment', cpItemId: 'i1' }), '/pilote/projets?item=i1&focus=discussion');
eq('récapitulatif sans lien : Mes tâches', piloteNotificationPath({ kind: 'cp_digest' }), '/pilote/projets?section=mytasks');
eq('assignation : la fiche, sans la discussion', piloteNotificationPath({ kind: 'cp_assigned', cpItemId: 'i1' }), '/pilote/projets?item=i1');

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
