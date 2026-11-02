#!/usr/bin/env node
// Cycle de vie d'un EMPRUNT, du point de vue du collaborateur et du magasin, sur de vrais outils de test :
// sortie, retour complet, retour partiel, retour refusé, états de retour (incomplet, à réparer, cassé),
// non-rendu (retard), perte, vol, matériel retrouvé, prolongation, outil indisponible, via une demande.
// Chaque scénario est joué seul : un échec n'arrête pas les suivants.
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-emprunts.cjs
//
// Comptes (adresses) : E2E_COLLAB, E2E_STAFF (magasinier), E2E_RESP (responsable) ; par défaut
// test.collaborateur@example.com, test.magasinier@example.com, test.responsable@example.com.
// Le mot de passe se donne UNIQUEMENT par E2E_PASSWORD. Tout est préfixé « TEST-EMPRUNT » et nettoyé à la fin :
// sorties rendues, objets perdus déclarés « retrouvés », maintenances closes, demandes annulées, outils retirés.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const PASSWORD = process.env.E2E_PASSWORD || '';
const ACCOUNTS = {
  collab: process.env.E2E_COLLAB || 'test.collaborateur@example.com',
  staff: process.env.E2E_STAFF || 'test.magasinier@example.com',
  resp: process.env.E2E_RESP || 'test.responsable@example.com',
};
const OUT_DIR = path.join(__dirname, '..', 'docs', 'tests');
const SHOTS = path.join(OUT_DIR, 'captures-emprunts');
const REPORT = path.join(OUT_DIR, 'rapport-emprunts.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-EMPRUNT';
const results = [];
const jsErrors = [];
const made = { equipment: [], notes: [], checkouts: new Set(), incidents: new Set(), requests: [] };
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
const refused = r => r.status >= 400 || r.status === 0 || (r.body && !Array.isArray(r.body) && (r.body.code || r.body.message) && !r.body.id);
const msg = r => (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`;
const ok = (cond, m) => { if (!cond) throw new Error(m); };
const INFO = d => ({ status: 'INFO', detail: d });
const SKIP = d => ({ status: 'NON TESTÉ', detail: d });
const day = (n, h = 17) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

async function step(id, title, fn, page) {
  const e = { group, id, title, status: 'KO', detail: '', shot: '' };
  try { const o = await fn(); e.status = (o && o.status) || 'OK'; e.detail = (o && o.detail) || ''; }
  catch (err) { e.status = 'KO'; e.detail = String(err.message).split('\n')[0]; }
  if (page && ['KO', 'PARTIEL'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-emprunts/${f}`; } catch { /* page fermée */ } }
  console.log(`${e.status.padEnd(11)} ${id}  ${title}${e.detail ? ' — ' + e.detail.slice(0, 170) : ''}`);
  results.push(e);
}

