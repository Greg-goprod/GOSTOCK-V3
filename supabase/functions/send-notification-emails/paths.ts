// Où mène le lien d'un avis PILOTE dans un e-mail ou une notification sur le téléphone.
// MÊMES règles que `piloteNotificationPath` (src/lib/pilote.ts) pour la cloche de l'application : la fiche de l'élément, sinon celle du projet ;
// un message ou une mention ouvre en plus la discussion ; sans cible précise : « Mes tâches » (ou la liste des projets pour « ajouté à l'équipe »).
// Fichier sans dépendance : testé tel quel par scripts/tests/edge-paths.test.ts.
export function pilotePath(kind: string, cpItemId?: string | null, cpProjectId?: string | null): string | null {
  if (!kind.startsWith('cp_')) return null;
  const focus = kind === 'cp_comment' || kind === 'cp_mention' ? '&focus=discussion' : '';
  if (cpItemId) return `/pilote/projets?item=${encodeURIComponent(cpItemId)}${focus}`;
  if (cpProjectId) return `/pilote/projets?project=${encodeURIComponent(cpProjectId)}${focus}`;
  return kind === 'cp_team_added' ? '/pilote/projets' : '/pilote/projets?section=mytasks';
}
