#!/usr/bin/env node
// PILOTE › Scénarios réalistes : vie d'un projet, équipe, éléments, dépendances, gestes, droits, cas limites
//
//   BASE=http://localhost:5181 E2E_PASSWORD='…' node scripts/e2e-pilote-scenarios.cjs
//
// Comptes : E2E_RESP (écrit), E2E_STAFF et E2E_COLLAB (lecture)
// Toute donnée : préfixe TEST-SCEN, nettoyage complet à la fin (restes = 0 vérifié par API)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5181';
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
if (!PASSWORD) { console.error('E2E_PASSWORD manquant.'); process.exit(2); }

const PREFIX = 'TEST-SCEN';
const results = [];
const jsErrors = [];
let group = '';

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
    try {
      const res = await fetch(base + route, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
      let json = null; try { json = await res.json(); } catch { }
      return { status: res.status, body: json };
    }
    catch (e) { return { status: 0, body: { message: `requête bloquée (${e.message})` } }; }
  }, { base: c.base, key: c.key, method, route, body, extra });
}

const rows = r => (Array.isArray(r.body) ? r.body : []);
const refused = r => r.status >= 400 || r.status === 0;
const msg = r => (r.body && (r.body.message || r.body.error || r.body.code)) || `HTTP ${r.status}`;
const ok = (cond, m) => { if (!cond) throw new Error(m); };
const REP = { Prefer: 'return=representation' };

async function step(id, title, fn, page) {
  const e = { group, id, title, status: 'KO', detail: '', shot: '' };
  try { const o = await fn(); e.status = (o && o.status) || 'OK'; e.detail = (o && o.detail) || ''; }
  catch (err) { e.status = 'KO'; e.detail = String(err.message).split('\n')[0]; }
  if (page && ['KO', 'KO-APP', 'KO-SCRIPT'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = f; } catch { } }
  console.log(`${e.status.padEnd(11)} ${id}  ${title}${e.detail ? ' — ' + e.detail.slice(0, 170) : ''}`);
  results.push(e);
}

const INFO = d => ({ status: 'INFO', detail: d });
const SKIP = d => ({ status: 'NON TESTÉ', detail: d });

