#!/usr/bin/env node
// Notifications : « lu / non lu » propre à chaque personne, pastille, page Notifications, avis du collaborateur.
// Trois comptes jouent en même temps (collaborateur, magasinier, responsable) pour vérifier qu'un « lu » ne déborde pas
// sur les autres et que le chiffre de la pastille est le même partout.
//
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/e2e-notifications.cjs
//
// Prérequis : migration 37 appliquée. Comptes (adresses) : E2E_COLLAB, E2E_STAFF, E2E_RESP ; par défaut
// test.collaborateur@example.com, test.magasinier@example.com, test.responsable@example.com.
// Le mot de passe se donne UNIQUEMENT par E2E_PASSWORD. Les notifications créées portent « TEST-NOTIF » ;
// elles ne peuvent pas être supprimées par ces comptes : à la fin elles sont marquées lues pour chacun.
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
const SHOTS = path.join(OUT_DIR, 'captures-notifications');
const REPORT = path.join(OUT_DIR, 'rapport-notifications.md');
fs.mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const M = 'TEST-NOTIF';
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
  if (page && ['KO', 'PARTIEL'].includes(e.status)) { const f = `${id.replace(/[^\w-]/g, '_')}.png`; try { await page.screenshot({ path: path.join(SHOTS, f) }); e.shot = `captures-notifications/${f}`; } catch { /* page fermée */ } }
  console.log(`${e.status.padEnd(11)} ${id}  ${title}${e.detail ? ' — ' + e.detail.slice(0, 170) : ''}`);
  results.push(e);
}

