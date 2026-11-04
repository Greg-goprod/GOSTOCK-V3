#!/usr/bin/env node
// PILOTE › Gantt (R3b-1) : éléments (phase, tâche, jalon, sous-tâche) créés par la base et par la fiche, arbre, regroupements, sans date, droits par rôle.
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-gantt.cjs
//
// Prérequis : migrations 47, 48 et 49 appliquées ; le module « Plan annuel et projets » (cp.projects) activé pour l'entreprise des comptes de test
// (Console de la plateforme › Modules). Comptes : E2E_RESP (écrit : droit « cp.projects »), E2E_STAFF et E2E_COLLAB (lisent
// seulement) ; par défaut test.responsable@ / test.magasinier@ / test.collaborateur@example.com. Mot de passe UNIQUEMENT par E2E_PASSWORD.
// Tout ce qui est créé porte « TEST-GANTT » et est supprimé à la fin (projets, états ajoutés, chantiers de test).
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
  // Barre d'outils allégée : échelle, regroupement, « sans date » et « Nouveau » sont des MENUS (boutons qui ouvrent un menu)
  const menuButton = (c, text) => c.page.locator('button[aria-haspopup="menu"]').filter({ hasText: text }).first();
  const pickMenu = async (c, text, item, role) => { await menuButton(c, text).click(); await c.page.getByRole(role, { name: item, exact: true }).click(); await c.page.waitForTimeout(350); };
  const setScale = (c, label) => pickMenu(c, /Échelle/, label, 'menuitemradio');
  const setGrouping = (c, label) => pickMenu(c, /Grouper/, label, 'menuitemradio');
  const newMenu = (c, label) => pickMenu(c, /^\s*Nouveau\s*$/, label, 'menuitem');
  // Les détails (rangé sous, liste à cocher, dépendances) sont repliés dans la fiche : on les ouvre au besoin
  const openDetails = async c => { const b = c.page.getByRole('button', { name: 'Afficher les détails' }); if (await b.count()) { await b.click(); await c.page.waitForTimeout(300); } };
  // Le Gantt s'ouvre sur aujourd'hui s'il est dans le plan (par exemple dès qu'un vrai projet daté existe), sinon sur le plan : on ne suppose
  // jamais la fenêtre de départ. On passe en « 1 année » et on avance d'une année à la fois jusqu'à voir la barre cherchée.
  const showBar = async (c, label) => {
    await setScale(c, '1 année');
    for (let i = 0; i < 24 && !(await c.page.locator(`[role="button"][aria-label*="${label}"]`).count()); i++) { await c.page.getByRole('button', { name: 'Période suivante' }).click(); await c.page.waitForTimeout(250); }
  };
  const expandAll = async c => { await c.page.locator('button[aria-label="Plus d\'options d\'affichage"]').click(); await c.page.getByRole('menuitem', { name: 'Tout déplier' }).click(); await c.page.waitForTimeout(500); };

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
  await step('P1-prepa', 'Projet, phase, tâches, sous-tâche, jalon, élément sans date', async () => {
    S.proj = await create(resp, 'cp_projects', { name: `${M} Projet`, type: 'rd', starts_on: '2027-02-01', ends_on: '2027-09-30' });
    S.phase = await create(resp, 'cp_items', { project_id: S.proj, kind: 'phase', name: `${M} Phase`, starts_on: '2027-02-01', ends_on: '2027-04-30' });
    S.task = await create(resp, 'cp_items', { project_id: S.proj, parent_id: S.phase, kind: 'task', name: `${M} Tâche`, starts_on: '2027-02-08', ends_on: '2027-02-20' });
    S.sub = await create(resp, 'cp_items', { project_id: S.proj, parent_id: S.task, kind: 'subtask', name: `${M} Sous-tâche`, starts_on: '2027-02-10', ends_on: '2027-02-12' });
    S.mile = await create(resp, 'cp_items', { project_id: S.proj, parent_id: S.phase, kind: 'milestone', name: `${M} Jalon`, starts_on: '2027-04-30', ends_on: '2027-04-30' });
    S.undated = await create(resp, 'cp_items', { project_id: S.proj, kind: 'task', name: `${M} À dater` });
    // Depuis la migration 52, on n'assigne une tâche qu'à quelqu'un de l'équipe du projet : le responsable de test y entre.
    S.me = rows(await api(resp, 'GET', `/rest/v1/users?select=id&email=eq.${encodeURIComponent(ACCOUNTS.resp)}`))[0]?.id;
    ok(S.me, 'fiche « users » du responsable introuvable');
    const team = await api(resp, 'POST', '/rest/v1/cp_project_members', [{ project_id: S.proj, user_id: S.me, role: 'lead' }]);
    ok(!refused(team), `équipe : ${msg(team)}`);
  });
  await step('P1-regles', 'La base refuse une phase sous une tâche et une sous-tâche sous le projet', async () => {
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_items', { project_id: S.proj, parent_id: S.task, kind: 'phase', name: `${M} Mal placée` })), 'phase sous tâche acceptée');
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_items', { project_id: S.proj, kind: 'subtask', name: `${M} Seule` })), 'sous-tâche sous le projet acceptée');
  });

  /* ============ P2 Écran ============ */
  group = 'P2 Écran';
  await step('P2-ouverture', 'PILOTE › Gantt s\'ouvre : groupes par état, projet visible, éléments repliés', async () => {
    await open(resp, '/pilote/gantt');
    ok(await menuButton(resp, /Échelle/).count(), 'écran du Gantt inaccessible (menu « Échelle » absent)');
    ok(await menuButton(resp, /Grouper/).count(), 'menu « Grouper » absent');
    // Les titres de groupe sont affichés en majuscules par le style (innerText rend la majuscule) : on compare sans tenir compte de la casse
    const names = (await rowLocator(resp).allInnerTexts()).map(t => t.toLowerCase());
    ok(names.some(t => t.includes('pas commencé')), 'groupe « Pas commencé » absent (regroupement par état par défaut)');
    ok(names.some(t => t.includes(`${M} Projet`.toLowerCase())), 'projet de test absent');
    ok(!names.some(t => t.includes(`${M} Tâche`.toLowerCase())), 'les tâches devraient être repliées à l\'ouverture');
  }, resp.page);
  await step('P2-deplier', '« Tout déplier » montre la phase, la tâche, la sous-tâche et le jalon', async () => {
    await expandAll(resp);
    const names = (await rowLocator(resp).allInnerTexts()).join('|');
    for (const n of ['Phase', 'Tâche', 'Sous-tâche', 'Jalon', 'À dater']) ok(names.includes(`${M} ${n}`), `« ${n} » absent`);
  }, resp.page);
  await step('P2-barres', 'Une barre par élément daté, un losange pour le jalon', async () => {
    await showBar(resp, `${M} Tâche`);
    ok(await resp.page.locator(`[role="button"][aria-label*="${M} Tâche"]`).count() >= 1, 'barre de la tâche absente');
    ok(await resp.page.locator(`[role="button"][aria-label*="${M} Jalon"]`).count() >= 1, 'losange du jalon absent');
  }, resp.page);
  await step('P2-sans-date', 'L\'élément sans date est dans le menu « Sans date (n) »', async () => {
    await menuButton(resp, /Sans date/).click(); await resp.page.waitForTimeout(300);
    const t = await resp.page.getByRole('menu').innerText();
    await resp.page.keyboard.press('Escape'); await resp.page.waitForTimeout(200);
    ok(t.includes(`${M} À dater`), `élément sans date absent du menu : ${t.slice(0, 200)}`);
  }, resp.page);
  await step('P2-zoom-regroupement', 'Échelles, période libre et regroupements sans erreur', async () => {
    for (const z of ['1 jour', '1 semaine', '2 semaines', '1 mois', '6 mois', '1 année', '3 mois']) await setScale(resp, z);
    await menuButton(resp, /Échelle/).click(); await resp.page.getByRole('menuitem', { name: /Période libre/ }).click(); await resp.page.waitForTimeout(400);
    ok(await resp.page.locator('main').getByText(/–/).count() >= 1, 'le sélecteur de plage n\'apparaît pas en période libre');
    await setScale(resp, '3 mois');
    await setGrouping(resp, 'Type'); await resp.page.waitForTimeout(300);
    ok((await resp.page.locator('.group\\/row button.uppercase', { hasText: 'R&D' }).count()) >= 1, 'groupe « R&D » absent');
    await setGrouping(resp, 'État'); await resp.page.waitForTimeout(300);
    ok((await rowLocator(resp).count()) > 0, 'aucune ligne par état');
    await menuButton(resp, /Grouper/).click();
    // allInnerTexts() n'attend rien : on attend d'abord que les choix soient affichés (sinon la liste lue est vide)
    await resp.page.getByRole('menu').getByRole('menuitemradio').first().waitFor({ timeout: 5000 });
    // On lit uniquement le menu ouvert, sans tenir compte de la casse (innerText applique le text-transform du CSS)
    const choices = (await resp.page.getByRole('menu').getByRole('menuitemradio').allInnerTexts()).map(x => x.trim().toLowerCase());
    ok(choices.join('/') === 'état/type', `choix de regroupement lus : « ${choices.join(' / ')} » (attendu : État / Type)`);
    await resp.page.keyboard.press('Escape');
  }, resp.page);

  // Finitions de la frise (inspirées de Notion) : couleur par état, barre fantôme, flèches hors zone, liste masquable
  const hexToRgb = h => { const n = parseInt(h.replace('#', ''), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
  await step('P2b-couleur', 'Couleur des barres : par état (défaut), puis par projet', async () => {
    const st = rows(await api(resp, 'GET', '/rest/v1/cp_statuses?select=id,color&is_system=eq.true'));
    const pr = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=color,status_id&id=eq.${S.proj}`))[0];
    const stColor = st.find(x => x.id === pr.status_id).color;
    await expandAll(resp); await showBar(resp, `${M} Tâche`);
    const borderOf = async () => resp.page.locator(`[role="button"][aria-label*="${M} Tâche"]`).first().evaluate(e => getComputedStyle(e).borderTopColor);
    const task = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=status_id&id=eq.${S.task}`))[0];
    const taskStateColor = st.find(x => x.id === task.status_id).color;
    ok(await borderOf() === hexToRgb(taskStateColor), `couleur de la tâche (par état) = ${await borderOf()} attendu ${hexToRgb(taskStateColor)}`);
    await resp.page.locator('button[aria-label="Plus d\'options d\'affichage"]').click();
    await resp.page.getByRole('menuitemradio', { name: 'Par projet', exact: true }).click(); await resp.page.waitForTimeout(400);
    ok(await borderOf() === hexToRgb(pr.color), `couleur de la tâche (par projet) = ${await borderOf()} attendu ${hexToRgb(pr.color)}`);
    await resp.page.locator('button[aria-label="Plus d\'options d\'affichage"]').click();
    await resp.page.getByRole('menuitemradio', { name: 'Par état', exact: true }).click(); await resp.page.waitForTimeout(300);
    void stColor;
  }, resp.page);
  await step('P2b-fantome', 'Barre fantôme : survoler une ligne sans date propose une plage ; un clic la donne à l\'élément', async () => {
    S.ghostItem = await create(resp, 'cp_items', { project_id: S.proj, kind: 'task', name: `${M} Fantôme` });
    await open(resp, '/pilote/gantt'); await expandAll(resp); await setScale(resp, '1 année');
    const zone = resp.page.locator(`[data-ghost-zone="i:${S.ghostItem}"]`);
    ok(await zone.count() === 1, 'zone de survol absente pour la ligne sans date');
    await zone.scrollIntoViewIfNeeded();
    const box = await zone.boundingBox();
    await resp.page.mouse.move(box.x + box.width / 3, box.y + box.height / 2); await resp.page.waitForTimeout(250);
    ok(await resp.page.locator('[data-ghost-bar]').count() === 1, 'barre fantôme absente au survol');
    ok(await resp.page.locator('[data-range-highlight]').count() === 1, 'plage non éclairée dans l\'en-tête');
    await resp.page.mouse.click(box.x + box.width / 3, box.y + box.height / 2); await resp.page.waitForTimeout(1800);
    const it = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=starts_on,ends_on&id=eq.${S.ghostItem}`))[0];
    ok(it && it.starts_on && it.ends_on && (new Date(it.ends_on) - new Date(it.starts_on)) / 86400000 === 6, `dates en base = ${JSON.stringify(it)} (attendu : 7 jours)`);
  }, resp.page);
  await step('P2b-fleche-hors-zone', 'Une ligne hors de la période affichée a une flèche ; un clic amène la fenêtre sur sa barre', async () => {
    await setScale(resp, '1 jour');
    const jump = resp.page.getByRole('button', { name: `Aller à ${M} Tâche`, exact: true });
    ok(await jump.count() === 1, 'flèche absente pour une tâche hors période');
    await jump.click(); await resp.page.waitForTimeout(500);
    ok(await resp.page.locator(`[role="button"][aria-label*="${M} Tâche"]`).count() >= 1, 'la fenêtre ne s\'est pas amenée sur la tâche');
    await setScale(resp, '3 mois');
  }, resp.page);
  await step('P2b-liste-masquee', 'Masquer la liste des noms : la frise prend toute la largeur ; la réafficher', async () => {
    const menu = () => resp.page.locator('button[aria-label="Plus d\'options d\'affichage"]').click();
    await menu(); await resp.page.getByRole('menuitem', { name: 'Masquer la liste' }).click(); await resp.page.waitForTimeout(400);
    ok(await rowLocator(resp).count() === 0, 'la liste des noms est encore affichée');
    ok(await resp.page.locator(`[role="button"][aria-label*="${M} Tâche"]`).count() >= 1 || await resp.page.locator('[data-jump]').count() >= 1, 'plus de barres ni de flèches une fois la liste masquée');
    await menu(); await resp.page.getByRole('menuitem', { name: 'Afficher la liste' }).click(); await resp.page.waitForTimeout(400);
    ok(await rowLocator(resp).count() > 0, 'la liste n\'est pas revenue');
  }, resp.page);

  /* ============ UI-4 création rapide ============ */
  group = 'UI-4 Création rapide';
  const focusedId = c => c.page.evaluate(() => document.activeElement && document.activeElement.id);
  const addInGroup = async (c, groupName) => {
    const row = rowLocator(c).filter({ has: c.page.locator('button.uppercase', { hasText: groupName }) }).first();
    ok(await row.count() === 1, `ligne de groupe « ${groupName} » absente`);
    await row.hover(); await row.locator('button[aria-label^="Ajouter dans"]').click(); await c.page.waitForTimeout(800);
  };
  await step('U4-groupe-etat', 'Le « + » d\'un groupe d\'état crée un projet qui reprend cet état ; titre en focus, détails repliés', async () => {
    await open(resp, '/pilote/gantt'); await setGrouping(resp, 'État');
    const pr = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=status_id&id=eq.${S.proj}`))[0];
    const st = rows(await api(resp, 'GET', `/rest/v1/cp_statuses?select=name&id=eq.${pr.status_id}`))[0];
    await addInGroup(resp, st.name);
    ok(await focusedId(resp) === 'prj-name', `focus sur « ${await focusedId(resp)} » au lieu du nom du projet`);
    ok((await resp.page.locator('#prj-status').innerText()).trim().toLowerCase() === st.name.trim().toLowerCase(), `état affiché = « ${(await resp.page.locator('#prj-status').innerText()).trim()} » (attendu : ${st.name})`);
    ok(await resp.page.locator('#prj-site').count() === 0 && await resp.page.locator('#prj-linkmode').count() === 0, 'les détails devraient être repliés à la création');
    await resp.page.locator('#prj-name').fill(`${M} Depuis groupe`);
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1800);
    const p = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=status_id&name=eq.${encodeURIComponent(M + ' Depuis groupe')}`))[0];
    ok(p && p.status_id === pr.status_id, `projet créé = ${JSON.stringify(p)} (attendu l'état ${pr.status_id})`);
  }, resp.page);
  await step('U4-groupe-type', 'Le « + » d\'un groupe de type crée un projet de ce type', async () => {
    await setGrouping(resp, 'Type');
    await addInGroup(resp, 'R&D');
    ok(await resp.page.locator('#prj-type').inputValue() === 'rd', `type prérempli = ${await resp.page.locator('#prj-type').inputValue()}`);
    await resp.page.getByRole('button', { name: 'Annuler' }).last().click(); await resp.page.waitForTimeout(500);
    await setGrouping(resp, 'État');
  }, resp.page);
  await step('U4-focus-fiche', '« Nouveau › Nouvelle tâche » : le curseur est dans le nom de l\'élément', async () => {
    await newMenu(resp, 'Nouvelle tâche'); await resp.page.waitForTimeout(800);
    ok(await focusedId(resp) === 'itm-name', `focus sur « ${await focusedId(resp)} » au lieu du nom de l'élément`);
    await resp.page.getByRole('button', { name: 'Annuler' }).last().click(); await resp.page.waitForTimeout(500);
  }, resp.page);

  await step('U5-choix-etat', 'Choix de l\'état : menu groupé par famille avec pastilles ; l\'état choisi est enregistré', async () => {
    const done = rows(await api(resp, 'GET', '/rest/v1/cp_statuses?select=id,name&is_system=eq.true&family=eq.done'))[0];
    await newMenu(resp, 'Nouvelle tâche'); await resp.page.waitForTimeout(800);
    await resp.page.locator('#itm-status').click();
    const menu = resp.page.getByRole('menu'); await menu.getByRole('menuitemradio').first().waitFor({ timeout: 5000 });
    const groups = (await menu.getByRole('group').allInnerTexts()).length;
    ok(groups >= 4, `familles affichées : ${groups} (attendu : au moins 4)`);
    const text = (await menu.innerText()).toLowerCase();
    const order = ['pas commencé', 'en cours', 'terminé', 'annulé'].map(x => text.indexOf(x));
    ok(order.every(i => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]), `familles absentes ou dans le désordre : ${JSON.stringify(order)}`);
    await menu.getByRole('menuitemradio', { name: done.name, exact: true }).click(); await resp.page.waitForTimeout(300);
    await resp.page.locator('#itm-project').selectOption({ label: `${M} Projet` });
    await resp.page.locator('#itm-name').fill(`${M} État choisi`);
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1800);
    const it = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=status_id&name=eq.${encodeURIComponent(M + ' État choisi')}`))[0];
    ok(it && it.status_id === done.id, `état en base = ${it && it.status_id} (attendu : ${done.id})`);
  }, resp.page);

  /* ============ P3 Fiche ============ */
  group = 'P3 Fiche';
  await step('P3-ouvrir', 'Clic sur la tâche : fiche avec le type en sous-titre, propriétés clés visibles, parent dans les détails', async () => {
    await expandAll(resp);
    await resp.page.locator('.group\\/row button', { hasText: `${M} Tâche` }).first().click(); await resp.page.waitForTimeout(1200);
    // Plusieurs éléments portent role="dialog" (la fiche, mais aussi d'autres panneaux) : on cible la fiche, celle qui contient le champ du nom
    const drawer = resp.page.locator('[role="dialog"]').filter({ has: resp.page.locator('#itm-name') });
    ok(await drawer.count() === 1, `fiche : ${await drawer.count()} panneau(x) contenant le champ du nom (attendu : 1)`);
    ok((await drawer.innerText()).includes(`Tâche · ${M} Projet`), 'sous-titre « Tâche · projet » absent');
    ok(await resp.page.locator('#itm-kind').count() === 0, 'le type ne se change pas : il ne doit pas être proposé en modification');
    for (const id of ['#itm-status', '#itm-priority', '#itm-period', '#itm-desc', '#itm-assign']) ok(await resp.page.locator(id).count() === 1, `propriété clé absente : ${id}`);
    ok(await resp.page.locator('#itm-parent').count() === 0, 'le parent devrait être replié dans les détails');
    await openDetails(resp);
    ok(await resp.page.locator('#itm-parent').inputValue() === S.phase, 'parent incorrect');
  }, resp.page);
  await step('P3-modifier', 'Modifier le nom, cocher une étape ajoutée, enregistrer : tout est en base', async () => {
    await resp.page.locator('#itm-name').fill(`${M} Tâche (révisée)`);
    await openDetails(resp);
    await resp.page.getByLabel('Nouvelle ligne').fill('Étape de test');
    await resp.page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1800);
    const it = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=name&id=eq.${S.task}`))[0];
    ok(it && it.name === `${M} Tâche (révisée)`, `nom en base = ${it && it.name}`);
    const checks = rows(await api(resp, 'GET', `/rest/v1/cp_item_checks?select=label,done&item_id=eq.${S.task}`));
    ok(checks.length === 1 && checks[0].label === 'Étape de test', `liste à cocher en base = ${JSON.stringify(checks)}`);
  }, resp.page);
  await step('P3-creer', 'Nouvel élément par la fiche : une sous-tâche sous la tâche, avec un responsable', async () => {
    await newMenu(resp, 'Nouvelle tâche'); await resp.page.waitForTimeout(800);
    await resp.page.locator('#itm-project').selectOption({ label: `${M} Projet` });
    await resp.page.locator('#itm-kind').selectOption('subtask');
    await resp.page.locator('#itm-parent').selectOption(S.task);
    await resp.page.locator('#itm-name').fill(`${M} Créée par la fiche`);
    // Assignés : un menu à choix multiple (on coche la première personne de l'équipe)
    await resp.page.locator('#itm-assign').click(); await resp.page.getByRole('menuitemradio').first().click(); await resp.page.keyboard.press('Escape'); await resp.page.waitForTimeout(200);
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
    await openDetails(resp);
    ok(await resp.page.locator('#itm-parent').isDisabled(), 'le parent devrait être figé');
    await resp.page.getByRole('button', { name: 'Annuler' }).click(); await resp.page.waitForTimeout(300);
  }, resp.page);
  await step('P3-placer', '« Placer aujourd\'hui » date l\'élément sans date', async () => {
    // Le menu contient aussi la sous-tâche créée à l'étape précédente (sans date) : on choisit SON entrée ; cliquer un élément le place aujourd'hui
    await menuButton(resp, /Sans date/).click(); await resp.page.waitForTimeout(300);
    await resp.page.getByRole('menuitemradio').filter({ hasText: `${M} À dater` }).click(); await resp.page.waitForTimeout(1500);
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

  /* ============ P3b Gestes (glisser, bords, clavier, « + Nouveau ») ============ */
  group = 'P3b Gestes';
  const zurichToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
  const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const dates = async id => rows(await api(resp, 'GET', `/rest/v1/cp_items?select=starts_on,ends_on&id=eq.${id}`))[0];
  await step('P3b-prepa', 'Projet « Gestes » : phase, tâche et sous-tâche datées à partir d\'aujourd\'hui (donc visibles à l\'ouverture)', async () => {
    const t = zurichToday();
    S.gp = await create(resp, 'cp_projects', { name: `${M} Gestes`, type: 'admin' });
    S.gPhase = await create(resp, 'cp_items', { project_id: S.gp, kind: 'phase', name: `${M} G-Phase`, starts_on: t, ends_on: addDays(t, 8) });
    S.gTask = await create(resp, 'cp_items', { project_id: S.gp, parent_id: S.gPhase, kind: 'task', name: `${M} G-Tâche`, starts_on: t, ends_on: addDays(t, 5) });
    S.gSub = await create(resp, 'cp_items', { project_id: S.gp, parent_id: S.gTask, kind: 'subtask', name: `${M} G-Sous`, starts_on: addDays(t, 1), ends_on: addDays(t, 3) });
    await open(resp, '/pilote/gantt'); await expandAll(resp);
    S.bar = n => resp.page.locator(`[role="button"][aria-label*="${M} ${n}"]`).first();
    ok(await S.bar('G-Tâche').count(), 'barre de la tâche absente de la fenêtre affichée');
  }, resp.page);
  await step('P3b-clavier-deplacer', 'Flèche droite sur la tâche : elle ET sa sous-tâche se décalent d\'un jour (la phase ne bouge pas)', async () => {
    const before = { task: await dates(S.gTask), sub: await dates(S.gSub), phase: await dates(S.gPhase) };
    await S.bar('G-Tâche').focus(); await resp.page.keyboard.press('ArrowRight'); await resp.page.waitForTimeout(2200);
    const after = { task: await dates(S.gTask), sub: await dates(S.gSub), phase: await dates(S.gPhase) };
    ok(after.task.starts_on === addDays(before.task.starts_on, 1) && after.task.ends_on === addDays(before.task.ends_on, 1), `tâche : ${JSON.stringify(before.task)} → ${JSON.stringify(after.task)}`);
    ok(after.sub.starts_on === addDays(before.sub.starts_on, 1), `sous-tâche non décalée : ${JSON.stringify(after.sub)}`);
    ok(JSON.stringify(after.phase) === JSON.stringify(before.phase), 'la phase ne devait pas bouger');
  }, resp.page);
  await step('P3b-clavier-bord', 'Maj + flèche droite sur la sous-tâche : sa fin avance d\'un jour, son début ne bouge pas', async () => {
    const before = await dates(S.gSub);
    await S.bar('G-Sous').focus(); await resp.page.keyboard.press('Shift+ArrowRight'); await resp.page.waitForTimeout(2200);
    const after = await dates(S.gSub);
    ok(after.starts_on === before.starts_on && after.ends_on === addDays(before.ends_on, 1), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }, resp.page);
  await step('P3b-souris-deplacer', 'Glisser la phase de +2 jours à la souris : la phase, la tâche et la sous-tâche se décalent de 2 jours', async () => {
    const before = { phase: await dates(S.gPhase), task: await dates(S.gTask), sub: await dates(S.gSub) };
    const taskBox = await S.bar('G-Tâche').boundingBox();
    const nDays = (new Date(before.task.ends_on) - new Date(before.task.starts_on)) / 86400000 + 1;
    const dayPx = taskBox.width / nDays;
    const box = await S.bar('G-Phase').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await resp.page.mouse.move(x, y); await resp.page.mouse.down();
    await resp.page.mouse.move(x + dayPx, y, { steps: 4 }); await resp.page.mouse.move(x + dayPx * 2, y, { steps: 4 });
    await resp.page.mouse.up(); await resp.page.waitForTimeout(2500);
    const after = { phase: await dates(S.gPhase), task: await dates(S.gTask), sub: await dates(S.gSub) };
    for (const k of ['phase', 'task', 'sub']) ok(after[k].starts_on === addDays(before[k].starts_on, 2) && after[k].ends_on === addDays(before[k].ends_on, 2), `${k} : ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
  }, resp.page);
  await step('P3b-souris-bord', 'Tirer le bord droit de la tâche de +2 jours : seule sa fin change', async () => {
    const before = { task: await dates(S.gTask), sub: await dates(S.gSub) };
    const nDays = (new Date(before.task.ends_on) - new Date(before.task.starts_on)) / 86400000 + 1;
    const taskBox = await S.bar('G-Tâche').boundingBox();
    const dayPx = taskBox.width / nDays;
    const handle = await resp.page.locator(`[role="button"][aria-label*="${M} G-Tâche"] [data-handle="end"]`).boundingBox();
    const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
    await resp.page.mouse.move(x, y); await resp.page.mouse.down(); await resp.page.mouse.move(x + dayPx * 2, y, { steps: 5 }); await resp.page.mouse.up(); await resp.page.waitForTimeout(2200);
    const after = { task: await dates(S.gTask), sub: await dates(S.gSub) };
    ok(after.task.starts_on === before.task.starts_on && after.task.ends_on === addDays(before.task.ends_on, 2), `tâche : ${JSON.stringify(before.task)} → ${JSON.stringify(after.task)}`);
    ok(JSON.stringify(after.sub) === JSON.stringify(before.sub), 'la sous-tâche ne devait pas bouger');
  }, resp.page);
  await step('P3b-clic-fiche', 'Un clic sans mouvement ouvre toujours la fiche', async () => {
    await S.bar('G-Tâche').click(); await resp.page.waitForTimeout(1200);
    ok(await resp.page.locator('#itm-name').inputValue() === `${M} G-Tâche`, 'fiche de la tâche non ouverte');
    await resp.page.getByRole('button', { name: 'Annuler' }).click(); await resp.page.waitForTimeout(400);
  }, resp.page);
  await step('P3b-nouveau', '« + Nouveau » dans la liste : une tâche créée sous la phase, avec des dates, et la saisie reste ouverte', async () => {
    ok((await resp.page.getByRole('button', { name: 'Nouveau', exact: true }).count()) >= 1, 'aucune ligne « + Nouveau »');
    // La ligne « + Nouveau » de la phase de test : on repère celle qui suit « G-Tâche » (un seul niveau sous la phase)
    const target = resp.page.getByRole('button', { name: 'Nouveau', exact: true });
    const n = await target.count(); let clicked = false;
    for (let i = 0; i < n && !clicked; i++) {
      await target.nth(i).click(); await resp.page.waitForTimeout(300);
      const kinds = await resp.page.locator('select[aria-label="Type du nouvel élément"] option').allInnerTexts();
      if (kinds.join('/') === 'Tâche/Jalon') { clicked = true; } else { await resp.page.keyboard.press('Escape'); }
    }
    ok(clicked, 'ligne « + Nouveau » d\'une phase introuvable');
    await resp.page.getByLabel('Nom du nouvel élément').fill(`${M} G-Rapide`); await resp.page.keyboard.press('Enter'); await resp.page.waitForTimeout(2000);
    const made = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=id,kind,parent_id,starts_on,ends_on,project_id&name=eq.${encodeURIComponent(M + ' G-Rapide')}`));
    ok(made.length === 1, `éléments créés = ${made.length}`);
    ok(made[0].kind === 'task' && made[0].starts_on && made[0].ends_on, `élément = ${JSON.stringify(made[0])}`);
    ok(await resp.page.getByLabel('Nom du nouvel élément').count() >= 1, 'la saisie ne reste pas ouverte');
  }, resp.page);

  /* ============ P3c Dépendances ============ */
  group = 'P3c Dépendances';
  const dts = async id => rows(await api(resp, 'GET', `/rest/v1/cp_items?select=starts_on,ends_on&id=eq.${id}`))[0];
  await step('P3c-prepa', 'Projet « Liens » : deux tâches qui se chevauchent, une troisième plus tard', async () => {
    S.lp = await create(resp, 'cp_projects', { name: `${M} Liens`, type: 'admin' });
    // Lundi 1er mars 2027 : le 6 est un samedi ; le 29 mars est un lundi
    S.lA = await create(resp, 'cp_items', { project_id: S.lp, kind: 'task', name: `${M} L-A`, starts_on: '2027-03-01', ends_on: '2027-03-05' });
    S.lB = await create(resp, 'cp_items', { project_id: S.lp, kind: 'task', name: `${M} L-B`, starts_on: '2027-03-03', ends_on: '2027-03-08' });
    S.lC = await create(resp, 'cp_items', { project_id: S.lp, kind: 'task', name: `${M} L-C`, starts_on: '2027-03-29', ends_on: '2027-03-31' });
    const p = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=link_mode,link_skip_weekends&id=eq.${S.lp}`))[0];
    ok(p.link_mode === 'overlap' && p.link_skip_weekends === true, `réglages par défaut = ${JSON.stringify(p)}`);
  });
  await step('P3c-creer', 'Dépendance A → B : B (qui chevauchait) passe au lundi 8 mars, même durée (6 jours : 8 → 13)', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_item_links?select=id', { predecessor_id: S.lA, successor_id: S.lB }, REP);
    ok(!refused(r), `création : ${msg(r)}`); S.link1 = rows(r)[0]?.id;
    const b = await dts(S.lB);
    ok(b.starts_on === '2027-03-08' && b.ends_on === '2027-03-13', `B = ${JSON.stringify(b)}`);
  });
  await step('P3c-cascade', 'Décaler A de +7 jours par la base : B suit (au lundi 15) ; C, plus tard, ne bouge pas', async () => {
    const r = await rpc(resp, 'cp_shift_item', { p_item_id: S.lA, p_days: 7 });
    ok(!refused(r), `décalage : ${msg(r)}`);
    const a = await dts(S.lA), b = await dts(S.lB), c = await dts(S.lC);
    ok(a.starts_on === '2027-03-08' && a.ends_on === '2027-03-12', `A = ${JSON.stringify(a)}`);
    ok(b.starts_on === '2027-03-15' && b.ends_on === '2027-03-20', `B = ${JSON.stringify(b)}`);
    ok(c.starts_on === '2027-03-29', `C a bougé : ${JSON.stringify(c)}`);
  });
  await step('P3c-refus', 'La base refuse la boucle (B → A), la même dépendance deux fois et un élément avec lui-même', async () => {
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: S.lB, successor_id: S.lA })), 'boucle acceptée');
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: S.lA, successor_id: S.lB })), 'doublon accepté');
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: S.lA, successor_id: S.lA })), 'auto-dépendance acceptée');
  });
  await step('P3c-fleche', 'Écran : une flèche relie A et B sur le Gantt', async () => {
    await resp.page.goto(`${BASE}/pilote/gantt`); await resp.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 }); await resp.page.waitForTimeout(3000);
    await expandAll(resp);
    // Fenêtre : on affiche mars 2027 avec la période libre « 1 mois » ancrée sur le plan ; les barres de test sont en 2027
    await setScale(resp, '1 année');
    for (let i = 0; i < 24 && !(await resp.page.locator(`[role="button"][aria-label*="${M} L-A"]`).count()); i++) { await resp.page.getByRole('button', { name: 'Période suivante' }).click(); await resp.page.waitForTimeout(250); }
    ok(await resp.page.locator(`[role="button"][aria-label*="${M} L-A"]`).count(), 'barre de L-A absente de la fenêtre');
    ok((await resp.page.locator('svg path[data-link]').count()) >= 1, 'aucune flèche de dépendance');
  }, resp.page);
  await step('P3c-fiche', 'Fiche de B : « Commence après » liste A ; ajout de A → C par la fiche de C, puis retrait', async () => {
    await resp.page.locator(`[role="button"][aria-label*="${M} L-B"]`).first().click(); await resp.page.waitForTimeout(1200);
    await openDetails(resp);
    const txt = await resp.page.locator('fieldset:has(legend:text("Dépendances"))').innerText();
    ok(txt.includes(`${M} L-A`), `A absent de « Commence après » : ${txt.slice(0, 160)}`);
    await resp.page.getByRole('button', { name: 'Annuler' }).click(); await resp.page.waitForTimeout(400);
    await resp.page.locator(`[role="button"][aria-label*="${M} L-C"]`).first().click(); await resp.page.waitForTimeout(1200);
    await openDetails(resp);
    await resp.page.locator('select[aria-label="Commence après l\'élément"]').selectOption({ label: `Tâche · ${M} L-A` });
    await resp.page.getByRole('button', { name: 'Ajouter la dépendance' }).click(); await resp.page.waitForTimeout(1800);
    const l = rows(await api(resp, 'GET', `/rest/v1/cp_item_links?select=id&predecessor_id=eq.${S.lA}&successor_id=eq.${S.lC}`));
    ok(l.length === 1, `dépendance A → C créée = ${l.length}`);
    await resp.page.getByRole('button', { name: new RegExp(`^Retirer la dépendance avec ${M} L-A`) }).click(); await resp.page.waitForTimeout(1800);
    ok(rows(await api(resp, 'GET', `/rest/v1/cp_item_links?select=id&predecessor_id=eq.${S.lA}&successor_id=eq.${S.lC}`)).length === 0, 'dépendance A → C non retirée');
    await resp.page.getByRole('button', { name: 'Annuler' }).click(); await resp.page.waitForTimeout(300);
  }, resp.page);
  await step('P3c-mode-garder', 'Réglage « Garder l\'intervalle » : A +3 jours → B suit de 3 jours (sans week-end évité)', async () => {
    ok(!refused(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.lp}`, { link_mode: 'keep_gap', link_skip_weekends: false })), 'réglage refusé');
    const before = await dts(S.lB);
    ok(!refused(await rpc(resp, 'cp_shift_item', { p_item_id: S.lA, p_days: 3 })), 'décalage refusé');
    const after = await dts(S.lB);
    const add = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
    ok(after.starts_on === add(before.starts_on, 3) && after.ends_on === add(before.ends_on, 3), `B : ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  });
  await step('P3c-mode-aucun', 'Réglage « Ne pas décaler » : A +10 jours → B ne bouge pas', async () => {
    ok(!refused(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.lp}`, { link_mode: 'none' })), 'réglage refusé');
    const before = await dts(S.lB);
    ok(!refused(await rpc(resp, 'cp_shift_item', { p_item_id: S.lA, p_days: 10 })), 'décalage refusé');
    ok(JSON.stringify(await dts(S.lB)) === JSON.stringify(before), 'B a bougé malgré le réglage');
  });
  await step('P3c-reglages-ecran', 'Fiche du projet : les réglages « Dépendances entre éléments » s\'affichent et s\'enregistrent', async () => {
    await resp.page.goto(`${BASE}/pilote/gantt`); await resp.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 }); await resp.page.waitForTimeout(3000);
    await resp.page.locator('.group\\/row button', { hasText: `${M} Liens` }).first().click(); await resp.page.waitForTimeout(1200);
    ok(await resp.page.locator('#prj-linkmode').inputValue() === 'none', 'le mode affiché ne correspond pas à la base');
    await resp.page.locator('#prj-linkmode').selectOption('overlap');
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1800);
    const p = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=link_mode&id=eq.${S.lp}`))[0];
    ok(p.link_mode === 'overlap', `mode en base = ${p.link_mode}`);
  }, resp.page);

  /* ============ P4 Lecteurs ============ */
  group = 'P4 Lecteurs';
  for (const c of readers) {
    await step(`P4-${c.who}`, `${c.who} : voit le Gantt, aucune création, fiche en lecture seule`, async () => {
      await open(c, '/pilote/gantt');
      ok(await menuButton(c, /Échelle/).count(), 'écran inaccessible (menu « Échelle » absent)');
      ok((await menuButton(c, /^\s*Nouveau\s*$/).count()) === 0, 'menu « Nouveau » présent pour un lecteur');
      ok((await c.page.locator('button[aria-label^="Ajouter dans"]').count()) === 0, 'boutons « + » présents');
      await expandAll(c);
      // Un clic sur le projet ouvre sa fiche en CONSULTATION : aucun bouton « Enregistrer », champs bloqués ; on la referme avant la suite
      await c.page.locator('.group\\/row button', { hasText: `${M} Projet` }).first().click(); await c.page.waitForTimeout(1000);
      ok(await c.page.locator('#prj-name').count() === 1, 'la fiche du projet ne s\'ouvre pas pour un lecteur');
      ok(await c.page.locator('#prj-name').isDisabled(), 'le nom du projet est modifiable par un lecteur');
      ok(await c.page.getByRole('button', { name: 'Enregistrer' }).count() === 0, 'bouton « Enregistrer » présent pour un lecteur');
      await c.page.keyboard.press('Escape'); await c.page.waitForTimeout(600);
      ok(await c.page.locator('#prj-name').count() === 0, 'la fiche ne se referme pas');
      // Un lecteur ouvre un élément sans date, il ne le place pas : l'en-tête du menu le dit
      if (await menuButton(c, /Sans date/).count()) { await menuButton(c, /Sans date/).click(); ok(!(await c.page.getByRole('menu').innerText()).includes('pour le placer'), 'un lecteur peut placer un élément'); await c.page.keyboard.press('Escape'); }
      ok((await c.page.locator('[data-handle]').count()) === 0 && (await c.page.getByRole('button', { name: 'Nouveau', exact: true }).count()) === 0, 'poignées ou lignes « + Nouveau » présentes pour un lecteur');
    }, c.page);
    await step(`P4-${c.who}-ecriture`, `${c.who} : la base refuse toute écriture sur les éléments`, async () => {
      ok(refused(await api(c, 'POST', '/rest/v1/cp_items', { project_id: S.proj, kind: 'task', name: `${M} Piraté` })), 'création acceptée');
      ok(refused(await api(c, 'POST', '/rest/v1/cp_item_links', { predecessor_id: S.lA, successor_id: S.lC })), 'création de dépendance acceptée');
      const patch = await api(c, 'PATCH', `/rest/v1/cp_items?id=eq.${S.undated}`, { name: `${M} Piraté` }, REP);
      ok(refused(patch) || rows(patch).length === 0, 'modification acceptée');
    });
  }

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  const clean = {};
  try {
    const mine = encodeURIComponent(M + '*');
    for (const table of ['cp_projects']) { const r = await api(resp, 'DELETE', `/rest/v1/${table}?name=like.${mine}`, undefined, REP); clean[table] = refused(r) ? msg(r) : `${rows(r).length} supprimé(s)`; }
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
