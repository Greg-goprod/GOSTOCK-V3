#!/usr/bin/env node
// Planning de chantier (module 1) : contrôles de la base, séries, copie d'un jour, matériel, droits par rôle, frise (glisser-déposer).
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-planning.cjs
//
// Prérequis : migrations 42 à 46 appliquées ; le module « Planning de chantier » activé pour l'entreprise des comptes de test
// (Console de la plateforme › Modules). Comptes : E2E_RESP (écrit : droit « chantiers.planning »), E2E_STAFF et E2E_COLLAB (lisent
// seulement) ; par défaut test.responsable@ / test.magasinier@ / test.collaborateur@example.com. Mot de passe UNIQUEMENT par E2E_PASSWORD.
// Tout ce qui est créé porte « TEST-PLAN » et est supprimé à la fin (chantiers de test → zones, équipes, interventions en cascade).
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
const SHOTS = path.join(OUT_DIR, 'captures-planning');
const REPORT = path.join(OUT_DIR, 'rapport-planning.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-PLAN';
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
  if (page && ['KO', 'PARTIEL'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-planning/${f}`; } catch { /* page fermée */ } }
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
  const itv = (over) => ({ site_id: S.site, zone_id: S.z1, team_id: S.t1, title: `${M} intervention`, ...over });
  const slot = (day, from, to) => ({ starts_at: zurichIso(day, from), ends_at: zurichIso(day, to) });
  const count = async (c, filter) => rows(await api(c, 'GET', `/rest/v1/site_interventions?select=id&site_id=eq.${S.site}${filter || ''}`)).length;
  const wallOf = iso => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`; };

  /* ============ P0 Prérequis ============ */
  group = 'P0 Prérequis';
  await step('P0-module', 'Le module « Planning de chantier » est activé pour l\'entreprise des comptes de test', async () => {
    for (const c of [resp, staff, collab]) { const me = (await rpc(c, 'whoami')).body || {}; ok((me.modules || []).includes('chantiers_planning'), `${c.who} : module absent (whoami.modules = ${JSON.stringify(me.modules)})`); }
  });
  await step('P0-droits', 'Droits : le responsable écrit ; magasinier et collaborateur lisent seulement', async () => {
    const can = async (c, action) => (await rpc(c, 'rbac_has_any_permission', { p_keys: [`chantiers.planning:${action}`] })).body === true;
    for (const a of ['create', 'update', 'delete']) { ok(await can(resp, a), `le responsable n'a pas « ${a} »`); ok(!(await can(staff, a)), `le magasinier a « ${a} »`); ok(!(await can(collab, a)), `le collaborateur a « ${a} »`); }
    for (const c of [resp, staff, collab]) ok(await can(c, 'read'), `${c.who} ne lit pas`);
  });

  /* ============ P1 Préparation ============ */
  group = 'P1 Préparation';
  await step('P1-prepa', 'Chantier de test (juin 2027), prestataire, zones, équipes, phase, jour bloqué, réglages', async () => {
    S.site = await create(resp, 'sites', { name: `${M} Chantier`, start_on: '2027-06-01', end_on: '2027-06-30' });
    S.site2 = await create(resp, 'sites', { name: `${M} Autre chantier`, start_on: '2027-06-01', end_on: '2027-06-30' });
    S.contractor = await create(resp, 'contractors', { name: `${M} Scène SA` });
    S.z1 = await create(resp, 'site_zones', { site_id: S.site, name: 'Scène' });
    S.z2 = await create(resp, 'site_zones', { site_id: S.site, name: 'Parking' });
    S.zOther = await create(resp, 'site_zones', { site_id: S.site2, name: 'Zone étrangère' });
    S.t1 = await create(resp, 'site_teams', { site_id: S.site, name: 'Équipe son', contractor_id: S.contractor });
    S.t2 = await create(resp, 'site_teams', { site_id: S.site, name: 'Équipe interne' });
    S.phase = await create(resp, 'site_phases', { site_id: S.site, name: 'Montage', start_on: '2027-06-01', end_on: '2027-06-10' });
    ok((await api(resp, 'POST', '/rest/v1/site_blocked_days', { site_id: S.site, day: '2027-06-13', reason: 'Dimanche' })).status < 300, 'jour bloqué refusé');
    ok((await api(resp, 'POST', '/rest/v1/site_config', { site_id: S.site, day_start: '07:00', day_end: '19:00', all_day: false, step_minutes: 15 })).status < 300, 'réglages refusés');
  });
  await step('P1-doublon', 'Deux zones de même nom sur un chantier : refusées', async () => {
    ok(refused(await api(resp, 'POST', '/rest/v1/site_zones', { site_id: S.site, name: ' scène ' })), 'doublon accepté');
  });

  /* ============ P2 Contrôles de la base ============ */
  group = 'P2 Interventions';
  await step('P2-valide', 'Trois interventions valides (lundi 2 juin… heures de Zurich)', async () => {
    S.i1 = await create(resp, 'site_interventions', itv({ title: `${M} Montage`, phase_id: S.phase, ...slot('2027-06-02', '08:00', '10:00') }));
    S.i2 = await create(resp, 'site_interventions', itv({ title: `${M} Éclairage`, team_id: S.t2, ...slot('2027-06-02', '10:00', '12:00') }));
    S.i3 = await create(resp, 'site_interventions', itv({ title: `${M} Contrôle`, zone_id: S.z2, ...slot('2027-06-02', '11:00', '12:00') }));
    ok(S.i1 && S.i2 && S.i3, 'identifiants non renvoyés');
  });
  const refuse = (id, title, over, expected) => step(id, title, async () => {
    const r = await api(resp, 'POST', '/rest/v1/site_interventions', itv({ title: `${M} refusée`, ...over }));
    ok(refused(r), 'acceptée à tort'); if (expected) ok(new RegExp(expected, 'i').test(msg(r)), `message « ${msg(r)} »`);
  });
  await refuse('P2-chevauche', 'Même équipe qui se chevauche : refusée', slot('2027-06-02', '09:00', '11:00'), 'déjà une intervention');
  await step('P2-contigu', 'Créneau qui touche sans chevaucher : accepté', async () => {
    const r = await api(resp, 'POST', '/rest/v1/site_interventions?select=id', itv({ title: `${M} juste après`, ...slot('2027-06-02', '10:00', '10:30') }), REP);
    ok(!refused(r), msg(r));
    // Retirée aussitôt : la suite du scénario (déplacements à la souris) compte sur une équipe « son » libre entre 10:00 et 11:00
    const gone = await api(resp, 'DELETE', `/rest/v1/site_interventions?id=eq.${rows(r)[0]?.id}`, undefined, REP);
    ok(!refused(gone) && rows(gone).length === 1, 'suppression de l\'intervention de contrôle impossible');
  });
  await refuse('P2-pas', 'Heure hors du pas de 15 minutes : refusée', { team_id: S.t2, ...slot('2027-06-03', '08:10', '09:00') }, 'pas de 15');
  await refuse('P2-tot', 'Avant l\'ouverture de la journée : refusée', { team_id: S.t2, ...slot('2027-06-03', '06:00', '08:00') }, 'Hors des heures');
  await refuse('P2-tard', 'Après la fermeture de la journée : refusée', { team_id: S.t2, ...slot('2027-06-03', '18:00', '20:00') }, 'Hors des heures');
  await refuse('P2-bloque', 'Jour bloqué (dimanche 13) : refusée', { team_id: S.t2, ...slot('2027-06-13', '08:00', '09:00') }, 'Jour bloqué');
  await refuse('P2-avant', 'Avant le début du chantier : refusée', { team_id: S.t2, ...slot('2027-05-31', '08:00', '09:00') }, 'Avant le début');
  await refuse('P2-apres', 'Après la fin du chantier : refusée', { team_id: S.t2, ...slot('2027-07-01', '08:00', '09:00') }, 'Après la fin');
  await refuse('P2-inverse', 'Fin avant le début : refusée', { team_id: S.t2, starts_at: zurichIso('2027-06-03', '10:00'), ends_at: zurichIso('2027-06-03', '09:00') });
  await refuse('P2-zone-etrangere', 'Zone d\'un autre chantier : refusée', { team_id: S.t2, zone_id: S.zOther, ...slot('2027-06-03', '08:00', '09:00') }, 'Zone inconnue');
  await step('P2-deplacer', 'Déplacer une intervention dans le créneau d\'une autre de la même équipe : refusé', async () => {
    const r = await api(resp, 'PATCH', `/rest/v1/site_interventions?id=eq.${S.i1}`, slot('2027-06-02', '10:30', '11:30'));
    ok(refused(r) && /déjà une intervention/i.test(msg(r)), `réponse ${r.status} ${msg(r)}`);
  });
  await step('P2-zone-utilisee', 'Une zone ou une équipe utilisée ne se supprime pas', async () => {
    ok(refused(await api(resp, 'DELETE', `/rest/v1/site_zones?id=eq.${S.z1}`)), 'zone utilisée supprimée');
    ok(refused(await api(resp, 'DELETE', `/rest/v1/site_teams?id=eq.${S.t1}`)), 'équipe utilisée supprimée');
  });

  /* ============ P3 Séries ============ */
  group = 'P3 Séries';
  await step('P3-serie', 'Série du lundi au vendredi (7 au 11 juin) : 5 interventions, même série', async () => {
    const r = await rpc(resp, 'create_intervention_series', { p_site_id: S.site, p_zone_id: S.z2, p_team_id: S.t2, p_phase_id: null, p_title: `${M} Série`, p_notes: null, p_first_day: '2027-06-07', p_last_day: '2027-06-11', p_weekdays: [1, 2, 3, 4, 5], p_start: '08:00', p_end: '09:00', p_end_day_offset: 0, p_needs: [] });
    ok(!refused(r), msg(r)); const row = rows(r)[0] || r.body; ok(Number(row.created) === 5 && Number(row.skipped_blocked) === 0, `créées ${row.created}, sautées ${row.skipped_blocked}`);
    S.series = row.series_id; ok(S.series, 'series_id non renvoyé');
    const l = rows(await api(resp, 'GET', `/rest/v1/site_interventions?select=starts_at&series_id=eq.${S.series}`));
    ok(l.length === 5 && l.every(x => wallOf(x.starts_at).endsWith('08:00')), 'heures de Zurich incorrectes');
  });
  await step('P3-bloque', 'Jour bloqué sauté dans une série (12 au 14 juin, le 13 est bloqué)', async () => {
    const r = await rpc(resp, 'create_intervention_series', { p_site_id: S.site, p_zone_id: S.z1, p_team_id: S.t2, p_phase_id: null, p_title: `${M} Fin de semaine`, p_notes: null, p_first_day: '2027-06-12', p_last_day: '2027-06-14', p_weekdays: [1, 2, 3, 4, 5, 6, 7], p_start: '13:00', p_end: '14:00', p_end_day_offset: 0, p_needs: [] });
    ok(!refused(r), msg(r)); const row = rows(r)[0] || r.body; ok(Number(row.created) === 2 && Number(row.skipped_blocked) === 1, `créées ${row.created}, sautées ${row.skipped_blocked}`);
  });
  await step('P3-tout-ou-rien', 'Un chevauchement refuse TOUTE la série et nomme la date', async () => {
    await create(resp, 'site_interventions', itv({ title: `${M} déjà là`, ...slot('2027-06-15', '09:00', '10:00') }));
    const before = await count(resp);
    const r = await rpc(resp, 'create_intervention_series', { p_site_id: S.site, p_zone_id: S.z1, p_team_id: S.t1, p_phase_id: null, p_title: `${M} Conflit`, p_notes: null, p_first_day: '2027-06-14', p_last_day: '2027-06-16', p_weekdays: [1, 2, 3, 4, 5, 6, 7], p_start: '08:30', p_end: '09:30', p_end_day_offset: 0, p_needs: [] });
    ok(refused(r) && /^15\.06\.2027/.test(msg(r)), `réponse ${r.status} « ${msg(r)} »`);
    ok((await count(resp)) === before, 'des interventions ont été créées malgré le refus');
  });
  await step('P3-entrees', 'Entrées invalides refusées : aucun jour, plus de 120 jours, dernier jour avant le premier', async () => {
    const base = { p_site_id: S.site, p_zone_id: S.z1, p_team_id: S.t2, p_phase_id: null, p_title: 'x', p_notes: null, p_start: '08:00', p_end: '09:00', p_end_day_offset: 0, p_needs: [] };
    ok(refused(await rpc(resp, 'create_intervention_series', { ...base, p_first_day: '2027-06-14', p_last_day: '2027-06-16', p_weekdays: [] })), 'aucun jour accepté');
    ok(refused(await rpc(resp, 'create_intervention_series', { ...base, p_first_day: '2027-06-01', p_last_day: '2027-12-31', p_weekdays: [1] })), '120 jours dépassés acceptés');
    ok(refused(await rpc(resp, 'create_intervention_series', { ...base, p_first_day: '2027-06-16', p_last_day: '2027-06-14', p_weekdays: [1] })), 'dates inversées acceptées');
  });
  await step('P3-supprimer', 'Supprimer toute une série (par son series_id)', async () => {
    const r = await api(resp, 'DELETE', `/rest/v1/site_interventions?series_id=eq.${S.series}`, undefined, REP);
    ok(!refused(r) && rows(r).length === 5, `${rows(r).length} ligne(s) supprimée(s) sur 5`);
  });

  /* ============ P4 Copie d'un jour ============ */
  group = 'P4 Copie';
  await step('P4-copie', 'Copier le 2 juin (3 interventions) vers le 21 et le 22 : 6 créées, mêmes heures', async () => {
    const r = await rpc(resp, 'copy_interventions_day', { p_site_id: S.site, p_from_day: '2027-06-02', p_to_days: ['2027-06-21', '2027-06-22'] });
    ok(!refused(r), msg(r)); const row = rows(r)[0] || r.body; ok(Number(row.created) === 6, `créées ${row.created}`);
    const l = rows(await api(resp, 'GET', `/rest/v1/site_interventions?select=starts_at,title&title=eq.${encodeURIComponent(M + ' Montage')}&starts_at=gte.${zurichIso('2027-06-21', '00:00')}`));
    ok(l.length === 2 && l.every(x => wallOf(x.starts_at).endsWith('08:00')), 'copies : heures ou nombre incorrects');
  });
  await step('P4-rejouer', 'Recopier au même endroit : refusé avec la date', async () => {
    const r = await rpc(resp, 'copy_interventions_day', { p_site_id: S.site, p_from_day: '2027-06-02', p_to_days: ['2027-06-21'] });
    ok(refused(r) && /^21\.06\.2027/.test(msg(r)), `réponse ${r.status} « ${msg(r)} »`);
  });
  await step('P4-vide', 'Copier un jour sans intervention : refusé', async () => {
    const r = await rpc(resp, 'copy_interventions_day', { p_site_id: S.site, p_from_day: '2027-06-25', p_to_days: ['2027-06-28'] });
    ok(refused(r) && /Aucune intervention/.test(msg(r)), `réponse ${r.status} « ${msg(r)} »`);
  });

  /* ============ P5 Matériel ============ */
  group = 'P5 Matériel';
  await step('P5-besoin', 'Besoin en matériel : ajout, doublon et quantité nulle refusés, avertissement si le stock ne suffit pas', async () => {
    const eq = rows(await api(resp, 'GET', '/rest/v1/equipment?select=id,name&item_type=eq.tool&status=neq.retired&limit=1'))[0];
    if (!eq) return SKIP('aucun outil dans le stock de test');
    const add = await api(resp, 'POST', '/rest/v1/site_intervention_needs?select=id', { intervention_id: S.i1, equipment_id: eq.id, quantity: 1 }, REP);
    ok(!refused(add), msg(add)); const needId = rows(add)[0]?.id;
    ok(refused(await api(resp, 'POST', '/rest/v1/site_intervention_needs', { intervention_id: S.i1, equipment_id: eq.id, quantity: 2 })), 'doublon accepté');
    ok(refused(await api(resp, 'POST', '/rest/v1/site_intervention_needs', { intervention_id: S.i2, equipment_id: eq.id, quantity: 0 })), 'quantité nulle acceptée');
    ok(!refused(await api(resp, 'PATCH', `/rest/v1/site_intervention_needs?id=eq.${needId}`, { quantity: 100000 })), 'modification refusée');
    const issues = rows(await rpc(resp, 'site_material_issues', { p_site_id: S.site }));
    const mine = issues.find(i => i.intervention_id === S.i1);
    ok(mine && Number(mine.shortage) > 0 && mine.equipment_name === eq.name, `aucun avertissement pour 100000 « ${eq.name} » (${issues.length} avertissement(s))`);
    return INFO(`article de test : ${eq.name}`);
  });

  /* ============ P6 Droits ============ */
  group = 'P6 Droits';
  for (const c of readers) {
    await step(`P6-${c.who}-lit`, `${c.who} : lit le planning (interventions, zones, équipes, prestataires)`, async () => {
      ok((await count(c)) >= 4, 'interventions invisibles');
      for (const t of ['site_zones', 'site_teams', 'contractors']) ok(rows(await api(c, 'GET', `/rest/v1/${t}?select=id&limit=1`)).length >= 1, `${t} invisible`);
    });
    await step(`P6-${c.who}-ecrit`, `${c.who} : ne crée, ne modifie, ne supprime rien`, async () => {
      ok(refused(await api(c, 'POST', '/rest/v1/site_interventions', itv({ title: `${M} intrus`, team_id: S.t2, ...slot('2027-06-03', '08:00', '09:00') }))), 'création acceptée');
      ok(refused(await rpc(c, 'create_intervention_series', { p_site_id: S.site, p_zone_id: S.z1, p_team_id: S.t2, p_phase_id: null, p_title: 'x', p_notes: null, p_first_day: '2027-06-03', p_last_day: '2027-06-04', p_weekdays: [1, 2, 3, 4, 5], p_start: '08:00', p_end: '09:00', p_end_day_offset: 0, p_needs: [] })), 'série acceptée');
      ok(refused(await rpc(c, 'copy_interventions_day', { p_site_id: S.site, p_from_day: '2027-06-02', p_to_days: ['2027-06-23'] })), 'copie acceptée');
      const upd = await api(c, 'PATCH', `/rest/v1/site_interventions?id=eq.${S.i1}`, { title: `${M} piraté` }, REP);
      ok(refused(upd) || rows(upd).length === 0, 'modification acceptée');
      const del = await api(c, 'DELETE', `/rest/v1/site_interventions?id=eq.${S.i1}`, undefined, REP);
      ok(refused(del) || rows(del).length === 0, 'suppression acceptée');
      ok(refused(await api(c, 'POST', '/rest/v1/contractors', { name: `${M} intrus SA` })), 'prestataire créé');
    });
  }
  await step('P6-anonyme', 'Visiteur sans connexion : aucune donnée de planning', async () => {
    const r = await resp.page.evaluate(async ({ base, key }) => { const res = await fetch(`${base}/rest/v1/site_interventions?select=id&limit=1`, { headers: { apikey: key } }); return { status: res.status, body: await res.json().catch(() => null) }; }, { base: resp.base, key: resp.key });
    ok(refused(r) || (Array.isArray(r.body) && r.body.length === 0), `réponse ${r.status} avec ${Array.isArray(r.body) ? r.body.length : '?'} ligne(s)`);
  });

  /* ============ P7 Écran : frise, liste, fenêtres ============ */
  group = 'P7 Écran';
  const openPlanning = async (c, url) => { await c.page.goto(`${BASE}${url}`); await c.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 }); await c.page.waitForTimeout(3000); };
  const blockByTitle = (c, title) => c.page.locator(`[role="button"][aria-label^="${title},"]`).first();
  await step('P7-frise', 'Responsable : la frise s\'affiche (jour du premier chantier) avec les interventions du 2 juin', async () => {
    await openPlanning(resp, `/planning-chantier?site=${S.site}`);
    ok(await resp.page.getByRole('radio', { name: 'Frise' }).count(), 'onglet « Frise » absent');
    ok((await resp.page.locator('[data-row-key]').count()) >= 2, 'lignes de la frise absentes');
    ok(await blockByTitle(resp, `${M} Montage`).count(), 'intervention « Montage » absente de la frise');
    await resp.page.screenshot({ path: path.join(SHOTS, 'frise-jour.png') });
  }, resp.page);
  await step('P7-glisser', 'Responsable : glisser « Montage » de +30 min l\'enregistre (08:30)', async () => {
    const track = await resp.page.locator('[data-row-key]').first().boundingBox();
    const ppm = track.width / 720; // 07:00 → 19:00
    const bb = await blockByTitle(resp, `${M} Montage`).boundingBox();
    await resp.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await resp.page.mouse.down();
    await resp.page.mouse.move(bb.x + bb.width / 2 + 15 * ppm, bb.y + bb.height / 2, { steps: 4 });
    await resp.page.mouse.move(bb.x + bb.width / 2 + 30 * ppm, bb.y + bb.height / 2, { steps: 4 });
    await resp.page.mouse.up(); await resp.page.waitForTimeout(1500);
    const now = rows(await api(resp, 'GET', `/rest/v1/site_interventions?select=starts_at,ends_at&id=eq.${S.i1}`))[0];
    ok(wallOf(now.starts_at) === '2027-06-02 08:30' && wallOf(now.ends_at) === '2027-06-02 10:30', `heures après glisser : ${wallOf(now.starts_at)} → ${wallOf(now.ends_at)}`);
  }, resp.page);
  await step('P7-glisser-refuse', 'Responsable : glisser « Montage » sur un créneau où son équipe est déjà occupée : refusé, remis en place avec le message', async () => {
    // « Montage » (équipe son, 08:30-10:30) vers 11:00 chevauche « Contrôle » (même équipe, 11:00-12:00) : refusé
    const track = await resp.page.locator('[data-row-key]').first().boundingBox(); const ppm = track.width / 720;
    const bb = await blockByTitle(resp, `${M} Montage`).boundingBox();
    await resp.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await resp.page.mouse.down();
    await resp.page.mouse.move(bb.x + bb.width / 2 + 75 * ppm, bb.y + bb.height / 2, { steps: 6 });
    await resp.page.mouse.move(bb.x + bb.width / 2 + 150 * ppm, bb.y + bb.height / 2, { steps: 6 });
    await resp.page.mouse.up(); await resp.page.waitForTimeout(1800);
    const now = rows(await api(resp, 'GET', `/rest/v1/site_interventions?select=starts_at&id=eq.${S.i1}`))[0];
    ok(wallOf(now.starts_at) === '2027-06-02 08:30', `l'intervention a bougé malgré le chevauchement : ${wallOf(now.starts_at)}`);
    const back = await blockByTitle(resp, `${M} Montage`).boundingBox(); ok(Math.abs(back.x - bb.x) < 3, 'le bloc n\'est pas revenu à sa place');
    ok(await resp.page.getByText(/déjà une intervention/).count(), 'le message de refus n\'est pas affiché');
  }, resp.page);
  await step('P7-clavier', 'Responsable : flèche droite sur « Montage » le décale d\'un pas (08:45)', async () => {
    await blockByTitle(resp, `${M} Montage`).focus(); await resp.page.keyboard.press('ArrowRight'); await resp.page.waitForTimeout(1500);
    const now = rows(await api(resp, 'GET', `/rest/v1/site_interventions?select=starts_at&id=eq.${S.i1}`))[0];
    ok(wallOf(now.starts_at) === '2027-06-02 08:45', `heure après flèche : ${wallOf(now.starts_at)}`);
  }, resp.page);
  await step('P7-vues', 'Responsable : « Par prestataire » et « Semaine » s\'affichent', async () => {
    await resp.page.getByRole('radio', { name: 'Par prestataire' }).click(); await resp.page.waitForTimeout(700);
    ok((await resp.page.locator('[data-row-key]').count()) >= 2, 'lignes par équipe absentes');
    await resp.page.getByRole('radio', { name: 'Semaine' }).click(); await resp.page.waitForTimeout(700);
    ok(/Semaine du/.test(await resp.page.locator('main').innerText()), 'en-tête de semaine absent');
    await resp.page.screenshot({ path: path.join(SHOTS, 'frise-semaine.png') });
  }, resp.page);
  await step('P7-liste', 'Responsable : onglet Interventions (liste) et fenêtres « Nouvelle intervention » / « Copier un jour »', async () => {
    await resp.page.getByRole('radio', { name: /^Interventions/ }).click(); await resp.page.waitForTimeout(800);
    ok((await resp.page.locator('main tbody tr').count()) >= 4, 'liste des interventions trop courte');
    await resp.page.getByRole('button', { name: 'Nouvelle intervention' }).click(); await resp.page.waitForTimeout(600);
    ok(await resp.page.locator('#itv-title').count(), 'fenêtre « Nouvelle intervention » absente');
    ok(await resp.page.getByText('Répéter sur plusieurs jours').count(), 'option de répétition absente');
    ok(await resp.page.getByText('Matériel nécessaire').count(), 'matériel nécessaire absent');
    await resp.page.getByRole('button', { name: 'Annuler' }).click(); await resp.page.waitForTimeout(500);
    await resp.page.getByRole('button', { name: 'Copier un jour' }).click(); await resp.page.waitForTimeout(600);
    ok(await resp.page.locator('#copy-from').count(), 'fenêtre « Copier un jour » absente');
    await resp.page.getByRole('button', { name: 'Annuler' }).click();
  }, resp.page);
  await step('P7-avertissement', 'Responsable : l\'avertissement de matériel est visible sur « Montage »', async () => {
    ok(await resp.page.locator('main [title*="demandé(s)"]').count(), 'aucun avertissement de matériel dans la liste');
  }, resp.page);
  for (const c of readers) {
    await step(`P7-${c.who}-ecran`, `${c.who} : l\'écran s\'ouvre en lecture seule (pas de bouton de création, pas de glisser)`, async () => {
      await openPlanning(c, `/planning-chantier?site=${S.site}`);
      ok(await c.page.getByRole('radio', { name: 'Frise' }).count(), 'écran du planning inaccessible');
      ok(/Lecture seule/.test(await c.page.locator('main').innerText()), 'mention « Lecture seule » absente');
      await c.page.getByRole('radio', { name: /^Interventions/ }).click(); await c.page.waitForTimeout(700);
      ok((await c.page.getByRole('button', { name: 'Nouvelle intervention' }).count()) === 0, 'bouton « Nouvelle intervention » présent');
      ok((await c.page.getByRole('button', { name: 'Modifier' }).count()) === 0, 'bouton « Modifier » présent');
    }, c.page);
  }
  await step('P7-chantier-clos', 'Chantier clôturé : lecture seule et création refusée', async () => {
    ok(!refused(await api(resp, 'PATCH', `/rest/v1/sites?id=eq.${S.site}`, { status: 'closed', closed_at: new Date().toISOString() })), 'clôture refusée');
    const r = await api(resp, 'POST', '/rest/v1/site_interventions', itv({ title: `${M} après clôture`, team_id: S.t2, ...slot('2027-06-24', '08:00', '09:00') }));
    ok(refused(r) && /clôturé/i.test(msg(r)), `réponse ${r.status} « ${msg(r)} »`);
    await openPlanning(resp, `/planning-chantier?site=${S.site}`);
    ok(/Clôturé : lecture seule/.test(await resp.page.locator('main').innerText()), 'bandeau « Clôturé : lecture seule » absent');
  }, resp.page);

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  const clean = {};
  try {
    for (const id of [S.site, S.site2].filter(Boolean)) {
      await api(resp, 'PATCH', `/rest/v1/sites?id=eq.${id}`, { status: 'open', closed_at: null });
      const r = await api(resp, 'DELETE', `/rest/v1/sites?id=eq.${id}`, undefined, REP); clean[id] = refused(r) ? msg(r) : 'supprimé';
    }
    if (S.contractor) { const r = await api(resp, 'DELETE', `/rest/v1/contractors?id=eq.${S.contractor}`, undefined, REP); clean.contractor = refused(r) ? msg(r) : 'supprimé'; }
    const left = rows(await api(resp, 'GET', `/rest/v1/sites?select=id&name=like.${encodeURIComponent(M + '*')}`)).length; clean.restants = left;
  } catch (e) { clean.err = e.message; }

  await browser.close();

  /* ============ Rapport ============ */
  const n = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport des tests du planning de chantier', '',
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
