#!/usr/bin/env node
// Série de tests POUSSÉS de GO-Mat : droits par rôle, sécurité de l'API, cycle de vie des commandes,
// stock, cas limites de saisie, interface (Shop, panier, hors ligne, session), 20 pages × 3 formats,
// accessibilité de base, langues. Chaque point est tenté seul : un échec n'arrête pas les suivants.
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-complet.cjs
//
// Comptes de test (adresses) : E2E_COLLAB, E2E_STAFF (magasinier), E2E_RESP (responsable)
//   par défaut test.collaborateur@example.com, test.magasinier@example.com, test.responsable@example.com
// Le mot de passe se donne UNIQUEMENT par E2E_PASSWORD : jamais écrit dans un fichier ni une capture.
// Données créées : tout est préfixé « TEST-E2E » ; en fin de série, les commandes ouvertes sont annulées,
// le stock de test remis à zéro et les articles passés « retirés du service » (une ligne reste en base, sans effet).
// Options : ONLY=G3,G4 (groupes ; G4 a besoin de G3), SKIP_PAGES=1 (saute G7), PAGES_LIMIT=5, E2E_MOCK=1 (essai à blanc).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const MOCK = process.env.E2E_MOCK === '1';
const PASSWORD = process.env.E2E_PASSWORD || '';
const ACCOUNTS = {
  collab: process.env.E2E_COLLAB || 'test.collaborateur@example.com',
  staff: process.env.E2E_STAFF || 'test.magasinier@example.com',
  resp: process.env.E2E_RESP || 'test.responsable@example.com',
};
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const OUT_DIR = path.join(__dirname, '..', 'docs', 'tests');
const SHOTS = path.join(OUT_DIR, 'captures-complet');
const REPORT = path.join(OUT_DIR, 'rapport-complet.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!MOCK && !PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-E2E';
const results = [];
const jsErrors = [];
const created = { requests: [], equipment: [], stockDelta: [], files: [] };
const state = {};
let currentGroup = '';
const wanted = g => !ONLY || ONLY.includes(g);

/* ------------------------------------------------------------------ outils */
async function login(browser, who, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-CH' });
  const page = await ctx.newPage();
  const info = { who, ctx, page, base: '', key: '' };
  page.on('pageerror', e => jsErrors.push(`${who}: ${e.message}`));
  page.on('request', r => {
    const u = r.url();
    if (!info.base && /supabase\.co|\/rest\/v1\//.test(u)) { info.base = new URL(u).origin; info.key = r.headers()['apikey'] || info.key; }
    if (info.base && !info.key && r.headers()['apikey']) info.key = r.headers()['apikey'];
  });
  if (MOCK) {
    const { data, PERMS } = require('./help-demo-data.cjs');
    const role = who === 'collab' ? 'user' : 'technician';
    const tables = { ...data, whoami: { id: 'u1', first_name: 'Marc', last_name: 'Dubois', email: 'm@d.ch', role, permissions: PERMS[role], depot_ids: [] } };
    await page.route('http://mock.supabase.test/**', route => {
      const u = new URL(route.request().url()); const t = u.pathname.split('/').pop();
      if (u.pathname.startsWith('/auth/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.includes('/rpc/') ? (t === 'tool_availability' ? 2 : tables[t] ?? null) : tables[t] ?? []) });
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem('gomat-language')) localStorage.setItem('gomat-language', 'fr');
      localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { id: 'a1', email: 'm@d.ch', aud: 'authenticated', role: 'authenticated' } }));
    });
    await page.goto(BASE); await page.waitForTimeout(2000);
    return info;
  }
  await page.goto(BASE);
  await page.getByRole('button', { name: /J'ai un mot de passe/ }).click();
  await page.locator('#login-email-pw').fill(ACCOUNTS[who]);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  return info;
}

// Appel direct de l'API avec la session de la page (mêmes droits que la personne connectée)
async function api(c, method, route, body, extra = {}, anon = false) {
  return c.page.evaluate(async ({ base, key, method, route, body, extra, anon }) => {
    const tokenKey = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
    const token = anon || !tokenKey ? key : (JSON.parse(localStorage.getItem(tokenKey) || '{}').access_token || key);
    const isFormData = body && body.__file;
    let res;
    try { res = await fetch(base + route, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${token}`, ...(isFormData ? { 'Content-Type': body.type } : { 'Content-Type': 'application/json' }), ...extra },
      body: body === undefined ? undefined : isFormData ? Uint8Array.from(atob(body.b64), ch => ch.charCodeAt(0)) : JSON.stringify(body),
    }); } catch (e) { return { status: 0, body: { message: `requête bloquée avant la base (${e.message})` } }; }
    let json = null; try { json = await res.json(); } catch { /* corps vide */ }
    return { status: res.status, body: json };
  }, { base: c.base, key: c.key, method, route, body, extra, anon });
}
const rpc = (c, name, args = {}) => api(c, 'POST', `/rest/v1/rpc/${name}`, args);
const rows = r => (Array.isArray(r.body) ? r.body : []);
const refused = r => r.status >= 400 || (r.body && (r.body.code || r.body.message) && !Array.isArray(r.body));
const errText = r => (r.body && (r.body.message || r.body.error || r.body.hint)) || `HTTP ${r.status}`;
const iso = (days, hour = 8) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };

async function step(id, title, fn, page) {
  const e = { group: currentGroup, id, title, status: 'KO', detail: '', shot: '' };
  try {
    const out = await fn();
    e.status = out && out.status ? out.status : 'OK';
    e.detail = (out && out.detail) || '';
  } catch (err) { e.status = 'KO'; e.detail = String(err.message).split('\n')[0]; }
  if (page && (e.status === 'KO' || e.status === 'PARTIEL')) {
    const f = `${id.replace(/[^\w-]/g, '_')}.png`;
    try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-complet/${f}`; } catch { /* page fermée */ }
  }
  console.log(`${e.status.padEnd(11)} ${id}  ${title}${e.detail ? ' — ' + e.detail.slice(0, 160) : ''}`);
  results.push(e);
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const INFO = detail => ({ status: 'INFO', detail });
const SKIP = detail => ({ status: 'NON TESTÉ', detail });

/* ------------------------------------------------------------------ routes */
function routeMatrix() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'access.ts'), 'utf8');
  const out = [];
  for (const m of src.matchAll(/'(\/[\w-]*)':\s*\[([^\]]*)\]/g)) out.push({ route: m[1], perms: [...m[2].matchAll(/'(\w+)'/g)].map(x => x[1]) });
  return out;
}
const PAGES = ['/', '/shop', '/shop?vue=commandes', '/demandes', '/consommables', '/commande', '/commandes', '/equipment', '/kits', '/entretien', '/atelier', '/incidents', '/etiquettes',
  '/vehicules', '/chantiers', '/locations', '/planning', '/users', '/formations', '/epi', '/transferts', '/emplacements', '/inventaire', '/checkouts', '/journal', '/couts', '/pilotage', '/notifications', '/aide'];

(async () => {
  const browser = await chromium.launch();
  const C = {};
  const need = async who => (C[who] ||= await login(browser, who));

  /* ============ G1 — droits par rôle (matrice lue dans src/lib/access.ts) ============ */
  if (wanted('G1')) {
    currentGroup = 'G1 Droits par rôle';
    for (const who of MOCK ? ['collab', 'staff'] : ['collab', 'staff', 'resp']) {
      const c = await need(who);
      const me = MOCK ? { body: { permissions: [] } } : await rpc(c, 'whoami');
      const perms = (me.body && me.body.permissions) || [];
      state[`perms_${who}`] = perms;
      state[`me_${who}`] = me.body;
      await step(`G1-${who}-perms`, `${who} : permissions lues (${perms.join(', ') || 'aucune'})`, async () => INFO(`rôle ${me.body && me.body.role}`), c.page);
      for (const { route, perms: need_ } of routeMatrix()) {
        await step(`G1-${who}-${route}`, `${who} sur ${route} (${need_.join('/')})`, async () => {
          const allowed = MOCK ? undefined : need_.some(p => perms.includes(p));
          await c.page.goto(BASE + route);
          // La redirection d'une page refusée n'arrive qu'une fois le profil chargé : on attend qu'elle ait eu lieu (jusqu'à 6 s) au lieu de 900 ms fixes
          const waitUntil = Date.now() + 6000; let at = new URL(c.page.url()).pathname;
          await c.page.waitForTimeout(900);
          while (Date.now() < waitUntil) { at = new URL(c.page.url()).pathname; if (allowed ? at === route : at !== route) break; await c.page.waitForTimeout(400); }
          at = new URL(c.page.url()).pathname;
          if (allowed === undefined) return INFO(`ouvert sur ${at}`);
          ok(allowed ? at === route : at !== route, allowed ? `refusé à tort (redirigé vers ${at})` : `ouvert à tort alors que ${who} n'a pas ${need_.join(' ni ')}`);
        }, c.page);
      }
    }
  }

  /* ============ G2 — sécurité de l'API avec le compte collaborateur ============ */
  if (wanted('G2') && !MOCK) {
    currentGroup = 'G2 Sécurité API (collaborateur)';
    const c = await need('collab');
    const me = state.me_collab || (await rpc(c, 'whoami')).body;
    state.collabId = me.id;
    await step('G2-users', 'GET users : seulement sa propre fiche', async () => {
      const r = await api(c, 'GET', '/rest/v1/users?select=id,email,role'); const n = rows(r).length;
      ok(n === 1, `${n} fiches lues (attendu 1)`);
    });
    await step('G2-audit', 'GET audit_log : refusé ou vide', async () => { const r = await api(c, 'GET', '/rest/v1/audit_log?select=id&limit=1'); ok(rows(r).length === 0, `${rows(r).length} lignes du journal lisibles`); });
    await step('G2-requests', 'GET requests : seulement les siennes', async () => { const r = await api(c, 'GET', '/rest/v1/requests?select=id,requester_id&limit=500'); const bad = rows(r).filter(x => x.requester_id !== me.id); ok(bad.length === 0, `${bad.length} demandes d'autres personnes lisibles`); });
    await step('G2-checkouts', 'GET checkouts : seulement les siens', async () => { const r = await api(c, 'GET', '/rest/v1/checkouts?select=id,user_id&limit=500'); const bad = rows(r).filter(x => x.user_id && x.user_id !== me.id); ok(bad.length === 0, `${bad.length} sorties d'autres personnes lisibles`); });
    await step('G2-settings', 'GET system_settings : aucun secret lisible', async () => {
      const r = await api(c, 'GET', '/rest/v1/system_settings?select=id,value'); const bad = rows(r).filter(x => /pass|secret|token|key|smtp|twilio|vapid/i.test(x.id) && x.value);
      ok(bad.length === 0, `secrets lisibles : ${bad.map(b => b.id).join(', ')}`);
    });
    await step('G2-insert-equipment', 'POST equipment : refusé', async () => { const r = await api(c, 'POST', '/rest/v1/equipment', { name: `${M} intrus`, status: 'available', total_quantity: 1, qr_type: 'batch' }); ok(refused(r), 'article créé par un collaborateur !'); });
    await step('G2-self-promote', 'PATCH users : ne peut pas se donner le rôle admin', async () => {
      await api(c, 'PATCH', `/rest/v1/users?id=eq.${me.id}`, { role: 'admin' });
      const again = (await rpc(c, 'whoami')).body; ok(again.role !== 'admin', 'le collaborateur est devenu admin !');
    });
    await step('G2-delete-requests', 'DELETE requests : refusé', async () => { const r = await api(c, 'DELETE', '/rest/v1/requests?number=like.DEM%25', undefined, { Prefer: 'return=representation' }); ok(rows(r).length === 0, `${rows(r).length} demandes supprimées`); });
    await step('G2-other-requester', 'create_request pour une autre personne : refusé', async () => {
      await need('resp'); const resp = state.me_resp || (await rpc(C.resp, 'whoami')).body; state.me_resp = resp;
      const dep = rows(await api(c, 'GET', '/rest/v1/depots?select=id&limit=1'))[0];
      const eq = rows(await api(c, 'GET', '/rest/v1/equipment?select=id&item_type=eq.consumable&limit=1'))[0];
      if (!dep || !eq) return SKIP('pas de dépôt ou de consommable lisible');
      const r = await rpc(c, 'create_request', { p_requester_id: resp.id, p_depot_id: dep.id, p_start: iso(5), p_end: iso(6), p_items: [{ kind: 'consumable', id: eq.id, quantity: 1 }], p_destination: M, p_notes: M });
      if (!refused(r) && r.body && r.body.id) created.requests.push(r.body.id);
      ok(refused(r), 'commande créée au nom d\'une autre personne');
    });
    await step('G2-decide', 'decide_request par un collaborateur : refusé', async () => {
      const r = await rpc(c, 'decide_request', { p_request_id: '00000000-0000-0000-0000-000000000000', p_approve: true, p_decided_by: 'pirate', p_note: null });
      ok(refused(r), 'appel accepté');
    });
    await step('G2-storage', 'Envoi dans photos-articles par un collaborateur : refusé', async () => {
      const r = await api(c, 'POST', `/storage/v1/object/photos-articles/e2e/intrus-${Date.now()}.png`, { __file: true, type: 'image/png', b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' });
      ok(r.status >= 400, `envoi accepté (HTTP ${r.status})`);
    });
    await step('G2-injection', 'Filtre avec apostrophe/injection : pas d\'erreur 500', async () => {
      const r = await api(c, 'GET', `/rest/v1/equipment?select=id&name=ilike.${encodeURIComponent("%'; drop table equipment;--%")}`); ok(r.status < 500, `HTTP ${r.status}`); return INFO(r.status === 0 ? 'bloquée avant d\'atteindre la base (pare-feu)' : `HTTP ${r.status}, ${rows(r).length} ligne(s)`);
    });
    await step('G2-anonyme', 'Sans connexion : equipment, users, requests illisibles', async () => {
      for (const t of ['equipment', 'users', 'requests', 'checkouts']) { const r = await api(c, 'GET', `/rest/v1/${t}?select=id&limit=1`, undefined, {}, true); ok(rows(r).length === 0, `${t} lisible sans connexion (${rows(r).length} ligne)`); }
    });
  }

  /* ============ Préparation des données TEST-E2E (compte responsable) ============ */
  if (!MOCK && (wanted('G3') || wanted('G4') || wanted('G5'))) {
    currentGroup = 'Préparation';
    const r = await need('resp'); const c = await need('collab');
    state.me_resp = state.me_resp || (await rpc(r, 'whoami')).body;
    state.collabId = state.collabId || (await rpc(c, 'whoami')).body.id;
    const deps = rows(await api(r, 'GET', '/rest/v1/depots?select=id,name,is_default&order=name'));
    state.depots = deps; state.depot = (deps.find(d => d.is_default) || deps[0]) || {};
    state.threshold = Number((rows(await api(r, 'GET', '/rest/v1/system_settings?id=eq.approval_max_quantity&select=value'))[0] || {}).value) || 10;
    const training = rows(await api(r, 'GET', '/rest/v1/trainings?select=id,name&limit=1'))[0];
    const make = async (row) => { const x = await api(r, 'POST', '/rest/v1/equipment?select=id,name', row, { Prefer: 'return=representation' }); const e = rows(x)[0]; if (e) created.equipment.push(e.id); return e; };
    const tool = n => ({ name: `${M} ${n}`, item_type: 'tool', status: 'available', total_quantity: 1, qr_type: 'batch' });
    state.T1 = await make(tool('Outil simple'));
    state.T2 = await make({ ...tool('Outil à validation'), requires_approval: true });
    state.T3 = training ? await make({ ...tool('Outil avec permis'), required_training_id: training.id }) : null;
    state.TX = await make({ ...tool('<img src=x onerror=window.__xss=1> "q" & é'), name: `${M} <img src=x onerror=window.__xss=1> "guillemets" & é` });
    state.TL = await make({ ...tool('L'), name: `${M} ${'Très long nom '.repeat(15)}` });
    state.TA = await make({ ...tool('Perçeuse accentuée'), name: `${M} Perçeuse à percussion` });
    state.TR = await make(tool('À retirer'));
    state.C1 = await make({ name: `${M} Consommable`, item_type: 'consumable', status: 'available', total_quantity: 1, qr_type: 'batch', unit: 'pièce' });
    if (state.C1 && state.depot.id) {
      await rpc(r, 'receive_stock', { p_equipment_id: state.C1.id, p_depot_id: state.depot.id, p_quantity: 40, p_notes: M });
      await rpc(r, 'set_min_quantity', { p_equipment_id: state.C1.id, p_depot_id: state.depot.id, p_min_quantity: 5 });
      created.stockDelta.push({ id: state.C1.id, depot: state.depot.id, qty: 40 });
    }
    await step('PREP', 'Données de test créées', async () => { ok(state.T1 && state.C1, 'création d\'articles refusée pour le responsable'); return INFO(`${created.equipment.length} articles ; seuil de validation = ${state.threshold} ; ${deps.length} dépôt(s) ; permis : ${training ? training.name : 'aucun'}`); });
  }

  const stockOf = async (eqId) => { const x = rows(await api(C.resp, 'GET', `/rest/v1/consumable_stock?equipment_id=eq.${eqId}&depot_id=eq.${state.depot.id}&select=quantity`))[0]; return x ? Number(x.quantity) : null; };
  const createReq = (c, items, opts = {}) => rpc(c, 'create_request', {
    p_requester_id: opts.requester || state.collabId, p_depot_id: state.depot.id, p_start: opts.start || iso(3, 8), p_end: opts.end || iso(3, 17),
    p_items: items, p_destination: opts.dest ?? M, p_notes: opts.notes ?? M,
  });
  const track = r => { if (r.body && r.body.id) created.requests.push(r.body.id); return r; };
  const reqState = async id => rows(await api(C.resp, 'GET', `/rest/v1/requests?id=eq.${id}&select=id,number,status,needs_approval,approval_reason,decided_by,notes,destination`))[0];

  /* ============ G3 — commandes : cas normaux, limites et refus ============ */
  if (wanted('G3') && !MOCK) {
    currentGroup = 'G3 Commandes';
    const c = C.collab;
    const T = state;
    await step('G3-auto', 'Consommable x1 : validée automatiquement', async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: 1 }])); ok(!refused(r), errText(r)); T.rAuto = r.body; ok(r.body.status === 'approved', `statut ${r.body.status}`); });
    await step('G3-seuil', `Quantité au-delà du seuil (${T.threshold}) : à valider`, async () => {
      const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: T.threshold + 1 }])); ok(!refused(r), errText(r)); T.rThr = r.body;
      ok(r.body.status === 'requested', `statut ${r.body.status}`); ok(/10|au-del|seuil|quantit/i.test(r.body.approval_reason || ''), `motif : ${r.body.approval_reason}`);
    });
    await step('G3-seuil-pile', `Quantité = seuil (${T.threshold}) : pas de validation`, async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: T.threshold }])); ok(!refused(r), errText(r)); ok(r.body.status === 'approved', `statut ${r.body.status}`); });
    await step('G3-article-validation', 'Article « validation requise » : à valider', async () => { const r = track(await createReq(c, [{ kind: 'tool', id: T.T2.id, quantity: 1 }])); ok(!refused(r), errText(r)); T.rVal = r.body; ok(r.body.status === 'requested', `statut ${r.body.status}`); });
    await step('G3-permis', 'Outil exigeant un permis, sans permis : refusé avec le nom du permis', async () => {
      if (!T.T3) return SKIP('aucune formation en base');
      const r = track(await createReq(c, [{ kind: 'tool', id: T.T3.id, quantity: 1 }])); if (!refused(r)) { T.rPermis = r.body; throw new Error('commande acceptée sans permis'); }
      ok(/permis|formation|exig/i.test(errText(r)), `message : ${errText(r)}`);
    });
    await step('G3-chevauchement', 'Même outil (1 exemplaire) sur la même période : 2e commande refusée', async () => {
      const a = track(await createReq(c, [{ kind: 'tool', id: T.T1.id, quantity: 1 }], { start: iso(9, 8), end: iso(9, 17) })); ok(!refused(a), `1re : ${errText(a)}`); T.rT1 = a.body;
      const b = track(await createReq(c, [{ kind: 'tool', id: T.T1.id, quantity: 1 }], { start: iso(9, 10), end: iso(9, 18) })); ok(refused(b), '2e commande acceptée : doublon de réservation'); ok(/pas assez|disponible/i.test(errText(b)), `message : ${errText(b)}`);
    });
    await step('G3-periode-suivante', 'Même outil, période qui suit (sans chevauchement) : acceptée', async () => { const r = track(await createReq(c, [{ kind: 'tool', id: T.T1.id, quantity: 1 }], { start: iso(10, 8), end: iso(10, 17) })); ok(!refused(r), errText(r)); });
    await step('G3-fin-avant-debut', 'Fin avant début : refusée', async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: 1 }], { start: iso(4, 17), end: iso(4, 8) })); ok(refused(r), 'acceptée'); });
    await step('G3-qte-zero', 'Quantité 0 : refusée', async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: 0 }])); ok(refused(r), 'acceptée'); });
    await step('G3-qte-negative', 'Quantité négative : refusée', async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: -3 }])); ok(refused(r), 'acceptée'); });
    await step('G3-qte-enorme', 'Quantité 1 000 000 : refusée ou à valider (jamais validée seule)', async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: 1000000 }])); if (!refused(r)) ok(r.body.status === 'requested', `validée automatiquement (${r.body.status})`); return INFO(refused(r) ? `refusée : ${errText(r)}` : 'acceptée « à valider »'); });
    await step('G3-qte-decimale', 'Quantité décimale 1,5 sur un outil', async () => { const r = track(await createReq(c, [{ kind: 'tool', id: T.T1.id, quantity: 1.5 }], { start: iso(12, 8), end: iso(12, 17) })); return INFO(refused(r) ? `refusée : ${errText(r)}` : `acceptée (statut ${r.body.status})`); });
    await step('G3-vide', 'Commande sans article : refusée', async () => { const r = track(await createReq(c, [])); ok(refused(r), 'acceptée'); });
    await step('G3-article-inconnu', 'Article inexistant : refusé', async () => { const r = track(await createReq(c, [{ kind: 'tool', id: '11111111-1111-1111-1111-111111111111', quantity: 1 }])); ok(refused(r), 'acceptée'); });
    await step('G3-article-retire', 'Article retiré du service : refusé', async () => {
      const x = state.TR; await api(C.resp, 'PATCH', `/rest/v1/equipment?id=eq.${x.id}`, { status: 'retired' });
      const r = track(await createReq(c, [{ kind: 'tool', id: x.id, quantity: 1 }])); ok(refused(r), 'commande acceptée pour un article retiré');
    });
    await step('G3-stock-insuffisant', 'Quantité supérieure au stock (stock 40, demande 45)', async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: 45 }])); return INFO(refused(r) ? `refusée : ${errText(r)}` : `acceptée (statut ${r.body.status}) : le stock est contrôlé à la sortie`); });
    await step('G3-unicode', 'Texte libre : accents, emoji, guillemets, 3 000 caractères', async () => {
      const dest = `${M} Chantier « Ô’Brien » & fils — 日本 🚧 <b>x</b> "q"`; const notes = `${M} ${'é'.repeat(3000)}`;
      const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: 1 }], { dest, notes })); ok(!refused(r), errText(r));
      const back = await reqState(r.body.id); ok(back.destination === dest, `destination altérée : ${back.destination}`); ok(back.notes === notes, `remarque altérée (${(back.notes || '').length} caractères)`);
    });
    await step('G3-passe', 'Retrait dans le passé (appel direct de l\'API)', async () => { const r = track(await createReq(c, [{ kind: 'consumable', id: T.C1.id, quantity: 1 }], { start: iso(-3, 8), end: iso(-2, 8) })); return INFO(refused(r) ? `refusée : ${errText(r)}` : 'acceptée côté serveur (seule l\'interface bloque)'); });
    await step('G3-changement-heure', 'Période à cheval sur le changement d\'heure d\'octobre 2026', async () => { const r = track(await rpc(c, 'create_request', { p_requester_id: state.collabId, p_depot_id: state.depot.id, p_start: '2026-10-24T08:00:00+02:00', p_end: '2026-10-26T17:00:00+01:00', p_items: [{ kind: 'consumable', id: T.C1.id, quantity: 1 }], p_destination: M, p_notes: M })); return INFO(refused(r) ? `refusée : ${errText(r)}` : `acceptée (${r.body.number})`); });
    await step('G3-vehicule', 'Véhicule : toujours « à valider » ; permis contrôlé', async () => {
      const v = rows(await api(C.resp, 'GET', '/rest/v1/vehicles?select=id,name,license_category,status&status=neq.retired&limit=1'))[0]; if (!v) return SKIP('aucun véhicule');
      const r = track(await rpc(c, 'create_request', { p_requester_id: state.collabId, p_depot_id: state.depot.id, p_start: iso(20, 8), p_end: iso(20, 17), p_items: [{ kind: 'vehicle', id: v.id, quantity: 1 }], p_destination: M, p_notes: M }));
      if (refused(r)) return INFO(`refusée (permis ${v.license_category}) : ${errText(r)}`); ok(r.body.status === 'requested', `statut ${r.body.status}`); return INFO(`acceptée « à valider » pour ${v.name}`);
    });
    await step('G3-2-vehicules', 'Deux véhicules dans une commande : refusé', async () => {
      const vs = rows(await api(C.resp, 'GET', '/rest/v1/vehicles?select=id&status=neq.retired&limit=2')); if (vs.length < 2) return SKIP('moins de 2 véhicules');
      const r = track(await rpc(c, 'create_request', { p_requester_id: state.collabId, p_depot_id: state.depot.id, p_start: iso(21, 8), p_end: iso(21, 17), p_items: vs.map(v => ({ kind: 'vehicle', id: v.id, quantity: 1 })), p_destination: M, p_notes: M })); ok(refused(r), 'acceptée');
    });
  }

  /* ============ G4 — cycle de vie : validation, préparation, sortie, refus, annulation ============ */
  if (wanted('G4') && !MOCK) {
    currentGroup = 'G4 Cycle de vie';
    const c = C.collab, r = C.resp, s = C.staff; const T = state;
    const staffHasApprove = (state.perms_staff || []).includes('approve');
    await step('G4-collab-decide', 'Collaborateur : ne peut pas valider sa propre commande', async () => { ok(T.rThr, 'pas de commande à valider (G3)'); const x = await rpc(c, 'decide_request', { p_request_id: T.rThr.id, p_approve: true, p_decided_by: 'moi', p_note: null }); ok(refused(x), 'validation acceptée'); });
    await step('G4-staff-decide', staffHasApprove ? 'Magasinier (a « approve ») : peut valider' : 'Magasinier sans « approve » : ne peut pas valider', async () => {
      const probe = track(await createReq(c, [{ kind: 'tool', id: T.T2.id, quantity: 1 }], { start: iso(30, 8), end: iso(30, 17) })); ok(!refused(probe), errText(probe)); T.rProbe = probe.body;
      const x = await rpc(s, 'decide_request', { p_request_id: probe.body.id, p_approve: true, p_decided_by: 'x', p_note: null });
      ok(staffHasApprove ? !refused(x) : refused(x), staffHasApprove ? errText(x) : 'validation acceptée sans le droit');
    });
    await step('G4-resp-valide', 'Responsable : valide, et la décision porte son nom', async () => {
      ok(T.rThr, 'pas de commande'); const x = await rpc(r, 'decide_request', { p_request_id: T.rThr.id, p_approve: true, p_decided_by: 'Faux Nom', p_note: M }); ok(!refused(x), errText(x));
      const st = await reqState(T.rThr.id); ok(st.status === 'approved', `statut ${st.status}`); ok(st.decided_by && st.decided_by !== 'Faux Nom', `nom saisi accepté : ${st.decided_by}`);
    });
    await step('G4-notif-validee', 'Le collaborateur reçoit l\'avis « validée »', async () => { const n = rows(await api(c, 'GET', `/rest/v1/notifications?request_id=eq.${T.rThr.id}&select=kind`)); ok(n.some(x => x.kind === 'request_approved'), `avis : ${n.map(x => x.kind).join(',') || 'aucun'}`); });
    await step('G4-prete', 'Magasin : validée → prête, avis au collaborateur', async () => {
      const x = await rpc(s, 'set_request_status', { p_request_id: T.rThr.id, p_status: 'ready' }); ok(!refused(x), errText(x));
      const n = rows(await api(c, 'GET', `/rest/v1/notifications?request_id=eq.${T.rThr.id}&select=kind`)); ok(n.some(k => k.kind === 'request_ready'), 'pas d\'avis « prête »');
    });
    await step('G4-annule-prete-collab', 'Collaborateur : ne peut pas annuler une commande « prête »', async () => { const x = await rpc(c, 'set_request_status', { p_request_id: T.rThr.id, p_status: 'cancelled' }); ok(refused(x), 'annulation acceptée'); });
    await step('G4-sauter-etape', 'Passer directement « à valider » → « prête » : refusé', async () => { ok(T.rVal, 'pas de commande'); const x = await rpc(s, 'set_request_status', { p_request_id: T.rVal.id, p_status: 'ready' }); ok(refused(x), 'étape sautée acceptée'); });
    await step('G4-retour-etat', 'Statut inventé : refusé', async () => { const x = await rpc(s, 'set_request_status', { p_request_id: T.rThr.id, p_status: 'closed' }); ok(refused(x), 'statut « closed » imposé à la main'); });
    await step('G4-sortie-collab', 'Collaborateur : ne peut pas sortir une commande', async () => { const x = await rpc(c, 'issue_request', { p_request_id: T.rAuto.id, p_vehicle: null }); ok(refused(x), 'sortie acceptée'); });
    await step('G4-sortie-conso', 'Magasin : sortie d\'un consommable, stock diminué', async () => {
      const before = await stockOf(T.C1.id); const x = await rpc(s, 'issue_request', { p_request_id: T.rAuto.id, p_vehicle: null }); ok(!refused(x), errText(x));
      const after = await stockOf(T.C1.id); ok(before - after === 1, `stock ${before} → ${after} (attendu −1)`); const st = await reqState(T.rAuto.id); created.stockDelta.push({ id: T.C1.id, depot: state.depot.id, qty: -1 }); return INFO(`statut après sortie : ${st.status}`);
    });
    await step('G4-double-sortie', 'Sortir deux fois la même commande : refusé, stock inchangé', async () => { const before = await stockOf(T.C1.id); const x = await rpc(s, 'issue_request', { p_request_id: T.rAuto.id, p_vehicle: null }); const after = await stockOf(T.C1.id); ok(refused(x) && before === after, `2e sortie acceptée (stock ${before} → ${after})`); });
    await step('G4-refus', 'Responsable : refuse une commande avec motif, avis au collaborateur', async () => {
      const q = track(await createReq(c, [{ kind: 'tool', id: T.T2.id, quantity: 1 }], { start: iso(31, 8), end: iso(31, 17) })); ok(!refused(q), errText(q));
      const x = await rpc(r, 'decide_request', { p_request_id: q.body.id, p_approve: false, p_decided_by: 'x', p_note: `${M} trop cher` }); ok(!refused(x), errText(x));
      const st = await reqState(q.body.id); ok(st.status === 'rejected', `statut ${st.status}`);
      const n = rows(await api(c, 'GET', `/rest/v1/notifications?request_id=eq.${q.body.id}&select=kind,message`)); ok(n.some(k => k.kind === 'request_rejected'), 'pas d\'avis « refusée »');
      const y = await rpc(c, 'set_request_status', { p_request_id: q.body.id, p_status: 'cancelled' }); ok(refused(y), 'une commande refusée peut être annulée');
    });
    await step('G4-annule-envoyee', 'Collaborateur : annule une commande « à valider »', async () => { ok(T.rVal, 'pas de commande'); const x = await rpc(c, 'set_request_status', { p_request_id: T.rVal.id, p_status: 'cancelled' }); ok(!refused(x), errText(x)); const st = await reqState(T.rVal.id); ok(st.status === 'cancelled', st.status); });
    await step('G4-annule-validee-libere', 'Annuler libère l\'outil : la même période redevient réservable', async () => {
      ok(T.rT1, 'pas de réservation (G3)'); const x = await rpc(c, 'set_request_status', { p_request_id: T.rT1.id, p_status: 'cancelled' }); ok(!refused(x), errText(x));
      const again = track(await createReq(c, [{ kind: 'tool', id: T.T1.id, quantity: 1 }], { start: iso(9, 10), end: iso(9, 18) })); ok(!refused(again), `période toujours bloquée : ${errText(again)}`);
    });
    await step('G4-annule-autrui', 'Collaborateur : ne peut pas annuler la commande d\'un autre', async () => {
      const mine = track(await createReq(r, [{ kind: 'consumable', id: T.C1.id, quantity: 1 }], { requester: T.me_resp.id, notes: `${M} du responsable` })); if (refused(mine)) return SKIP(errText(mine));
      const x = await rpc(c, 'set_request_status', { p_request_id: mine.body.id, p_status: 'cancelled' }); ok(refused(x), 'annulation de la commande d\'autrui acceptée');
    });
    await step('G4-journal', 'Le journal enregistre les décisions (lecture par le responsable)', async () => {
      const a = rows(await api(r, 'GET', '/rest/v1/audit_log?select=id,table_name,action&table_name=eq.requests&order=at.desc&limit=5')); ok(a.length > 0, 'aucune entrée « requests » dans le journal');
    });
  }

  /* ============ G5 — stock : réception, inventaire, sortie, transfert ============ */
  if (wanted('G5') && !MOCK) {
    currentGroup = 'G5 Stock';
    const r = C.resp; const id = state.C1.id; const dep = state.depot.id;
    await step('G5-reception', 'Réception +5 : stock augmente de 5', async () => { const b = await stockOf(id); const x = await rpc(r, 'receive_stock', { p_equipment_id: id, p_depot_id: dep, p_quantity: 5, p_notes: M }); ok(!refused(x), errText(x)); created.stockDelta.push({ id, depot: dep, qty: 5 }); const a = await stockOf(id); ok(a - b === 5, `${b} → ${a}`); });
    await step('G5-reception-zero', 'Réception de 0 ou négative : refusée', async () => { for (const q of [0, -2]) { const x = await rpc(r, 'receive_stock', { p_equipment_id: id, p_depot_id: dep, p_quantity: q, p_notes: M }); ok(refused(x), `réception de ${q} acceptée`); } });
    await step('G5-sortie-trop', 'Sortie supérieure au stock : refusée', async () => { const b = await stockOf(id); const x = await rpc(r, 'consume_stock', { p_equipment_id: id, p_depot_id: dep, p_quantity: b + 1000, p_user_id: null, p_destination: M, p_notes: M }); ok(refused(x), 'sortie acceptée'); ok((await stockOf(id)) === b, 'stock modifié malgré le refus'); });
    await step('G5-sortie-sans-motif', 'Sortie sans personne ni chantier : refusée', async () => { const x = await rpc(r, 'consume_stock', { p_equipment_id: id, p_depot_id: dep, p_quantity: 1, p_user_id: null, p_destination: '  ', p_notes: M }); ok(refused(x), 'sortie anonyme acceptée'); });
    await step('G5-sortie-ok', 'Sortie de 2 avec chantier : stock −2', async () => { const b = await stockOf(id); const x = await rpc(r, 'consume_stock', { p_equipment_id: id, p_depot_id: dep, p_quantity: 2, p_user_id: null, p_destination: M, p_notes: M }); ok(!refused(x), errText(x)); created.stockDelta.push({ id, depot: dep, qty: -2 }); const a = await stockOf(id); ok(b - a === 2, `${b} → ${a}`); });
    await step('G5-inventaire', 'Inventaire : le stock devient la valeur comptée', async () => { const before = await stockOf(id); const x = await rpc(r, 'count_stock', { p_equipment_id: id, p_depot_id: dep, p_counted: 30, p_notes: M }); ok(!refused(x), errText(x)); created.stockDelta.push({ id, depot: dep, qty: 30 - before }); ok((await stockOf(id)) === 30, 'stock ≠ 30'); });
    await step('G5-inventaire-negatif', 'Inventaire négatif : refusé', async () => { const x = await rpc(r, 'count_stock', { p_equipment_id: id, p_depot_id: dep, p_counted: -1, p_notes: M }); ok(refused(x), 'accepté'); });
    await step('G5-transfert', 'Transfert entre deux dépôts (si 2 dépôts)', async () => {
      const other = state.depots.find(d => d.id !== dep); if (!other) return SKIP('un seul dépôt');
      const x = await rpc(r, 'transfer_stock', { p_equipment_id: id, p_from_depot_id: dep, p_to_depot_id: other.id, p_quantity: 3, p_notes: M }); ok(!refused(x), errText(x));
      const back = await rpc(r, 'transfer_stock', { p_equipment_id: id, p_from_depot_id: other.id, p_to_depot_id: dep, p_quantity: 3, p_notes: M }); ok(!refused(back), `retour : ${errText(back)}`);
    });
    await step('G5-transfert-meme-depot', 'Transfert vers le même dépôt : refusé', async () => { const x = await rpc(r, 'transfer_stock', { p_equipment_id: id, p_from_depot_id: dep, p_to_depot_id: dep, p_quantity: 1, p_notes: M }); ok(refused(x), 'accepté'); });
    await step('G5-collab-stock', 'Collaborateur : ne peut pas modifier le stock', async () => { const x = await rpc(C.collab, 'receive_stock', { p_equipment_id: id, p_depot_id: dep, p_quantity: 1, p_notes: M }); ok(refused(x), 'réception acceptée'); });
    await step('G5-seuil-alerte', 'Stock sous le seuil : une alerte est créée', async () => {
      const b = await stockOf(id); await rpc(r, 'count_stock', { p_equipment_id: id, p_depot_id: dep, p_counted: 2, p_notes: M }); created.stockDelta.push({ id, depot: dep, qty: 2 - b });
      const n = rows(await api(r, 'GET', `/rest/v1/notifications?select=kind,message&order=created_at.desc&limit=30`)); const hit = n.find(x => /TEST-E2E/.test(x.message || '') && /stock|reste/i.test(x.message || ''));
      return INFO(hit ? `alerte : ${hit.message}` : 'aucune alerte trouvée parmi les 30 dernières (peut dépendre d\'un traitement différé)');
    });
  }

  /* ============ G6 — interface Shop et cas limites de saisie ============ */
  if (wanted('G6') && !MOCK) {
    currentGroup = 'G6 Interface Shop';
    const c = C.collab; const p = c.page;
    const shop = async (q) => { await p.goto(`${BASE}/shop`); await p.waitForSelector('text=article', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1200); if (q !== undefined) { await p.getByLabel('Chercher dans le shop').fill(q); await p.waitForTimeout(500); } };
    const cartClear = () => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gomat-cart')).forEach(k => localStorage.removeItem(k)));
    await cartClear();
    await step('G6-recherche-accent', 'Recherche « perceuse » = « PERÇEUSE » = « percuss »', async () => {
      for (const q of ['perceuse', 'PERÇEUSE', 'percuss']) { await shop(q); ok(await p.getByRole('button', { name: /Voir la fiche : TEST-E2E Perçeuse/ }).count() > 0, `introuvable avec « ${q} »`); }
    }, p);
    await step('G6-recherche-vide', 'Recherche sans résultat : état vide propre', async () => { await shop('zzzzqqqq'); ok(await p.getByText('Aucun article').count() > 0, 'pas de message « Aucun article »'); }, p);
    await step('G6-recherche-speciaux', 'Recherche avec caractères spéciaux (% _ \' " < >)', async () => { await shop(`%_'"<>\\`); await p.waitForTimeout(500); ok(await p.locator('main').count() > 0, 'page cassée'); }, p);
    await step('G6-xss', 'Nom d\'article avec <img onerror> : affiché comme texte, rien d\'exécuté', async () => {
      await shop('TEST-E2E <img'); const card = p.getByRole('button', { name: /Voir la fiche : TEST-E2E <img/ }); ok(await card.count() > 0, 'article introuvable');
      ok(!(await p.evaluate(() => window.__xss)), 'le code du nom a été exécuté !'); ok(await p.locator('main img[src="x"]').count() === 0, 'une balise <img> a été injectée');
      await card.first().click(); await p.waitForTimeout(800); ok(!(await p.evaluate(() => window.__xss)), 'exécuté dans la fiche'); await p.keyboard.press('Escape');
    }, p);
    await step('G6-nom-long', 'Nom de 200 caractères : pas de débordement (bureau et téléphone)', async () => {
      for (const w of [1440, 390]) { await p.setViewportSize({ width: w, height: 900 }); await shop('Très long nom'); const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2); ok(!over, `défilement horizontal à ${w} px`); }
      await p.setViewportSize({ width: 1440, height: 900 });
    }, p);
    await step('G6-panier-qte', 'Panier : − à 1 retire l\'article, + augmente, rechargement conserve', async () => {
      await shop('TEST-E2E Consommable'); const add = p.getByRole('button', { name: /^Ajouter au panier : TEST-E2E Consommable/ }); await add.first().click(); await p.waitForTimeout(600);
      await p.getByRole('button', { name: /^Un de plus/ }).first().click(); await p.getByRole('button', { name: /^Un de plus/ }).first().click(); await p.waitForTimeout(400);
      await p.reload(); await p.waitForTimeout(1500); ok(await p.getByRole('button', { name: /^Panier \(3\)/ }).count() > 0, 'quantité 3 non conservée après rechargement');
      await shop('TEST-E2E Consommable'); for (let i = 0; i < 3; i++) await p.getByRole('button', { name: /^Un de moins/ }).first().click().catch(() => {}); await p.waitForTimeout(500);
      ok(await p.getByRole('button', { name: /^Panier \(/ }).count() === 0, 'l\'article reste au panier après −');
    }, p);
    await step('G6-double-clic', 'Double clic sur « Commander » : une seule commande', async () => {
      await cartClear(); await shop('TEST-E2E Consommable'); await p.getByRole('button', { name: /^Ajouter au panier : TEST-E2E Consommable/ }).first().click(); await p.waitForTimeout(500);
      await p.getByRole('button', { name: /^Panier/ }).first().click(); await p.waitForTimeout(1200); await p.getByLabel('Remarque (facultatif)').fill(`${M} DBL`);
      const t0 = new Date(Date.now() - 2000).toISOString();
      await p.getByRole('button', { name: 'Commander', exact: true }).dblclick(); await p.waitForTimeout(4000);
      // Seulement les commandes créées par CE double clic (les exécutions précédentes laissent des commandes annulées avec la même remarque)
      const n = rows(await api(c, 'GET', `/rest/v1/requests?notes=ilike.*${M}%20DBL*&created_at=gte.${encodeURIComponent(t0)}&select=id`)); n.forEach(x => created.requests.push(x.id)); ok(n.length === 1, `${n.length} commandes créées`);
    }, p);
    await step('G6-hors-ligne', 'Hors ligne : message clair, panier conservé', async () => {
      await cartClear(); await shop('TEST-E2E Consommable'); await p.getByRole('button', { name: /^Ajouter au panier : TEST-E2E Consommable/ }).first().click(); await p.waitForTimeout(500);
      await p.getByRole('button', { name: /^Panier/ }).first().click(); await p.waitForTimeout(1000);
      await c.ctx.setOffline(true); await p.getByRole('button', { name: 'Commander', exact: true }).click(); await p.waitForTimeout(2500);
      const msg = await p.locator('[role="status"]').allInnerTexts(); await c.ctx.setOffline(false);
      ok(msg.some(m => /connexion/i.test(m)), `message : ${msg.join(' | ') || 'aucun'}`); await p.keyboard.press('Escape'); ok(await p.getByRole('button', { name: /^Panier \(/ }).count() > 0, 'panier perdu');
    }, p);
    await step('G6-article-retire', 'Article retiré pendant qu\'il est au panier : retiré avec un avis', async () => {
      await cartClear(); await shop('TEST-E2E Outil simple'); await p.getByRole('button', { name: /^Ajouter au panier : TEST-E2E Outil simple/ }).first().click(); await p.waitForTimeout(500);
      await api(C.resp, 'PATCH', `/rest/v1/equipment?id=eq.${state.T1.id}`, { status: 'retired' }); await p.reload(); await p.waitForTimeout(2500);
      ok(await p.getByRole('button', { name: /^Panier \(/ }).count() === 0, 'article retiré toujours au panier');
    }, p);
    await step('G6-session-expiree', 'Session supprimée : retour à la page de connexion', async () => {
      await p.evaluate(() => Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k)).forEach(k => localStorage.removeItem(k))); await p.goto(`${BASE}/shop`); await p.waitForTimeout(2500);
      ok(await p.getByRole('button', { name: /J'ai un mot de passe|Recevoir un code/ }).count() > 0, 'application toujours accessible sans session');
    }, p);
    // reconnexion propre pour la suite
    await C.collab.ctx.close(); delete C.collab;
    await step('G6-upload-image', 'Image d\'article (API, compte responsable) : PNG accepté, texte refusé', async () => {
      const r = C.resp; const name = `e2e/${Date.now()}.png`;
      const good = await api(r, 'POST', `/storage/v1/object/photos-articles/${name}`, { __file: true, type: 'image/png', b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }); created.files.push(name); ok(good.status < 300, `PNG refusé (HTTP ${good.status})`);
      const bad = await api(r, 'POST', `/storage/v1/object/photos-articles/e2e/${Date.now()}.txt`, { __file: true, type: 'text/plain', b64: 'aGVsbG8=' }); ok(bad.status >= 400, 'fichier texte accepté');
    });
  }

  /* ============ G7 — 29 pages × 3 formats : erreurs, débordement, accessibilité de base, rapidité ============ */
  if (wanted('G7') && !process.env.SKIP_PAGES) {
    currentGroup = 'G7 Pages';
    const who = MOCK ? 'staff' : 'resp';
    const c = await need(who); const p = c.page;
    const formats = [['bureau', 1440, 900], ['tablette', 768, 1024], ['téléphone', 390, 844]];
    for (const route of PAGES.slice(0, Number(process.env.PAGES_LIMIT) || PAGES.length)) {
      for (const [label, w, h] of formats) {
        await step(`G7-${route.replace(/[/?=]/g, '_')}-${label}`, `${route} (${label})`, async () => {
          await p.setViewportSize({ width: w, height: h }); const t0 = Date.now();
          const before = jsErrors.length; await p.goto(BASE + route); await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(1300); const ms = Date.now() - t0;
          const at = new URL(p.url()).pathname; if (at !== route.split('?')[0]) return INFO(`redirigé vers ${at}`);
          const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2); ok(!over, 'défilement horizontal');
          ok(jsErrors.length === before, `erreur JavaScript : ${jsErrors[jsErrors.length - 1]}`);
          const a11y = await p.evaluate((vw) => {
            const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
            const name = e => (e.getAttribute('aria-label') || e.getAttribute('title') || e.innerText || e.textContent || '').trim() || (e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'))?.innerText?.trim()) || (e.querySelector('img[alt]')?.getAttribute('alt') || '').trim();
            const btn = [...document.querySelectorAll('button, [role=button], a[href]')].filter(vis).filter(e => !name(e)).length;
            const inp = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')].filter(vis).filter(e => !(e.getAttribute('aria-label') || e.labels?.length || e.getAttribute('aria-labelledby') || e.getAttribute('placeholder'))).length;
            const small = vw < 600 ? [...document.querySelectorAll('button, a[href], [role=button]')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.height < 30 && r.width < 30; }).length : 0;
            const ids = [...document.querySelectorAll('[id]')].map(e => e.id); const dup = ids.length - new Set(ids).size;
            return { btn, inp, dup, small };
          }, w);
          const notes = []; if (a11y.btn) notes.push(`${a11y.btn} bouton(s)/lien(s) sans nom`); if (a11y.inp) notes.push(`${a11y.inp} champ(s) sans libellé`); if (a11y.dup) notes.push(`${a11y.dup} id en double`); if (a11y.small) notes.push(`${a11y.small} cible(s) < 30 px`);
          if (ms > 6000) notes.push(`chargement lent ${ms} ms`);
          return notes.length ? { status: 'PARTIEL', detail: notes.join(' ; ') } : { detail: `${ms} ms` };
        }, p);
      }
    }
    await step('G7-ouverture-cartes', 'Une carte ouvre un panneau qui se ferme avec Échap (6 pages)', async () => {
      await p.setViewportSize({ width: 1440, height: 900 }); const bad = []; let tested = 0;
      for (const route of ['/chantiers', '/kits', '/locations', '/vehicules', '/consommables', '/demandes']) {
        await p.goto(BASE + route); await p.waitForTimeout(1300);
        const cards = p.getByRole('button', { name: /^Actions pour/ }); if (await cards.count() === 0) continue; tested++;
        let opened = false;
        for (const n of [0, 1]) {
          await cards.nth(n).click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(700);
          if (await p.locator('[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])').count()) { opened = true; break; }
          await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        }
        if (!opened) { bad.push(`${route} (ne s'ouvre pas)`); continue; }
        await p.keyboard.press('Escape'); await p.waitForTimeout(800);
        if (await p.locator('[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])').count()) bad.push(`${route} (ne se ferme pas avec Échap)`);
      }
      if (tested === 0) return SKIP('aucune carte trouvée');
      ok(bad.length === 0, bad.join(', ')); return INFO(`${tested} pages vérifiées`);
    }, p);
    await step('G7-clavier', 'Clavier : Tab atteint les boutons du Shop, focus visible', async () => {
      await p.goto(`${BASE}/shop`); await p.waitForTimeout(1500); const seen = new Set(); let visible = 0;
      for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); const x = await p.evaluate(() => { const e = document.activeElement; if (!e) return null; const cs = getComputedStyle(e); return { t: (e.getAttribute('aria-label') || e.innerText || e.tagName).slice(0, 30), ring: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' }; }); if (x) { seen.add(x.t); if (x.ring) visible++; } }
      ok(seen.size >= 10, `seulement ${seen.size} éléments atteints`); return visible < 15 ? { status: 'PARTIEL', detail: `focus visible sur ${visible}/25 étapes` } : { detail: `${seen.size} éléments, focus visible ${visible}/25` };
    }, p);
  }

  /* ============ G8 — langues ============ */
  if (wanted('G8')) {
    currentGroup = 'G8 Langues';
    const c = await need(MOCK ? 'collab' : 'collab'); const p = c.page; await p.setViewportSize({ width: 1440, height: 900 });
    const fr = ['Ajouter', 'Annuler', 'Enregistrer', 'Rechercher', 'Chargement', 'Commander', 'Disponible', 'Mes commandes', 'Panier', 'Aucun', 'Modifier', 'Supprimer', 'Nouveau', 'Filtres'];
    for (const lang of ['de', 'it', 'en']) {
      // /aide reste volontairement en français (mode d'emploi), donc absent de cette liste
      for (const route of ['/shop', '/shop?vue=commandes', '/', '/consommables']) {
        await step(`G8-${lang}-${route.replace(/[/?=]/g, '_')}`, `${lang.toUpperCase()} ${route} : mots français restants`, async () => {
          await p.evaluate(l => localStorage.setItem('gomat-language', l), lang); await p.goto(BASE + route); await p.waitForTimeout(2200);
          const text = await p.locator('main').innerText().catch(() => ''); const left = fr.filter(w => new RegExp(`\\b${w}\\b`).test(text));
          return left.length ? { status: 'PARTIEL', detail: `reste en français : ${left.join(', ')}` } : {};
        }, p);
      }
    }
    await p.evaluate(() => localStorage.setItem('gomat-language', 'fr'));
  }

  /* ============ Nettoyage ============ */
  currentGroup = 'Nettoyage';
  const cleanup = { cancelled: 0, stuck: [], retired: 0, stockRestored: 0 };
  if (!MOCK && C.resp) {
    try {
      const all = [...new Set(created.requests)];
      const marked = rows(await api(C.resp, 'GET', `/rest/v1/requests?select=id,number,status&or=(notes.ilike.*${M}*,destination.ilike.*${M}*)&status=in.(requested,approved,ready)`));
      for (const r of [...marked.map(x => ({ id: x.id })), ...all.map(id => ({ id }))].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i)) {
        const st = await reqState(r.id); if (!st) continue;
        if (['requested', 'approved', 'ready'].includes(st.status)) { const x = await rpc(C.resp, 'set_request_status', { p_request_id: r.id, p_status: 'cancelled' }); if (!refused(x)) cleanup.cancelled++; else cleanup.stuck.push(`${st.number} (${st.status})`); }
        else if (st.status === 'out') cleanup.stuck.push(`${st.number} (sortie : à rendre à la main)`);
      }
      for (const eid of created.equipment) { const x = await api(C.resp, 'PATCH', `/rest/v1/equipment?id=eq.${eid}`, { status: 'retired' }); if (!refused(x)) cleanup.retired++; }
      if (state.C1) for (const d of state.depots || []) { const x = await rpc(C.resp, 'count_stock', { p_equipment_id: state.C1.id, p_depot_id: d.id, p_counted: 0, p_notes: `${M} remise à zéro` }); if (!refused(x)) cleanup.stockRestored++; }
      for (const f of created.files) await api(C.resp, 'DELETE', `/storage/v1/object/photos-articles/${f}`);
    } catch (e) { cleanup.stuck.push(`erreur de nettoyage : ${e.message}`); }
  }

  /* ============ Rapport ============ */
  await browser.close();
  const count = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport des tests poussés', '',
    `Base : ${MOCK ? 'SIMULÉE (essai à blanc)' : 'GO-MAT'} · comptes : ${Object.values(ACCOUNTS).join(', ')} · date : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    'Commit testé : à renseigner (`git log --oneline -1`).', '',
    `**Synthèse : ${count('OK')} OK · ${count('PARTIEL')} PARTIEL · ${count('KO')} KO · ${count('NON TESTÉ')} NON TESTÉ · ${count('INFO')} INFO (observations)**`, '',
    `Nettoyage : ${cleanup.cancelled} commande(s) annulée(s), ${cleanup.retired} article(s) retiré(s) du service, stock de test remis à zéro dans ${cleanup.stockRestored} dépôt(s)${cleanup.stuck.length ? `. **À traiter à la main : ${cleanup.stuck.join(' ; ')}**` : ', rien de bloqué'}.`, '',
    '## À corriger (KO et PARTIEL)', '',
    ...(results.filter(r => ['KO', 'PARTIEL'].includes(r.status)).length ? results.filter(r => ['KO', 'PARTIEL'].includes(r.status)).map(r => `- **${r.status}** ${r.id} — ${r.title} : ${r.detail}${r.shot ? ` ([capture](${r.shot}))` : ''}`) : ['Aucun.']), '',
    ...groups.flatMap(g => ['', `## ${g}`, '', '| Point | Verdict | Détail |', '|---|---|---|', ...results.filter(r => r.group === g).map(r => `| ${r.id} — ${r.title.replace(/\|/g, '/')} | ${r.status} | ${r.detail.replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 220)} |`)]),
    '', '## Erreurs JavaScript', '', jsErrors.length ? [...new Set(jsErrors)].slice(0, 30).map(e => `- ${e}`).join('\n') : 'Aucune.', '',
  ];
  fs.writeFileSync(REPORT, md.join('\n'));
  console.log(`\nRapport : ${path.relative(process.cwd(), REPORT)}`);
  console.log(`Synthèse : ${count('OK')} OK · ${count('PARTIEL')} PARTIEL · ${count('KO')} KO · ${count('NON TESTÉ')} NON TESTÉ · ${count('INFO')} INFO`);
  if (cleanup.stuck.length) console.log(`À TRAITER À LA MAIN : ${cleanup.stuck.join(' ; ')}`);
  process.exit(count('KO') ? 1 : 0);
})();
