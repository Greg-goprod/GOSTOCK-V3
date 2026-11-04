#!/usr/bin/env node
// PILOTE › Projets (R2b) : états, projets, responsables — contrôles de la base, droits par rôle, écran.
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-projets.cjs
//
// Prérequis : migrations 47 et 48 appliquées ; le module « Plan annuel et projets » (cp.projects) activé pour l'entreprise des comptes de test
// (Console de la plateforme › Modules). Comptes : E2E_RESP (écrit : droit « cp.projects »), E2E_STAFF et E2E_COLLAB (lisent
// seulement) ; par défaut test.responsable@ / test.magasinier@ / test.collaborateur@example.com. Mot de passe UNIQUEMENT par E2E_PASSWORD.
// Tout ce qui est créé porte « TEST-PROJ » et est supprimé à la fin (projets, états ajoutés, chantiers de test).
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
const SHOTS = path.join(OUT_DIR, 'captures-projets');
const REPORT = path.join(OUT_DIR, 'rapport-projets.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-PROJ';
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
  if (page && ['KO', 'PARTIEL'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-projets/${f}`; } catch { /* page fermée */ } }
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
  const open = async (c, url) => { await c.page.goto(`${BASE}${url}`); await c.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 }); await c.page.waitForTimeout(2500); };

  /* ============ P0 Prérequis ============ */
  group = 'P0 Prérequis';
  await step('P0-module', 'Le module « Plan annuel et projets » (cp.projects) est activé pour l\'entreprise des comptes de test', async () => {
    for (const c of [resp, staff, collab]) { const me = (await rpc(c, 'whoami')).body || {}; ok((me.modules || []).includes('cp.projects'), `${c.who} : module absent (whoami.modules = ${JSON.stringify(me.modules)})`); }
  });
  await step('P0-droits', 'Droits : le responsable écrit ; magasinier et collaborateur lisent seulement', async () => {
    const can = async (c, action) => (await rpc(c, 'rbac_has_any_permission', { p_keys: [`cp.projects:${action}`] })).body === true;
    for (const a of ['create', 'update', 'delete']) { ok(await can(resp, a), `le responsable n'a pas « ${a} »`); ok(!(await can(staff, a)), `le magasinier a « ${a} »`); ok(!(await can(collab, a)), `le collaborateur a « ${a} »`); }
    for (const c of [resp, staff, collab]) ok(await can(c, 'read'), `${c.who} ne lit pas`);
  });
  await step('P0-etats', 'Les 4 états de base existent, une fois par famille', async () => {
    const st = rows(await api(resp, 'GET', '/rest/v1/cp_statuses?select=id,name,family,is_system&is_system=eq.true'));
    ok(st.length === 4 && new Set(st.map(x => x.family)).size === 4, `états de base : ${JSON.stringify(st.map(x => x.family))}`);
    S.stNot = st.find(x => x.family === 'not_started').id; S.stDone = st.find(x => x.family === 'done').id; S.stProg = st.find(x => x.family === 'in_progress').id;
  });

  /* ============ P1 Données ============ */
  group = 'P1 Données';
  await step('P1-prepa', 'Chantiers de test, projets de plusieurs types, responsables', async () => {
    S.site = await create(resp, 'sites', { name: `${M} Chantier` });
    S.site2 = await create(resp, 'sites', { name: `${M} Autre chantier` });
    S.p1 = await create(resp, 'cp_projects', { name: `${M} Festival`, type: 'site', site_id: S.site, starts_on: '2027-06-01', ends_on: '2027-06-30', priority: 'high' });
    S.p2 = await create(resp, 'cp_projects', { name: `${M} Prototype`, type: 'rd', starts_on: '2027-02-01', ends_on: '2027-09-30' });
    for (const [i, t] of ['design', 'recruitment', 'admin', 'event'].entries()) await create(resp, 'cp_projects', { name: `${M} Type ${i}`, type: t });
    S.me = rows(await api(resp, 'GET', `/rest/v1/users?select=id&email=eq.${encodeURIComponent(ACCOUNTS.resp)}`))[0]?.id;
    ok(S.me, 'fiche « users » du responsable introuvable');
    const r = await api(resp, 'POST', '/rest/v1/cp_project_members', [{ project_id: S.p1, user_id: S.me }]);
    ok(!refused(r), `responsable : ${msg(r)}`);
  });
  await step('P1-defaut', 'Sans état précisé, un projet est « Pas commencé »', async () => {
    const p = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=status_id&id=eq.${S.p2}`))[0];
    ok(p && p.status_id === S.stNot, `état par défaut = ${p && p.status_id}`);
  });

  /* ============ P2 Contrôles de la base ============ */
  group = 'P2 Contrôles de la base';
  const must = (name, fn) => step(`P2-${name.split(' ')[0]}`, name, async () => { const r = await fn(); ok(refused(r), `accepté (HTTP ${r.status})`); });
  await must('type-site : projet R&D relié à un chantier refusé', () => api(resp, 'POST', '/rest/v1/cp_projects', { name: `${M} R&D lié`, type: 'rd', site_id: S.site2 }));
  await must('doublon-chantier : deux projets sur le même chantier refusé', () => api(resp, 'POST', '/rest/v1/cp_projects', { name: `${M} Doublon`, type: 'site', site_id: S.site }));
  await must('dates : fin avant début refusée', () => api(resp, 'POST', '/rest/v1/cp_projects', { name: `${M} Inversé`, type: 'admin', starts_on: '2027-05-01', ends_on: '2027-04-01' }));
  await must('type-inconnu : type inconnu refusé', () => api(resp, 'POST', '/rest/v1/cp_projects', { name: `${M} Bizarre`, type: 'autre' }));
  await must('responsable-doublon : même responsable deux fois refusé', () => api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: S.p1, user_id: S.me }));
  await step('P2-equipe', 'Équipe : rôle inconnu refusé ; une tâche ne s\'assigne qu\'à l\'équipe ; quitter l\'équipe désassigne', async () => {
    S.collab = rows(await api(resp, 'GET', `/rest/v1/users?select=id&email=eq.${encodeURIComponent(ACCOUNTS.collab)}`))[0]?.id;
    ok(S.collab, 'fiche « users » du collaborateur introuvable');
    ok(refused(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: S.p1, user_id: S.collab, role: 'chef' })), 'rôle inconnu accepté');
    S.itemTeam = await create(resp, 'cp_items', { project_id: S.p1, kind: 'task', name: `${M} Tâche équipe` });
    const hors = await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: S.itemTeam, user_id: S.collab });
    ok(refused(hors) && /équipe/.test(msg(hors)), `assignation hors équipe : ${refused(hors) ? msg(hors) : 'ACCEPTÉE'}`);
    ok(!refused(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: S.p1, user_id: S.collab, role: 'member' })), 'ajout comme membre refusé');
    ok(!refused(await api(resp, 'POST', '/rest/v1/cp_item_members', [{ item_id: S.itemTeam, user_id: S.collab }, { item_id: S.itemTeam, user_id: S.me }])), 'assignation d\'un membre et du responsable refusée');
    ok(!refused(await api(resp, 'DELETE', `/rest/v1/cp_project_members?project_id=eq.${S.p1}&user_id=eq.${S.collab}`)), 'retrait de l\'équipe refusé');
    const left = rows(await api(resp, 'GET', `/rest/v1/cp_item_members?select=user_id&item_id=eq.${S.itemTeam}`)).map(r => r.user_id);
    ok(left.length === 1 && left[0] === S.me, `assignations restantes = ${JSON.stringify(left)} (attendu : le responsable seul)`);
  });
  await step('P2-etat-base', 'Un état de base ne se supprime pas et ne change pas de famille', async () => {
    ok(refused(await api(resp, 'DELETE', `/rest/v1/cp_statuses?id=eq.${S.stDone}`)), 'suppression acceptée');
    ok(refused(await api(resp, 'PATCH', `/rest/v1/cp_statuses?id=eq.${S.stDone}`, { family: 'in_progress' })), 'changement de famille accepté');
  });
  await step('P2-etat-ajoute', 'État ajouté : créé dans une famille, utilisé par un projet (suppression refusée), puis supprimé une fois libre', async () => {
    S.stCustom = await create(resp, 'cp_statuses', { name: `${M} En validation`, family: 'in_progress', color: '#f59e0b', position: 10 });
    ok(!refused(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.p2}`, { status_id: S.stCustom })), 'état non affectable');
    ok(refused(await api(resp, 'DELETE', `/rest/v1/cp_statuses?id=eq.${S.stCustom}`)), 'suppression d\'un état utilisé acceptée');
    ok(!refused(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.p2}`, { status_id: S.stProg })), 'projet non remis à un état de base');
    ok(!refused(await api(resp, 'DELETE', `/rest/v1/cp_statuses?id=eq.${S.stCustom}`)), 'état libre non supprimable');
    S.stCustom = null;
  });
  await step('P2-programme-absent', 'Le programme n\'existe plus : ni table, ni colonne (migration 55)', async () => {
    const t = await api(resp, 'GET', '/rest/v1/cp_programs?select=id');
    ok(refused(t) && /cp_programs|find|relation/i.test(msg(t)), `table cp_programs encore accessible ou refus inattendu : ${msg(t)}`);
    const c = await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.p1}`, { program_id: null });
    ok(refused(c) && /program_id|column|colonne/i.test(msg(c)), `colonne program_id encore acceptée ou refus inattendu : ${msg(c)}`);
  });

  /* ============ P3 Droits par rôle ============ */
  group = 'P3 Droits par rôle';
  for (const c of readers) {
    await step(`P3-${c.who}-lecture`, `${c.who} : lit projets, états et responsables`, async () => {
      ok(rows(await api(c, 'GET', `/rest/v1/cp_projects?select=id&name=like.${encodeURIComponent(M + '*')}`)).length >= 6, 'projets illisibles');
      ok(rows(await api(c, 'GET', '/rest/v1/cp_statuses?select=id')).length >= 4, 'états illisibles');
    });
    await step(`P3-${c.who}-ecriture`, `${c.who} : ne crée, ne modifie, ne supprime rien`, async () => {
      ok(refused(await api(c, 'POST', '/rest/v1/cp_projects', { name: `${M} Piraté`, type: 'admin' })), 'création de projet acceptée');
      ok(refused(await api(c, 'POST', '/rest/v1/cp_statuses', { name: `${M} Piraté`, family: 'done' })), 'création d\'état acceptée');
      const patch = await api(c, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.p1}`, { name: `${M} Piraté` }, REP);
      ok(refused(patch) || rows(patch).length === 0, 'modification acceptée');
      const del = await api(c, 'DELETE', `/rest/v1/cp_projects?id=eq.${S.p1}`, undefined, REP);
      ok(refused(del) || rows(del).length === 0, 'suppression acceptée');
    });
  }

  /* ============ P4 Écran ============ */
  group = 'P4 Écran';
  await step('P4-ouverture', 'Responsable : PILOTE › Projets s\'ouvre, les projets de test s\'affichent, compteurs par état', async () => {
    await open(resp, '/pilote/projets');
    ok(await resp.page.getByRole('radio', { name: /^Projets/ }).count(), 'écran des projets inaccessible');
    // Le titre d'une carte (h3) : un simple getByText tomberait d'abord sur une option invisible d'un filtre
    ok(await resp.page.locator('h3', { hasText: `${M} Festival` }).first().isVisible(), 'projet de test absent');
    ok(await resp.page.locator('[aria-label="Projets par état"] button').count() === 4, 'compteurs par famille absents');
  }, resp.page);
  await step('P4-liste', 'Bascule cartes / liste', async () => {
    await resp.page.locator('[aria-label="Affichage des projets"] [role="radio"]').nth(1).click(); await resp.page.waitForTimeout(500);
    ok(await resp.page.locator('table').count(), 'tableau absent en vue liste');
    await resp.page.locator('[aria-label="Affichage des projets"] [role="radio"]').nth(0).click(); await resp.page.waitForTimeout(300);
  }, resp.page);
  await step('P4-creation', 'Création d\'un projet par le formulaire (type, responsable) ; plus de champ « Programme »', async () => {
    await resp.page.getByRole('button', { name: 'Nouveau projet' }).click(); await resp.page.waitForTimeout(700);
    await resp.page.locator('#prj-name').fill(`${M} Par l'écran`);
    await resp.page.locator('#prj-type').selectOption('design');
    ok(await resp.page.locator('#prj-program').count() === 0, 'le champ « Programme » ne devrait plus être proposé');
    await resp.page.getByLabel(/^Rôle de /).first().selectOption('lead');
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1500);
    const r = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=id,type&name=eq.${encodeURIComponent(M + " Par l'écran")}`))[0];
    ok(r && r.type === 'design', `projet enregistré = ${JSON.stringify(r)}`);
    const m = rows(await api(resp, 'GET', `/rest/v1/cp_project_members?select=user_id&project_id=eq.${r.id}`));
    ok(m.length === 1, `responsables enregistrés = ${m.length}`);
    const role = rows(await api(resp, 'GET', `/rest/v1/cp_project_members?select=role&project_id=eq.${r.id}`))[0]?.role;
    ok(role === 'lead', `rôle enregistré = ${role}`);
  }, resp.page);
  await step('P4-programme-masque', 'Le « programme » n\'existe plus (formulaire, onglets) ; modifier un projet par l\'écran enregistre sa description', async () => {
    await open(resp, '/pilote/projets');
    ok(await resp.page.getByRole('radio', { name: /^Programmes/ }).count() === 0, 'l\'onglet « Programmes » ne devrait plus être proposé');
    ok(await resp.page.getByText('Programme', { exact: true }).count() === 0, 'le mot « Programme » apparaît encore comme filtre ou colonne');
    const card = resp.page.locator('div', { has: resp.page.locator('h3', { hasText: `${M} Festival` }) }).filter({ has: resp.page.getByRole('button', { name: 'Modifier' }) }).last();
    await card.getByRole('button', { name: 'Modifier' }).click(); await resp.page.waitForTimeout(800);
    ok(await resp.page.locator('#prj-program').count() === 0, 'le champ « Programme » ne devrait plus être proposé dans la fiche');
    ok(await resp.page.getByRole('button', { name: /Créer un programme/ }).count() === 0, 'le lien « Créer un programme » ne devrait plus être proposé');
    await resp.page.locator('#prj-desc').fill('Description modifiée par l\'écran');
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1500);
    const r = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=description&id=eq.${S.p1}`))[0];
    ok(r && r.description === 'Description modifiée par l\'écran', `description en base = ${r && r.description}`);
  }, resp.page);
  await step('U8-dupliquer', 'Écran : « Dupliquer » sur la carte d\'un projet ouvre la fenêtre, crée la copie (éléments, équipe) et l\'ouvre', async () => {
    const ph = await create(resp, 'cp_items', { project_id: S.p1, kind: 'phase', name: `${M} Dup Phase`, starts_on: '2027-06-01', ends_on: '2027-06-10' });
    await create(resp, 'cp_items', { project_id: S.p1, parent_id: ph, kind: 'task', name: `${M} Dup Tâche`, starts_on: '2027-06-02', ends_on: '2027-06-05' });
    await open(resp, '/pilote/projets');
    const card = resp.page.locator('div', { has: resp.page.locator('h3', { hasText: new RegExp(`^${M} Festival$`) }) }).filter({ has: resp.page.getByRole('button', { name: 'Dupliquer' }) }).last();
    await card.getByRole('button', { name: 'Dupliquer' }).click(); await resp.page.waitForTimeout(900);
    ok(await resp.page.evaluate(() => document.activeElement && document.activeElement.id) === 'dup-name', 'le curseur n\'est pas dans le nom de la copie');
    ok((await resp.page.locator('#dup-name').inputValue()) === `Copie de ${M} Festival`, `nom proposé : ${await resp.page.locator('#dup-name').inputValue()}`);
    ok(await resp.page.locator('#dup-team').isChecked() && !(await resp.page.locator('#dup-assign').isChecked()), 'options par défaut : équipe cochée, assignations décochées');
    await resp.page.locator('#dup-name').fill(`${M} Copie festival`);
    await resp.page.getByRole('button', { name: 'Dupliquer', exact: true }).last().click(); await resp.page.waitForTimeout(2500);
    const c = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=id,type,status_id&name=eq.${encodeURIComponent(M + ' Copie festival')}`))[0];
    ok(c && c.type === 'site', `copie absente ou mauvais type : ${JSON.stringify(c)}`);
    const n = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=id&project_id=eq.${c.id}`)).length;
    const src = rows(await api(resp, 'GET', `/rest/v1/cp_items?select=id&project_id=eq.${S.p1}`)).length;
    ok(n === src && n >= 2, `éléments copiés : ${n} (source : ${src})`);
    ok(rows(await api(resp, 'GET', `/rest/v1/cp_project_members?select=user_id&project_id=eq.${c.id}`)).length === rows(await api(resp, 'GET', `/rest/v1/cp_project_members?select=user_id&project_id=eq.${S.p1}`)).length, 'équipe non copiée');
    ok((await resp.page.locator('#prj-name').inputValue().catch(() => '')) === `${M} Copie festival`, 'la copie ne s\'est pas ouverte dans la fiche du projet');
    await resp.page.getByRole('button', { name: 'Annuler' }).last().click(); await resp.page.waitForTimeout(400);
  }, resp.page);
  await step('P4-equipe-ecran', 'Fiche du projet : ajouter un membre par l\'écran ne défait pas les assignations existantes ; retirer la personne la désassigne', async () => {
    await open(resp, '/pilote/projets');
    const card = () => resp.page.locator('div', { has: resp.page.locator('h3', { hasText: `${M} Festival` }) }).filter({ has: resp.page.getByRole('button', { name: 'Modifier' }) }).last();
    await card().getByRole('button', { name: 'Modifier' }).click(); await resp.page.waitForTimeout(800);
    ok(await resp.page.locator('legend', { hasText: 'Équipe' }).count(), 'section « Équipe » absente de la fiche');
    const collabRole = resp.page.getByLabel(/^Rôle de /).filter({ has: resp.page.locator('option[value="member"]') });
    ok((await collabRole.count()) >= 2, 'moins de deux personnes proposées');
    // le responsable de test est déjà dans l'équipe : il doit apparaître avec son rôle
    const roles = await resp.page.getByLabel(/^Rôle de /).evaluateAll(els => els.map(e => e.value));
    ok(roles.includes('lead'), `le responsable n'apparaît pas comme « Responsable » : ${JSON.stringify(roles)}`);
    // on passe la 1re personne HORS équipe (≠ responsable) en « Membre »
    const idx = roles.findIndex(v => v === '');
    ok(idx >= 0, 'personne hors équipe introuvable');
    await resp.page.getByLabel(/^Rôle de /).nth(idx).selectOption('member');
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1500);
    const team = rows(await api(resp, 'GET', `/rest/v1/cp_project_members?select=user_id,role&project_id=eq.${S.p1}`));
    ok(team.length === 2 && team.some(t => t.user_id === S.me && t.role === 'lead') && team.some(t => t.role === 'member'), `équipe en base = ${JSON.stringify(team)}`);
    const kept = rows(await api(resp, 'GET', `/rest/v1/cp_item_members?select=user_id&item_id=eq.${S.itemTeam}`));
    ok(kept.length === 1 && kept[0].user_id === S.me, `l'assignation du responsable a été défaite par l'enregistrement : ${JSON.stringify(kept)}`);
    // on remet cette personne hors équipe : elle n'a aucune tâche, le responsable garde la sienne
    await card().getByRole('button', { name: 'Modifier' }).click(); await resp.page.waitForTimeout(800);
    const roles2 = await resp.page.getByLabel(/^Rôle de /).evaluateAll(els => els.map(e => e.value));
    const idx2 = roles2.findIndex(v => v === 'member');
    ok(idx2 >= 0, 'le membre ajouté n\'est pas relu dans la fiche');
    await resp.page.getByLabel(/^Rôle de /).nth(idx2).selectOption('');
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(1500);
    const team2 = rows(await api(resp, 'GET', `/rest/v1/cp_project_members?select=user_id,role&project_id=eq.${S.p1}`));
    ok(team2.length === 1 && team2[0].user_id === S.me, `équipe après retrait = ${JSON.stringify(team2)}`);
  }, resp.page);
  await step('P4-mes-taches', 'Onglet « Mes tâches » : la tâche assignée au responsable s\'affiche et ouvre sa fiche', async () => {
    await open(resp, '/pilote/projets');
    await resp.page.getByRole('radio', { name: /^Mes tâches/ }).click(); await resp.page.waitForTimeout(1500);
    ok(await resp.page.getByRole('button', { name: `${M} Tâche équipe` }).first().isVisible(), 'tâche assignée absente de « Mes tâches »');
    await resp.page.getByRole('button', { name: `${M} Tâche équipe` }).first().click(); await resp.page.waitForTimeout(1000);
    ok(await resp.page.locator('#itm-name').inputValue() === `${M} Tâche équipe`, 'la fiche de la tâche ne s\'ouvre pas');
    await resp.page.getByRole('button', { name: 'Annuler' }).last().click(); await resp.page.waitForTimeout(300);
  }, resp.page);
  await step('P4-chantier-pris', 'Le chantier déjà relié n\'est plus proposé pour un autre projet', async () => {
    // L'étape précédente (« Mes tâches ») laisse l'onglet « Mes tâches » ouvert : on revient sur « Projets »
    await open(resp, '/pilote/projets');
    await resp.page.getByRole('button', { name: 'Nouveau projet' }).click(); await resp.page.waitForTimeout(600);
    await resp.page.locator('#prj-type').selectOption('site');
    // Le chantier lié fait partie des détails, repliés à la création
    ok(await resp.page.locator('#prj-site').count() === 0, 'le chantier lié devrait être dans les détails repliés');
    await resp.page.getByRole('button', { name: 'Afficher les détails' }).click(); await resp.page.waitForTimeout(300);
    const options = await resp.page.locator('#prj-site option').allInnerTexts();
    ok(!options.some(o => o.includes(`${M} Chantier`)), `chantier déjà relié proposé : ${options.join(' | ')}`);
    ok(options.some(o => o.includes(`${M} Autre chantier`)), 'chantier libre non proposé');
    await resp.page.getByRole('button', { name: 'Annuler' }).click(); await resp.page.waitForTimeout(300);
  }, resp.page);
  await step('U6-onglets', 'Page unique : vues Gantt / Projets / Mes tâches, plus d\'entrée « Gantt » dans la navigation, /pilote/gantt ouvre la vue Gantt', async () => {
    await open(resp, '/pilote/projets');
    for (const n of [/^Gantt$/, /^Projets/, /^Mes tâches/]) ok(await resp.page.getByRole('radio', { name: n }).count() === 1, `vue absente : ${n}`);
    ok(await resp.page.getByRole('radio', { name: /^États/ }).count() === 0, 'les états ne devraient plus être un onglet');
    ok(await resp.page.locator('a[href="/pilote/gantt"]').count() === 0, 'la navigation propose encore une entrée « Gantt »');
    ok(await resp.page.getByRole('radio', { name: /^Projets/ }).isChecked(), 'la vue « Projets » devrait être celle par défaut');
    await resp.page.getByRole('radio', { name: /^Gantt$/ }).click(); await resp.page.waitForTimeout(2500);
    ok(await resp.page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Échelle/ }).first().isVisible(), 'la vue Gantt n\'affiche pas sa barre d\'outils');
    await resp.page.getByRole('radio', { name: /^Projets/ }).click(); await resp.page.waitForTimeout(800);
    ok(await resp.page.getByRole('button', { name: 'Nouveau projet' }).first().isVisible(), '« Nouveau projet » absent de la vue Projets');
    await open(resp, '/pilote/gantt');
    ok(await resp.page.getByRole('radio', { name: /^Gantt$/ }).isChecked(), '/pilote/gantt devrait ouvrir la vue Gantt');
  }, resp.page);
  await step('P4-programmes-etats', 'Réglages : états d\'avancement derrière l\'icône, lignes visibles, états de base non supprimables, retour aux projets', async () => {
    await open(resp, '/pilote/projets');
    await resp.page.locator('button[aria-label="Réglages des projets"]').click();
    await resp.page.getByRole('menuitem', { name: /^États d'avancement/ }).click(); await resp.page.waitForTimeout(800);
    ok(await resp.page.getByRole('button', { name: 'Retour aux projets' }).isVisible(), 'bouton « Retour aux projets » absent');
    const txt = await resp.page.locator('main').innerText();
    ok(/De base/.test(txt), 'mention « De base » absente');
    ok((await resp.page.locator('table tbody tr', { hasText: 'De base' }).getByRole('button', { name: 'Supprimer' }).count()) === 0, 'bouton Supprimer sur un état de base');
    await resp.page.getByRole('button', { name: 'Retour aux projets' }).click(); await resp.page.waitForTimeout(500);
    ok(await resp.page.getByRole('radio', { name: /^Projets/ }).isChecked(), 'le retour ne ramène pas à la vue Projets');
  }, resp.page);
  for (const c of readers) {
    await step(`P4-${c.who}-ecran`, `${c.who} : l\'écran s\'ouvre en lecture seule`, async () => {
      await open(c, '/pilote/projets');
      ok(await c.page.getByRole('radio', { name: /^Projets/ }).count(), 'écran inaccessible');
      ok((await c.page.getByRole('button', { name: 'Nouveau projet' }).count()) === 0, 'bouton « Nouveau projet » présent');
      ok((await c.page.getByRole('button', { name: 'Modifier' }).count()) === 0, 'bouton « Modifier » présent');
    }, c.page);
  }

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  const clean = {};
  try {
    const mine = encodeURIComponent(M + '*');
    for (const table of ['cp_projects']) { const r = await api(resp, 'DELETE', `/rest/v1/${table}?name=like.${mine}`, undefined, REP); clean[table] = refused(r) ? msg(r) : `${rows(r).length} supprimé(s)`; }
    { const r = await api(resp, 'DELETE', `/rest/v1/cp_statuses?name=like.${mine}`, undefined, REP); clean.cp_statuses = refused(r) ? msg(r) : `${rows(r).length} supprimé(s)`; }
    { const r = await api(resp, 'DELETE', `/rest/v1/sites?name=like.${mine}`, undefined, REP); clean.sites = refused(r) ? msg(r) : `${rows(r).length} supprimé(s)`; }
    clean.restants = rows(await api(resp, 'GET', `/rest/v1/cp_projects?select=id&name=like.${mine}`)).length;
  } catch (e) { clean.err = e.message; }

  await browser.close();

  /* ============ Rapport ============ */
  const n = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport des tests des projets PILOTE', '',
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
