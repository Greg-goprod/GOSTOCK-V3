#!/usr/bin/env node
// PILOTE : scénarios « tous les cas de figure » (vie d'un projet, équipe, éléments, dépendances, droits, cas limites).
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-pilote-scenarios.cjs
//
// Prérequis : migrations 47 à 52 appliquées ; module cp.projects actif ; comptes E2E_RESP (écrit), E2E_STAFF et E2E_COLLAB (lisent
// seulement) = trois personnes différentes. Facultatif : E2E_OTHER_ORG_USER (compte d'une AUTRE entreprise) pour l'isolation à l'écran.
// Mot de passe UNIQUEMENT par E2E_PASSWORD. Tout ce qui est créé porte « TEST-SCEN » et est supprimé à la fin (vérifié par requête).
// Règle d'écriture : un refus n'est compté que si le MESSAGE est celui de la bonne règle ; sinon KO (un « refus » pour une mauvaise
// raison, par exemple un identifiant invalide, ne prouve rien).
const { execSync } = require('child_process');
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
const SHOTS = path.join(OUT_DIR, 'captures-pilote-scenarios');
const REPORT = path.join(OUT_DIR, 'rapport-pilote-scenarios.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-SCEN';
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
  if (page && ['KO', 'PARTIEL'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-pilote-scenarios/${f}`; } catch { /* page fermée */ } }
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
  // Pièges : sur écran étroit la barre latérale (« hidden lg:flex ») est masquée et c'est la barre du bas qui est visible ; dans les autres langues
  // l'aria-label « Navigation principale » est traduit ; et un sélecteur « A, B » ne renvoie que le PREMIER élément du document (ici la barre latérale,
  // masquée sur mobile) : on attend donc le premier élément VISIBLE de l'une ou l'autre barre.
  const open = async (c, url) => { await c.page.goto(`${BASE}${url}`); await c.page.locator('aside nav:visible, nav.fixed:visible').first().waitFor({ state: 'visible', timeout: 30000 }); await c.page.waitForTimeout(2500); };

  /* ---- outils de scénario ---- */
  // Un refus n'a de valeur que s'il vient de la bonne règle : on vérifie aussi le message (sinon un test « refusé » peut passer pour une mauvaise raison)
  const refuses = (r, re, what) => { ok(refused(r), `${what} : ACCEPTÉ (HTTP ${r.status})`); if (re) ok(re.test(msg(r)), `${what} : refusé, mais pour une autre raison : « ${msg(r)} »`); };
  const accepts = (r, what) => ok(!refused(r), `${what} : ${msg(r)}`);
  const get = async (c, route) => rows(await api(c, 'GET', route));
  const d = async (c, id) => { const r = (await get(c, `/rest/v1/cp_items?select=starts_on,ends_on&id=eq.${id}`))[0]; return r ? `${r.starts_on}→${r.ends_on}` : '(absent)'; };
  const proj = (c, row) => create(c, 'cp_projects', { type: 'admin', ...row });
  const item = (c, row) => create(c, 'cp_items', { kind: 'task', ...row });
  const count = async (c, table, filter) => (await get(c, `/rest/v1/${table}?select=*&${filter}`)).length;
  const mine = encodeURIComponent(M + '*');
  // Écriture bloquée = refus OU aucune ligne touchée (sous la sécurité par ligne, un PATCH/DELETE interdit ne touche rien sans erreur)
  const blocked = async (c, method, route, body) => { const r = await api(c, method, route, body, REP); return refused(r) || (method !== 'POST' && rows(r).length === 0); };

  /* ============ S Préparation ============ */
  group = 'S Préparation';
  await step('S-comptes', 'Les trois comptes existent, le module cp.projects est actif, seul le responsable écrit', async () => {
    for (const [k, c] of Object.entries({ resp, staff, collab })) {
      const u = (await get(c, `/rest/v1/users?select=id&email=eq.${encodeURIComponent(ACCOUNTS[k])}`))[0];
      ok(u && u.id, `fiche « users » de ${k} introuvable`);
      S['u_' + k] = u.id;
      const me = (await rpc(c, 'whoami')).body || {};
      ok((me.modules || []).includes('cp.projects'), `${k} : module cp.projects absent`);
    }
    ok(new Set([S.u_resp, S.u_staff, S.u_collab]).size === 3, 'les trois comptes doivent être trois personnes différentes');
    const can = async (c, a) => (await rpc(c, 'rbac_has_any_permission', { p_keys: [`cp.projects:${a}`] })).body === true;
    ok(await can(resp, 'create') && await can(resp, 'update') && await can(resp, 'delete'), 'le responsable n\'écrit pas');
    ok(!(await can(staff, 'update')) && !(await can(collab, 'update')), 'un lecteur peut modifier');
  });
  await step('S-etats', 'Les 4 états de base sont lus', async () => {
    const st = await get(resp, '/rest/v1/cp_statuses?select=id,family&is_system=eq.true');
    ok(st.length === 4, `états de base : ${st.length}`);
    S.st = Object.fromEntries(st.map(x => [x.family, x.id]));
  });
  await step('S-propre', 'Aucun reste d\'un test précédent (préfixe ' + M + ')', async () => {
    ok(await count(resp, 'cp_projects', `name=like.${mine}`) === 0, 'projets TEST-SCEN déjà présents : un test précédent n\'a pas nettoyé');
  });

  /* ============ A Vie d'un projet chantier ============ */
  group = 'A Vie d\'un projet chantier';
  await step('A-creation', 'Projet de type Chantier relié à un chantier de Logistique', async () => {
    S.site = await create(resp, 'sites', { name: `${M} Chantier A` });
    S.pA = await proj(resp, { name: `${M} Projet A`, type: 'site', site_id: S.site });
    const r = (await get(resp, `/rest/v1/cp_projects?select=site_id,type,status_id&id=eq.${S.pA}`))[0];
    ok(r && r.site_id === S.site && r.type === 'site', `projet relu = ${JSON.stringify(r)}`);
    ok(r.status_id === S.st.not_started, 'un projet neuf n\'est pas « Pas commencé »');
  });
  await step('A-un-projet-par-chantier', 'Un 2e projet sur le même chantier est refusé', async () => {
    refuses(await api(resp, 'POST', '/rest/v1/cp_projects', { name: `${M} Doublon chantier`, type: 'site', site_id: S.site }), /cp_projects_site_key|duplicate|unique/i, '2e projet sur le chantier');
    ok(await count(resp, 'cp_projects', `site_id=eq.${S.site}`) === 1, 'un 2e projet a été créé');
  });
  await step('A-chantier-seulement-type-chantier', 'Un projet R&D ne peut pas être relié à un chantier', async () => {
    const site2 = await create(resp, 'sites', { name: `${M} Chantier B` });
    refuses(await api(resp, 'POST', '/rest/v1/cp_projects', { name: `${M} R&D relié`, type: 'rd', site_id: site2 }), /chantier|check/i, 'R&D relié à un chantier');
    S.site2 = site2;
  });
  await step('A-etats', 'Le projet traverse les 4 familles d\'état', async () => {
    for (const fam of ['in_progress', 'done', 'cancelled', 'not_started']) {
      accepts(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { status_id: S.st[fam] }), `état ${fam}`);
      const r = (await get(resp, `/rest/v1/cp_projects?select=status_id&id=eq.${S.pA}`))[0];
      ok(r.status_id === S.st[fam], `état relu pour ${fam} : ${r.status_id}`);
    }
    refuses(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { status_id: '00000000-0000-0000-0000-000000000000' }), /état|violates|foreign|introuvable/i, 'état inexistant');
  });
  await step('A-priorite', 'Priorité basse/moyenne/haute acceptée, autre valeur refusée', async () => {
    for (const p of ['low', 'medium', 'high']) accepts(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { priority: p }), `priorité ${p}`);
    refuses(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { priority: 'critique' }), /check|priority|priorit/i, 'priorité inconnue');
  });
  await step('A-dates', 'Dates : fin avant début refusée, mêmes dates acceptées, dates vides acceptées', async () => {
    refuses(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { starts_on: '2027-05-10', ends_on: '2027-05-01' }), /check|date/i, 'fin avant début');
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { starts_on: '2027-05-10', ends_on: '2027-05-10' }), 'même jour');
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { starts_on: null, ends_on: null }), 'sans dates');
  });
  await step('A-programme', 'Programme : rattacher, doublon de nom à la casse près refusé, supprimer garde le projet', async () => {
    S.prog = await create(resp, 'cp_programs', { name: `${M} Programme` });
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pA}`, { program_id: S.prog }), 'rattacher');
    refuses(await api(resp, 'POST', '/rest/v1/cp_programs', { name: ` ${M.toLowerCase()} PROGRAMME ` }), /duplicate|unique/i, 'doublon de programme');
    accepts(await api(resp, 'DELETE', `/rest/v1/cp_programs?id=eq.${S.prog}`), 'supprimer le programme');
    const r = (await get(resp, `/rest/v1/cp_projects?select=program_id&id=eq.${S.pA}`))[0];
    ok(r && r.program_id === null, `le projet devait rester, sans programme : ${JSON.stringify(r)}`);
  });
  await step('A-suppression-cascade', 'Supprimer un projet supprime ses éléments, son équipe, ses assignations, ses dépendances et sa liste à cocher', async () => {
    const p = await proj(resp, { name: `${M} À supprimer` });
    accepts(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: p, user_id: S.u_resp, role: 'lead' }), 'équipe');
    const i1 = await item(resp, { project_id: p, name: `${M} Sup 1`, starts_on: '2027-06-01', ends_on: '2027-06-03' });
    const i2 = await item(resp, { project_id: p, name: `${M} Sup 2`, starts_on: '2027-06-10', ends_on: '2027-06-12' });
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: i1, user_id: S.u_resp }), 'assignation');
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: i1, successor_id: i2, project_id: p }), 'dépendance');
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_checks', { item_id: i1, label: 'ligne' }), 'ligne à cocher');
    accepts(await api(resp, 'DELETE', `/rest/v1/cp_projects?id=eq.${p}`), 'suppression du projet');
    const left = {
      items: await count(resp, 'cp_items', `project_id=eq.${p}`), team: await count(resp, 'cp_project_members', `project_id=eq.${p}`),
      assign: await count(resp, 'cp_item_members', `item_id=in.(${i1},${i2})`), links: await count(resp, 'cp_item_links', `project_id=eq.${p}`),
      checks: await count(resp, 'cp_item_checks', `item_id=in.(${i1},${i2})`),
    };
    ok(Object.values(left).every(n => n === 0), `restes après suppression : ${JSON.stringify(left)}`);
  });

  /* ============ B Équipe et assignations ============ */
  group = 'B Équipe et assignations';
  await step('B-equipe-vide', 'Équipe vide : on ne peut assigner personne', async () => {
    S.pB = await proj(resp, { name: `${M} Projet B` });
    S.tB = await item(resp, { project_id: S.pB, name: `${M} Tâche B1`, starts_on: '2027-04-05', ends_on: '2027-04-09' });
    for (const u of [S.u_resp, S.u_staff]) refuses(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: S.tB, user_id: u }), /équipe du projet/, 'assigner avec équipe vide');
    ok(await count(resp, 'cp_item_members', `item_id=eq.${S.tB}`) === 0, 'une assignation a été créée');
  });
  await step('B-roles', 'Responsable + membre : rôles relus ; rôle inconnu et doublon refusés', async () => {
    accepts(await api(resp, 'POST', '/rest/v1/cp_project_members', [{ project_id: S.pB, user_id: S.u_resp, role: 'lead' }, { project_id: S.pB, user_id: S.u_collab, role: 'member' }]), 'équipe');
    const t = await get(resp, `/rest/v1/cp_project_members?select=user_id,role&project_id=eq.${S.pB}`);
    ok(t.length === 2 && t.find(x => x.user_id === S.u_resp)?.role === 'lead' && t.find(x => x.user_id === S.u_collab)?.role === 'member', `équipe relue = ${JSON.stringify(t)}`);
    refuses(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: S.pB, user_id: S.u_staff, role: 'chef' }), /check|role/i, 'rôle inconnu');
    refuses(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: S.pB, user_id: S.u_collab, role: 'member' }), /duplicate|unique|pkey/i, 'même personne deux fois');
    ok(await count(resp, 'cp_project_members', `project_id=eq.${S.pB}`) === 2, 'l\'équipe a changé de taille');
  });
  await step('B-assigner', 'Assigner un responsable et un membre ; une personne hors équipe est refusée', async () => {
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_members', [{ item_id: S.tB, user_id: S.u_resp }, { item_id: S.tB, user_id: S.u_collab }]), 'assigner équipe');
    refuses(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: S.tB, user_id: S.u_staff }), /équipe du projet/, 'assigner hors équipe');
    ok(await count(resp, 'cp_item_members', `item_id=eq.${S.tB}`) === 2, 'nombre d\'assignés inattendu');
  });
  await step('B-changer-role', 'Changer un rôle (membre → responsable → membre) ne désassigne personne', async () => {
    for (const role of ['lead', 'member']) {
      const r = await api(resp, 'PATCH', `/rest/v1/cp_project_members?project_id=eq.${S.pB}&user_id=eq.${S.u_collab}`, { role }, REP);
      accepts(r, `rôle ${role}`); ok(rows(r).length === 1, `rôle ${role} : ${rows(r).length} ligne(s) modifiée(s)`);
      ok(await count(resp, 'cp_item_members', `item_id=eq.${S.tB}`) === 2, `assignations après passage à ${role}`);
    }
  });
  await step('B-modifier-projet', 'Modifier le projet (nom, dates) ne touche ni l\'équipe ni les assignations', async () => {
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pB}`, { name: `${M} Projet B renommé`, starts_on: '2027-04-01', ends_on: '2027-04-30' }), 'renommer');
    ok(await count(resp, 'cp_project_members', `project_id=eq.${S.pB}`) === 2 && await count(resp, 'cp_item_members', `item_id=eq.${S.tB}`) === 2, 'l\'équipe ou les assignations ont changé');
  });
  await step('B-quitter-equipe', 'Quitter l\'équipe désassigne de CE projet seulement', async () => {
    const pC = await proj(resp, { name: `${M} Projet C` });
    const tC = await item(resp, { project_id: pC, name: `${M} Tâche C1` });
    accepts(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: pC, user_id: S.u_collab, role: 'member' }), 'équipe C');
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: tC, user_id: S.u_collab }), 'assignation C');
    accepts(await api(resp, 'DELETE', `/rest/v1/cp_project_members?project_id=eq.${S.pB}&user_id=eq.${S.u_collab}`), 'retrait de B');
    const b = (await get(resp, `/rest/v1/cp_item_members?select=user_id&item_id=eq.${S.tB}`)).map(x => x.user_id);
    ok(b.length === 1 && b[0] === S.u_resp, `assignés de B après retrait = ${JSON.stringify(b)} (attendu : le responsable seul)`);
    ok(await count(resp, 'cp_item_members', `item_id=eq.${tC}&user_id=eq.${S.u_collab}`) === 1, 'la personne a été désassignée du projet C où elle reste');
    refuses(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: S.tB, user_id: S.u_collab }), /équipe du projet/, 'réassigner après retrait');
    S.pC = pC; S.tC = tC;
  });
  await step('B-mes-taches-ecran', 'Écran « Mes tâches » : le collaborateur voit SA tâche (projet C) et pas celle du responsable ; la fiche est en lecture seule', async () => {
    await open(collab, '/pilote/projets');
    await collab.page.getByRole('radio', { name: /^Mes tâches/ }).click(); await collab.page.waitForTimeout(1800);
    ok(await collab.page.getByRole('button', { name: `${M} Tâche C1` }).first().isVisible(), 'sa tâche est absente de « Mes tâches »');
    ok(await collab.page.getByRole('button', { name: `${M} Tâche B1` }).count() === 0, 'la tâche d\'un autre apparaît dans « Mes tâches »');
    await collab.page.getByRole('button', { name: `${M} Tâche C1` }).first().click(); await collab.page.waitForTimeout(900);
    ok(await collab.page.getByRole('button', { name: 'Fermer' }).count() > 0 && await collab.page.getByRole('button', { name: 'Enregistrer' }).count() === 0, 'la fiche d\'un lecteur n\'est pas en lecture seule');
    await collab.page.getByRole('button', { name: 'Fermer' }).last().click();
    await open(staff, '/pilote/projets');
    await staff.page.getByRole('radio', { name: /^Mes tâches/ }).click(); await staff.page.waitForTimeout(1500);
    ok(await staff.page.getByRole('button', { name: `${M} Tâche C1` }).count() === 0 && await staff.page.getByRole('button', { name: `${M} Tâche B1` }).count() === 0, 'le magasinier voit des tâches de test qui ne lui sont pas assignées');
  }, collab.page);
  await step('B-mes-taches-groupes', 'Groupes de « Mes tâches » : en retard / à faire / sans date / terminées', async () => {
    const pD = await proj(resp, { name: `${M} Projet D` });
    accepts(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: pD, user_id: S.u_resp, role: 'lead' }), 'équipe D');
    const mk = async (name, extra) => { const id = await item(resp, { project_id: pD, name: `${M} ${name}`, ...extra }); accepts(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: id, user_id: S.u_resp }), name); return id; };
    await mk('Retard', { starts_on: '2020-01-06', ends_on: '2020-01-10' });
    await mk('Futur', { starts_on: '2030-01-07', ends_on: '2030-01-11' });
    await mk('Sans date', {});
    await mk('Fini', { starts_on: '2020-02-03', ends_on: '2020-02-07', status_id: S.st.done });
    await open(resp, '/pilote/projets');
    await resp.page.getByRole('radio', { name: /^Mes tâches/ }).click(); await resp.page.waitForTimeout(1800);
    const where = async name => resp.page.locator('section', { has: resp.page.getByRole('button', { name: `${M} ${name}` }) }).first().getAttribute('aria-label');
    const got = { Retard: await where('Retard'), Futur: await where('Futur'), 'Sans date': await where('Sans date'), Fini: await where('Fini') };
    ok(got.Retard === 'En retard' && got.Futur === 'À faire' && got['Sans date'] === 'Sans date' && got.Fini === 'Terminées ou annulées', `groupes = ${JSON.stringify(got)}`);
  }, resp.page);

  /* ============ C Éléments : les 5 niveaux ============ */
  group = 'C Éléments';
  await step('C-niveaux', 'Phase → tâche → sous-tâche et phase → jalon sont acceptés', async () => {
    S.pE = await proj(resp, { name: `${M} Projet E` });
    S.ph = await item(resp, { project_id: S.pE, kind: 'phase', name: `${M} Phase`, starts_on: '2027-02-01', ends_on: '2027-02-26' });
    S.ta = await item(resp, { project_id: S.pE, parent_id: S.ph, kind: 'task', name: `${M} Tâche`, starts_on: '2027-02-02', ends_on: '2027-02-12' });
    S.su = await item(resp, { project_id: S.pE, parent_id: S.ta, kind: 'subtask', name: `${M} Sous-tâche`, starts_on: '2027-02-03', ends_on: '2027-02-05' });
    S.jl = await item(resp, { project_id: S.pE, parent_id: S.ph, kind: 'milestone', name: `${M} Jalon`, starts_on: '2027-02-26', ends_on: '2027-02-26' });
    S.ta2 = await item(resp, { project_id: S.pE, kind: 'task', name: `${M} Tâche libre` });
  });
  await step('C-refus-hierarchie', 'Chaque règle de hiérarchie refuse avec SON message', async () => {
    const mk = (row) => api(resp, 'POST', '/rest/v1/cp_items', { project_id: S.pE, name: `${M} Refusé`, ...row });
    refuses(await mk({ kind: 'subtask', parent_id: S.ph }), /sous une tâche/, 'sous-tâche sous phase');
    refuses(await mk({ kind: 'subtask' }), /sous une tâche/, 'sous-tâche sous le projet');
    refuses(await mk({ kind: 'subtask', parent_id: S.su }), /sous une tâche/, 'sous-tâche sous sous-tâche (6e niveau)');
    refuses(await mk({ kind: 'task', parent_id: S.ta }), /sous une phase ou directement sous le projet/, 'tâche sous tâche');
    refuses(await mk({ kind: 'task', parent_id: S.jl }), /sous une phase ou directement sous le projet/, 'tâche sous jalon');
    refuses(await mk({ kind: 'phase', parent_id: S.ph }), /directement sous le projet/, 'phase sous phase');
    refuses(await api(resp, 'POST', '/rest/v1/cp_items', { project_id: S.pB, kind: 'task', parent_id: S.ph, name: `${M} Refusé` }), /même projet/, 'parent d\'un autre projet');
    ok(await count(resp, 'cp_items', `name=eq.${encodeURIComponent(M + ' Refusé')}`) === 0, 'un élément refusé a été créé');
  });
  await step('C-refus-valeurs', 'Valeurs refusées : jalon sur 2 jours, fin avant début, nom vide, type et priorité inconnus', async () => {
    const mk = (row) => api(resp, 'POST', '/rest/v1/cp_items', { project_id: S.pE, kind: 'task', name: `${M} Refusé`, ...row });
    refuses(await mk({ kind: 'milestone', starts_on: '2027-03-01', ends_on: '2027-03-03' }), /check|jalon|jour/i, 'jalon sur 2 jours');
    refuses(await mk({ starts_on: '2027-03-10', ends_on: '2027-03-01' }), /check|date/i, 'fin avant début');
    refuses(await mk({ name: '   ' }), /check|nom|violates/i, 'nom d\'espaces');
    refuses(await mk({ kind: 'epic' }), /check|kind|type/i, 'type inconnu');
    refuses(await mk({ priority: 'critique' }), /check|priority|priorit/i, 'priorité inconnue');
  });
  await step('C-immuables', 'Le type et le projet d\'un élément ne changent pas ; pas son propre parent', async () => {
    refuses(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.ta2}`, { kind: 'milestone' }), /ne change pas/, 'changer le type');
    refuses(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.ta2}`, { project_id: S.pB }), /ne change pas de projet/, 'changer de projet');
    refuses(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.ta2}`, { parent_id: S.ta2 }), /propre parent/, 'son propre parent');
  });
  await step('C-deplacer', 'Déplacer une tâche sous une phase puis la remettre sous le projet', async () => {
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.ta2}`, { parent_id: S.ph }), 'sous la phase');
    ok((await get(resp, `/rest/v1/cp_items?select=parent_id&id=eq.${S.ta2}`))[0].parent_id === S.ph, 'parent non relu');
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.ta2}`, { parent_id: null }), 'sous le projet');
    refuses(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.su}`, { parent_id: S.ph }), /sous une tâche/, 'sous-tâche déplacée sous une phase');
  });
  await step('C-etat-element', 'Changer l\'état d\'un élément', async () => {
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.ta2}`, { status_id: S.st.in_progress }), 'en cours');
    ok((await get(resp, `/rest/v1/cp_items?select=status_id&id=eq.${S.ta2}`))[0].status_id === S.st.in_progress, 'état non relu');
  });
  await step('C-liste-a-cocher', 'Liste à cocher : ajouter, cocher, supprimer', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_item_checks?select=id', { item_id: S.ta2, label: `${M} ligne` }, REP);
    accepts(r, 'ajouter'); const id = rows(r)[0].id;
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_item_checks?id=eq.${id}`, { done: true }), 'cocher');
    ok((await get(resp, `/rest/v1/cp_item_checks?select=done&id=eq.${id}`))[0].done === true, 'case non cochée en base');
    accepts(await api(resp, 'DELETE', `/rest/v1/cp_item_checks?id=eq.${id}`), 'supprimer');
    ok(await count(resp, 'cp_item_checks', `id=eq.${id}`) === 0, 'ligne encore présente');
  });
  await step('C-supprimer-phase', 'Supprimer une phase supprime tout ce qu\'elle contient (3 éléments : tâche, sous-tâche, jalon) mais pas le reste', async () => {
    const before = await count(resp, 'cp_items', `project_id=eq.${S.pE}`);
    accepts(await api(resp, 'DELETE', `/rest/v1/cp_items?id=eq.${S.ph}`), 'supprimer la phase');
    const after = await count(resp, 'cp_items', `project_id=eq.${S.pE}`);
    ok(before - after === 4, `éléments supprimés = ${before - after} (attendu 4 : la phase, sa tâche, la sous-tâche, le jalon) ; restants = ${after}`);
    ok(await count(resp, 'cp_items', `id=eq.${S.ta2}`) === 1, 'la tâche libre a disparu avec la phase');
  });

  /* ============ D Dépendances et décalages ============ */
  group = 'D Dépendances et décalages';
  await step('D-chevauchement', 'Mode par défaut : B qui chevauche A est décalé au lendemain de la fin de A, ramené au lundi, même durée', async () => {
    S.pL = await proj(resp, { name: `${M} Liens` });
    S.A = await item(resp, { project_id: S.pL, name: `${M} L-A`, starts_on: '2027-03-01', ends_on: '2027-03-05' });
    S.B = await item(resp, { project_id: S.pL, name: `${M} L-B`, starts_on: '2027-03-03', ends_on: '2027-03-08' });
    S.C = await item(resp, { project_id: S.pL, name: `${M} L-C`, starts_on: '2027-03-10', ends_on: '2027-03-12' });
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: S.A, successor_id: S.B, project_id: S.pL }), 'A → B');
    ok(await d(resp, S.B) === '2027-03-08→2027-03-13', `B = ${await d(resp, S.B)} (attendu 2027-03-08→2027-03-13)`);
    ok(await d(resp, S.A) === '2027-03-01→2027-03-05', 'A a bougé');
  });
  await step('D-chaine', 'Chaîne A → B → C : toute la chaîne suit quand A avance de 14 jours', async () => {
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: S.B, successor_id: S.C, project_id: S.pL }), 'B → C');
    ok(await d(resp, S.C) === '2027-03-15→2027-03-17', `C = ${await d(resp, S.C)} (attendu 2027-03-15→2027-03-17)`);
    accepts(await rpc(resp, 'cp_shift_item', { p_item_id: S.A, p_days: 14 }), 'décaler A de +14');
    ok(await d(resp, S.A) === '2027-03-15→2027-03-19' && await d(resp, S.B) === '2027-03-22→2027-03-27' && await d(resp, S.C) === '2027-03-29→2027-03-31', `A/B/C = ${await d(resp, S.A)} | ${await d(resp, S.B)} | ${await d(resp, S.C)}`);
  });
  await step('D-refus', 'Dépendances refusées avec la bonne raison : boucle, doublon, parent/enfant, autre projet', async () => {
    const link = (a, b, p) => api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: a, successor_id: b, project_id: p ?? S.pL });
    refuses(await link(S.C, S.A), /boucle/, 'boucle C → A');
    refuses(await link(S.B, S.A), /boucle/, 'boucle B → A');
    refuses(await link(S.A, S.B), /duplicate|unique/i, 'doublon');
    refuses(await link(S.A, S.A), /./, 'A → A');
    refuses(await link(S.A, S.tB, S.pL), /même projet/, 'éléments de deux projets');
    const ph = await item(resp, { project_id: S.pL, kind: 'phase', name: `${M} L-Phase`, starts_on: '2027-05-03', ends_on: '2027-05-14' });
    const ch = await item(resp, { project_id: S.pL, parent_id: ph, name: `${M} L-Enfant`, starts_on: '2027-05-03', ends_on: '2027-05-07' });
    refuses(await link(ph, ch), /parent ni de ce qu'il contient/, 'phase → son enfant');
    refuses(await link(ch, ph), /parent ni de ce qu'il contient/, 'enfant → sa phase');
    ok(await count(resp, 'cp_item_links', `project_id=eq.${S.pL}`) === 2, 'le nombre de dépendances a changé');
  });
  await step('D-supprimer-predecesseur', 'Supprimer une dépendance ne ramène pas le successeur en arrière', async () => {
    const before = await d(resp, S.C);
    accepts(await api(resp, 'DELETE', `/rest/v1/cp_item_links?predecessor_id=eq.${S.B}&successor_id=eq.${S.C}`), 'supprimer B → C');
    ok(await d(resp, S.C) === before, `C a bougé : ${before} → ${await d(resp, S.C)}`);
    accepts(await rpc(resp, 'cp_shift_item', { p_item_id: S.B, p_days: 7 }), 'décaler B');
    ok(await d(resp, S.C) === before, 'sans dépendance, C a bougé quand B a bougé');
  });
  await step('D-sans-weekend-desactive', 'Réglage « éviter les week-ends » désactivé : B commence le samedi, lendemain de la fin de A', async () => {
    const p = await proj(resp, { name: `${M} Liens WE`, link_skip_weekends: false });
    const a = await item(resp, { project_id: p, name: `${M} W-A`, starts_on: '2027-03-01', ends_on: '2027-03-05' });
    const b = await item(resp, { project_id: p, name: `${M} W-B`, starts_on: '2027-03-03', ends_on: '2027-03-08' });
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: a, successor_id: b, project_id: p }), 'A → B');
    ok(await d(resp, b) === '2027-03-06→2027-03-11', `B = ${await d(resp, b)} (attendu 2027-03-06→2027-03-11, un samedi)`);
  });
  await step('D-mode-aucun', 'Mode « ne rien décaler » : la dépendance existe, B ne bouge jamais', async () => {
    const p = await proj(resp, { name: `${M} Liens N`, link_mode: 'none' });
    const a = await item(resp, { project_id: p, name: `${M} N-A`, starts_on: '2027-03-01', ends_on: '2027-03-05' });
    const b = await item(resp, { project_id: p, name: `${M} N-B`, starts_on: '2027-03-03', ends_on: '2027-03-08' });
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: a, successor_id: b, project_id: p }), 'A → B');
    ok(await d(resp, b) === '2027-03-03→2027-03-08', `B a bougé à la création : ${await d(resp, b)}`);
    accepts(await rpc(resp, 'cp_shift_item', { p_item_id: a, p_days: 10 }), 'décaler A');
    ok(await d(resp, a) === '2027-03-11→2027-03-15' && await d(resp, b) === '2027-03-03→2027-03-08', `A/B = ${await d(resp, a)} | ${await d(resp, b)}`);
  });
  await step('D-mode-intervalle', 'Mode « garder l\'intervalle » : B suit A de +3 puis -2 jours, week-end compris', async () => {
    const p = await proj(resp, { name: `${M} Liens G`, link_mode: 'keep_gap', link_skip_weekends: false });
    const a = await item(resp, { project_id: p, name: `${M} G-P`, starts_on: '2027-03-01', ends_on: '2027-03-05' });
    const b = await item(resp, { project_id: p, name: `${M} G-Q`, starts_on: '2027-03-10', ends_on: '2027-03-12' });
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_links', { predecessor_id: a, successor_id: b, project_id: p }), 'P → Q');
    ok(await d(resp, b) === '2027-03-10→2027-03-12', 'la création de la dépendance a décalé Q');
    accepts(await rpc(resp, 'cp_shift_item', { p_item_id: a, p_days: 3 }), 'P +3');
    ok(await d(resp, a) === '2027-03-04→2027-03-08' && await d(resp, b) === '2027-03-13→2027-03-15', `P/Q = ${await d(resp, a)} | ${await d(resp, b)}`);
    accepts(await rpc(resp, 'cp_shift_item', { p_item_id: a, p_days: -2 }), 'P -2');
    ok(await d(resp, b) === '2027-03-11→2027-03-13', `Q après -2 = ${await d(resp, b)}`);
  });
  await step('D-decalage-bloc', 'Décaler une phase déplace toute sa descendance ; le jalon reste sur un jour ; un élément sans date reste sans date', async () => {
    const p = await proj(resp, { name: `${M} Bloc` });
    const ph = await item(resp, { project_id: p, kind: 'phase', name: `${M} Bloc phase`, starts_on: '2027-06-01', ends_on: '2027-06-30' });
    const t = await item(resp, { project_id: p, parent_id: ph, name: `${M} Bloc tâche`, starts_on: '2027-06-02', ends_on: '2027-06-10' });
    const j = await item(resp, { project_id: p, parent_id: ph, kind: 'milestone', name: `${M} Bloc jalon`, starts_on: '2027-06-30', ends_on: '2027-06-30' });
    const u = await item(resp, { project_id: p, parent_id: ph, name: `${M} Bloc sans date` });
    const n = await rpc(resp, 'cp_shift_item', { p_item_id: ph, p_days: 5 });
    accepts(n, 'décaler la phase'); ok(n.body === 4, `éléments décalés = ${n.body} (attendu 4)`);
    ok(await d(resp, ph) === '2027-06-06→2027-07-05' && await d(resp, t) === '2027-06-07→2027-06-15' && await d(resp, j) === '2027-07-05→2027-07-05', `phase/tâche/jalon = ${await d(resp, ph)} | ${await d(resp, t)} | ${await d(resp, j)}`);
    ok(await d(resp, u) === 'null→null', `élément sans date = ${await d(resp, u)}`);
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_projects?id=eq.${p}`, { starts_on: '2027-06-01', ends_on: '2027-06-30' }), 'dates du projet');
    accepts(await rpc(resp, 'cp_shift_project', { p_project_id: p, p_days: -5 }), 'décaler le projet');
    ok(await d(resp, ph) === '2027-06-01→2027-06-30', `phase après retour = ${await d(resp, ph)}`);
    const pr = (await get(resp, `/rest/v1/cp_projects?select=starts_on,ends_on&id=eq.${p}`))[0];
    ok(pr.starts_on === '2027-05-27' && pr.ends_on === '2027-06-25', `projet = ${JSON.stringify(pr)}`);
    refuses(await rpc(resp, 'cp_shift_item', { p_item_id: ph, p_days: 0 }), /décalage/i, 'décalage 0');
    refuses(await rpc(resp, 'cp_shift_item', { p_item_id: ph, p_days: 4000 }), /trop grand/i, 'décalage > 10 ans');
  });

  /* ============ H Droits : lecteurs ============ */
  group = 'H Droits';
  for (const c of [staff, collab]) {
    await step(`H-${c.who}-lecture`, `${c.who} lit projets, équipes, éléments, assignations et dépendances`, async () => {
      for (const [table, f] of [['cp_projects', 'id=eq.' + S.pL], ['cp_project_members', 'project_id=eq.' + S.pB], ['cp_items', 'project_id=eq.' + S.pL], ['cp_item_members', 'item_id=eq.' + S.tB], ['cp_item_links', 'project_id=eq.' + S.pL]]) {
        ok(await count(c, table, f) > 0, `${table} : rien de lisible`);
      }
    });
    await step(`H-${c.who}-ecriture`, `${c.who} ne peut RIEN écrire (valeurs valides : si c'est refusé, c'est bien le droit)`, async () => {
      const blockedAll = [
        ['créer un projet', await blocked(c, 'POST', '/rest/v1/cp_projects', { name: `${M} Piraté`, type: 'admin' })],
        ['modifier un projet', await blocked(c, 'PATCH', `/rest/v1/cp_projects?id=eq.${S.pL}`, { name: `${M} Piraté` })],
        ['supprimer un projet', await blocked(c, 'DELETE', `/rest/v1/cp_projects?id=eq.${S.pC}`)],
        ['ajouter à l\'équipe', await blocked(c, 'POST', '/rest/v1/cp_project_members', { project_id: S.pL, user_id: S[c.who === 'staff' ? 'u_staff' : 'u_collab'], role: 'member' })],
        ['changer un rôle', await blocked(c, 'PATCH', `/rest/v1/cp_project_members?project_id=eq.${S.pB}`, { role: 'member' })],
        ['retirer de l\'équipe', await blocked(c, 'DELETE', `/rest/v1/cp_project_members?project_id=eq.${S.pB}`)],
        ['créer un élément', await blocked(c, 'POST', '/rest/v1/cp_items', { project_id: S.pL, kind: 'task', name: `${M} Piraté` })],
        ['modifier un élément', await blocked(c, 'PATCH', `/rest/v1/cp_items?id=eq.${S.A}`, { name: `${M} Piraté` })],
        ['assigner', await blocked(c, 'POST', '/rest/v1/cp_item_members', { item_id: S.tB, user_id: S.u_resp })],
        ['désassigner', await blocked(c, 'DELETE', `/rest/v1/cp_item_members?item_id=eq.${S.tB}`)],
        ['créer une dépendance', await blocked(c, 'POST', '/rest/v1/cp_item_links', { predecessor_id: S.A, successor_id: S.C, project_id: S.pL })],
        ['supprimer une dépendance', await blocked(c, 'DELETE', `/rest/v1/cp_item_links?project_id=eq.${S.pL}`)],
      ].filter(([, b]) => !b).map(([w]) => w);
      ok(blockedAll.length === 0, `écritures ACCEPTÉES pour un lecteur : ${blockedAll.join(', ')}`);
      const shift = await rpc(c, 'cp_shift_item', { p_item_id: S.A, p_days: 1 });
      refuses(shift, /non autorisée/, 'décalage par un lecteur');
      ok(await d(resp, S.A) === '2027-03-15→2027-03-19', 'les dates ont changé malgré le refus');
    });
  }
  await step('H-isolation-entreprise', 'Un compte d\'une AUTRE entreprise ne voit ni n\'écrit rien (si E2E_OTHER_ORG_USER est fourni)', async () => {
    if (!process.env.E2E_OTHER_ORG_USER) return SKIP('NON TESTÉ : pas de compte d\'une autre entreprise (variable E2E_OTHER_ORG_USER). Couvert par les tests SQL (supabase/tests), pas par ce script.');
    ACCOUNTS.other = process.env.E2E_OTHER_ORG_USER;
    const other = await login(browser, 'other');
    ok(await count(other, 'cp_projects', `name=like.${mine}`) === 0 && await count(other, 'cp_items', `name=like.${mine}`) === 0, 'projets ou éléments TEST-SCEN visibles depuis une autre entreprise');
    ok(await blocked(other, 'POST', '/rest/v1/cp_item_members', { item_id: S.tB, user_id: S.u_resp }), 'assignation inter-entreprises acceptée');
    ok(await blocked(other, 'PATCH', `/rest/v1/cp_items?id=eq.${S.A}`, { name: `${M} Piraté` }), 'modification inter-entreprises acceptée');
    await other.ctx.close();
  });

  /* ============ I Cas limites ============ */
  group = 'I Cas limites';
  await step('I-noms-vides', 'Noms vides ou d\'espaces refusés (projet, programme)', async () => {
    refuses(await api(resp, 'POST', '/rest/v1/cp_projects', { name: '', type: 'admin' }), /check|violates|nom/i, 'projet sans nom');
    refuses(await api(resp, 'POST', '/rest/v1/cp_projects', { name: '     ', type: 'admin' }), /check|violates|nom/i, 'projet d\'espaces');
    refuses(await api(resp, 'POST', '/rest/v1/cp_programs', { name: ' ' }), /check|violates|nom/i, 'programme d\'espaces');
  });
  await step('I-caracteres', 'Accents, guillemets, apostrophes, emoji : relus à l\'identique', async () => {
    const name = `${M} Été "à" l'école 🎪 & <co>`;
    const id = await proj(resp, { name });
    ok((await get(resp, `/rest/v1/cp_projects?select=name&id=eq.${id}`))[0].name === name, 'nom relu différent');
  });
  await step('I-long-nom', 'Nom de 300 caractères : on observe ce que fait la base (pas de verdict arbitraire)', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_projects?select=id', { name: M + ' ' + 'x'.repeat(300), type: 'admin' }, REP);
    return INFO(refused(r) ? `refusé : ${msg(r)}` : 'accepté tel quel (aucune limite de longueur en base) ; à vérifier à l\'écran : la carte doit passer à la ligne');
  });
  await step('I-doublon-nom-projet', 'Deux projets de même nom : on observe', async () => {
    const r1 = await api(resp, 'POST', '/rest/v1/cp_projects?select=id', { name: `${M} Jumeau`, type: 'admin' }, REP);
    const r2 = await api(resp, 'POST', '/rest/v1/cp_projects?select=id', { name: `${M} Jumeau`, type: 'admin' }, REP);
    return INFO(`1er : ${refused(r1) ? 'refusé' : 'accepté'} · 2e : ${refused(r2) ? 'refusé (' + msg(r2) + ')' : 'accepté (les noms de projet peuvent se répéter)'}`);
  });
  await step('I-html', 'Un nom contenant du HTML s\'affiche en texte brut et n\'exécute rien', async () => {
    const name = `${M} <b>gras</b><img src=x onerror="window.__xss=1">`;
    await proj(resp, { name });
    await open(resp, '/pilote/projets');
    const txt = await resp.page.locator('main').innerText();
    ok(txt.includes('<b>gras</b>'), 'le HTML n\'est pas affiché en texte brut');
    ok(await resp.page.evaluate(() => window.__xss === undefined), 'un script injecté s\'est exécuté');
    ok(await resp.page.locator('main b', { hasText: 'gras' }).count() === 0, 'une balise <b> a été interprétée');
  }, resp.page);
  await step('I-perf-200', '200 éléments dans un projet : le Gantt affiche le projet et reste utilisable', async () => {
    const p = await proj(resp, { name: `${M} Perf`, starts_on: '2027-01-01', ends_on: '2027-12-31' });
    const phases = [];
    for (let i = 0; i < 10; i++) phases.push({ project_id: p, kind: 'phase', name: `${M} Perf phase ${i}`, starts_on: '2027-01-04', ends_on: '2027-12-17', parent_id: null });
    const ph = rows(await api(resp, 'POST', '/rest/v1/cp_items?select=id', phases, REP)).map(x => x.id);
    ok(ph.length === 10, `phases créées : ${ph.length}`);
    const tasks = [];
    for (let i = 0; i < 190; i++) tasks.push({ project_id: p, kind: 'task', name: `${M} Perf tâche ${i}`, starts_on: '2027-02-01', ends_on: '2027-02-12', parent_id: ph[i % 10] });
    const t = await api(resp, 'POST', '/rest/v1/cp_items?select=id', tasks, REP);
    accepts(t, 'création des 190 tâches'); ok(rows(t).length === 190, `tâches créées : ${rows(t).length}`);
    ok(await count(resp, 'cp_items', `project_id=eq.${p}`) === 200, 'le projet ne contient pas 200 éléments');
    await resp.page.goto(`${BASE}/pilote/gantt`);
    const t0 = Date.now();
    await resp.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 });
    await resp.page.locator('.group\\/row', { hasText: `${M} Perf` }).first().waitFor({ state: 'visible', timeout: 15000 });
    const ms = Date.now() - t0;
    S.perfMs = ms;
    const rowsShown = await resp.page.locator('.group\\/row').count();
    ok(rowsShown > 0, 'aucune ligne dans le Gantt');
    // L'arbre s'ouvre replié (quelques lignes) : on mesure aussi l'arbre DÉPLIÉ, avec les 200 éléments à l'écran
    const t1 = Date.now();
    await resp.page.getByRole('button', { name: 'Tout déplier' }).click();
    await resp.page.waitForFunction(() => document.querySelectorAll('.group\\/row').length >= 200, null, { timeout: 20000 }).catch(() => {});
    const msExpand = Date.now() - t1;
    const rowsExpanded = await resp.page.locator('.group\\/row').count();
    const detail = `replié : ${ms} ms, ${rowsShown} lignes · déplié : ${msExpand} ms, ${rowsExpanded} lignes`;
    if (rowsExpanded < 200) return { status: 'PARTIEL', detail: `${detail} (moins de 200 lignes affichées : l'arbre déplié n'a pas été mesuré en entier)` };
    if (ms > 2000 || msExpand > 2000) return { status: 'PARTIEL', detail: `${detail} (objectif < 2000 ms)` };
    return { status: 'OK', detail };
  }, resp.page);
  await step('I-double-clic', 'Double-clic sur « Enregistrer » : un seul projet est créé', async () => {
    await open(resp, '/pilote/projets');
    await resp.page.getByRole('button', { name: 'Nouveau projet' }).click(); await resp.page.waitForTimeout(700);
    await resp.page.locator('#prj-name').fill(`${M} Double clic`);
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().dblclick(); await resp.page.waitForTimeout(2200);
    const n = await count(resp, 'cp_projects', `name=eq.${encodeURIComponent(M + ' Double clic')}`);
    ok(n === 1, `projets « Double clic » créés = ${n} (attendu 1)`);
  }, resp.page);
  await step('I-coupure-reseau', 'Coupure réseau pendant l\'enregistrement : message d\'erreur, rien d\'écrit à moitié', async () => {
    await open(resp, '/pilote/projets');
    await resp.page.getByRole('button', { name: 'Nouveau projet' }).click(); await resp.page.waitForTimeout(700);
    await resp.page.locator('#prj-name').fill(`${M} Coupure`);
    await resp.page.route('**/rest/v1/cp_projects*', route => route.abort());
    await resp.page.getByRole('button', { name: 'Enregistrer' }).last().click(); await resp.page.waitForTimeout(2000);
    await resp.page.unroute('**/rest/v1/cp_projects*');
    const n = await count(resp, 'cp_projects', `name=eq.${encodeURIComponent(M + ' Coupure')}`);
    ok(n === 0, `projet créé malgré la coupure : ${n}`);
    const stillOpen = await resp.page.locator('#prj-name').count();
    const toast = await resp.page.locator('[role="status"]').allInnerTexts();
    return INFO(`rien écrit en base ; formulaire ${stillOpen ? 'toujours ouvert (la saisie est conservée)' : 'fermé'} ; message(s) affiché(s) : ${JSON.stringify(toast).slice(0, 120)}`);
  }, resp.page);
  await step('I-rechargement', 'Rechargement de la page en plein formulaire : pas d\'erreur JavaScript, la page revient', async () => {
    const before = jsErrors.length;
    await open(resp, '/pilote/projets');
    await resp.page.getByRole('button', { name: 'Nouveau projet' }).click(); await resp.page.waitForTimeout(500);
    await resp.page.locator('#prj-name').fill(`${M} Reload`);
    await resp.page.reload(); await resp.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 }); await resp.page.waitForTimeout(1500);
    ok(jsErrors.length === before, `erreurs JavaScript : ${jsErrors.slice(before).join(' | ')}`);
    ok(await count(resp, 'cp_projects', `name=eq.${encodeURIComponent(M + ' Reload')}`) === 0, 'un projet « Reload » a été créé');
  }, resp.page);
  await step('I-mobile', 'Mobile 390 px : Projets, Mes tâches et Gantt sans défilement horizontal de la page', async () => {
    const bad = [];
    try {
      await resp.page.setViewportSize({ width: 390, height: 800 });
      for (const [url, tab] of [['/pilote/projets', null], ['/pilote/projets', /^Mes tâches/], ['/pilote/gantt', null]]) {
        await open(resp, url);
        if (tab) { await resp.page.getByRole('radio', { name: tab }).click(); await resp.page.waitForTimeout(1200); }
        const w = await resp.page.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }));
        if (w.s > w.i + 1) bad.push(`${url}${tab ? ' (Mes tâches)' : ''} : largeur ${w.s} > ${w.i}`);
      }
    } finally { await resp.page.setViewportSize({ width: 1440, height: 900 }); }
    ok(bad.length === 0, `débordement horizontal : ${bad.join(' ; ')}`);
  }, resp.page);
  await step('I-sombre', 'Mode sombre : les écrans PILOTE s\'ouvrent sans débordement ni erreur JavaScript', async () => {
    const before = jsErrors.length;
    let dark = false, noOverflow = false;
    try {
      await resp.page.evaluate(() => localStorage.setItem('theme', 'dark'));
      await open(resp, '/pilote/projets');
      dark = await resp.page.evaluate(() => document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark');
      noOverflow = await resp.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    } finally { await resp.page.evaluate(() => localStorage.setItem('theme', 'light')); }
    ok(noOverflow, 'débordement horizontal en mode sombre');
    ok(jsErrors.length === before, `erreurs JavaScript : ${jsErrors.slice(before).join(' | ')}`);
    return dark ? undefined : INFO('le mode sombre n\'a pas été détecté sur <html> : la vérification visuelle n\'est pas garantie');
  }, resp.page);
  for (const [lang, expectTab] of [['de', 'Meine Aufgaben'], ['it', 'Le mie attività'], ['en', 'My tasks']]) {
    await step(`I-langue-${lang}`, `Langue ${lang} : « Mes tâches » et la fiche du projet sont traduits (textes attendus lus dans src/i18n/${lang}.json)`, async () => {
      // On compare aux traductions ATTENDUES, et seulement dans les éléments concernés : chercher un mot français dans tout le formulaire donne de faux positifs
      // (une donnée n'est jamais traduite : la personne de test s'appelle « TEST Rôle Responsable » ; et « Description » s'écrit pareil en anglais).
      const dict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', `${lang}.json`), 'utf8'));
      const want = k => { ok(dict[k], `pas de traduction ${lang} pour « ${k} » dans le dictionnaire`); return dict[k]; };
      let opened = false, missing = [];
      try {
        await resp.page.evaluate(l => localStorage.setItem('gomat-language', l), lang);
        await open(resp, '/pilote/projets');
        const body = await resp.page.locator('main').innerText();
        ok(body.includes(expectTab), `onglet « ${expectTab} » absent (langue non appliquée ou onglet non traduit)`);
        const edit = resp.page.locator('button', { hasText: new RegExp(`${dict['Modifier'] || 'Modifier'}|Modifier`) }).first();
        if (await edit.count()) {
          await edit.click(); await resp.page.waitForTimeout(900);
          opened = true;
          const legends = await resp.page.locator('form legend').allInnerTexts();
          const options = await resp.page.locator('form fieldset select').first().locator('option').allInnerTexts();
          if (!legends.some(t => t.trim() === want('Équipe'))) missing.push(`titre « ${want('Équipe')} » (lu : ${JSON.stringify(legends)})`);
          for (const k of ['Pas dans l\'équipe', 'Membre', 'Responsable']) if (!options.some(t => t.trim() === want(k))) missing.push(`option « ${want(k)} » (lues : ${JSON.stringify(options)})`);
          await resp.page.keyboard.press('Escape');
        }
      } finally { await resp.page.evaluate(() => localStorage.setItem('gomat-language', 'fr')); }
      if (!opened) return INFO('onglet « Mes tâches » traduit, mais la fiche du projet n\'a pas pu être ouverte (bouton de modification introuvable) : traduction de la fiche NON vérifiée');
      return missing.length ? { status: 'PARTIEL', detail: `non traduit dans la fiche : ${missing.join(' ; ')}` } : undefined;
    }, resp.page);
  }
  await step('I-concurrence', 'Deux sessions modifient le même élément : on DÉCRIT ce qui se passe (pas de verdict)', async () => {
    const id = await item(resp, { project_id: S.pE, name: `${M} Concurrence`, description: 'initiale' });
    const second = await login(browser, 'resp');
    await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${id}`, { name: `${M} Concurrence A` });
    await api(second, 'PATCH', `/rest/v1/cp_items?id=eq.${id}`, { description: 'écrite par B' });
    const r = (await get(resp, `/rest/v1/cp_items?select=name,description&id=eq.${id}`))[0];
    await second.ctx.close();
    return INFO(`Modifications PARTIELLES (champs différents) : les deux sont conservées = ${r.name.endsWith('A') && r.description === 'écrite par B'}. ATTENTION : la fiche de l'écran enregistre l'élément ENTIER (voir ItemDrawer.tsx, fonction d'enregistrement) : si deux personnes ouvrent la même fiche, la dernière à enregistrer écrase les champs de l'autre sans avertissement (« dernier gagnant »).`);
  });

  /* ============ N Notifications PILOTE (étape 2, migration 53) ============ */
  group = 'N Notifications';
  const myNotifs = async c => rows(await rpc(c, 'my_notifications', { p_limit: 500 })).filter(n => /^cp_/.test(n.kind) && (n.message || '').includes(M));
  await step('N-equipe-assignation', 'Ajouter le collaborateur à l\'équipe puis lui assigner une tâche : il reçoit 2 avis précis, le responsable (auteur) aucun', async () => {
    S.pN = await proj(resp, { name: `${M} Projet notifs` });
    S.tN1 = await item(resp, { project_id: S.pN, name: `${M} Notif T1`, starts_on: '2027-05-03', ends_on: '2027-05-07' });
    accepts(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: S.pN, user_id: S.u_resp, role: 'lead' }), 'équipe : responsable');
    accepts(await api(resp, 'POST', '/rest/v1/cp_project_members', { project_id: S.pN, user_id: S.u_collab, role: 'member' }), 'équipe : collaborateur');
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_members', [{ item_id: S.tN1, user_id: S.u_collab }, { item_id: S.tN1, user_id: S.u_resp }]), 'assignations');
    const mine = await myNotifs(collab);
    const team = mine.filter(n => n.kind === 'cp_team_added'), asg = mine.filter(n => n.kind === 'cp_assigned');
    ok(team.length === 1 && /membre/.test(team[0].message) && team[0].message.includes(`${M} Projet notifs`), `avis d'équipe = ${JSON.stringify(team.map(n => n.message))}`);
    ok(asg.length === 1 && asg[0].message.includes(`la tâche « ${M} Notif T1 »`) && asg[0].message.includes('à terminer le 07.05.2027'), `avis d'assignation = ${JSON.stringify(asg.map(n => n.message))}`);
    ok((await myNotifs(resp)).length === 0, 'l\'auteur reçoit des avis sur ses propres actions');
  });
  await step('N-dates-regroupees', 'Décaler une tâche assignée : avis « dates modifiées » ; un 2e décalage rapproché est regroupé (toujours un seul avis)', async () => {
    accepts(await rpc(resp, 'cp_shift_item', { p_item_id: S.tN1, p_days: 7 }), 'décaler +7');
    let d1 = (await myNotifs(collab)).filter(n => n.kind === 'cp_dates_changed');
    ok(d1.length === 1 && d1[0].message.includes('du 10.05.2027 au 14.05.2027'), `avis de dates = ${JSON.stringify(d1.map(n => n.message))}`);
    accepts(await rpc(resp, 'cp_shift_item', { p_item_id: S.tN1, p_days: 7 }), 'décaler +7 encore');
    d1 = (await myNotifs(collab)).filter(n => n.kind === 'cp_dates_changed');
    ok(d1.length === 1, `après un 2e décalage : ${d1.length} avis (attendu 1, regroupé)`);
    accepts(await api(resp, 'PATCH', `/rest/v1/cp_items?id=eq.${S.tN1}`, { description: 'sans effet sur les dates' }), 'description');
    ok((await myNotifs(collab)).filter(n => n.kind === 'cp_dates_changed').length === 1, 'modifier la description a produit un avis');
  });
  await step('N-ecran-notifications', 'Écran « Notifications » du collaborateur : famille PILOTE, avis lisibles, un clic ouvre « Mes tâches »', async () => {
    await open(collab, '/notifications');
    ok(await collab.page.getByText(`${M} Projet notifs`, { exact: false }).first().isVisible(), 'avis PILOTE absent de l\'écran');
    ok(await collab.page.getByRole('radio', { name: /^PILOTE/ }).count() > 0, 'famille « PILOTE » absente');
    await collab.page.getByRole('radio', { name: /^PILOTE/ }).click(); await collab.page.waitForTimeout(500);
    await collab.page.getByText(`${M} Projet notifs`, { exact: false }).first().click(); await collab.page.waitForTimeout(1800);
    ok(/\/pilote\/projets/.test(collab.page.url()) && /section=mytasks/.test(collab.page.url()), `adresse après clic = ${collab.page.url()}`);
    ok(await collab.page.getByRole('button', { name: `${M} Notif T1` }).first().isVisible(), '« Mes tâches » ne s\'est pas ouvert sur la tâche');
  }, collab.page);
  await step('N-choix-ecran', 'Choix par personne à l\'écran : 5 événements × 3 canaux, une case cochée est enregistrée en base', async () => {
    await open(collab, '/notifications');
    const card = collab.page.locator('table', { has: collab.page.getByText('Échéance proche') }).first();
    ok(await card.locator('tbody tr').count() === 5, 'le tableau des choix n\'a pas 5 lignes');
    ok(await card.locator('input[type=checkbox]').count() === 15, 'le tableau des choix n\'a pas 15 cases');
    const box = card.locator('input[aria-label*="m\'assigne une tâche"]').first();
    await box.click(); await collab.page.waitForTimeout(1200);
    const p = (await get(collab, `/rest/v1/cp_notification_prefs?select=kind,in_app&kind=eq.cp_assigned`))[0];
    ok(p && p.in_app === false, `choix enregistré = ${JSON.stringify(p)} (attendu in_app = false)`);
  }, collab.page);
  await step('N-choix-respecte', '« Dans l\'application » décoché : une nouvelle assignation ne produit AUCUN avis ; recoché, elle en produit un', async () => {
    const t2 = await item(resp, { project_id: S.pN, name: `${M} Notif T2` });
    const before = (await myNotifs(collab)).filter(n => n.kind === 'cp_assigned').length;
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: t2, user_id: S.u_collab }), 'assigner T2');
    ok((await myNotifs(collab)).filter(n => n.kind === 'cp_assigned').length === before, 'un avis a été créé malgré le choix');
    accepts(await api(collab, 'PATCH', '/rest/v1/cp_notification_prefs?kind=eq.cp_assigned', { in_app: true }), 'recocher');
    const t3 = await item(resp, { project_id: S.pN, name: `${M} Notif T3` });
    accepts(await api(resp, 'POST', '/rest/v1/cp_item_members', { item_id: t3, user_id: S.u_collab }), 'assigner T3');
    ok((await myNotifs(collab)).filter(n => n.kind === 'cp_assigned').length === before + 1, 'recoché, aucun avis créé');
    accepts(await api(collab, 'DELETE', '/rest/v1/cp_notification_prefs?kind=eq.cp_assigned'), 'remise à zéro des choix');
  });
  await step('N-droits', 'Droits : les choix d\'un autre sont illisibles ; les rappels quotidiens ne se lancent pas à la main', async () => {
    accepts(await api(staff, 'POST', '/rest/v1/cp_notification_prefs', { kind: 'cp_overdue', in_app: false }), 'le magasinier fixe SON choix');
    ok((await get(collab, '/rest/v1/cp_notification_prefs?select=user_id')).every(r => r.user_id === S.u_collab), 'le collaborateur lit des choix qui ne sont pas les siens');
    ok((await get(resp, '/rest/v1/cp_notification_prefs?select=user_id')).every(r => r.user_id === S.u_resp), 'le responsable lit les choix des autres');
    accepts(await api(staff, 'DELETE', '/rest/v1/cp_notification_prefs?kind=eq.cp_overdue'), 'nettoyage du choix du magasinier');
    refuses(await rpc(resp, 'check_cp_deadlines'), /permission|denied|autoris/i, 'lancer les rappels depuis l\'écran');
    refuses(await rpc(resp, 'cp_notify', { p_user: S.u_collab, p_kind: 'cp_assigned', p_title: 'x', p_message: 'y', p_project: null, p_item: null }), /permission|denied|autoris|function/i, 'créer un avis à la main');
  });
  await step('N-rappels-quotidiens', 'Rappels d\'échéance (cp_due_soon / cp_overdue)', async () => SKIP('NON TESTÉ ici : le contrôle quotidien est réservé à la clé de service (la fonction Edge) ; il est couvert par les tests SQL (notifications_pilote.sql) et par un essai annulé sur la vraie base, pas par ce script.'));

  /* ============ J Sauvegarde ============ */
  group = 'J Sauvegarde';
  await step('J-sauvegarde', 'La sauvegarde contient l\'équipe (colonne role) et les assignations', async () => SKIP('NON TESTÉ : générer une sauvegarde crée un fichier réel et la restaurer est destructif ; non exécuté volontairement. Vérifié par lecture du code seulement : BACKUP_TABLES contient cp_project_members et cp_item_members, et la sauvegarde lit select(\'*\') donc la colonne role est incluse.'));

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  const clean = {};
  try {
    for (const table of ['cp_projects', 'cp_programs']) { const r = await api(resp, 'DELETE', `/rest/v1/${table}?name=like.${mine}`, undefined, REP); clean[table] = refused(r) ? msg(r) : `${rows(r).length} supprimé(s)`; }
    { const r = await api(resp, 'DELETE', `/rest/v1/sites?name=like.${mine}`, undefined, REP); clean.sites = refused(r) ? msg(r) : `${rows(r).length} supprimé(s)`; }
    clean.restants = {
      projets: await count(resp, 'cp_projects', `name=like.${mine}`), programmes: await count(resp, 'cp_programs', `name=like.${mine}`),
      chantiers: await count(resp, 'sites', `name=like.${mine}`), avis: await count(resp, 'notifications', `message=like.${encodeURIComponent('*' + M + '*')}`), elements: await count(resp, 'cp_items', `name=like.${mine}`),
    };
  } catch (e) { clean.err = e.message; }
  await step('Z-restes', 'Aucun reste après nettoyage (vérifié par requête)', async () => {
    ok(clean.restants && Object.values(clean.restants).every(n => n === 0), `restes = ${JSON.stringify(clean)}`);
  });

  await browser.close();

  await browser.close();

  /* ============ Rapport ============ */
  const n = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport des scénarios PILOTE', '',
    `Base : GO-MAT · comptes : ${Object.values(ACCOUNTS).join(', ')} · date : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, `Commit testé : ${(() => { try { return execSync('git log --oneline -1').toString().trim(); } catch { return 'inconnu'; } })()}`, '',
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