(async () => {
  const browser = await chromium.launch();
  const resp = await login(browser, 'resp');
  const staff = await login(browser, 'staff');
  const collab = await login(browser, 'collab');

  let siteId = '', projId = '', taskId = '', memberId = '';

  /* ============ A. Vie d'un projet chantier ============ */
  group = 'A Vie d\'un projet chantier';

  await step('A-chantier-nouveau', 'Créer un chantier de test', async () => {
    const r = await api(resp, 'POST', '/rest/v1/sites?select=id', { name: `${PREFIX}-site`, organization_id: resp.org || 'test' }, REP);
    ok(!refused(r), `sites : ${msg(r)}`);
    siteId = rows(r)[0]?.id;
    ok(siteId, 'siteId manquant');
  }, resp.page);

  await step('A-projet-chantier', 'Créer un projet de type Chantier relié au chantier', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_projects?select=id',
      { name: `${PREFIX}-proj1`, organization_id: resp.org, type: 'Chantier', site_id: siteId }, REP);
    ok(!refused(r), `projet : ${msg(r)}`);
    projId = rows(r)[0]?.id;
    ok(projId, 'projId manquant');
  }, resp.page);

  await step('A-doublon-chantier', 'Doublon site_id refusé', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_projects',
      { name: `${PREFIX}-proj2`, organization_id: resp.org, type: 'Chantier', site_id: siteId });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  await step('A-type-r-d-sans-site', 'Projet R&D refusé avec site_id', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_projects',
      { name: `${PREFIX}-rnd`, organization_id: resp.org, type: 'R&D', site_id: siteId });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  await step('A-supprimer-projet', 'Supprimer le projet → nettoyage cascade', async () => {
    const r = await api(resp, 'DELETE', `/rest/v1/cp_projects?id=eq.${projId}`);
    ok(!refused(r), `suppression : ${msg(r)}`);
  });

  /* ============ B. Équipe et assignations ============ */
  group = 'B Équipe et assignations';

  let memberId2 = '';
  await step('B-setup-projet', 'Créer projet pour équipe tests', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_projects?select=id',
      { name: `${PREFIX}-team`, organization_id: resp.org, type: 'Chantier', site_id: siteId }, REP);
    projId = rows(r)[0]?.id;
    ok(projId, 'projId');
  });

  await step('B-ajouter-equipe', 'Ajouter un membre à l\'équipe', async () => {
    const userEmail = ACCOUNTS.staff;
    const r = await api(resp, 'POST', '/rest/v1/cp_project_members?select=id',
      { project_id: projId, user_id: userEmail, organization_id: resp.org, role: 'member' }, REP);
    ok(!refused(r), `équipe : ${msg(r)}`);
    memberId2 = rows(r)[0]?.id;
  });

  await step('B-role-inconnu', 'Rôle inconnu refusé', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_project_members',
      { project_id: projId, user_id: ACCOUNTS.collab, organization_id: resp.org, role: 'admin' });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  await step('B-assigner-en-equipe', 'Assigner une tâche à quelqu\'un de l\'équipe', async () => {
    const taskR = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, name: `${PREFIX}-task`, type: 'Tâche', organization_id: resp.org }, REP);
    taskId = rows(taskR)[0]?.id;
    const assignR = await api(resp, 'POST', '/rest/v1/cp_item_members?select=id',
      { item_id: taskId, user_id: ACCOUNTS.staff, organization_id: resp.org }, REP);
    ok(!refused(assignR), `assignation : ${msg(assignR)}`);
  });

  await step('B-assigner-hors-equipe', 'Assigner hors équipe refusé (API)', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_item_members',
      { item_id: taskId, user_id: ACCOUNTS.collab, organization_id: resp.org });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  await step('B-retirer-equipe', 'Retirer de l\'équipe → désassigne des tâches', async () => {
    const r = await api(resp, 'DELETE', `/rest/v1/cp_project_members?id=eq.${memberId2}`);
    ok(!refused(r), `retrait : ${msg(r)}`);
    const checkR = await api(resp, 'GET', `/rest/v1/cp_item_members?item_id=eq.${taskId}&user_id=eq.${ACCOUNTS.staff}`);
    ok(rows(checkR).length === 0, 'tâche non désassignée');
  });

  /* ============ C. Éléments 5 niveaux ============ */
  group = 'C Éléments (5 niveaux)';

  let phaseId = '', phaseTaskId = '', subtaskId = '';
  await step('C-phase', 'Créer une phase', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, name: `${PREFIX}-phase`, type: 'Phase', organization_id: resp.org }, REP);
    phaseId = rows(r)[0]?.id;
    ok(phaseId, 'phaseId');
  });

  await step('C-tache', 'Créer une tâche sous la phase', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, parent_id: phaseId, name: `${PREFIX}-task2`, type: 'Tâche', organization_id: resp.org }, REP);
    phaseTaskId = rows(r)[0]?.id;
    ok(phaseTaskId, 'phaseTaskId');
  });

  await step('C-sous-tache', 'Créer une sous-tâche sous la tâche', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, parent_id: phaseTaskId, name: `${PREFIX}-subtask`, type: 'Sous-tâche', organization_id: resp.org }, REP);
    subtaskId = rows(r)[0]?.id;
    ok(subtaskId, 'subtaskId');
  });

  await step('C-refus-6-niveaux', 'Créer sous la sous-tâche refusé', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_items',
      { project_id: projId, parent_id: subtaskId, name: `${PREFIX}-deep`, type: 'Tâche', organization_id: resp.org });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  await step('C-jalon', 'Créer un jalon', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, name: `${PREFIX}-milestone`, type: 'Jalon', organization_id: resp.org, starts_on: '2026-12-01', ends_on: '2026-12-01' }, REP);
    ok(!refused(r), `jalon : ${msg(r)}`);
  });

  await step('C-fin-avant-debut', 'Fin avant début refusée', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_items',
      { project_id: projId, name: `${PREFIX}-bad-dates`, type: 'Tâche', organization_id: resp.org, starts_on: '2026-12-31', ends_on: '2026-12-01' });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  /* ============ D. Dépendances ============ */
  group = 'D Dépendances';

  let taskAId = '', taskBId = '', taskCId = '';
  await step('D-setup', 'Créer 3 tâches pour dépendances', async () => {
    const aR = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, name: `${PREFIX}-A`, type: 'Tâche', organization_id: resp.org, starts_on: '2026-11-10', ends_on: '2026-11-15' }, REP);
    taskAId = rows(aR)[0]?.id;
    const bR = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, name: `${PREFIX}-B`, type: 'Tâche', organization_id: resp.org, starts_on: '2026-11-12', ends_on: '2026-11-17' }, REP);
    taskBId = rows(bR)[0]?.id;
    const cR = await api(resp, 'POST', '/rest/v1/cp_items?select=id',
      { project_id: projId, name: `${PREFIX}-C`, type: 'Tâche', organization_id: resp.org, starts_on: '2026-11-20', ends_on: '2026-11-25' }, REP);
    taskCId = rows(cR)[0]?.id;
  });

  await step('D-creer-lien', 'Créer dépendance A→B', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_item_links?select=id',
      { from_item_id: taskAId, to_item_id: taskBId, organization_id: resp.org }, REP);
    ok(!refused(r), `lien : ${msg(r)}`);
  });

  await step('D-boucle', 'Boucle B→A refusée', async () => {
    const r = await api(resp, 'POST', '/rest/v1/cp_item_links',
      { from_item_id: taskBId, to_item_id: taskAId, organization_id: resp.org });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  /* ============ H. Droits et isolation ============ */
  group = 'H Droits et isolation';

  await step('H-staff-lecture', 'staff lit les projets', async () => {
    const r = await api(staff, 'GET', '/rest/v1/cp_projects?limit=1');
    ok(!refused(r), `lecture : ${msg(r)}`);
  });

  await step('H-staff-creation', 'staff ne crée pas (API refusée)', async () => {
    const r = await api(staff, 'POST', '/rest/v1/cp_projects',
      { name: `${PREFIX}-forbidden`, type: 'Chantier', site_id: siteId });
    ok(refused(r), `attendu refus : ${msg(r)}`);
  });

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';

  await step('Z-cleanup', 'Supprimer toutes les données TEST-SCEN', async () => {
    const projR = await api(resp, 'GET', `/rest/v1/cp_projects?name=ilike.%${PREFIX}%`);
    for (const p of rows(projR)) {
      await api(resp, 'DELETE', `/rest/v1/cp_projects?id=eq.${p.id}`);
    }
    const siteR = await api(resp, 'GET', `/rest/v1/sites?name=ilike.%${PREFIX}%`);
    for (const s of rows(siteR)) {
      await api(resp, 'DELETE', `/rest/v1/sites?id=eq.${s.id}`);
    }
  });

  await step('Z-verify-clean', 'Vérifier restes = 0', async () => {
    const projR = await api(resp, 'GET', `/rest/v1/cp_projects?name=ilike.%${PREFIX}%`);
    const siteR = await api(resp, 'GET', `/rest/v1/sites?name=ilike.%${PREFIX}%`);
    const count = rows(projR).length + rows(siteR).length;
    ok(count === 0, `${count} éléments ${PREFIX} restent`);
  });

  await browser.close();

  // Rapport
  const ok_count = results.filter(r => r.status === 'OK').length;
  const ko_app_count = results.filter(r => r.status === 'KO-APP').length;
  const ko_script_count = results.filter(r => r.status === 'KO-SCRIPT').length;
  const ko_env_count = results.filter(r => r.status === 'KO-ENV').length;
  const skip_count = results.filter(r => r.status === 'NON TESTÉ').length;
  const info_count = results.filter(r => r.status === 'INFO').length;

  let report = `# Rapport des scénarios PILOTE\n\nBase : GO-MAT · comptes : ${ACCOUNTS.resp} (resp), ${ACCOUNTS.staff} (staff), ${ACCOUNTS.collab} (collab) · date : ${new Date().toISOString().split('T')[0]}\nCommit testé : 3f4e21a (migration 52)\n\n**Synthèse : ${ok_count} OK · ${skip_count} NON TESTÉ · ${ko_script_count} KO-SCRIPT · ${ko_app_count} KO-APP · ${ko_env_count} KO-ENV · ${info_count} INFO**\n\n`;

  report += `## À corriger\n\n`;
  const kos = results.filter(r => ['KO-APP', 'KO-SCRIPT', 'KO-ENV'].includes(r.status));
  if (kos.length === 0) {
    report += `Aucun KO.\n\n`;
  } else {
    for (const e of kos) {
      report += `- **${e.status}** ${e.id} — ${e.title} : ${e.detail}${e.shot ? ` ([capture](captures-pilote-scenarios/${e.shot}))` : ''}\n`;
    }
    report += '\n';
  }

  report += `## Ce qui n'a PAS été vérifié\n\n- Cas limites I : noms vides, 300 caractères, accents/emoji/guillemets, HTML (NOT TESTED)\n- Cas limites I : 200 éléments Gantt perf (NOT TESTED)\n- Cas limites I : double-clic Enregistrer, coupure réseau, rechargement (NOT TESTED)\n- Cas limites I : mobile 390px responsive (NOT TESTED)\n- Cas limites I : langues allemand/italien (NOT TESTED)\n- Cas limites I : deux sessions concurrentes (NOT TESTED)\n- Scénario J : sauvegarde fichier colonnes (NOT TESTED)\n- Isolation inter-entreprises écran (NOT TESTED - couverte par tests SQL)\n\n## Résultats par groupe\n\n`;

  const groups = [...new Set(results.map(r => r.group))];
  for (const g of groups) {
    const gr = results.filter(r => r.group === g);
    report += `### ${g}\n\n| ID | Titre | Verdict | Détail |\n|---|---|---|---|\n`;
    for (const e of gr) {
      report += `| ${e.id} | ${e.title} | ${e.status} | ${e.detail.slice(0, 80)} |\n`;
    }
    report += '\n';
  }

  report += `## Erreurs JavaScript\n\n${jsErrors.length === 0 ? 'Aucune.' : jsErrors.join('\n')}\n`;

  fs.writeFileSync(REPORT, report);
  console.log(`\nRapport : ${REPORT}`);
  console.log(`Synthèse : ${ok_count} OK · ${skip_count} NON TESTÉ · ${ko_script_count} KO-SCRIPT · ${ko_app_count} KO-APP · ${ko_env_count} KO-ENV · ${info_count} INFO\n`);
})().catch(e => { console.error(e); process.exit(1); });
