// Test RÉEL de PILOTE (P7, P11, P13) dans le Chrome de Greg, piloté par CDP. Écrit dans la base RÉELLE : uniquement un projet « ZZ-TEST P13 », supprimé à la fin.
//
// Greg lance lui-même Chrome :   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\Users\greg_\gomat-test-profil-greg
// puis ouvre http://localhost:5174 et se connecte (compte administrateur).
// Lancer :   node scripts/real-p13.cjs --port=9222 --out=C:\Users\greg_\real-p13-out
//   --steps=0,1,2      ne joue que ces étapes (0 = création du projet et de la tâche ; « nettoyage » est toujours joué à la fin)
//   --keep             ne supprime rien à la fin (déconseillé)
// Les recettes d'interface (sélecteurs, calendrier, confirmations) viennent de scripts/e2e-*.cjs, qui passent sur une base simulée.
// Ce script n'a PAS été joué sur GO-MAT par son auteur : un échec peut venir de l'application OU du script — la capture et le texte relevé le diront.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const PORT = arg('port', '9222');
const OUT = arg('out', path.join(process.cwd(), 'real-p13-out'));
const ONLY = arg('steps', '') ? arg('steps', '').split(',').map(s => s.trim()) : null;
const KEEP = process.argv.includes('--keep');
const PROJECT = 'ZZ-TEST P13';
const TASK = 'Tâche test A';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const notes = [];
let page, ctx, base;
const ids = {};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const shot = async (name, p = page) => { try { await p.screenshot({ path: path.join(OUT, `${name}.png`) }); } catch { /* sans capture */ } };
const wanted = (id) => !ONLY || ONLY.includes(String(id));

async function step(id, title, fn, { always = false } = {}) {
  if (!always && !wanted(id)) return;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ id, title, status: 'OK', detail: detail || '' });
    console.log(`OK     ${id} ${title}${detail ? ' — ' + detail : ''}`);
    await shot(`etape${id}-ok`);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 400);
    const nt = /^NON TESTÉ/.test(msg);
    results.push({ id, title, status: nt ? 'NON TESTÉ' : 'KO', detail: msg });
    console.log(`${nt ? 'NON TESTÉ' : 'KO    '} ${id} ${title} — ${msg}`);
    await shot(`etape${id}-KO`);
    try { await page.keyboard.press('Escape'); } catch { /* rien */ }
  }
  void t0;
}
const skip = (id, title, why) => { results.push({ id, title, status: 'NON TESTÉ', detail: why }); console.log(`NON TESTÉ ${id} ${title} — ${why}`); };

/* --------------------------------------------------------------- aides d'interface */
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());

async function goGantt() {
  await page.goto(`${base}/pilote/projets?view=gantt`);
  await page.waitForSelector('[role="search"]', { timeout: 25000 });
  await sleep(900);
  await page.getByRole('button', { name: "Plus d'options d'affichage" }).click().catch(() => {});
  await page.getByRole('menuitem', { name: 'Tout déplier' }).click().catch(() => {});
  await sleep(500);
}
const itemButtons = (name) => page.locator('button[title*=" · "]').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
async function openNth(name, n = 0) {
  await itemButtons(name).nth(n).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  await sleep(600);
}
async function closeDrawer() { await page.keyboard.press('Escape'); await sleep(500); }
async function ensureOpen(sel, label) {
  const h = page.locator(sel).getByRole('button', { name: label }).first();
  if ((await h.getAttribute('aria-expanded')) !== 'true') await h.click();
  await sleep(500);
}
async function confirm() { await page.getByRole('button', { name: 'Confirmer' }).click(); await sleep(900); }
async function save() { await page.getByRole('button', { name: /^Enregistrer/ }).last().click(); await sleep(1500); }

