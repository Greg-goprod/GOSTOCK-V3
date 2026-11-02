#!/usr/bin/env node
// PILOTE › Gantt (R3b-1) : éléments (phase, tâche, jalon, sous-tâche) créés par la base et par la fiche, arbre, regroupements, sans date, droits par rôle.
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-gantt.cjs
//
// Prérequis : migrations 47, 48 et 49 appliquées ; le module « Plan annuel et projets » (cp.projects) activé pour l'entreprise des comptes de test
// (Console de la plateforme › Modules). Comptes : E2E_RESP (écrit : droit « cp.projects »), E2E_STAFF et E2E_COLLAB (lisent
// seulement) ; par défaut test.responsable@ / test.magasinier@ / test.collaborateur@example.com. Mot de passe UNIQUEMENT par E2E_PASSWORD.
// Tout ce qui est créé porte « TEST-GANTT » et est supprimé à la fin (projets, programmes, états ajoutés, chantiers de test).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const PASSWORD = process.env.E2E_PASSWORD || '';
const ACCOUNTS = {
  resp: process.env.E2E_RESP || 'test.responsable@example.com',
  staff: process.env.E2E_STAFF || 'test.magasinier@example.com',
  collab: process.env.E2E_COLLAB || 'test.collaborateur@example.com',
};
const OUT_DIR = path.join(__dirname, '..', 'docs', 'tests');
const SHOTS = path.join(OUT_DIR, 'captures-gantt');
const REPORT = path.join(OUT_DIR, 'rapport-gantt.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-GANTT';
const results = [];
const jsErrors = [];
const S = {};
let group = '';

/* ------------------------------------------------------------------ outils */
async function login(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
  const page = await ctx.newPage();
  const c = { who, ctx, page, base: '', key: '' };
  page.on('pageerror', e => jsErrors.push(`${who}: ${e.message}`));
  page.on('request', r => { const h = r.headers(); if (/supabase\.co|\/rest\/v1\//.test(r.url())) { c.base ||= new URL(r.url()).origin; c.key ||= h['apikey'] || ''; } });
  await page.goto(BASE);
  await page.getByRole('button', { name: /J'ai un mot de passe/ }).click();
  await page.locator('#login-email-pw').fill(ACCOUNTS[who]);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  return c;
}
async function api(c, method, route, body, extra = {}) {
  return c.page.evaluate(async ({ base, key, method, route, body, extra }) => {
    const tk = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
    const token = tk ? JSON.parse(localStorage.getItem(tk) || '{}').access_token : key;
    let res;
    try { res = await fetch(base + route, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { return { status: 0, body: { message: `requête bloquée (${e.message})` } }; }
    let json = null; try { json = await res.json(); } catch { /* corps vide */ }
    return { status: res.status, body: json };
  }, { base: c.base, key: c.key, method, route, body, extra });
}
const rpc = (c, n, a = {}) => api(c, 'POST', `/rest/v1/rpc/${n}`, a);
const rows = r => (Array.isArray(r.body) ? r.body : []);
const refused = r => r.status >= 400 || r.status === 0;
const msg = r => (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`;
const ok = (cond, m) => { if (!cond) throw new Error(m); };
const INFO = d => ({ status: 'INFO', detail: d });
const SKIP = d => ({ status: 'NON TESTÉ', detail: d });
const REP = { Prefer: 'return=representation' };

// Heure de Zurich → instant ISO (indépendant du fuseau de la machine)
function zurichIso(day, time) {
  const [y, m, d] = day.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (asUtc - guess)).toISOString();
}

async function step(id, title, fn, page) {
  const e = { group, id, title, status: 'KO', detail: '', shot: '' };
  try { const o = await fn(); e.status = (o && o.status) || 'OK'; e.detail = (o && o.detail) || ''; }
  catch (err) { e.status = 'KO'; e.detail = String(err.message).split('\n')[0]; }
  if (page && ['KO', 'PARTIEL'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-gantt/${f}`; } catch { /* page fermée */ } }
  console.log(`${e.status.padEnd(11)} ${id}  ${title}${e.detail ? ' — ' + e.detail.slice(0, 170) : ''}`);
  results.push(e);
}

(async () => {
  const browser = await chromium.launch();
  const resp = await login(browser, 'resp');
  const staff = await login(browser, 'staff');
  const collab = await login(browser, 'collab');
  const readers = [staff, collab];

  const create = async (c, table, row) => { const r = await api(c, 'POST', `/rest/v1/${table}?select=id`, row, REP); ok(!refused(r), `${table} : ${msg(r)}`); return rows(r)[0]?.id; };
  const open = async (c, url) => { await c.page.goto(`${BASE}${url}`); await c.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 }); await c.page.waitForTimeout(3000); };
  const rowLocator = c => c.page.locator('.group\\/row');
  const expandAll = async c => { await c.page.getByRole('button', { name: 'Tout déplier' }).click(); await c.page.waitForTimeout(500); };

  /* ============ P0 Prérequis ============ */
  group = 'P0 Prérequis';
  await step('P0-module', 'Le module « Plan annuel et projets » (cp.projects) est activé', async () => {
    for (const c of [resp, staff, collab]) { const me = (await rpc(c, 'whoami')).body || {}; ok((me.modules || []).includes('cp.projects'), `${c.who} : module absent`); }
  });
  await step('P0-droits', 'Le responsable écrit ; magasinier et collaborateur lisent seulement', async () => {
    const can = async (c, a) => (await rpc(c, 'rbac_has_any_permission', { p_keys: [`cp.projects:${a}`] })).body === true;
    for (const a of ['create', 'update', 'delete']) { ok(await can(resp, a), `le responsable n'a pas « ${a} »`); ok(!(await can(staff, a)) && !(await can(collab, a)), `un lecteur a « ${a} »`); }
  });

  /* ============ P1 Données ============ */
  group = 'P1 Données';
  await step('P1-prepa', 'Programme, projet, phase, tâches, sous-tâche, jalon, élément sans date', async () => {
    S.prog = await create(resp, 'cp_programs', { name: `${M} Programme` });
    S.proj = await create(resp, 'cp_projects', { name: `${M} Projet`, type: 'rd', program_id: S.prog, starts_on: '2027-02-01', ends_on: '2027-09-30' });
    S.phase = await create(resp, 'cp_items', { project_id: S.proj, kind: 'phase', name: `${M} Phase`, starts_on: '2027-02-01', ends_on: '2027-04-30' });
    S.task = await create(resp, 'cp_items', { project_id: S.proj, parent_id: S.phase, kind: 'task', name: `${M} Tâche`, starts_on: '2027-02-08', ends_on: '2027-02-20' });
    S.sub = await create(resp, 'cp_items', { project_id: S.proj, parent_id: S.task, kind: 'subtask', name: `${M} Sous-tâche`, starts_on: '2027-02-10', ends_on: '2027-02-12' });
    S.mile = await create(resp, 'cp_items', { project_id: S.proj, parent_id: S.phase, kind: 'milestone', name: `${M} Jalon`, starts_on: '2027-04-30', ends_on: '2027-04-30' });
    S.undated = await create(resp, 'cp_items', { project_id: S.proj, kind: 'task', name: `${M} À dater` });
  });
  await step('P1-regles', 'La base refuse une phase sous une tâche et une sous-tâche sous le projet', async () => {
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_items', { project_id: S.proj, parent_id: S.task, kind: 'phase', name: `${M} Mal placée` })), 'phase sous tâche acceptée');
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_items', { project_id: S.proj, kind: 'subtask', name: `${M} Seule` })), 'sous-tâche sous le projet acceptée');
  });

  /* ============ P2 Écran ============ */
  group = 'P2 Écran';
  await step('P2-ouverture', 'PILOTE › Gantt s\'ouvre : groupe « Programme » et projet visibles, éléments repliés', async () => {
    await open(resp, '/pilote/gantt');
    ok(await resp.page.getByRole('radio', { name: '3 mois', exact: true }).count(), 'écran du Gantt inaccessible');
    const names = await rowLocator(resp).allInnerTexts();
    ok(names.some(t => t.includes(`${M} Programme`)), 'programme de test absent');
    ok(names.some(t => t.includes(`${M} Projet`)), 'projet de test absent');
    ok(!names.some(t => t.includes(`${M} Tâche`)), 'les tâches devraient être repliées à l\'ouverture');
  }, resp.page);
  await step('P2-deplier', '« Tout déplier » montre la phase, la tâche, la sous-tâche et le jalon', async () => {
    await expandAll(resp);
    const names = (await rowLocator(resp).allInnerTexts()).join('|');
    for (const n of ['Phase', 'Tâche', 'Sous-tâche', 'Jalon', 'À dater']) ok(names.includes(`${M} ${n}`), `« ${n} » absent`);
  }, resp.page);
  await step('P2-barres', 'Une barre par élément daté, un losange pour le jalon', async () => {
    ok(await resp.page.locator(`[role="button"][aria-label*="${M} Tâche"]`).count() >= 1, 'barre de la tâche absente');
    ok(await resp.page.locator(`[role="button"][aria-label*="${M} Jalon"]`).count() >= 1, 'losange du jalon absent');
  }, resp.page);
  await step('P2-sans-date', 'L\'élément sans date est dans le bac « Sans date »', async () => {
    const t = await resp.page.locator('section[aria-label="Sans date"]').innerText();
    ok(t.includes(`${M} À dater`), 'élément sans date absent du bac');
  }, resp.page);
  await step('P2-zoom-regroupement', 'Périodes affichées et regroupements sans erreur', async () => {
    for (const z of ['1 jour', '1 semaine', '2 semaines', '1 mois', '6 mois', '1 année', '3 mois']) { await resp.page.getByRole('radio', { name: z, exact: true }).click(); await resp.page.waitForTimeout(300); }
    await resp.page.getByRole('radio', { name: 'État', exact: true }).click(); await resp.page.waitForTimeout(400);
    ok((await rowLocator(resp).count()) > 0, 'aucune ligne par état');
    await resp.page.getByRole('radio', { name: 'Type', exact: true }).click(); await resp.page.waitForTimeout(400);
    ok((await resp.page.locator('.group\\/row button.uppercase', { hasText: 'R&D' }).count()) >= 1, 'groupe « R&D » absent');
    await resp.page.getByRole('radio', { name: 'Programme', exact: true }).click(); await resp.page.waitForTimeout(400);
  }, resp.page);

  /* ============ P3 Fiche ============ */
  group = 'P3 Fiche';
  await step('P3-ouvrir', 'Clic sur la tâche : fiche avec type verrouillé et parent', async () => {
    await expandAll(resp);
    await resp.page.locator('.group\\/row button', { hasText: `${M} Tâche` }).first().click(); await resp.page.waitForTimeout(1200);
    ok(await resp.page.locator('#itm-kind').inputValue() === 'task', 'type de la tâche incorrect');
    ok(await resp.page.locator('#itm-kind').isDisabled(), 'le type devrait être verrouillé');
    ok(await resp.page.locator('#itm-parent').inputValue() === S.phase, 'parent incorrect');
  }, resp.page);
  await step('P3-modifier', 'Modifier le nom, cocher une étape ajoutée, enregistrer : tout est en base', async () => {
    await resp.page.locator('#itm-name').fill(`${M} Tâche (révisée)`);
    await resp.page.getByLabel('Nouvelle ligne').fill('Étape de test');
    await resp.page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1800);
    const it = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=name&id=eq.${S.task}`))[0];
    ok(it && it.name === `${M} Tâche (révisée)`, `nom en base = ${it && it.name}`);
    const checks = rows(await api(resp, 'GET', `/rest/v1/cp_item_checks?select=label,done&item_id=eq.${S.task}`));
    ok(checks.length === 1 && checks[0].label === 'Étape de test', `liste à cocher en base = ${JSON.stringify(checks)}`);
  }, resp.page);
  await step('P3-creer', 'Nouvel élément par la fiche : une sous-tâche sous la tâche, avec un responsable', async () => {
    await resp.page.getByRole('button', { name: 'Nouvel élément' }).click(); await resp.page.waitForTimeout(800);
    await resp.page.locator('#itm-project').selectOption({ label: `${M} Projet` });
    await resp.page.locator('#itm-kind').selectOption('subtask');
    await resp.page.locator('#itm-parent').selectOption(S.task);
    await resp.page.locator('#itm-name').fill(`${M} Créée par la fiche`);
    await resp.page.locator('fieldset input[type=checkbox]').first().check();
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1800);
    const it = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=id,kind,parent_id&name=eq.${encodeURIComponent(M + ' Créée par la fiche')}`))[0];
    ok(it && it.kind === 'subtask' && it.parent_id === S.task, `élément créé = ${JSON.stringify(it)}`);
    const m = rows(await api(resp, 'GET', `/rest/v1/cp_item_members?select=user_id&item_id=eq.${it.id}`));
    ok(m.length === 1, `responsables en base = ${m.length}`);
  }, resp.page);
  await step('P3-plus', 'Le « + » d\'une phase propose tâche et jalon, parent figé', async () => {
    await expandAll(resp);
    await resp.page.locator('.group\\/row', { hasText: `${M} Phase` }).first().hover();
    await resp.page.getByRole('button', { name: `Ajouter dans ${M} Phase` }).click(); await resp.page.waitForTimeout(800);
    const kinds = await resp.page.locator('#itm-kind option').allInnerTexts();
    ok(kinds.join('/') === 'Tâche/Jalon', `types proposés = ${kinds.join('/')}`);
    ok(await resp.page.locator('#itm-parent').isDisabled(), 'le parent devrait être figé');
    await resp.page.getByRole('button', { name: 'Annuler' }).click(); await resp.page.waitForTimeout(300);
  }, resp.page);
  await step('P3-placer', '« Placer aujourd\'hui » date l\'élément sans date', async () => {
    await resp.page.getByRole('button', { name: "Placer aujourd'hui" }).first().click(); await resp.page.waitForTimeout(1500);
    const it = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=starts_on,ends_on&id=eq.${S.undated}`))[0];
    ok(it && it.starts_on && it.ends_on, `dates en base = ${JSON.stringify(it)}`);
  }, resp.page);
  await step('P3-supprimer', 'Supprimer la phase : le message annonce les éléments en dessous, tout part en cascade', async () => {
    await expandAll(resp);
    await resp.page.locator('.group\\/row button', { hasText: `${M} Phase` }).first().click(); await resp.page.waitForTimeout(1000);
    await resp.page.getByRole('button', { name: 'Supprimer' }).click(); await resp.page.waitForTimeout(600);
    ok(await resp.page.getByText(/en dessous/).first().isVisible().catch(() => false), 'message de confirmation (« … en dessous ») absent');
    await resp.page.getByRole('button', { name: 'Confirmer' }).click(); await resp.page.waitForTimeout(1500);
    const left = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=id&project_id=eq.${S.proj}&parent_id=not.is.null`)).length;
    ok(left === 0, `éléments enfants restants = ${left}`);
  }, resp.page);

  /* ============ P4 Lecteurs ============ */
  group = 'P4 Lecteurs';
  for (const c of readers) {
    await step(`P4-${c.who}`, `${c.who} : voit le Gantt, aucune création, fiche en lecture seule`, async () => {
      await open(c, '/pilote/gantt');
      ok(await c.page.getByRole('radio', { name: '3 mois', exact: true }).count(), 'écran inaccessible');
      ok((await c.page.getByRole('button', { name: 'Nouvel élément' }).count()) === 0, 'bouton « Nouvel élément » présent');
      ok((await c.page.locator('button[aria-label^="Ajouter dans"]').count()) === 0, 'boutons « + » présents');
      await expandAll(c);
      await c.page.locator('.group\\/row button', { hasText: `${M} Projet` }).first().click().catch(() => {});
      ok((await c.page.getByRole('button', { name: "Placer aujourd'hui" }).count()) === 0, 'bouton « Placer » présent');
    }, c.page);
    await step(`P4-${c.who}-ecriture`, `${c.who} : la base refuse toute écriture sur les éléments`, async () => {
      ok(refused(await api(c, 'POST', '/rest/v1/cp_items', { project_id: S.proj, kind: 'task', name: `${M} Piraté` })), 'création acceptée');
      const patch = await api(c, 'PATCH', `/rest/v1/cp_items?id=eq.${S.undated}`, { name: `${M} Piraté` }, REP);
      ok(refused(patch) || rows(patch).length === 0, 'modification acceptée');
    });
  }

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  const clean = {};
  try {
    const mine = encodeURIComponent(M + '*');
    for (const table of ['cp_projects', 'cp_programs']) { const r = await api(resp, 'DELETE', `/rest/v1/${table}?name=like.${mine}`, undefined, REP); clean[table] = refused(r) ? msg(r) : `${rows(r).length} supprimé(s)`; }
    clean.elements_restants = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=id&name=like.${mine}`)).length;
  } catch (e) { clean.err = e.message; }

  await browser.close();

  /* ============ Rapport ============ */
  const n = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport des tests du Gantt PILOTE', '',
    `Base : GO-MAT · comptes : ${Object.values(ACCOUNTS).join(', ')} · date : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, 'Commit testé : à renseigner (`git log --oneline -1`).', '',
    `**Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO**`, '',
    `Nettoyage : ${JSON.stringify(clean)}`, '',
    '## À corriger (KO et PARTIEL)', '', ...(results.filter(r => ['KO', 'PARTIEL'].includes(r.status)).map(r => `- **${r.status}** ${r.id} — ${r.title} : ${r.detail}${r.shot ? ` ([capture](${r.shot}))` : ''}`)), ...(results.some(r => ['KO', 'PARTIEL'].includes(r.status)) ? [] : ['Aucun.']), '',
    '## Observations (INFO / NON TESTÉ)', '', ...results.filter(r => ['INFO', 'NON TESTÉ'].includes(r.status)).map(r => `- **${r.id}** — ${r.title} : ${r.detail}`), '',
    ...groups.flatMap(g => ['', `## ${g}`, '', '| Point | Verdict | Détail |', '|---|---|---|', ...results.filter(r => r.group === g).map(r => `| ${r.id} — ${r.title.replace(/\|/g, '/')} | ${r.status} | ${r.detail.replace(/\|/g, '/').slice(0, 200)} |`)]),
    '', '## Erreurs JavaScript', '', jsErrors.length ? [...new Set(jsErrors)].slice(0, 20).map(e => `- ${e}`).join('\n') : 'Aucune.', '',
  ];
  fs.writeFileSync(REPORT, md.join('\n'));
  console.log(`\nRapport : ${path.relative(process.cwd(), REPORT)}`);
  console.log(`Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO`);
  process.exit(n('KO') ? 1 : 0);
})();
