// Lance le serveur de développement sur une base SIMULÉE (aucune donnée réelle, aucun accès à GO-MAT), puis les scripts navigateur PILOTE.
// Prérequis : « npm install » fait ; puis, une fois : « npm install --no-save playwright » et « npx playwright install chromium » (playwright n'est pas dans package.json).
// Usage : node scripts/run-pilote-e2e.cjs        (captures, téléchargements et PDF dans %TEMP%\pilote-e2e)
const path = require('path'); const os = require('os'); const fs = require('fs'); const http = require('http'); const { spawn, spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const outDir = path.join(os.tmpdir(), 'pilote-e2e'); fs.mkdirSync(outDir, { recursive: true });
const SCRIPTS = ['e2e-gantt-filtres', 'e2e-calendrier', 'e2e-modeles', 'e2e-tableau-calendrier', 'e2e-exports', 'e2e-charge', 'e2e-critique-base', 'e2e-synthese', 'e2e-groupe-historique', 'e2e-budget', 'e2e-mobile'];
// Playwright n'est pas déclaré dans package.json (comme pour les autres scripts navigateur du dépôt) : on le vérifie et on dit quoi faire
try { require.resolve('playwright', { paths: [root, ...module.paths] }); } catch {
  console.log('ERREUR : le module « playwright » n\'est pas installé. Lance (sans modifier package.json) :\n  npm install --no-save playwright\n  npx playwright install chromium\npuis relance : node scripts/run-pilote-e2e.cjs');
  process.exit(2);
}
const up = () => new Promise(res => { http.get('http://127.0.0.1:5197/', r => { r.resume(); res(true); }).on('error', () => res(false)); });
(async () => {
  if (await up()) { console.log('ERREUR : le port 5197 est déjà utilisé. Ferme ce qui tourne dessus puis relance.'); process.exit(2); }
  const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5197', '--host', '127.0.0.1', '--strictPort'], {
    cwd: root, env: { ...process.env, VITE_SUPABASE_URL: 'http://mock.supabase.test', VITE_SUPABASE_ANON_KEY: 'k' }, stdio: 'ignore',
  });
  let bad = 0;
  try {
    for (let i = 0; i < 60 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
    if (!(await up())) { console.log('ERREUR : le serveur de développement ne démarre pas.'); process.exit(2); }
    for (const name of SCRIPTS) {
      const r = spawnSync(process.execPath, [path.join(__dirname, `${name}.cjs`), outDir], { cwd: root, encoding: 'utf8', timeout: 240000, env: { ...process.env, NODE_PATH: [path.join(root, 'node_modules'), process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter) } });
      const lines = (r.stdout || '').split(/\r?\n/).filter(l => /^(OK|ÉCHEC)|\d+\/\d+ OK/.test(l));
      console.log(`\n=== ${name} (code ${r.status})`);
      lines.forEach(l => console.log(l));
      if (r.status !== 0) { bad++; console.log((r.stderr || '').split(/\r?\n/).slice(0, 12).join('\n')); }
    }
  } finally { vite.kill(); }
  console.log(`\nDossier des captures : ${outDir}`);
  console.log(`RÉSULTAT : ${bad === 0 ? 'TOUT VERT' : bad + ' script(s) en échec'}`);
  process.exit(bad === 0 ? 0 : 1);
})();