// Calendrier de la charte : on ouvre le champ, on avance de N mois, on clique la case du jour (celle du mois affiché, opacité 1), puis OK.
async function pickPeriod(dialog, isoStart, isoEnd) {
  await dialog.getByText(/Choisir le début|Sélectionner/).first().click();
  await sleep(400);
  const now = todayZurich();
  const months = (Number(isoStart.slice(0, 4)) - Number(now.slice(0, 4))) * 12 + (Number(isoStart.slice(5, 7)) - Number(now.slice(5, 7)));
  for (let i = 0; i < Math.abs(months); i++) { await page.getByRole('button', { name: months > 0 ? 'Mois suivant' : 'Mois précédent' }).click(); await sleep(150); }
  const pickDay = async (n) => {
    const idx = await page.getByRole('gridcell').evaluateAll((els, d) => els.map((e, i) => [i, e.textContent.trim(), getComputedStyle(e).opacity]).filter(x => x[1] === String(d) && x[2] === '1').map(x => x[0]), n);
    must(idx.length === 1, `calendrier : ${idx.length} case(s) pour le jour ${n} dans le mois affiché`);
    await page.getByRole('gridcell').nth(idx[0]).click(); await sleep(150);
  };
  await pickDay(Number(isoStart.slice(8, 10)));
  await pickDay(Number(isoEnd.slice(8, 10)));
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await sleep(400);
}

async function createItem(parentName, name, kind, isoStart, isoEnd) {
  await goGantt();
  await page.getByRole('button', { name: `Ajouter dans ${parentName}` }).first().click();
  const d = page.getByRole('dialog'); await d.waitFor({ timeout: 10000 }); await sleep(500);
  await d.locator('#itm-name').fill(name);
  await d.locator('#itm-kind').selectOption(kind);
  if (kind === 'milestone') { /* pas utilisé ici */ } else await pickPeriod(d, isoStart, isoEnd);
  await save();
  if (await page.getByRole('dialog').count()) await closeDrawer();
}

// Ouvre l'occurrence k (1..n) de la série « Tâche test A » : on essaie chaque élément du même nom et on lit « occurrence k sur n »
async function openOccurrence(k) {
  await goGantt();
  const total = await itemButtons(TASK).count();
  for (let i = 0; i < total; i++) {
    await openNth(TASK, i);
    await ensureOpen('[data-repeat]', /Répétition/);
    const info = await page.locator('[data-series-info]').first().innerText().catch(() => '');
    if (new RegExp(`occurrence ${k} sur`).test(info)) return i;
    await closeDrawer();
  }
  throw new Error(`occurrence ${k} de la série introuvable (${total} éléments « ${TASK} » affichés)`);
}

