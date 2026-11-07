// Les trois listes de la sauvegarde restent d'accord : l'écran (Paramètres), la sauvegarde automatique (fonction d'e-mails) et la liste fermée
// de la restauration (dernière migration qui définit restore_missing_rows). Un oubli = des données absentes d'une sauvegarde ou refusées à la restauration.
import * as fs from 'fs';
import * as path from 'path';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };
const root = process.cwd();   // lancé depuis la racine du dépôt par scripts/run-pilote-unit.cjs
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
// Texte entre crochets qui suit une ancre, sans les commentaires de ligne, puis tous les noms entre apostrophes
const names = (text: string, anchor: RegExp): string[] => {
  const m = anchor.exec(text);
  if (!m) return [];
  const start = text.indexOf('[', m.index);
  const end = text.indexOf('];', start);
  return [...text.slice(start, end).replace(/\/\/[^\n]*/g, '').matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
};

const panel = names(read('src/components/settings/BackupPanel.tsx'), /const TABLES\s*=/);
const edge = names(read('supabase/functions/send-notification-emails/index.ts'), /const BACKUP_TABLES\s*=/);
const migDir = path.join(root, 'supabase', 'migrations');
const withRestore = fs.readdirSync(migDir).filter(f => f.endsWith('.sql') && read(`supabase/migrations/${f}`).includes('FUNCTION public.restore_missing_rows(')).sort();
const lastRestore = withRestore[withRestore.length - 1];
const allowed = names(read(`supabase/migrations/${lastRestore}`), /v_allowed text\[\] := ARRAY/);

eq('l\'écran liste des tables', panel.length > 60, true);
eq('sauvegarde automatique = écran (mêmes tables, même ordre)', edge, panel);
const NOT_RESTORABLE = new Set(['organizations', 'audit_log']);
eq('chaque table de la sauvegarde (sauf entreprise et journal) est dans la liste fermée de la restauration (' + lastRestore + ')', panel.filter(t => !NOT_RESTORABLE.has(t) && !allowed.includes(t)), []);
eq('la liste fermée ne contient aucune table absente de la sauvegarde', allowed.filter(t => !panel.includes(t)), []);
eq('les nouvelles tables PILOTE y sont', ['cp_calendar_days', 'cp_user_capacity', 'cp_baseline_dates'].filter(t => !panel.includes(t) || !allowed.includes(t)), []);
eq('ordre : lignes de base après projets et éléments, capacités après les personnes', [panel.indexOf('cp_baseline_dates') > panel.indexOf('cp_items'), panel.indexOf('cp_baseline_dates') > panel.indexOf('cp_projects'), panel.indexOf('cp_user_capacity') > panel.indexOf('users')], [true, true, true]);
eq('tables sensibles jamais dans la liste', ['organizations', 'audit_log', 'owner_admins', 'organization_modules', 'cp_document_trash'].filter(t => allowed.includes(t)), []);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