(async () => {
  const browser = await chromium.launch();
  const collab = await login(browser, 'collab');
  const staff = await login(browser, 'staff');
  const resp = await login(browser, 'resp');
  const all = [collab, staff, resp];
  const me = {};
  for (const c of all) me[c.who] = (await rpc(c, 'whoami')).body || {};
  S.collabId = me.collab.id; S.staffId = me.staff.id; S.respId = me.resp.id;

  /* ---------- outils de scénario ---------- */
  const list = async (c, limit = 500) => rows(await rpc(c, 'my_notifications', { p_limit: limit }));
  const mine = async c => (await list(c)).filter(n => (n.message || '').includes(M));
  const count = async c => Number((await rpc(c, 'unread_notification_count')).body);
  const unreadTest = async c => (await mine(c)).filter(n => !n.is_read).length;
  // Les dates « envoyé » sont posées d'avance : ni e-mail, ni notification push, ni SMS ne partent pour ces avis de test
  const post = async (c, row) => { const now = new Date().toISOString(); return api(c, 'POST', '/rest/v1/notifications?select=id', { title: `${M} ${row.title || 'avis'}`, ...row, message: `${M} ${row.message}`, emailed_at: now, pushed_at: now, sms_sent_at: now }, { Prefer: 'return=representation' }); };
  const bell = async c => {
    const l = c.page.locator('header a[aria-label^="Notifications"]').first();
    const label = (await l.getAttribute('aria-label')) || '';
    const m = label.match(/(\d+)\s+alerte/);
    return m ? Number(m[1]) : 0;
  };
  const reload = async (c, url) => { await c.page.goto(`${BASE}${url}`); await c.page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 }); await c.page.waitForTimeout(2500); };

  /* ============ N1 Visibilité ============ */
  group = 'N1 Qui voit quoi';
  await step('N1-creation', 'Création de 3 notifications de test : une pour le magasin, une pour le collaborateur, une pour le magasinier', async () => {
    const a = await post(staff, { kind: 'low_stock', message: 'alerte du magasin', recipient_user_id: null });
    const b = await post(staff, { kind: 'request_ready', message: 'avis du collaborateur', recipient_user_id: S.collabId });
    const d = await post(resp, { kind: 'return_reminder', message: 'avis du magasinier', recipient_user_id: S.staffId });
    ok(!refused(a), `alerte du magasin refusée : ${msg(a)}`); ok(!refused(b), `avis collaborateur refusé : ${msg(b)}`); ok(!refused(d), `avis magasinier refusé : ${msg(d)}`);
    S.n1 = rows(a)[0]?.id; S.nCollab = rows(b)[0]?.id; S.nStaff = rows(d)[0]?.id;
    ok(S.n1 && S.nCollab && S.nStaff, 'identifiants non renvoyés');
  });
  await step('N1-collab', 'Collaborateur : voit son avis, pas l\'alerte du magasin ni l\'avis du magasinier', async () => {
    const l = await mine(collab);
    ok(l.some(n => n.id === S.nCollab), 'son avis est absent');
    ok(!l.some(n => n.id === S.n1), 'il voit l\'alerte du magasin');
    ok(!l.some(n => n.id === S.nStaff), 'il voit l\'avis d\'un autre');
  });
  await step('N1-staff', 'Magasinier : voit l\'alerte du magasin et son avis, pas l\'avis du collaborateur', async () => {
    const l = await mine(staff);
    ok(l.some(n => n.id === S.n1), 'l\'alerte du magasin est absente');
    ok(l.some(n => n.id === S.nStaff), 'son avis est absent');
    ok(!l.some(n => n.id === S.nCollab), 'il voit l\'avis du collaborateur');
  });
  await step('N1-resp', 'Responsable : voit l\'alerte du magasin, pas les avis personnels des autres', async () => {
    const l = await mine(resp);
    ok(l.some(n => n.id === S.n1), 'l\'alerte du magasin est absente');
    ok(!l.some(n => n.id === S.nStaff) && !l.some(n => n.id === S.nCollab), 'il voit un avis personnel d\'un autre');
  });
  await step('N1-anonyme', 'Visiteur sans connexion : aucune fonction de notification', async () => {
    const r = await api(staff, 'POST', '/rest/v1/rpc/my_notifications', {}, {}, true);
    ok(refused(r) || (Array.isArray(r.body) && r.body.length === 0), `réponse ${r.status} avec ${Array.isArray(r.body) ? r.body.length : '?'} ligne(s)`);
    const c = await api(staff, 'POST', '/rest/v1/rpc/mark_all_notifications_read', {}, {}, true);
    ok(refused(c), `« tout marquer comme lu » accepté sans connexion (HTTP ${c.status})`);
  });

  /* ============ N2 Compteur ============ */
  group = 'N2 Compteur';
  for (const c of all) {
    await step(`N2-${c.who}`, `${c.who} : le compteur est égal au nombre de non lues de la liste`, async () => {
      const l = await list(c, 500); const unread = l.filter(n => !n.is_read).length; const n = await count(c);
      if (l.length >= 500) return INFO(`liste limitée à 500 : compteur ${n}, non lues vues ${unread}`);
      ok(n === unread, `compteur ${n} ≠ ${unread} non lues dans la liste`);
    });
  }

  /* ============ N3 Un « lu » ne déborde pas ============ */
  group = 'N3 Lu par personne';
  await step('N3-staff-lit', 'Magasinier : lit l\'alerte du magasin (son compteur baisse de 1)', async () => {
    const before = await count(staff);
    const r = await rpc(staff, 'mark_notifications_read', { p_ids: [S.n1] }); ok(!refused(r), msg(r));
    const after = await count(staff); ok(after === before - 1, `compteur ${before} → ${after}`);
    const n = (await mine(staff)).find(x => x.id === S.n1); ok(n && n.is_read, 'toujours non lue dans la liste');
  });
  await step('N3-resp-inchange', 'Responsable : l\'alerte lue par le magasinier reste NON lue pour lui', async () => {
    const n = (await mine(resp)).find(x => x.id === S.n1); ok(n, 'alerte absente'); ok(!n.is_read, 'elle est lue pour le responsable : le « lu » est partagé');
  });
  await step('N3-non-lue', 'Magasinier : remet l\'alerte en « non lue » (compteur +1)', async () => {
    const before = await count(staff);
    const r = await rpc(staff, 'mark_notification_unread', { p_id: S.n1 }); ok(!refused(r), msg(r));
    const after = await count(staff); ok(after === before + 1, `compteur ${before} → ${after}`);
  });
  await step('N3-collab-hors-perimetre', 'Collaborateur : ne peut ni lire ni modifier l\'alerte du magasin ni l\'avis d\'un autre', async () => {
    const a = await rpc(collab, 'mark_notifications_read', { p_ids: [S.n1, S.nStaff] });
    ok(!refused(a) ? Number(a.body) === 0 : true, `${a.body} ligne(s) modifiée(s)`);
    const b = await rpc(collab, 'mark_notification_unread', { p_id: S.n1 }); ok(refused(b) || Number(b.body) === 0, 'remise en non lue acceptée');
    const direct = await api(collab, 'GET', `/rest/v1/notification_reads?select=*`); ok(refused(direct) || rows(direct).every(x => x.user_id === S.collabId), 'il lit les lignes de lecture d\'un autre');
  });
  await step('N3-lignes-privees', 'Chacun ne lit que ses propres lignes de lecture', async () => {
    await rpc(resp, 'mark_notifications_read', { p_ids: [S.n1] });
    const a = rows(await api(staff, 'GET', '/rest/v1/notification_reads?select=user_id')); const b = rows(await api(resp, 'GET', '/rest/v1/notification_reads?select=user_id'));
    ok(a.every(x => x.user_id === S.staffId), 'le magasinier lit les lignes d\'un autre');
    ok(b.every(x => x.user_id === S.respId), 'le responsable lit les lignes d\'un autre');
  });
  await step('N3-tout-lire', 'Collaborateur : « tout marquer comme lu » vide son compteur sans toucher aux autres', async () => {
    const staffBefore = await count(staff);
    const r = await rpc(collab, 'mark_all_notifications_read'); ok(!refused(r), msg(r));
    ok((await count(collab)) === 0, `compteur collaborateur ${await count(collab)}`);
    ok((await count(staff)) === staffBefore, 'le compteur du magasinier a changé');
  });
  await step('N3-nouvelle', 'Une nouvelle notification fait remonter le compteur de 1', async () => {
    const before = await count(collab);
    const p = await post(staff, { kind: 'request_approved', message: 'deuxième avis du collaborateur', recipient_user_id: S.collabId }); ok(!refused(p), msg(p));
    ok((await count(collab)) === before + 1, `compteur ${before} → ${await count(collab)}`);
  });

  /* ============ N4 Interface : magasinier ============ */
  group = 'N4 Pastille et page (magasinier)';
  await step('N4-pastille', 'La pastille du menu et la cloche affichent le compteur de la base', async () => {
    await reload(staff, '/notifications');
    const n = await count(staff); const b = await bell(staff);
    ok(b === n, `cloche ${b} ≠ base ${n}`);
    const side = staff.page.locator('nav[aria-label="Navigation principale"] span.bg-danger-600').first();
    if (n > 0) { const t = ((await side.innerText().catch(() => '')) || '').trim(); ok(t === (n > 99 ? '99+' : String(n)), `pastille du menu « ${t || 'absente'} » ≠ ${n}`); }
  }, staff.page);
  await step('N4-page', 'La page affiche « Non lues (n) » avec le même n', async () => {
    const n = await count(staff);
    const t = await staff.page.locator('body').innerText();   // les filtres sont dans l'en-tête du module, pas dans <main>
    const m = t.match(/Non lues \((\d+)\)/); ok(m, '« Non lues (n) » introuvable');
    ok(Number(m[1]) === n, `page ${m[1]} ≠ base ${n}`);
  }, staff.page);
  await step('N4-menu-lire', 'Menu d\'une carte : « Marquer comme lue » baisse la pastille de 1 et reste sur la page', async () => {
    const card = staff.page.locator('[role="button"]').filter({ hasText: 'TEST-NOTIF' }).filter({ hasText: 'Non lue' }).first();
    if (!(await card.count())) return SKIP('aucune carte de test « Non lue » affichée');
    const before = await bell(staff);
    await card.locator('button[aria-haspopup="menu"]').click();
    await staff.page.getByRole('menuitem', { name: /Marquer comme lue/ }).first().click();
    await staff.page.waitForTimeout(1500);
    ok(new URL(staff.page.url()).pathname === '/notifications', `la page a changé : ${staff.page.url()}`);
    const after = await bell(staff); ok(after === before - 1, `pastille ${before} → ${after}`);
  }, staff.page);
  await step('N4-persistant', 'Après rechargement, la pastille garde sa valeur (le « lu » est enregistré)', async () => {
    const before = await bell(staff);
    await reload(staff, '/notifications');
    const after = await bell(staff); ok(after === before, `pastille ${before} → ${after} après rechargement`);
    ok(after === await count(staff), 'la pastille ne correspond pas à la base');
  }, staff.page);
  await step('N4-actualiser', 'Une nouvelle alerte apparaît avec « Actualiser », sans recharger la page', async () => {
    const before = await bell(staff);
    const p = await post(resp, { kind: 'low_stock', message: 'alerte arrivée pendant la session', recipient_user_id: null }); ok(!refused(p), msg(p));
    await staff.page.getByRole('button', { name: /Actualiser/ }).click(); await staff.page.waitForTimeout(2000);
    const after = await bell(staff); ok(after === before + 1, `pastille ${before} → ${after}`);
  }, staff.page);
  await step('N4-filtre-non-lues', 'Filtre « Non lues » : n\'affiche que des cartes « Non lue »', async () => {
    await staff.page.getByRole('radio', { name: /Non lues/ }).click().catch(async () => { await staff.page.getByText(/Non lues \(/).first().click(); });
    await staff.page.waitForTimeout(800);
    const t = await staff.page.locator('main').innerText();
    ok(!/\bLue\b/.test(t.replace(/Non lue/g, '')), 'une carte « Lue » est affichée dans « Non lues »');
  }, staff.page);
  await step('N4-tout-lire', '« Tout marquer comme lu » : pastille à zéro, enregistré après rechargement', async () => {
    await staff.page.getByRole('button', { name: 'Tout marquer comme lu' }).click(); await staff.page.waitForTimeout(1800);
    ok((await bell(staff)) === 0, `pastille ${await bell(staff)} après « tout lire »`);
    await reload(staff, '/notifications');
    ok((await bell(staff)) === 0 && (await count(staff)) === 0, `après rechargement : pastille ${await bell(staff)}, base ${await count(staff)}`);
  }, staff.page);
  await step('N4-resp-inchange', 'Le « tout lire » du magasinier n\'a pas vidé la pastille du responsable', async () => {
    const n = await count(resp);
    if (n === 0) return INFO('le responsable n\'avait rien de non lu : indépendance non démontrable ici');
    await reload(resp, '/notifications'); ok((await bell(resp)) === n, `pastille ${await bell(resp)} ≠ base ${n}`);
  }, resp.page);

  /* ============ N5 Interface : collaborateur ============ */
  group = 'N5 Avis du collaborateur';
  await step('N5-pastille', 'Collaborateur : la cloche affiche le compteur de la base', async () => {
    await reload(collab, '/shop?vue=commandes');
    const n = await count(collab); const b = await bell(collab); ok(b === n, `cloche ${b} ≠ base ${n}`);
  }, collab.page);
  await step('N5-ok', 'Collaborateur : « OK » sur un avis le lit (pastille −1, enregistré après rechargement)', async () => {
    const before = await bell(collab);
    if (before === 0) return SKIP('aucun avis non lu à acquitter');
    const btn = collab.page.getByRole('list', { name: 'Avis sur mes demandes' }).getByRole('button', { name: 'OK' }).first();
    ok(await btn.count(), 'bouton « OK » introuvable alors que la pastille est non nulle');
    await btn.click(); await collab.page.waitForTimeout(1500);
    const after = await bell(collab); ok(after === before - 1, `pastille ${before} → ${after}`);
    await reload(collab, '/shop?vue=commandes'); ok((await bell(collab)) === after, 'le « lu » n\'est pas conservé après rechargement');
  }, collab.page);
  await step('N5-pas-de-page', 'Collaborateur : pas d\'accès à la page Notifications du magasin', async () => {
    await collab.page.goto(`${BASE}/notifications`); await collab.page.waitForTimeout(2000);
    ok(new URL(collab.page.url()).pathname !== '/notifications' || !/Tout marquer comme lu/.test(await collab.page.locator('main').innerText()), 'la page du magasin est accessible au collaborateur');
  }, collab.page);

  /* ============ Nettoyage ============ */
  group = 'Nettoyage';
  const clean = { read: 0 };
  try {
    for (const c of all) {
      const r = await rpc(c, 'mark_all_notifications_read'); if (!refused(r)) clean.read += Number(r.body) || 0;
    }
  } catch (e) { clean.err = e.message; }

  await browser.close();

  /* ============ Rapport ============ */
  const n = k => results.filter(r => r.status === k).length;
  const groups = [...new Set(results.map(r => r.group))];
  const md = [
    '# Rapport des tests des notifications', '',
    `Base : GO-MAT · comptes : ${Object.values(ACCOUNTS).join(', ')} · date : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, 'Commit testé : à renseigner (`git log --oneline -1`).', '',
    `**Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO**`, '',
    `Nettoyage : ${clean.read} notification(s) marquée(s) lue(s) pour les trois comptes (les notifications « ${M} » restent en base : ces comptes ne peuvent pas les supprimer)${clean.err ? `. Erreur : ${clean.err}` : ''}.`, '',
    '## À corriger (KO et PARTIEL)', '', ...(results.filter(r => ['KO', 'PARTIEL'].includes(r.status)).map(r => `- **${r.status}** ${r.id} — ${r.title} : ${r.detail}${r.shot ? ` ([capture](${r.shot}))` : ''}`)), ...(results.some(r => ['KO', 'PARTIEL'].includes(r.status)) ? [] : ['Aucun.']), '',
    '## Observations (INFO / NON TESTÉ)', '', ...results.filter(r => ['INFO', 'NON TESTÉ'].includes(r.status)).map(r => `- **${r.id}** — ${r.title} : ${r.detail}`), '',
    ...groups.flatMap(g => ['', `## ${g}`, '', '| Point | Verdict | Détail |', '|---|---|---|', ...results.filter(r => r.group === g).map(r => `| ${r.id} — ${r.title.replace(/\|/g, '/')} | ${r.status} | ${r.detail.replace(/\|/g, '/').replace(/\n/g, ' ')} |`)]),
    '', '## Erreurs JavaScript', '', jsErrors.length ? [...new Set(jsErrors)].slice(0, 20).map(e => `- ${e}`).join('\n') : 'Aucune.', '',
  ];
  fs.writeFileSync(REPORT, md.join('\n'));
  console.log(`\nRapport : ${path.relative(process.cwd(), REPORT)}`);
  console.log(`Synthèse : ${n('OK')} OK · ${n('PARTIEL')} PARTIEL · ${n('KO')} KO · ${n('NON TESTÉ')} NON TESTÉ · ${n('INFO')} INFO`);
  process.exit(n('KO') ? 1 : 0);
})();
