#!/usr/bin/env node
// COHÉRENCE DES CHIFFRES : le même chiffre doit être le même partout.
// Pour chaque notion (consommables en service, stock bas, à commander, outils, véhicules, pastille), on calcule la vérité
// dans la base (avec le compte du responsable) et on la compare à ce que chaque écran affiche : Consommables, À commander,
// Accueil, pastille. Des articles pièges sont créés exprès : un en stock bas, un épuisé avec seuil, un épuisé sans seuil,
// un retiré du service qui a un seuil (il ne doit apparaître nulle part), un en ordre.
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-coherence.cjs
//
// Compte du responsable (E2E_RESP) et du collaborateur (E2E_COLLAB) ; mot de passe UNIQUEMENT par E2E_PASSWORD.
// Les articles créés portent « TEST-COH » ; à la fin ils sont retirés du service (et ne s'affichent plus nulle part).
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
const SHOTS = path.join(OUT_DIR, 'captures-coherence');
const REPORT = path.join(OUT_DIR, 'rapport-coherence.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-COH';
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
async function api(c, method, route, body, extra = {}, anonymous = false) {
  return c.page.evaluate(async ({ base, key, method, route, body, extra, anonymous }) => {
    const tk = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
    const token = anonymous ? key : (tk ? JSON.parse(localStorage.getItem(tk) || '{}').access_token : key);
    let res;
    try { res = await fetch(base + route, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { return { status: 0, body: { message: `requête bloquée (${e.message})` } }; }
    let json = null; try { json = await res.json(); } catch { /* corps vide */ }
    return { status: res.status, body: json };
  }, { base: c.base, key: c.key, method, route, body, extra, anonymous });
}
const rpc = (c, n, a = {}) => api(c, 'POST', `/rest/v1/rpc/${n}`, a);
const rows = r => (Array.isArray(r.body) ? r.body : []);
const refused = r => r.status >= 400 || r.status === 0;
const msg = r => (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`;
const ok = (cond, m) => { if (!cond) throw new Error(m); };
const INFO = d => ({ status: 'INFO', detail: d });
const SKIP = d => ({ status: 'NON TESTÉ', detail: d });

async function step(id, title, fn, page) {
  const e = { group, id, title, status: 'KO', detail: '', shot: '' };
  try { const o = await fn(); e.status = (o && o.status) || 'OK'; e.detail = (o && o.detail) || ''; }
  catch (err) { e.status = 'KO'; e.detail = String(err.message).split('\n')[0]; }
  if (page && ['KO', 'PARTIEL'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-coherence/${f}`; } catch { /* page fermée */ } }
  console.log(`${e.status.padEnd(11)} ${id}  ${title}${e.detail ? ' — ' + e.detail.slice(0, 170) : ''}`);
  results.push(e);
}


(async () => {
  const browser = await chromium.launch();
  const resp = await login(browser, 'resp');
  const collab = await login(browser, 'collab');
  const all = [resp, collab];

  const rest = async (path) => rows(await api(resp, 'GET', path));
  const made = [];
  const mk = async (name, extra = {}) => {
    const r = await api(resp, 'POST', '/rest/v1/equipment?select=id,name', { name: `${M} ${name}`, item_type: 'consumable', unit: 'pièce', status: 'available', total_quantity: 1, ...extra }, { Prefer: 'return=representation' });
    const e = rows(r)[0]; if (!e) throw new Error(`création de « ${name} » impossible : ${msg(r)}`); made.push(e.id); return e;
  };

  /* ============ Préparation : des articles pièges ============ */
  group = 'Préparation';
  await step('PREP', 'Articles pièges : bas (2/5), épuisé avec seuil (0/5), épuisé sans seuil, retiré avec seuil, en ordre (8/3)', async () => {
    const depot = rows(await api(resp, 'GET', '/rest/v1/depots?is_default=eq.true&select=id'))[0] || rows(await api(resp, 'GET', '/rest/v1/depots?select=id&limit=1'))[0];
    ok(depot, 'aucun dépôt');
    S.depot = depot.id;
    const put = async (e, qty, min) => {
      if (qty > 0) ok(!refused(await rpc(resp, 'receive_stock', { p_equipment_id: e.id, p_depot_id: S.depot, p_quantity: qty, p_notes: M })), `réception de stock refusée pour ${e.name}`);
      if (min > 0) ok(!refused(await rpc(resp, 'set_min_quantity', { p_equipment_id: e.id, p_depot_id: S.depot, p_min_quantity: min })), `seuil refusé pour ${e.name}`);
    };
    S.low = await mk('bas 2 sur 5'); await put(S.low, 2, 5);
    S.zeroThr = await mk('épuisé avec seuil'); await put(S.zeroThr, 0, 5);
    S.zeroNo = await mk('épuisé sans seuil'); await put(S.zeroNo, 0, 0);
    S.ok = await mk('en ordre 8 sur 3'); await put(S.ok, 8, 3);
    S.retired = await mk('retiré avec seuil'); await put(S.retired, 0, 5);
    const p = await api(resp, 'PATCH', `/rest/v1/equipment?id=eq.${S.retired.id}`, { status: 'retired' }); ok(!refused(p), `retrait refusé : ${msg(p)}`);
  });

  /* ============ La vérité dans la base ============ */
  const truth = async () => {
    const eq = await rest('/rest/v1/equipment?select=id,name,status,item_type');
    const stock = await rest('/rest/v1/consumable_stock?select=equipment_id,depot_id,quantity,min_quantity');
    const live = eq.filter(e => e.item_type === 'consumable' && e.status !== 'retired');
    const liveIds = new Set(live.map(e => e.id));
    const lowRows = stock.filter(s => liveIds.has(s.equipment_id) && Number(s.min_quantity) > 0 && Number(s.quantity) < Number(s.min_quantity));
    const qty = id => stock.filter(s => s.equipment_id === id).reduce((a, s) => a + Number(s.quantity), 0);
    const lowItems = new Set(lowRows.map(s => s.equipment_id));
    const zeroItems = live.filter(e => qty(e.id) === 0).map(e => e.id);
    const onSheet = await rest('/rest/v1/low_stock_items?select=equipment_id,name,depot_id');
    const tools = eq.filter(e => e.item_type !== 'consumable' && e.status !== 'retired');
    const vehicles = (await rest('/rest/v1/vehicles?select=id,status')).filter(v => v.status !== 'retired');
    return { eq, live, lowRows, lowItems, zeroItems, onSheet, tools, vehicles, countLowFilter: new Set([...lowItems, ...zeroItems]).size };
  };
  let T;

  /* ============ La base elle-même est cohérente ============ */
  group = 'C1 La base';
  await step('C1-vue', 'La feuille « À commander » (vue de la base) = les lignes sous leur seuil des articles en service', async () => {
    T = await truth();
    ok(T.onSheet.length === T.lowRows.length, `vue ${T.onSheet.length} ligne(s) ≠ ${T.lowRows.length} ligne(s) de stock sous le seuil`);
    ok(!T.onSheet.some(r => r.equipment_id === S.retired.id), 'un article retiré figure sur la feuille');
    ok(T.onSheet.some(r => r.equipment_id === S.low.id) && T.onSheet.some(r => r.equipment_id === S.zeroThr.id), 'un article bas ou épuisé avec seuil manque sur la feuille');
    ok(!T.onSheet.some(r => r.equipment_id === S.zeroNo.id), 'un article sans seuil figure sur la feuille (il ne devrait pas)');
  });

  /* ============ C2 Écran Consommables ============ */
  group = 'C2 Écran Consommables';
  await step('C2-cartes', 'Autant de cartes que d\'articles en service ; aucun article retiré affiché', async () => {
    await resp.page.goto(`${BASE}/consommables`); await resp.page.waitForSelector('nav[aria-label="Navigation principale"]'); await resp.page.waitForTimeout(3000);
    const n = await resp.page.locator('main button[aria-haspopup="menu"][aria-label^="Actions pour"]').count();
    const text = await resp.page.locator('main').innerText();
    ok(n === T.live.length, `${n} carte(s) affichée(s) ≠ ${T.live.length} article(s) en service dans la base`);
    ok(!text.toUpperCase().includes(`${M} RETIRÉ AVEC SEUIL`), 'l\'article retiré est affiché');
  }, resp.page);
  await step('C2-stock-bas', '« Stock bas seulement (n) » = n articles bas ou épuisés de la base', async () => {
    const body = await resp.page.locator('body').innerText();
    const m = body.match(/Stock bas seulement \((\d+)\)/); ok(m, 'compteur « Stock bas seulement » introuvable');
    ok(Number(m[1]) === T.countLowFilter, `écran ${m[1]} ≠ base ${T.countLowFilter}`);
  }, resp.page);
  await step('C2-retires', '« Afficher les articles retirés » fait apparaître l\'article retiré avec la pastille « Retiré »', async () => {
    await resp.page.getByLabel('Afficher les articles retirés').check(); await resp.page.waitForTimeout(800);
    const text = (await resp.page.locator('main').innerText()).toUpperCase();
    ok(text.includes(`${M} RETIRÉ AVEC SEUIL`) && /RETIRÉ/.test(text), 'article retiré absent malgré la case cochée');
    await resp.page.getByLabel('Afficher les articles retirés').uncheck();
  }, resp.page);

  /* ============ C3 Écran À commander ============ */
  group = 'C3 Écran À commander';
  await step('C3-lignes', 'Autant de lignes que la vue de la base ; chaque article bas ou épuisé avec seuil y figure', async () => {
    await resp.page.goto(`${BASE}/commande`); await resp.page.waitForSelector('nav[aria-label="Navigation principale"]'); await resp.page.waitForTimeout(3000);
    const n = await resp.page.locator('main tbody tr').count();
    const text = await resp.page.locator('main').innerText();
    ok(n === T.onSheet.length, `${n} ligne(s) affichée(s) ≠ ${T.onSheet.length} ligne(s) dans la base`);
    ok(text.includes(`${M} bas 2 sur 5`) && text.includes(`${M} épuisé avec seuil`), 'un article bas ou épuisé avec seuil manque');
    ok(!text.includes(`${M} retiré avec seuil`), 'un article retiré figure sur la feuille');
  }, resp.page);
  await step('C3-sans-seuil', 'Un article épuisé sans seuil est signalé par un avis (il ne peut pas être commandé automatiquement)', async () => {
    const text = await resp.page.locator('main').innerText();
    ok(/sans seuil/.test(text) && text.includes(`${M} épuisé sans seuil`), 'aucun avis pour l\'article épuisé sans seuil');
  }, resp.page);

  /* ============ C4 Accueil ============ */
  group = 'C4 Accueil';
  await step('C4-chiffres', 'Accueil : Consommables, Sous le seuil, Outils et Véhicules = la base', async () => {
    await resp.page.goto(`${BASE}/`); await resp.page.waitForSelector('nav[aria-label="Navigation principale"]'); await resp.page.waitForTimeout(3000);
    const text = await resp.page.locator('main').innerText();
    const read = label => { const m = text.match(new RegExp(`${label}\\s*\\n\\s*(\\d[\\d'’ ]*)`)); return m ? Number(m[1].replace(/\D/g, '')) : null; };
    const got = { consommables: read('Consommables'), seuil: read('Sous le seuil'), outils: read('Outils'), vehicules: read('Véhicules') };
    const want = { consommables: T.live.length, seuil: T.lowRows.length, outils: T.tools.length, vehicules: T.vehicles.length };
    const bad = Object.keys(want).filter(k => got[k] !== want[k]).map(k => `${k} : écran ${got[k]} ≠ base ${want[k]}`);
    ok(bad.length === 0, bad.join(' ; '));
  }, resp.page);

  /* ============ C5 Pastille ============ */
  group = 'C5 Pastille de notifications';
  for (const c of all) {
    await step(`C5-${c.who}`, `${c.who} : la pastille = le nombre de non lues de la base`, async () => {
      await c.page.goto(`${BASE}/`); await c.page.waitForSelector('nav[aria-label="Navigation principale"]'); await c.page.waitForTimeout(2500);
      const n = Number((await rpc(c, 'unread_notification_count')).body);
      const label = (await c.page.locator('header a[aria-label^="Notifications"]').first().getAttribute('aria-label')) || '';
      const m = label.match(/(\d+)\s+alerte/); const shown = m ? Number(m[1]) : 0;
      ok(shown === n, `pastille ${shown} ≠ base ${n}`);
    }, c.page);
  }

  /* ============ C6 Données à jour sans recharger ============ */
  group = 'C6 Mise à jour sans recharger';
  await step('C6-stock', 'Un stock modifié dans la base apparaît sur l\'écran Consommables en moins de 90 secondes, sans recharger', async () => {
    await resp.page.goto(`${BASE}/consommables`); await resp.page.waitForSelector('nav[aria-label="Navigation principale"]'); await resp.page.waitForTimeout(2500);
    const extra = await mk('apparu pendant la session'); const r = await rpc(resp, 'receive_stock', { p_equipment_id: extra.id, p_depot_id: S.depot, p_quantity: 4, p_notes: M }); ok(!refused(r), msg(r));
    let seen = false;
    for (let i = 0; i < 18 && !seen; i++) { await resp.page.waitForTimeout(5000); seen = (await resp.page.locator('main').innerText()).toUpperCase().includes(`${M} APPARU PENDANT LA SESSION`.toUpperCase()); }
    ok(seen, 'l\'article créé pendant la session n\'est pas apparu après 90 secondes');
  }, resp.page);

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  let retired = 0;
  for (const id of made) { const p = await api(resp, 'PATCH', `/rest/v1/equipment?id=eq.${id}`, { status: 'retired' }); if (!refused(p)) retired++; }

  await browser.close();

  const n = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport de cohérence des chiffres', '',
    `Base : GO-MAT · comptes : ${ACCOUNTS.resp}, ${ACCOUNTS.collab} · date : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, 'Commit testé : à renseigner (`git log --oneline -1`).', '',
    `**Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO**`, '',
    `Nettoyage : ${retired} article(s) de test retiré(s) du service (ils ne s'affichent plus).`, '',
    '## À corriger (KO et PARTIEL)', '', ...(results.filter(r => ['KO', 'PARTIEL'].includes(r.status)).map(r => `- **${r.status}** ${r.id} — ${r.title} : ${r.detail}${r.shot ? ` ([capture](${r.shot}))` : ''}`)), ...(results.some(r => ['KO', 'PARTIEL'].includes(r.status)) ? [] : ['Aucun.']), '',
    ...groups.flatMap(g => ['', `## ${g}`, '', '| Point | Verdict | Détail |', '|---|---|---|', ...results.filter(r => r.group === g).map(r => `| ${r.id} — ${r.title.replace(/\|/g, '/')} | ${r.status} | ${r.detail.replace(/\|/g, '/').replace(/\n/g, ' ')} |`)]),
    '', '## Erreurs JavaScript', '', jsErrors.length ? [...new Set(jsErrors)].slice(0, 20).map(e => `- ${e}`).join('\n') : 'Aucune.', '',
  ];
  fs.writeFileSync(REPORT, md.join('\n'));
  console.log(`\nRapport : ${path.relative(process.cwd(), REPORT)}`);
  console.log(`Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO`);
  process.exit(n('KO') ? 1 : 0);
})();