(async () => {
  const browser = await chromium.launch();
  const collab = await login(browser, 'collab');
  const staff = await login(browser, 'staff');
  const resp = await login(browser, 'resp');
  S.collabId = (await rpc(collab, 'whoami')).body.id;
  S.respId = (await rpc(resp, 'whoami')).body.id;
  S.perms = { staff: ((await rpc(staff, 'whoami')).body.permissions) || [], resp: ((await rpc(resp, 'whoami')).body.permissions) || [] };

  /* ---------- fonctions de scénario ---------- */
  const make = async (name, qty = 1, extra = {}) => {
    const r = await api(resp, 'POST', '/rest/v1/equipment?select=id,name', { name: `${M} ${name}`, item_type: 'tool', status: 'available', total_quantity: qty, qr_type: 'batch', ...extra }, { Prefer: 'return=representation' });
    const e = rows(r)[0]; if (!e) throw new Error(`création de « ${name} » impossible : ${msg(r)}`); made.equipment.push(e.id); return e;
  };
  const out = async (tool, qty, due, who = S.collabId, c = staff) => {
    const r = await rpc(c, 'create_checkout', { p_user_id: who, p_due_date: due || day(1), p_items: [{ equipment_id: tool.id, quantity: qty }], p_notes: M });
    if (!refused(r) && r.body && r.body.id) { made.notes.push(r.body.id); await lines(r.body.id); }
    return r;
  };
  const lines = async (noteId) => { const l = rows(await api(staff, 'GET', `/rest/v1/checkouts?delivery_note_id=eq.${noteId}&select=id,status,equipment_id,due_date&order=checkout_date`)); l.forEach(x => made.checkouts.add(x.id)); return l; };
  const noteStatus = async (id) => (rows(await api(staff, 'GET', `/rest/v1/delivery_notes?id=eq.${id}&select=status`))[0] || {}).status;
  const coStatus = async (id) => (rows(await api(staff, 'GET', `/rest/v1/checkouts?id=eq.${id}&select=status`))[0] || {}).status;
  const ret = (id, cond = 'ok', notes = M, c = staff) => rpc(c, 'return_with_check', { p_checkout_id: id, p_condition: cond, p_notes: notes, p_photos: [] });
  const avail = async (tool) => { const r = await rpc(staff, 'tool_availability', { p_equipment_id: tool.id, p_start: new Date().toISOString(), p_end: new Date(Date.now() + 3600e3).toISOString() }); return typeof r.body === 'number' ? r.body : NaN; };
  const declare = (kind, tool, checkoutId, c = staff) => rpc(c, 'declare_incident', { p_kind: kind, p_equipment_id: tool.id, p_checkout_id: checkoutId, p_responsible_id: S.collabId, p_description: `${M} ${kind}`, p_photos: [], p_occurred_at: new Date().toISOString() });
  const incidentsOf = async (toolId) => rows(await api(staff, 'GET', `/rest/v1/incidents?equipment_id=eq.${toolId}&select=id,kind,decision,checkout_id&order=occurred_at.desc`));

  /* ============ E1 — sortie ============ */
  group = 'E1 Sortie';
  await step('E1-sortie', 'Magasin : sortie de 2 outils sur 3, le collaborateur les voit, la disponibilité baisse', async () => {
    S.A = await make('Outil A', 3); const r = await out(S.A, 2); ok(!refused(r), msg(r)); S.noteA = r.body.id;
    const l = await lines(S.noteA); ok(l.length === 2 && l.every(x => x.status === 'active'), `${l.length} sortie(s), statuts ${l.map(x => x.status)}`);
    ok((await avail(S.A)) === 1, `disponibilité ${await avail(S.A)} (attendu 1)`);
    const own = rows(await api(collab, 'GET', `/rest/v1/checkouts?delivery_note_id=eq.${S.noteA}&select=id`)); ok(own.length === 2, `le collaborateur ne voit que ${own.length} sortie(s) sur 2`);
  });
  await step('E1-quantite-excessive', 'Sortie de plus d\'exemplaires que disponibles : refusée', async () => { const r = await out(S.A, 2); ok(refused(r), 'sortie acceptée alors qu\'il n\'en reste qu\'1'); return INFO(msg(r)); });
  await step('E1-quantite-zero', 'Sortie de quantité 0 ou négative : refusée', async () => { for (const q of [0, -1]) { const r = await out(S.A, q); ok(refused(r), `quantité ${q} acceptée`); } });
  await step('E1-consommable', 'Sortie d\'un consommable en prêt : refusée', async () => {
    const c = await api(resp, 'POST', '/rest/v1/equipment?select=id', { name: `${M} conso`, item_type: 'consumable', status: 'available', total_quantity: 1, qr_type: 'batch', unit: 'pièce' }, { Prefer: 'return=representation' }); const e = rows(c)[0]; ok(e, msg(c)); made.equipment.push(e.id);
    const r = await out(e, 1); ok(refused(r), 'un consommable peut être emprunté');
  });
  await step('E1-collab-sortie', 'Collaborateur : ne peut pas se faire une sortie lui-même', async () => { const r = await out(S.A, 1, day(1), S.collabId, collab); ok(refused(r), 'sortie créée par un collaborateur'); });

  /* ============ E2 — retour complet ============ */
  group = 'E2 Retour';
  await step('E2-retour-refus-collab', 'Collaborateur : ne peut pas enregistrer un retour', async () => { const l = await lines(S.noteA); const r = await ret(l[0].id, 'ok', M, collab); ok(refused(r), 'retour accepté'); ok((await coStatus(l[0].id)) === 'active', 'statut modifié'); });
  await step('E2-etat-inconnu', 'État de retour inventé : refusé', async () => { const l = await lines(S.noteA); const r = await ret(l[0].id, 'peut-etre'); ok(refused(r), 'état inconnu accepté'); });
  await step('E2-retour-complet', 'Retour des 2 outils : tout redevient disponible, bon « rendu »', async () => {
    const l = await lines(S.noteA); for (const x of l) { const r = await ret(x.id); ok(!refused(r), msg(r)); }
    ok((await avail(S.A)) === 3, `disponibilité ${await avail(S.A)} (attendu 3)`); const st = await noteStatus(S.noteA); ok(st === 'returned', `bon : ${st}`);
  });
  await step('E2-double-retour', 'Retour d\'une sortie déjà rendue : refusé', async () => { const l = await lines(S.noteA); const r = await ret(l[0].id); ok(refused(r), 'second retour accepté'); });

  /* ============ E3 — retour partiel ============ */
  group = 'E3 Retour partiel';
  await step('E3-partiel', 'Bon de 3 outils : 1 rendu → bon « partiel », 2 toujours chez la personne', async () => {
    S.B = await make('Outil B', 3); const r = await out(S.B, 3); ok(!refused(r), msg(r)); S.noteB = r.body.id; const l = await lines(S.noteB); ok(l.length === 3, `${l.length} sortie(s)`);
    ok((await avail(S.B)) === 0, `disponibilité ${await avail(S.B)} (attendu 0)`);
    ok(!refused(await ret(l[0].id)), 'retour de la 1re ligne refusé');
    const st = await noteStatus(S.noteB); ok(st === 'partial', `statut du bon : ${st} (attendu partial)`);
    const left = (await lines(S.noteB)).filter(x => x.status === 'active'); ok(left.length === 2, `${left.length} sortie(s) encore actives`);
    ok((await avail(S.B)) === 1, `disponibilité ${await avail(S.B)} (attendu 1)`);
  });
  await step('E3-partiel-collab-voit', 'Le collaborateur voit encore les 2 sorties restantes', async () => { const own = rows(await api(collab, 'GET', `/rest/v1/checkouts?delivery_note_id=eq.${S.noteB}&status=in.(active,overdue)&select=id`)); ok(own.length === 2, `${own.length}`); });
  await step('E3-ui-partiel', 'Interface magasin : le bon partiel est visible dans Sorties', async () => {
    await staff.page.goto(`${BASE}/checkouts`); await staff.page.waitForTimeout(2500);
    const text = (await staff.page.locator('main').innerText()).toLowerCase(); ok(/partiel|partial/.test(text), 'aucune mention « partiel » dans la page Sorties');
  }, staff.page);

  /* ============ E4 — états au retour ============ */
  group = 'E4 États au retour';
  await step('E4-incomplet', 'Retour « incomplet » : rendu, contrôle enregistré', async () => {
    const l = (await lines(S.noteB)).filter(x => x.status === 'active'); const r = await ret(l[0].id, 'incomplete', `${M} manque le chargeur`); ok(!refused(r), msg(r));
    const chk = rows(await api(staff, 'GET', `/rest/v1/return_checks?checkout_id=eq.${l[0].id}&select=condition,notes`))[0]; ok(chk && chk.condition === 'incomplete', `contrôle : ${JSON.stringify(chk)}`);
  });
  await step('E4-retour-final', 'Dernière ligne rendue : le bon passe à « rendu »', async () => {
    const l = (await lines(S.noteB)).filter(x => x.status === 'active'); ok(l.length === 1, `${l.length} ligne(s) active(s)`); ok(!refused(await ret(l[0].id)), 'retour refusé');
    ok((await noteStatus(S.noteB)) === 'returned', `bon : ${await noteStatus(S.noteB)}`); ok((await avail(S.B)) === 3, `disponibilité ${await avail(S.B)}`);
  });
  await step('E4-a-reparer', 'Retour « à réparer » : l\'outil passe en maintenance, ne peut plus sortir', async () => {
    S.C = await make('Outil C'); const r = await out(S.C, 1); ok(!refused(r), msg(r)); const l = await lines(r.body.id);
    ok(!refused(await ret(l[0].id, 'to_repair', `${M} poignée fendue`)), 'retour refusé');
    const m = rows(await api(staff, 'GET', `/rest/v1/equipment_maintenance?equipment_id=eq.${S.C.id}&select=id,status,title`)); ok(m.some(x => x.status === 'in_progress'), 'aucune maintenance ouverte'); S.maintC = m.map(x => x.id);
    const again = await out(S.C, 1); ok(refused(again), 'sortie acceptée pour un outil à réparer'); return INFO(`refus : ${msg(again)} ; disponibilité ${await avail(S.C)}`);
  });
  await step('E4-casse', 'Retour « cassé » : maintenance + incident « cassé » à décider', async () => {
    S.D = await make('Outil D'); const r = await out(S.D, 1); const l = await lines(r.body.id);
    ok(!refused(await ret(l[0].id, 'broken', `${M} cassé en deux`)), 'retour refusé');
    const inc = await incidentsOf(S.D.id); ok(inc.some(i => i.kind === 'broken' && i.decision === 'pending'), `incidents : ${JSON.stringify(inc)}`); S.incD = inc[0];
    const m = rows(await api(staff, 'GET', `/rest/v1/equipment_maintenance?equipment_id=eq.${S.D.id}&select=id,status`)); ok(m.some(x => x.status === 'in_progress'), 'pas de maintenance'); S.maintD = m.map(x => x.id);
  });
  await step('E4-decision-casse', 'Responsable : décide « déduit du salaire » avec un coût ; le magasin seul ne peut pas', async () => {
    const asStaff = await rpc(staff, 'decide_incident', { p_id: S.incD.id, p_decision: 'deducted', p_cost: 12.5, p_note: M });
    const asResp = await rpc(resp, 'decide_incident', { p_id: S.incD.id, p_decision: 'deducted', p_cost: 12.5, p_note: M }); ok(!refused(asResp), `responsable : ${msg(asResp)}`);
    const st = (rows(await api(resp, 'GET', `/rest/v1/incidents?id=eq.${S.incD.id}&select=decision,cost`))[0]) || {}; ok(st.decision === 'deducted', `décision : ${st.decision}`);
    return INFO(refused(asStaff) ? 'le magasinier seul ne peut pas décider' : 'le magasinier peut aussi décider (droit « approve » ?)');
  });
  await step('E4-collab-decide', 'Collaborateur : ne peut pas décider d\'un incident', async () => { const r = await rpc(collab, 'decide_incident', { p_id: S.incD.id, p_decision: 'written_off', p_cost: 0, p_note: M }); ok(refused(r), 'décision acceptée'); });

  /* ============ E5 — retard ============ */
  group = 'E5 Retard (non rendu)';
  await step('E5-sortie-echue', 'Sortie dont le retour est déjà dépassé (hier) : acceptée ou refusée ?', async () => {
    S.F = await make('Outil F', 2); const r = await out(S.F, 1, day(-1, 12)); S.lateOk = !refused(r); if (S.lateOk) S.noteF = r.body.id;
    return INFO(S.lateOk ? 'acceptée (le serveur ne contrôle pas la date de retour passée)' : `refusée : ${msg(r)}`);
  });
  await step('E5-passage-retard', 'Après l\'échéance la sortie passe en « en retard »', async () => {
    if (!S.lateOk) return SKIP('sortie échue impossible');
    const u = await rpc(staff, 'update_overdue_checkouts', {}); const l = await lines(S.noteF); let st = l[0].status;
    if (st === 'active') { const v = rows(await rpc(staff, 'get_checkouts_with_status', {})).find(x => x.id === l[0].id); st = v ? v.status : st; }
    ok(st === 'overdue', `statut ${st} après le traitement des retards (${refused(u) ? 'traitement refusé : ' + msg(u) : 'traitement lancé'})`);
  });
  await step('E5-dispo-retard', 'Un outil en retard reste indisponible : 1 sur 2 seulement réservable', async () => {
    if (!S.lateOk) return SKIP('pas de sortie échue');
    ok((await avail(S.F)) === 1, `disponibilité ${await avail(S.F)} (attendu 1)`);
    const r = await rpc(collab, 'create_request', { p_requester_id: S.collabId, p_depot_id: (rows(await api(staff, 'GET', '/rest/v1/depots?select=id&limit=1'))[0] || {}).id, p_start: day(1, 8), p_end: day(1, 17), p_items: [{ kind: 'tool', id: S.F.id, quantity: 2 }], p_destination: M, p_notes: M });
    if (!refused(r) && r.body && r.body.id) made.requests.push(r.body.id); ok(refused(r), 'commande de 2 acceptée alors qu\'un exemplaire est en retard');
  });
  await step('E5-qui-a-quoi', 'Le retard est visible : « qui a quoi » et « Mon matériel »', async () => {
    if (!S.lateOk) return SKIP('pas de sortie échue');
    const w = rows(await rpc(collab, 'who_has', {})); ok(w.some(x => x.equipment_id === S.F.id), 'who_has ne montre pas la sortie en retard');
    await collab.page.goto(`${BASE}/shop?vue=commandes`); await collab.page.waitForTimeout(2500);
    const text = await collab.page.locator('main').innerText(); ok(/retard/i.test(text), 'aucune mention de retard dans « Mon matériel »'); ok(text.includes('TEST-EMPRUNT'), 'l\'outil en retard n\'est pas listé');
  }, collab.page);
  await step('E5-commande-en-retard', 'Une personne en retard peut-elle encore commander ?', async () => {
    if (!S.lateOk) return SKIP('pas de sortie échue');
    const t = await make('Outil F2'); const r = await rpc(collab, 'create_request', { p_requester_id: S.collabId, p_depot_id: (rows(await api(staff, 'GET', '/rest/v1/depots?select=id&limit=1'))[0] || {}).id, p_start: day(2, 8), p_end: day(2, 17), p_items: [{ kind: 'tool', id: t.id, quantity: 1 }], p_destination: M, p_notes: M });
    if (!refused(r) && r.body && r.body.id) made.requests.push(r.body.id); return INFO(refused(r) ? `bloquée : ${msg(r)}` : 'autorisée (aucun blocage automatique des personnes en retard)');
  });
  await step('E5-notification-retard', 'Une alerte de retard est créée pour le magasin', async () => {
    if (!S.lateOk) return SKIP('pas de sortie échue');
    const n = rows(await api(staff, 'GET', '/rest/v1/notifications?select=kind,message&order=created_at.desc&limit=60')); const hit = n.find(x => /retard|overdue/i.test(`${x.kind} ${x.message}`) && /TEST-EMPRUNT/.test(x.message || ''));
    return INFO(hit ? `alerte : ${hit.message}` : 'aucune alerte de retard trouvée pour cette sortie (créées par un traitement planifié ?)');
  });
  await step('E5-retour-tardif', 'Retour tardif : accepté, disponibilité rétablie', async () => {
    if (!S.lateOk) return SKIP('pas de sortie échue'); const l = await lines(S.noteF); ok(!refused(await ret(l[0].id)), 'retour d\'une sortie en retard refusé'); ok((await avail(S.F)) === 2, `disponibilité ${await avail(S.F)}`);
  });

  /* ============ E6 — perte, vol, retrouvé ============ */
  group = 'E6 Perte et vol';
  await step('E6-perte', 'Perte déclarée : sortie « perdue », incident à décider, outil indisponible', async () => {
    S.G = await make('Outil G', 2); const r = await out(S.G, 2); ok(!refused(r), msg(r)); const l = await lines(r.body.id); S.gL = l;
    const d = await declare('lost', S.G, l[0].id); ok(!refused(d), msg(d)); ok((await coStatus(l[0].id)) === 'lost', `sortie : ${await coStatus(l[0].id)}`);
    const inc = await incidentsOf(S.G.id); ok(inc.some(i => i.kind === 'lost' && i.decision === 'pending'), `incidents : ${JSON.stringify(inc)}`); S.incG = inc[0]; made.incidents.add(inc[0].id);
    return INFO(`disponibilité après perte : ${await avail(S.G)} (2 sorties, dont 1 perdue)`);
  });
  await step('E6-retour-sortie-perdue', 'Enregistrer un retour sur une sortie « perdue » : refusé', async () => { const r = await ret(S.gL[0].id); ok(refused(r), 'retour accepté sur une sortie perdue'); });
  await step('E6-double-declaration', 'Déclarer deux fois la même perte', async () => { const d = await declare('lost', S.G, S.gL[0].id); return INFO(refused(d) ? `refusée : ${msg(d)}` : 'acceptée (un second incident est créé)'); });
  await step('E6-decision-assurance', 'Responsable : décision « assurance » ; collaborateur ne peut pas décider', async () => {
    ok(refused(await rpc(collab, 'decide_incident', { p_id: S.incG.id, p_decision: 'insurance', p_cost: 100, p_note: M })), 'le collaborateur a pu décider');
    const r = await rpc(resp, 'decide_incident', { p_id: S.incG.id, p_decision: 'insurance', p_cost: 100, p_note: M }); ok(!refused(r), msg(r));
  });
  await step('E6-retrouve', 'Objet retrouvé : la sortie n\'est plus « perdue », l\'outil est de nouveau disponible', async () => {
    const r = await rpc(resp, 'decide_incident', { p_id: S.incG.id, p_decision: 'found', p_cost: null, p_note: `${M} retrouvé` }); ok(!refused(r), msg(r));
    const st = await coStatus(S.gL[0].id); ok(st !== 'lost', `la sortie reste « ${st} »`); return INFO(`statut de la sortie après « retrouvé » : ${st} ; disponibilité ${await avail(S.G)}`);
  });
  await step('E6-vol', 'Vol déclaré : même traitement qu\'une perte', async () => {
    S.H = await make('Outil H'); const r = await out(S.H, 1); const l = await lines(r.body.id); const d = await declare('stolen', S.H, l[0].id); ok(!refused(d), msg(d));
    ok((await coStatus(l[0].id)) === 'lost', `sortie : ${await coStatus(l[0].id)}`); const inc = await incidentsOf(S.H.id); inc.forEach(i => made.incidents.add(i.id));
  });
  await step('E6-collab-declare', 'Collaborateur : peut-il déclarer lui-même la perte d\'un outil qu\'il a ?', async () => {
    S.I = await make('Outil I'); const r = await out(S.I, 1); const l = await lines(r.body.id); const d = await declare('lost', S.I, l[0].id, collab);
    const inc = await incidentsOf(S.I.id); inc.forEach(i => made.incidents.add(i.id)); return INFO(refused(d) ? `refusé : ${msg(d)}` : `accepté (sortie : ${await coStatus(l[0].id)})`);
  });
  await step('E6-collab-declare-autrui', 'Collaborateur : ne peut pas déclarer la perte d\'un outil d\'un autre', async () => {
    S.J = await make('Outil J'); const r = await out(S.J, 1, day(1), S.respId); const l = await lines(r.body.id); const d = await declare('lost', S.J, l[0].id, collab);
    const inc = await incidentsOf(S.J.id); inc.forEach(i => made.incidents.add(i.id)); ok(refused(d) || (await coStatus(l[0].id)) !== 'lost', 'le collaborateur a déclaré perdu l\'outil d\'un autre');
  });
  await step('E6-ui-pertes', 'Interface : la perte apparaît dans « Pertes et casse » avec la décision à prendre', async () => {
    await staff.page.goto(`${BASE}/incidents`); await staff.page.waitForTimeout(2500); const t = await staff.page.locator('main').innerText();
    ok(/TEST-EMPRUNT/.test(t), 'aucun incident TEST-EMPRUNT affiché'); ok(/décider|à décider/i.test(t), 'aucune mention « à décider »');
  }, staff.page);

  /* ============ E7 — prolongation ============ */
  group = 'E7 Prolongation';
  const dueOf = async (id) => (rows(await api(staff, 'GET', `/rest/v1/checkouts?id=eq.${id}&select=due_date`))[0] || {}).due_date;
  const extend = (ids, due, note = M, c = staff) => rpc(c, 'extend_checkouts', { p_checkout_ids: ids, p_new_due: due, p_note: note });
  await step('E7-collab-modif-directe', 'Collaborateur : ne peut pas repousser lui-même la date de retour (accès direct)', async () => {
    S.K = await make('Outil K'); const r = await out(S.K, 1, day(1)); S.kId = (await lines(r.body.id))[0].id;
    const p = await api(collab, 'PATCH', `/rest/v1/checkouts?id=eq.${S.kId}`, { due_date: day(10) }, { Prefer: 'return=representation' }); ok(rows(p).length === 0, 'le collaborateur a modifié la date de retour');
  });
  await step('E7-collab-extend-refuse', 'Collaborateur : ne peut pas prolonger via la fonction du magasin', async () => { ok(refused(await extend([S.kId], day(5), M, collab)), 'prolongation acceptée'); });
  await step('E7-prolonger', 'Magasin : prolonge une sortie ; la date change, la note le dit, le collaborateur est prévenu', async () => {
    const r = await extend([S.kId], day(5)); ok(!refused(r), msg(r)); const due = new Date(await dueOf(S.kId)).getTime(); ok(due > Date.now() + 3.5 * 86400e3, `date de retour : ${await dueOf(S.kId)}`);
    const co = rows(await api(staff, 'GET', `/rest/v1/checkouts?id=eq.${S.kId}&select=notes`))[0]; ok(/Prolongé jusqu/.test(co.notes || ''), 'pas de trace « Prolongé » dans la sortie');
    const n = rows(await api(collab, 'GET', '/rest/v1/notifications?kind=eq.loan_extended&select=message&order=created_at.desc&limit=5')); ok(n.length > 0, 'aucun avis « emprunt prolongé » pour le collaborateur');
  });
  await step('E7-date-invalide', 'Date antérieure au retour prévu, passée ou à plus d\'un an : refusées', async () => {
    ok(refused(await extend([S.kId], day(2))), 'date antérieure acceptée'); ok(refused(await extend([S.kId], day(-1))), 'date passée acceptée'); ok(refused(await extend([S.kId], day(400))), 'plus d\'un an accepté');
  });
  await step('E7-prolonger-apres-partiel', 'Après un retour partiel : seules les sorties restantes sont prolongées', async () => {
    S.K2 = await make('Outil K2', 3); const r = await out(S.K2, 3, day(1)); const l = await lines(r.body.id); ok(l.length === 3, `${l.length} sortie(s)`);
    ok(!refused(await ret(l[0].id)), 'retour refusé'); const before = await dueOf(l[0].id);
    const e = await extend([l[1].id, l[2].id], day(6)); ok(!refused(e), msg(e));
    ok((await dueOf(l[0].id)) === before, 'la sortie déjà rendue a été modifiée'); ok(new Date(await dueOf(l[1].id)).getTime() > Date.now() + 4.5 * 86400e3 && new Date(await dueOf(l[2].id)).getTime() > Date.now() + 4.5 * 86400e3, 'les sorties restantes ne sont pas prolongées');
    ok(refused(await extend([l[0].id], day(8))), 'une sortie déjà rendue peut être prolongée');
    S.k2Lines = l;
  });
  await step('E7-conflit-reservation', 'Une réservation à venir sur le même outil empêche la prolongation', async () => {
    S.K3 = await make('Outil K3'); const r = await out(S.K3, 1, day(1)); S.k3 = (await lines(r.body.id))[0].id; const dep = (rows(await api(staff, 'GET', '/rest/v1/depots?select=id&limit=1'))[0] || {}).id;
    const q = await rpc(resp, 'create_request', { p_requester_id: S.respId, p_depot_id: dep, p_start: day(3, 8), p_end: day(4, 17), p_items: [{ kind: 'tool', id: S.K3.id, quantity: 1 }], p_destination: M, p_notes: M }); ok(!refused(q), `réservation : ${msg(q)}`); made.requests.push(q.body.id);
    const e = await extend([S.k3], day(5)); ok(refused(e), 'prolongation acceptée malgré la réservation'); ok(/réservé/i.test(msg(e)), `message : ${msg(e)}`);
    const ok2 = await extend([S.k3], day(2)); ok(!refused(ok2), `prolongation avant la réservation refusée : ${msg(ok2)}`);
  });
  await step('E7-prolonger-retard', 'Une sortie en retard prolongée redevient « active »', async () => {
    if (!S.lateOk) return SKIP('pas de sortie échue (E5)'); const t = await make('Outil K4', 2); const r = await out(t, 1, day(-1, 12)); const id = (await lines(r.body.id))[0].id; await rpc(staff, 'update_overdue_checkouts', {});
    ok(!refused(await extend([id], day(3))), 'prolongation refusée'); const st = await coStatus(id); ok(st === 'active', `statut ${st} après prolongation`);
  });
  await step('E7-demande-collab', 'Collaborateur : demande une prolongation (avis au magasin, pas de doublon) ; pas pour l\'outil d\'un autre', async () => {
    const depuis = encodeURIComponent(new Date(Date.now() - 120e3).toISOString()); // seuls les avis de CE passage comptent (ceux des passages précédents restent en base)
    const a = await rpc(collab, 'request_extension', { p_new_due: day(8), p_reason: `${M} chantier retardé`, p_checkout_id: S.kId, p_request_id: null }); ok(!refused(a), msg(a));
    const b = await rpc(collab, 'request_extension', { p_new_due: day(8), p_reason: `${M} chantier retardé`, p_checkout_id: S.kId, p_request_id: null });
    const n = rows(await api(staff, 'GET', `/rest/v1/notifications?kind=eq.extension_request&created_at=gte.${depuis}&select=id,message&order=created_at.desc&limit=10`)).filter(x => /TEST-EMPRUNT|Outil K/.test(x.message)); ok(n.length >= 1, 'le magasin ne reçoit aucun avis'); ok(n.length === 1, `${n.length} avis pour la même demande (doublon)`);
    const other = await out(S.K, 1, day(1), S.respId); const oid = (await lines(other.body.id))[0]; const x = await rpc(collab, 'request_extension', { p_new_due: day(8), p_reason: M, p_checkout_id: oid ? oid.id : null, p_request_id: null }); ok(refused(x), 'demande acceptée pour l\'outil d\'un autre');
    return INFO(refused(b) ? `2e demande identique refusée : ${msg(b)}` : '2e demande identique absorbée (un seul avis)');
  });

  /* ============ E8 — via une demande ============ */
  group = 'E8 Demande puis sortie';
  await step('E8-demande-sortie', 'Demande de 2 outils → préparée → sortie : la demande est « sortie »', async () => {
    S.L1 = await make('Outil L1'); S.L2 = await make('Outil L2'); const dep = (rows(await api(staff, 'GET', '/rest/v1/depots?select=id&limit=1'))[0] || {}).id;
    const q = await rpc(collab, 'create_request', { p_requester_id: S.collabId, p_depot_id: dep, p_start: day(0, 6), p_end: day(1, 17), p_items: [{ kind: 'tool', id: S.L1.id, quantity: 1 }, { kind: 'tool', id: S.L2.id, quantity: 1 }], p_destination: M, p_notes: M }); ok(!refused(q), msg(q)); S.req = q.body; made.requests.push(q.body.id);
    ok(q.body.status === 'approved', `statut ${q.body.status}`); ok(!refused(await rpc(staff, 'set_request_status', { p_request_id: q.body.id, p_status: 'ready' })), 'passage « prête » refusé');
    const i = await rpc(staff, 'issue_request', { p_request_id: q.body.id, p_vehicle: null }); ok(!refused(i), msg(i));
    S.reqRow = rows(await api(staff, 'GET', `/rest/v1/requests?id=eq.${q.body.id}&select=status,delivery_note_id`))[0]; ok(S.reqRow.status === 'out', `statut ${S.reqRow.status}`); await lines(S.reqRow.delivery_note_id);
  });
  await step('E8-demande-partielle', 'Un seul des 2 outils rendu : la demande reste « sortie »', async () => {
    const l = (await lines(S.reqRow.delivery_note_id)); ok(l.length === 2, `${l.length} sortie(s)`); ok(!refused(await ret(l[0].id)), 'retour refusé');
    const st = (rows(await api(staff, 'GET', `/rest/v1/requests?id=eq.${S.req.id}&select=status`))[0] || {}).status; ok(st === 'out', `demande : ${st} (attendu out)`);
  });
  await step('E8-prolonger-demande', 'Demande partiellement rendue : « Prolonger » ne touche que l\'outil resté dehors, la demande est prolongée', async () => {
    const l = (await lines(S.reqRow.delivery_note_id)); const rest = l.filter(x => x.status === 'active'); const done = l.filter(x => x.status === 'returned'); ok(rest.length === 1 && done.length === 1, `${rest.length} dehors, ${done.length} rendu`);
    const doneDue = await dueOf(done[0].id); const e = await rpc(staff, 'extend_request', { p_request_id: S.req.id, p_new_end: day(6), p_note: M }); ok(!refused(e), msg(e));
    ok(new Date(await dueOf(rest[0].id)).getTime() > Date.now() + 4.5 * 86400e3, 'l\'outil resté dehors n\'est pas prolongé'); ok((await dueOf(done[0].id)) === doneDue, 'l\'outil rendu a été modifié');
    const rq = rows(await api(staff, 'GET', `/rest/v1/requests?id=eq.${S.req.id}&select=end_at,status`))[0]; ok(new Date(rq.end_at).getTime() > Date.now() + 4.5 * 86400e3, 'la fin de la demande n\'a pas été repoussée'); ok(rq.status === 'out', `statut ${rq.status}`);
    ok(refused(await rpc(collab, 'extend_request', { p_request_id: S.req.id, p_new_end: day(9), p_note: M })), 'un collaborateur a prolongé une demande');
  });
  await step('E8-demande-close', 'Le second outil rendu : la demande est clôturée automatiquement', async () => {
    const l = (await lines(S.reqRow.delivery_note_id)).filter(x => x.status === 'active'); ok(l.length === 1, `${l.length} restante(s)`); ok(!refused(await ret(l[0].id)), 'retour refusé');
    const st = (rows(await api(staff, 'GET', `/rest/v1/requests?id=eq.${S.req.id}&select=status`))[0] || {}).status; ok(st === 'closed', `demande : ${st} (attendu closed)`);
  });
  await step('E8-demande-perdu', 'Demande dont un outil est perdu et l\'autre rendu : état de la demande', async () => {
    const a = await make('Outil M1'); const b = await make('Outil M2'); const dep = (rows(await api(staff, 'GET', '/rest/v1/depots?select=id&limit=1'))[0] || {}).id;
    const q = await rpc(collab, 'create_request', { p_requester_id: S.collabId, p_depot_id: dep, p_start: day(0, 6), p_end: day(1, 17), p_items: [{ kind: 'tool', id: a.id, quantity: 1 }, { kind: 'tool', id: b.id, quantity: 1 }], p_destination: M, p_notes: M }); ok(!refused(q), msg(q)); made.requests.push(q.body.id);
    await rpc(staff, 'set_request_status', { p_request_id: q.body.id, p_status: 'ready' }); ok(!refused(await rpc(staff, 'issue_request', { p_request_id: q.body.id, p_vehicle: null })), 'sortie refusée');
    const row = rows(await api(staff, 'GET', `/rest/v1/requests?id=eq.${q.body.id}&select=delivery_note_id`))[0]; const l = await lines(row.delivery_note_id);
    await declare('lost', a, l.find(x => x.equipment_id === a.id).id); (await incidentsOf(a.id)).forEach(i => made.incidents.add(i.id)); ok(!refused(await ret(l.find(x => x.equipment_id === b.id).id)), 'retour de l\'autre outil refusé');
    const st = (rows(await api(staff, 'GET', `/rest/v1/requests?id=eq.${q.body.id}&select=status`))[0] || {}).status; return INFO(`demande : ${st} (1 outil perdu, 1 rendu)`);
  });

  /* ============ UI collaborateur : matériel chez moi ============ */
  group = 'E9 Interface collaborateur';
  await step('E9-materiel-chez-moi', 'Le collaborateur voit ce qu\'il a, avec « Signaler »', async () => {
    await collab.page.goto(`${BASE}/shop?vue=commandes`); await collab.page.waitForTimeout(2500); const t = await collab.page.locator('main').innerText();
    ok(/Matériel chez moi/.test(t), 'bloc « Matériel chez moi » absent'); ok(await collab.page.getByRole('button', { name: 'Signaler' }).count() > 0, 'bouton « Signaler » absent');
  }, collab.page);
  await step('E9-accueil-retards', 'Accueil magasin : le retard/perte est compté', async () => {
    await staff.page.goto(`${BASE}/`); await staff.page.waitForTimeout(2500); const t = await staff.page.locator('main').innerText(); return INFO(/retard/i.test(t) ? 'mention « retard » présente' : 'aucune mention de retard sur l\'accueil');
  }, staff.page);

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  const clean = { returned: 0, found: 0, maint: 0, cancelled: 0, retired: 0, stuck: [] };
  try {
    for (const id of made.incidents) { const r = await rpc(resp, 'decide_incident', { p_id: id, p_decision: 'found', p_cost: null, p_note: `${M} nettoyage` }); if (!refused(r)) clean.found++; }
    for (const n of made.notes) await lines(n);
    for (const id of made.checkouts) { const st = await coStatus(id); if (['active', 'overdue'].includes(st)) { const r = await ret(id); if (!refused(r)) clean.returned++; else clean.stuck.push(`sortie ${id.slice(0, 8)} (${st}) : ${msg(r)}`); } else if (st === 'lost') clean.stuck.push(`sortie ${id.slice(0, 8)} reste « perdue »`); }
    for (const eid of made.equipment) { const m = rows(await api(resp, 'GET', `/rest/v1/equipment_maintenance?equipment_id=eq.${eid}&status=eq.in_progress&select=id`)); for (const x of m) { const p = await api(resp, 'PATCH', `/rest/v1/equipment_maintenance?id=eq.${x.id}`, { status: 'completed', end_date: new Date().toISOString() }); if (!refused(p)) clean.maint++; } }
    for (const rid of made.requests) { const st = (rows(await api(resp, 'GET', `/rest/v1/requests?id=eq.${rid}&select=status`))[0] || {}).status; if (['requested', 'approved', 'ready'].includes(st)) { const r = await rpc(resp, 'set_request_status', { p_request_id: rid, p_status: 'cancelled' }); if (!refused(r)) clean.cancelled++; else clean.stuck.push(`demande ${rid.slice(0, 8)} (${st})`); } else if (st === 'out') clean.stuck.push(`demande ${rid.slice(0, 8)} encore « sortie »`); }
    for (const eid of made.equipment) { const p = await api(resp, 'PATCH', `/rest/v1/equipment?id=eq.${eid}`, { status: 'retired' }); if (!refused(p)) clean.retired++; }
  } catch (e) { clean.stuck.push(`erreur de nettoyage : ${e.message}`); }

  await browser.close();

  /* ============ Rapport ============ */
  const n = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport du cycle de vie d\'un emprunt', '',
    `Base : GO-MAT · comptes : ${Object.values(ACCOUNTS).join(', ')} · date : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, 'Commit testé : à renseigner (`git log --oneline -1`).', '',
    `**Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO (comportements à lire)**`, '',
    `Nettoyage : ${clean.returned} sortie(s) rendue(s), ${clean.found} incident(s) clos « retrouvé », ${clean.maint} maintenance(s) close(s), ${clean.cancelled} demande(s) annulée(s), ${clean.retired} outil(s) retiré(s)${clean.stuck.length ? `. **À traiter à la main : ${clean.stuck.join(' ; ')}**` : ', rien de bloqué'}.`, '',
    '## À corriger (KO et PARTIEL)', '', ...(results.filter(r => ['KO', 'PARTIEL'].includes(r.status)).map(r => `- **${r.status}** ${r.id} — ${r.title} : ${r.detail}${r.shot ? ` ([capture](${r.shot}))` : ''}`)), ...(results.some(r => ['KO', 'PARTIEL'].includes(r.status)) ? [] : ['Aucun.']), '',
    '## Comportements observés (INFO)', '', ...results.filter(r => r.status === 'INFO').map(r => `- **${r.id}** — ${r.title} : ${r.detail}`), '',
    ...groups.flatMap(g => ['', `## ${g}`, '', '| Point | Verdict | Détail |', '|---|---|---|', ...results.filter(r => r.group === g).map(r => `| ${r.id} — ${r.title.replace(/\|/g, '/')} | ${r.status} | ${r.detail.replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 240)} |`)]),
    '', '## Erreurs JavaScript', '', jsErrors.length ? [...new Set(jsErrors)].slice(0, 20).map(e => `- ${e}`).join('\n') : 'Aucune.', '',
  ];
  fs.writeFileSync(REPORT, md.join('\n'));
  console.log(`\nRapport : ${path.relative(process.cwd(), REPORT)}`);
  console.log(`Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO`);
  if (clean.stuck.length) console.log(`À TRAITER À LA MAIN : ${clean.stuck.join(' ; ')}`);
  process.exit(n('KO') ? 1 : 0);
})();
