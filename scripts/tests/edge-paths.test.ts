// Liens des e-mails et des notifications téléphone pour les avis PILOTE : la fonction d'envoi (supabase/functions/send-notification-emails/paths.ts)
// doit donner EXACTEMENT les mêmes liens que la cloche de l'application (piloteNotificationPath).
import { pilotePath } from '../../supabase/functions/send-notification-emails/paths';
import { piloteNotificationPath } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

const KINDS = ['cp_assigned', 'cp_team_added', 'cp_dates_changed', 'cp_due_soon', 'cp_overdue', 'cp_comment', 'cp_mention', 'cp_digest'];
const IDS = [undefined, null, '', 'abc-123', 'a b&c'];
let compared = 0; const diff: string[] = [];
for (const kind of KINDS) for (const item of IDS) for (const project of IDS) {
  compared++;
  const a = pilotePath(kind, item, project);
  const b = piloteNotificationPath({ kind, cpItemId: item ?? undefined, cpProjectId: project ?? undefined });
  if (a !== b) diff.push(`${kind}/${item}/${project}: ${a} ≠ ${b}`);
}
eq(`mêmes liens que la cloche sur ${compared} combinaisons (types d'avis PILOTE × élément × projet, vides et caractères spéciaux compris)`, diff, []);

eq('mention : la fiche de l\'élément avec la discussion', pilotePath('cp_mention', 'i1', 'p1'), '/pilote/projets?item=i1&focus=discussion');
eq('message : le projet seul ouvre la discussion du projet', pilotePath('cp_comment', null, 'p1'), '/pilote/projets?project=p1&focus=discussion');
eq('assignation : la fiche de l\'élément, sans discussion', pilotePath('cp_assigned', 'i1', 'p1'), '/pilote/projets?item=i1');
eq('sans cible : « Mes tâches »', pilotePath('cp_overdue', null, null), '/pilote/projets?section=mytasks');
eq('ajouté à l\'équipe sans cible : la liste des projets', pilotePath('cp_team_added'), '/pilote/projets');
eq('un identifiant est encodé (aucun caractère spécial dans le lien)', pilotePath('cp_assigned', 'a b&c'), '/pilote/projets?item=a%20b%26c');
eq('avis qui n\'est pas PILOTE : aucun lien PILOTE (l\'e-mail garde sa page habituelle)', [pilotePath('low_stock', 'i1', 'p1'), pilotePath('request_ready'), pilotePath('')], [null, null, null]);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
