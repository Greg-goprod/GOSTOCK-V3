// Où mène un clic sur un avis PILOTE (sans affichage). Lancer :
//   npx esbuild scripts/tests/pilote-links.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/pilote-links.test.cjs --define:import.meta.env.VITE_SUPABASE_URL='"http://x.test"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"k"' --log-level=error && node /tmp/pilote-links.test.cjs
import { piloteNotificationPath, storageLevel } from '../../src/lib/pilote';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

const P = '11111111-1111-1111-1111-111111111111', I = '22222222-2222-2222-2222-222222222222';
eq('assignation : la fiche de l\'élément', piloteNotificationPath({ kind: 'cp_assigned', cpProjectId: P, cpItemId: I }), `/pilote/projets?item=${I}`);
eq('dates modifiées : la fiche de l\'élément', piloteNotificationPath({ kind: 'cp_dates_changed', cpProjectId: P, cpItemId: I }), `/pilote/projets?item=${I}`);
eq('échéance proche : la fiche de l\'élément', piloteNotificationPath({ kind: 'cp_due_soon', cpProjectId: P, cpItemId: I }), `/pilote/projets?item=${I}`);
eq('retard : la fiche de l\'élément', piloteNotificationPath({ kind: 'cp_overdue', cpProjectId: P, cpItemId: I }), `/pilote/projets?item=${I}`);
eq('nouveau message sur un élément : fiche + discussion', piloteNotificationPath({ kind: 'cp_comment', cpProjectId: P, cpItemId: I }), `/pilote/projets?item=${I}&focus=discussion`);
eq('nouveau message sur un projet : fiche du projet + discussion', piloteNotificationPath({ kind: 'cp_comment', cpProjectId: P }), `/pilote/projets?project=${P}&focus=discussion`);
eq('ajouté à l\'équipe : la fiche du projet', piloteNotificationPath({ kind: 'cp_team_added', cpProjectId: P }), `/pilote/projets?project=${P}`);
eq('dates modifiées sans élément (avis regroupé) : la fiche du projet', piloteNotificationPath({ kind: 'cp_dates_changed', cpProjectId: P }), `/pilote/projets?project=${P}`);
eq('ancien avis sans lien : Mes tâches', piloteNotificationPath({ kind: 'cp_assigned' }), '/pilote/projets?section=mytasks');
eq('ancien avis « équipe » sans lien : la liste des projets', piloteNotificationPath({ kind: 'cp_team_added' }), '/pilote/projets');
eq('un identifiant inattendu est encodé (jamais interprété)', piloteNotificationPath({ kind: 'cp_assigned', cpItemId: 'x&y=1' }), '/pilote/projets?item=x%26y%3D1');
eq('l\'élément prime sur le projet', piloteNotificationPath({ kind: 'cp_assigned', cpProjectId: P, cpItemId: I }).includes('project='), false);

// Jauge de stockage (migration 62)
const GB = 1024 ** 3;
eq('stockage : pas de réponse (migration absente) → pas d\'alerte', storageLevel(null), 'ok');
eq('stockage : illimité → ok, même très rempli', storageLevel({ used: 50 * GB, quota: null }), 'ok');
eq('stockage : 79 % → ok', storageLevel({ used: Math.floor(1.58 * GB), quota: 2 * GB }), 'ok');
eq('stockage : 80 % → presque plein', storageLevel({ used: Math.ceil(1.6 * GB), quota: 2 * GB }), 'warn');
eq('stockage : 99 % → presque plein', storageLevel({ used: Math.floor(1.98 * GB), quota: 2 * GB }), 'warn');
eq('stockage : 100 % → plein', storageLevel({ used: 2 * GB, quota: 2 * GB }), 'full');
eq('stockage : au-delà (dépôts simultanés) → plein', storageLevel({ used: 2 * GB + 5, quota: 2 * GB }), 'full');
eq('stockage : limite 0 → plein', storageLevel({ used: 0, quota: 0 }), 'full');

console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTous les contrôles passent');
process.exit(fails ? 1 : 0);