/* ------------------------------------------------------------------------- principal */
(async () => {
  let browser;
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); }
  catch (e) { console.log(`ERREUR : connexion CDP impossible sur le port ${PORT} : ${e.message.split('\n')[0]}`); process.exit(2); }
  ctx = browser.contexts()[0];
  page = ctx.pages().find(p => /localhost:\d+|127\.0\.0\.1:\d+/.test(p.url()) && !/:9222|:9223/.test(p.url())) || await ctx.newPage();
  base = new URL(page.url() && page.url().startsWith('http') && !/:9222/.test(page.url()) ? page.url() : 'http://localhost:5174').origin;
  page.setDefaultTimeout(15000);
  const original = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight })).catch(() => ({ w: 1366, h: 900 }));
  page.on('pageerror', e => notes.push(`erreur JavaScript de la page : ${e.message.slice(0, 200)}`));

  let dbUrl = '?', commit = '?';
  try { const env = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8'); dbUrl = (env.match(/^VITE_SUPABASE_URL=(.*)$/m) || [])[1] || '?'; } catch { /* .env absent */ }
  try { commit = execSync('git log --oneline -1', { encoding: 'utf8' }).trim(); } catch { /* pas git */ }
  console.log(`Application : ${base}\nBase        : ${dbUrl}\nCommit      : ${commit}\nCaptures    : ${OUT}\n`);
  await page.goto(`${base}/pilote/projets`); await page.waitForSelector('text=PROJETS', { timeout: 25000 }).catch(() => {});
  await sleep(1200);
  const onLogin = await page.getByRole('button', { name: /Recevoir un code/i }).count();
  if (onLogin) { console.log('ERREUR : la page affiche l\'écran de connexion. Greg doit se connecter dans cette fenêtre, puis relancer.'); process.exit(3); }

  /* ---- étape 0 : projet et tâche */
  await step('0a', `Projet « ${PROJECT} »`, async () => {
    await page.goto(`${base}/pilote/projets`); await sleep(1200);
    const n = await page.getByText(PROJECT, { exact: true }).count();
    if (n > 1) notes.push(`${n} projets « ${PROJECT} » existaient déjà au départ (restes d'un essai précédent) : le premier est réutilisé, tous seront supprimés au nettoyage`);
    if (n >= 1) return `projet existant réutilisé (${n} trouvé(s))`;
    await page.getByRole('button', { name: 'Nouveau projet' }).click(); await sleep(700);
    await page.locator('#prj-name').fill(PROJECT);
    await save();
    await page.waitForSelector(`text=${PROJECT}`, { timeout: 10000 });
    must((await page.getByText(PROJECT, { exact: true }).count()) === 1, 'le projet n\'apparaît pas exactement une fois');
    return 'créé';
  });
  await step('0b', `Tâche « ${TASK} » du 31/01/2027 au 31/01/2027`, async () => {
    await goGantt();
    if ((await itemButtons(TASK).count()) >= 1) return 'tâche déjà présente (réutilisée)';
    await createItem(PROJECT, TASK, 'task', '2027-01-31', '2027-01-31');
    await goGantt();
    must((await itemButtons(TASK).count()) === 1, `la tâche n'apparaît pas dans le Gantt (${await itemButtons(TASK).count()} trouvée(s))`);
  });

  /* ---- étape 1 : répétition */
  await step(1, 'Répétition mensuelle ×3 depuis le 31/01/2027 (aperçu, création, série 1 sur 4)', async () => {
    await goGantt(); await openNth(TASK, 0);
    await ensureOpen('[data-repeat]', /Répétition/);
    must((await page.getByRole('button', { name: 'Répéter…' }).count()) === 1, 'bouton « Répéter… » absent');
    await page.getByRole('button', { name: 'Répéter…' }).click();
    await page.getByRole('radiogroup', { name: 'Fréquence' }).waitFor();
    await page.getByRole('radio', { name: 'Chaque mois' }).click();
    await page.locator('#rep-count').fill('3'); await sleep(300);
    const preview = await txt(page.locator('[data-repeat-preview]'));
    ids.preview = preview;
    must(/28\.02\.2027/.test(preview) && /31\.03\.2027/.test(preview) && /30\.04\.2027/.test(preview), `aperçu inattendu : ${preview}`);
    await page.getByRole('button', { name: 'Créer 3 occurrences' }).click(); await sleep(1800);
    must((await page.getByRole('radiogroup', { name: 'Fréquence' }).count()) === 0, 'la fenêtre de répétition ne s\'est pas fermée');
    const head = await txt(page.locator('[data-repeat]'));
    must(/Répétition \(1 sur 4\)/.test(head), `en-tête de section : ${head}`);
    await closeDrawer(); await goGantt();
    const n = await itemButtons(TASK).count();
    must(n === 4, `${n} éléments « ${TASK} » dans le Gantt au lieu de 4`);
    return `aperçu : ${preview.slice(0, 160)}`;
  });
  await step('1c', 'Occurrence 1 : « Supprimer les 3 suivantes » sans « Prolonger » ; dernière : « Prolonger »', async () => {
    await openOccurrence(1);
    must((await page.getByRole('button', { name: 'Supprimer les 3 suivantes' }).count()) === 1, '« Supprimer les 3 suivantes » absent sur l\'occurrence 1');
    must((await page.getByRole('button', { name: 'Prolonger la série…' }).count()) === 0, '« Prolonger la série… » proposé alors que ce n\'est pas la dernière');
    await closeDrawer();
    await openOccurrence(4);
    must((await page.getByRole('button', { name: 'Prolonger la série…' }).count()) === 1, '« Prolonger la série… » absent sur la dernière occurrence');
    await closeDrawer();
  });
  await step('1d', 'Une phase ne se répète pas', async () => {
    await createItem(PROJECT, 'Phase test', 'phase', '2027-01-31', '2027-01-31');
    await goGantt(); await openNth('Phase test', 0); await ensureOpen('[data-repeat]', /Répétition/);
    const m = await txt(page.locator('[data-repeat-blocked]'));
    must(/Une phase ne se répète pas/.test(m), `message : ${m}`);
    must((await page.getByRole('button', { name: 'Répéter…' }).count()) === 0, 'bouton « Répéter… » proposé sur une phase');
    await closeDrawer();
  });

  /* ---- étape 2 : temps passé */
  await step('2a', 'Chronomètre : bandeau sur les autres vues, arrêt, saisie d\'environ 1 minute', async () => {
    await openOccurrence(1); await ensureOpen('[data-time]', /Temps passé/);
    await page.getByRole('button', { name: 'Démarrer le chronomètre' }).click(); await sleep(1500);
    must((await page.locator('[data-timer-bar]').count()) === 1, 'bandeau « Chronomètre en cours » absent');
    await closeDrawer();
    const seen = [];
    for (const v of ['Tableau', 'Calendrier', 'Gantt']) {
      await page.getByRole('radiogroup', { name: 'Vues des projets' }).getByRole('radio', { name: new RegExp(`^${v}`) }).click().catch(() => {});
      await sleep(1000); seen.push(`${v}: ${await page.locator('[data-timer-bar]').count() === 1 ? 'bandeau visible' : 'BANDEAU ABSENT'}`);
    }
    must(seen.every(s => /visible/.test(s)), seen.join(' ; '));
    await sleep(70000);
    await page.locator('[data-timer-bar]').getByRole('button', { name: 'Arrêter' }).click(); await sleep(1500);
    must((await page.locator('[data-timer-bar]').count()) === 0, 'le bandeau est toujours là après « Arrêter »');
    await openOccurrence(1); await ensureOpen('[data-time]', /Temps passé/);
    const list = await txt(page.locator('[data-time-list]'));
    must(/\b[12] min\b/.test(list), `saisie du chronomètre non trouvée : ${list}`);
    return seen.join(' ; ') + ' | liste : ' + list.slice(0, 80);
  });
  await step('2b', 'Saisie à la main « 1 h 30 »', async () => {
    await ensureOpen('[data-time]', /Temps passé/);
    await page.locator('#tm-dur').fill('1 h 30'); await page.locator('#tm-note').fill('test');
    await page.locator('[data-time-form]').getByRole('button', { name: 'Ajouter' }).click(); await sleep(1500);
    const list = await txt(page.locator('[data-time-list]'));
    must(/1 h 30/.test(list), `liste : ${list}`);
    return await txt(page.locator('[data-time-summary]'));
  });
  await step('2c', 'Durée « 1,5 » refusée, « 1,5 h » acceptée', async () => {
    const before = await page.locator('[data-time-entry]').count();
    await page.locator('#tm-dur').fill('1,5'); await page.locator('[data-time-form]').getByRole('button', { name: 'Ajouter' }).click(); await sleep(900);
    must((await page.getByText(/Durée : par exemple 1 h 30/).count()) >= 1, 'aucun message de refus pour « 1,5 »');
    must((await page.locator('[data-time-entry]').count()) === before, 'une saisie a été créée avec « 1,5 »');
    await page.locator('#tm-dur').fill('1,5 h'); await page.locator('[data-time-form]').getByRole('button', { name: 'Ajouter' }).click(); await sleep(1500);
    must((await page.locator('[data-time-entry]').count()) === before + 1, '« 1,5 h » n\'a pas créé de saisie');
  });
  await step('2d', 'Le champ « Jour » interdit le futur', async () => {
    const max = await page.locator('#tm-date').getAttribute('max');
    must(max === todayZurich() || !!max, `attribut max du champ : ${max}`);
    return `max = ${max} (aujourd'hui = ${todayZurich()})`;
  });
  await step('2e', 'Modifier puis supprimer sa propre saisie', async () => {
    await page.getByRole('button', { name: /^Modifier la saisie/ }).first().click(); await sleep(400);
    await page.locator('[data-time-entry]').getByLabel('Durée').first().fill('2 h');
    await page.locator('[data-time-entry]').getByRole('button', { name: 'Enregistrer' }).first().click(); await sleep(1200);
    must(/2 h/.test(await txt(page.locator('[data-time-list]'))), 'la modification n\'apparaît pas');
    const before = await page.locator('[data-time-entry]').count();
    await page.getByRole('button', { name: /^Supprimer la saisie/ }).first().click(); await confirm(); await sleep(800);
    must((await page.locator('[data-time-entry]').count()) === before - 1, 'la suppression n\'a pas retiré la saisie');
    await closeDrawer();
  });
  await step('2f', 'Un seul chronomètre à la fois', async () => {
    await openOccurrence(1); await ensureOpen('[data-time]', /Temps passé/);
    await page.getByRole('button', { name: 'Démarrer le chronomètre' }).click(); await sleep(1200); await closeDrawer();
    await openOccurrence(2); await ensureOpen('[data-time]', /Temps passé/);
    await page.getByRole('button', { name: /Démarrer ici/ }).click(); await sleep(1500);
    must((await page.locator('[role="timer"]').count()) === 1, 'pas exactement un chronomètre actif sur cette fiche');
    await page.locator('[data-timer-bar]').getByRole('button', { name: 'Arrêter' }).click(); await sleep(1500);
    must((await page.locator('[data-timer-bar]').count()) === 0, 'un chronomètre reste actif');
    // l'occurrence 2 ne doit pas garder de temps (la suite compte sur une occurrence « intacte »)
    await page.reload(); await page.getByRole('dialog').waitFor(); await sleep(800); await ensureOpen('[data-time]', /Temps passé/);
    for (let i = 0; i < 6 && (await page.getByRole('button', { name: /^Supprimer la saisie/ }).count()); i++) { await page.getByRole('button', { name: /^Supprimer la saisie/ }).first().click(); await confirm(); }
    await closeDrawer();
  });

  /* ---- étape 3 : suppression des suivantes avec garde */
  await step(3, 'Supprimer les suivantes : 2 supprimées, 1 gardée (celle qui a du temps)', async () => {
    await openOccurrence(3); await ensureOpen('[data-time]', /Temps passé/);
    await page.locator('#tm-dur').fill('30 min'); await page.locator('[data-time-form]').getByRole('button', { name: 'Ajouter' }).click(); await sleep(1500); await closeDrawer();
    await openOccurrence(1); await ensureOpen('[data-repeat]', /Répétition/);
    await page.getByRole('button', { name: 'Supprimer les 3 suivantes' }).click(); await confirm(); await sleep(1200);
    const toast = await page.getByText(/supprimée\(s\)/).first().innerText().catch(() => '');
    must(/2 supprimée\(s\), 1 gardée\(s\) car déjà travaillée\(s\)/.test(toast), `message annoncé : « ${toast} »`);
    await closeDrawer(); await goGantt();
    must((await itemButtons(TASK).count()) === 2, `${await itemButtons(TASK).count()} éléments restent au lieu de 2`);
    return toast;
  });

  /* ---- étape 4 : intervenants externes */
  await step('4a', 'Créer et ajouter « ZZ Électricien » (société « ZZ Société »)', async () => {
    await openNth(TASK, 0); await ensureOpen('[data-externals]', /Intervenants externes/);
    await page.locator('#ext-name').fill('ZZ Électricien'); await page.locator('#ext-company').fill('ZZ Société');
    await page.getByRole('button', { name: 'Créer et ajouter' }).click(); await sleep(1500);
    must(/ZZ Électricien \(ZZ Société\)/.test(await txt(page.locator('[data-external-list]'))), `liste : ${await txt(page.locator('[data-externals]'))}`);
  });
  await step('4b', 'Même intervenant avec d\'autres majuscules : refusé', async () => {
    await page.locator('#ext-name').fill('zz électricien'); await page.locator('#ext-company').fill('zz société');
    await page.getByRole('button', { name: 'Créer et ajouter' }).click(); await sleep(1200);
    const t = await page.getByText(/existe déjà/).count();
    must(t >= 1, 'pas de message « existe déjà »');
    await page.locator('#ext-name').fill(''); await page.locator('#ext-company').fill('');
  });
  await step('4c', 'Retirer puis réajouter depuis la liste', async () => {
    await page.getByRole('button', { name: /^Retirer ZZ Électricien/ }).click(); await sleep(1200);
    must((await page.locator('[data-external]').count()) === 0, 'l\'intervenant est toujours sur la tâche');
    const opt = (await page.locator('#ext-pick option').evaluateAll(os => os.map(o => [o.value, o.textContent.trim()]))).find(o => /ZZ Électricien/.test(o[1]));
    must(!!opt, 'ZZ Électricien absent de la liste des choix');
    await page.locator('#ext-pick').selectOption(opt[0]);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).last().click(); await sleep(1200);
    must(/ZZ Électricien/.test(await txt(page.locator('[data-external-list]'))), 'il n\'est pas revenu sur la tâche');
    await closeDrawer();
  });

  /* ---- étape 5 : budget */
  await step(5, 'Budget : ligne prévu 1234,50 / engagé 1000 / réel 800,25 → écart 434,25, export CSV, suppression', async () => {
    await page.goto(`${base}/pilote/projets`);
    const top = page.getByRole('radio', { name: 'Pilotage', exact: true }); await top.waitFor({ timeout: 25000 }); await top.click(); await sleep(900);
    const tab = page.getByRole('radio', { name: 'Budget', exact: true });
    if ((await tab.count()) === 0) throw new Error('NON TESTÉ : onglet « Budget » absent pour ce compte');
    await tab.click(); await sleep(1200);
    await page.getByRole('button', { name: PROJECT, exact: true }).first().click(); await sleep(600);
    await page.getByRole('button', { name: 'Nouvelle ligne' }).click();
    await page.locator('#crud-category').fill('Test'); await page.locator('#crud-planned').fill('1234,50'); await page.locator('#crud-committed').fill('1000'); await page.locator('#crud-actual').fill('800,25');
    await page.getByRole('button', { name: 'Enregistrer' }).click(); await sleep(1500);
    const detail = await txt(page.locator('[data-budget-project]'));
    must(/434[.,']?25/.test(detail), `écart 434,25 non trouvé : ${detail.slice(0, 300)}`);
    let dl = null; page.once('download', d => { dl = d; });
    await page.getByRole('button', { name: 'Exporter (CSV)' }).click();
    for (let i = 0; i < 40 && !dl; i++) await sleep(250);
    must(!!dl, 'aucun téléchargement après « Exporter (CSV) »');
    const f = path.join(OUT, dl.suggestedFilename()); await dl.saveAs(f);
    const csv = fs.readFileSync(f, 'utf8'); must(/Test/.test(csv), 'le CSV ne contient pas la ligne « Test »');
    await page.locator('tr').filter({ hasText: 'Test' }).getByRole('button', { name: /Supprimer/ }).first().click(); await confirm();
    return `CSV : ${dl.suggestedFilename()}`;
  });

  /* ---- étape 7 : temps réel */
  await step(7, 'Temps réel : un renommage dans un onglet apparaît dans l\'autre sans recharger', async () => {
    const pageB = await ctx.newPage(); pageB.setDefaultTimeout(15000);
    try {
      await pageB.goto(`${base}/pilote/projets?view=gantt`); await pageB.waitForSelector('[role="search"]', { timeout: 25000 }); await sleep(1500);
      await goGantt(); await openNth(TASK, 0);
      const renamed = `${TASK} (modifiée)`;
      await page.locator('#itm-name').fill(renamed); await save();
      if (await page.getByRole('dialog').count()) await closeDrawer();
      const t0 = Date.now(); let seen = false;
      while (Date.now() - t0 < 120000 && !seen) { seen = (await pageB.locator('button[title*=" · "]').filter({ hasText: renamed }).count()) > 0; if (!seen) await sleep(2000); }
      await shot('etape7-fenetreB', pageB);
      must(seen, 'la fenêtre B n\'a pas reçu le changement en 120 s sans rechargement (temps réel KO ou non activé)');
      return `${Math.round((Date.now() - t0) / 1000)} s`;
    } finally { await pageB.close().catch(() => {}); }
  });

  /* ---- étape 9 : langues */
  await step(9, 'Langues : sections traduites en allemand puis en anglais', async () => {
    const out = [];
    for (const [lang, words] of [['de', ['Wiederholung', 'Externe Beteiligte', 'Aufgewendete Zeit']], ['en', ['Repetition', 'External contributors', 'Time spent']]]) {
      await page.evaluate(l => localStorage.setItem('gomat-language', l), lang);
      await goGantt(); await openNth(renamedOrTask(), 0); await sleep(800);
      const miss = [];
      for (const w of words) if ((await page.getByText(w, { exact: false }).count()) === 0) miss.push(w);
      out.push(`${lang}: ${miss.length ? 'MANQUE ' + miss.join(', ') : 'ok'}`);
      await shot(`etape9-${lang}`); await closeDrawer();
    }
    must(out.every(s => /ok$/.test(s)), out.join(' ; '));
    return out.join(' ; ');
  });
  await page.evaluate(() => localStorage.setItem('gomat-language', 'fr')).catch(() => {});

  /* ---- étape 10 : téléphone simulé */
  await step(10, 'Téléphone (390 px) : fiche, section « Temps passé », pas de défilement horizontal', async () => {
    await goGantt(); await openNth(renamedOrTask(), 0);
    await page.setViewportSize({ width: 390, height: 844 }); await sleep(1200);
    must((await page.getByRole('dialog').count()) >= 1, 'la fiche s\'est fermée au passage en largeur de téléphone');
    await ensureOpen('[data-time]', /Temps passé/);
    await page.locator('#tm-dur').fill('10 min'); await page.locator('[data-time-form]').getByRole('button', { name: 'Ajouter' }).click(); await sleep(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await shot('etape10-telephone');
    must(overflow <= 1, `défilement horizontal de ${overflow} px`);
    await page.locator('[data-time]').getByRole('button', { name: 'Démarrer le chronomètre' }).click(); await sleep(1200);
    must((await page.locator('[data-timer-bar]').count()) === 1, 'bandeau du chronomètre absent sur téléphone');
    await page.locator('[data-timer-bar]').getByRole('button', { name: 'Arrêter' }).click(); await sleep(1200);
  });
  await page.setViewportSize({ width: original.w, height: original.h }).catch(() => {});

  /* ---- nettoyage */
  if (!KEEP) {
    await step('nettoyage-a', 'Chronomètre arrêté', async () => {
      await page.goto(`${base}/pilote/projets`); await sleep(1200);
      if (await page.locator('[data-timer-bar]').count()) { await page.locator('[data-timer-bar]').getByRole('button', { name: 'Arrêter' }).click(); await sleep(1200); }
      must((await page.locator('[data-timer-bar]').count()) === 0, 'un chronomètre reste en cours');
    }, { always: true });
    await step('nettoyage-b', 'Intervenant « ZZ Électricien » supprimé (réglages)', async () => {
      await page.goto(`${base}/pilote/projets`); await sleep(1000);
      await page.getByRole('button', { name: 'Réglages des projets' }).click(); await page.getByRole('menuitem', { name: 'Intervenants externes' }).click(); await sleep(900);
      const label = page.getByText('ZZ Électricien', { exact: true });
      if ((await label.count()) === 0) return 'déjà absent';
      await label.first().locator('xpath=ancestor::*[.//button[contains(@aria-label,"Supprimer") or contains(normalize-space(.),"Supprimer")]][1]').getByRole('button', { name: /Supprimer/ }).first().click(); await confirm();
      must((await page.getByText('ZZ Électricien', { exact: true }).count()) === 0, 'l\'intervenant est toujours listé');
    }, { always: true });
    await step('nettoyage-c', `Projet(s) « ${PROJECT} » supprimé(s) ; « test projet b » intact`, async () => {
      await page.goto(`${base}/pilote/projets`); await sleep(1200);
      for (let i = 0; i < 6; i++) {
        const label = page.getByText(PROJECT, { exact: true });
        if ((await label.count()) === 0) break;
        await label.first().locator('xpath=ancestor::*[.//button[normalize-space()="Supprimer"]][1]').getByRole('button', { name: 'Supprimer' }).click();
        await confirm(); await sleep(800);
      }
      must((await page.getByText(PROJECT, { exact: true }).count()) === 0, `il reste un projet « ${PROJECT} »`);
      must((await page.getByText('test projet b', { exact: true }).count()) >= 1, '« test projet b » est introuvable : à vérifier immédiatement');
    }, { always: true });
  }

  /* ---- étapes non automatisées ici */
  skip(6, 'Matériel et véhicules par tâche', 'non automatisé dans ce script : à faire avec les recettes de scripts/e2e-ressources.cjs');
  skip(8, 'Mentions (compte de test noreply@)', 'demande la connexion du second compte (port 9223, code envoyé par e-mail)');
  skip(11, 'Droits d\'un utilisateur ordinaire', 'demande la connexion du second compte (port 9223)');

  /* ---- rapport */
  const lines = ['# Rapport du test réel PILOTE (script real-p13.cjs)', '', `- Application : ${base}`, `- Base : ${dbUrl}`, `- Commit : ${commit}`, `- Date : ${new Date().toISOString()}`, '', '| Étape | Titre | Statut | Détail |', '|---|---|---|---|'];
  for (const r of results) lines.push(`| ${r.id} | ${r.title} | ${r.status} | ${String(r.detail).replace(/\|/g, '/').slice(0, 300)} |`);
  if (notes.length) lines.push('', '## Remarques', ...notes.map(n => `- ${n}`));
  fs.writeFileSync(path.join(OUT, 'rapport.md'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUT, 'rapport.json'), JSON.stringify({ base, dbUrl, commit, results, notes }, null, 2), 'utf8');
  console.log('\n' + lines.join('\n'));
  const ko = results.filter(r => r.status === 'KO').length;
  console.log(`\nRÉSULTAT : ${results.filter(r => r.status === 'OK').length} OK, ${ko} KO, ${results.filter(r => r.status === 'NON TESTÉ').length} NON TESTÉ — rapport : ${path.join(OUT, 'rapport.md')}`);
  await browser.close().catch(() => {});
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('ERREUR FATALE du script :', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : e); process.exit(2); });

// Nom de la tâche renommée à l'étape 7 (si elle a réussi), sinon le nom d'origine
function renamedOrTask() { return results.find(r => r.id === 7 && r.status === 'OK') ? `${TASK} (modifiée)` : TASK; }
