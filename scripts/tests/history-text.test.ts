// Contrôles du texte de l'historique d'une fiche (sans affichage). Lancer : node scripts/run-pilote-unit.cjs
import { describeEntry, type HistoryEntry } from '../../src/lib/historyText';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const labels = { status: (id: string) => ({ s0: 'Pas commencé', s1: 'En cours' } as Record<string, string>)[id] ?? '?', item: (id: string) => (id === 'p' ? 'Montage' : '?'), site: (id: string) => (id === 'c' ? 'Festival Nord' : '?') };
const upd = (changes: Record<string, unknown>): HistoryEntry => ({ at: '2027-03-01T10:00:00Z', who: 'Ana', action: 'update', changes });

eq('création', describeEntry({ at: '', who: '', action: 'insert', changes: { name: 'X' } }, 'item', labels), ['Création']);
eq('suppression', describeEntry({ at: '', who: '', action: 'delete', changes: {} }, 'item', labels), ['Suppression']);
eq('nom', describeEntry(upd({ name: ['A', 'B'] }), 'item', labels), ['Nom : A → B']);
eq('état résolu par son nom', describeEntry(upd({ status_id: ['s0', 's1'] }), 'item', labels), ['État : Pas commencé → En cours']);
eq('dates au format suisse', describeEntry(upd({ starts_on: ['2027-03-01', '2027-03-02'], ends_on: ['2027-03-05', null] }), 'item', labels), ['Début : 01.03.2027 → 02.03.2027', 'Fin : 05.03.2027 → —']);
eq('priorité en clair, vide devient un tiret', describeEntry(upd({ priority: [null, 'high'] }), 'item', labels), ['Priorité : — → Haute']);
eq('parent résolu, estimation en heures', describeEntry(upd({ parent_id: [null, 'p'], estimate_hours: [null, 12.5] }), 'item', labels), ['Parent : — → Montage', 'Estimation (h) : — → 12.5']);
eq('description : seulement « modifiée » (pas de texte long)', describeEntry(upd({ description: ['a'.repeat(500), 'b'] }), 'item', labels), ['Description modifiée']);
eq('plusieurs champs dans l\'ordre de la fiche', describeEntry(upd({ ends_on: ['2027-03-05', '2027-03-06'], name: ['A', 'B'] }), 'item', labels), ['Nom : A → B', 'Fin : 05.03.2027 → 06.03.2027']);
eq('champs techniques ignorés (position, version, projet…)', describeEntry(upd({ position: [1, 2], project_id: ['a', 'b'], updated_at: ['x', 'y'], name: ['A', 'B'] }), 'item', labels), ['Nom : A → B']);
eq('changement sans champ connu : aucune ligne', describeEntry(upd({ position: [1, 2] }), 'item', labels), []);
eq('texte long (hors description) coupé à 60 caractères', describeEntry(upd({ name: ['x'.repeat(100), 'y'] }), 'item', labels), [`Nom : ${'x'.repeat(60)}… → y`]);
eq('projet : type, chantier, mode de décalage, booléen', describeEntry(upd({ type: ['rd', 'site'], site_id: [null, 'c'], link_mode: ['overlap', 'keep_gap'], link_skip_weekends: [true, false] }), 'project', labels),
  ['Type : R&D → Chantier', 'Chantier : — → Festival Nord', 'Mode de décalage : Seulement si les dates se chevauchent → Garder l\'intervalle entre les éléments', 'Éviter les jours non travaillés : Oui → Non'].map(l => l));
eq('valeur inconnue : affichée telle quelle', describeEntry(upd({ priority: ['low', 'bizarre'] }), 'item', labels), ['Priorité : Basse → bizarre']);
eq('modification mal formée (pas un couple) : ignorée', describeEntry(upd({ name: 'A' }), 'item', labels), []);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
