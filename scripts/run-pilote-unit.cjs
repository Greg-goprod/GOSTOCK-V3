// Lance tous les contrôles unitaires PILOTE (sans base ni navigateur) et affiche leur sortie brute.
// Usage : node scripts/run-pilote-unit.cjs        (code de sortie 0 = tout vert)
const path = require('path'); const os = require('os'); const fs = require('fs'); const { spawnSync } = require('child_process');
const esbuild = require('esbuild');
const TESTS = ['gantt-model', 'view-period', 'pilote-links', 'gantt-filters', 'holidays', 'board-calendar', 'pilote-exports', 'workload', 'critical-path', 'dashboard'];
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pilote-unit-'));
let bad = 0;
for (const name of TESTS) {
  const outfile = path.join(out, `${name}.cjs`);
  esbuild.buildSync({ entryPoints: [path.join(__dirname, 'tests', `${name}.test.ts`)], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error',
    define: { 'import.meta.env.VITE_SUPABASE_URL': '"http://x.test"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"k"' } });
  const r = spawnSync(process.execPath, [outfile], { encoding: 'utf8' });
  const lines = (r.stdout || '').split(/\r?\n/).filter(l => /^(OK|ÉCHEC)/.test(l));
  const fails = lines.filter(l => l.startsWith('ÉCHEC')).length;
  console.log(`\n=== ${name} : ${lines.length - fails} OK, ${fails} ÉCHEC (code ${r.status})`);
  (r.stdout || '').split(/\r?\n/).filter(l => l.startsWith('ÉCHEC') || /^\s+(obtenu|attendu)/.test(l)).forEach(l => console.log(l));
  if (r.status !== 0 || fails > 0) { bad++; if (r.stderr) console.log(r.stderr.slice(0, 1500)); }
}
console.log(`\nRÉSULTAT : ${bad === 0 ? 'TOUT VERT' : bad + ' fichier(s) en échec'}`);
process.exit(bad === 0 ? 0 : 1);
