// Modifications groupées, annuler, raccourcis clavier et historique d'une fiche PILOTE — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Se lance avec : node scripts/run-pilote-e2e.cjs
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:5197';
const ME = 'aaaaaaaa-0000-0000-0000-000000000001', OTHER = 'aaaaaaaa-0000-0000-0000-000000000002';
const P1 = '11111111-0000-0000-0000-000000000001', I1 = '22222222-0000-0000-0000-000000000001', I2 = '22222222-0000-0000-0000-000000000002';
const ST = '33333333-0000-0000-0000-000000000001';
const ORG = '44444444-0000-0000-0000-000000000001';
const profile = { id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', permissions: ['view_all', 'scan', 'approve', 'manage_stock', 'settings', 'manage_users'], depot_ids: [], organization: { id: ORG, name: 'Org' }, organizations: [], modules: ['cp.projects', 'cp.planning', 'logistics'], platform_admin: true };
const now = new Date().toISOString();
const notif = (id, kind, title, message, extra = {}) => ({ id, kind, title, message, equipment_id: null, depot_id: null, request_id: null, vehicle_id: null, recipient_user_id: ME, created_at: now, is_read: false, cp_project_id: null, cp_item_id: null, ...extra });
const NOTIFS = [
  notif('n1', 'cp_assigned', 'Tâche assignée', 'On t\'a assigné la tâche « Tâche Un » du projet « Projet Alpha »', { cp_project_id: P1, cp_item_id: I1 }),
  notif('n2', 'cp_comment', 'Nouveau message', 'Nouveau message sur « Tâche Un »', { cp_project_id: P1, cp_item_id: I1 }),
  notif('n3', 'cp_team_added', 'Ajouté à l\'équipe', 'Tu as été ajouté à l\'équipe du projet « Projet Alpha » comme membre', { cp_project_id: P1 }),
  notif('n4', 'cp_comment', 'Nouveau message', 'Nouveau message sur le projet « Projet Alpha »', { cp_project_id: P1 }),
  notif('n5', 'cp_assigned', 'Ancienne assignation', 'Avis antérieur à la migration 61 (sans lien)'),
  notif('n6', 'cp_overdue', 'Tâche en retard', 'Tâche Deux est en retard', { cp_project_id: P1, cp_item_id: '99999999-0000-0000-0000-000000000009' }),
];

const day = (n) => { const d = new Date(new Date('2026-11-07T10:00:00+01:00').getTime() + n * 86400000); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(d); };
const ST0 = '33333333-0000-0000-0000-000000000001', ST1 = '33333333-0000-0000-0000-000000000002', ST2 = '33333333-0000-0000-0000-000000000003';
const P2 = '11111111-0000-0000-0000-000000000002';
const base = { organization_id: ORG, priority: null, color: '#6366f1', description: null, site_id: null, link_mode: 'overlap', link_skip_weekends: true, created_at: now, updated_at: now };
const it = (id, project_id, name, status_id, s, e, extra = {}) => ({ ...base, id, project_id, parent_id: null, kind: 'task', name, position: 1, starts_on: day(s), ends_on: day(e), status_id, version: 1, ...extra });
const TABLES = {
  cp_statuses: [{ id: ST0, name: 'Pas commencé', family: 'not_started', color: '#999999', position: 0, is_system: true }, { id: ST1, name: 'En cours', family: 'in_progress', color: '#3b82f6', position: 1, is_system: true }, { id: ST2, name: 'Terminé', family: 'done', color: '#10b981', position: 2, is_system: true }],
  cp_projects: [{ ...base, id: P1, type: 'site', name: 'Projet Alpha', status_id: ST1, starts_on: day(-10), ends_on: day(20) }, { ...base, id: P2, type: 'rd', name: 'Projet Beta', status_id: ST1, starts_on: day(-8), ends_on: day(15) }],
  cp_project_members: [{ project_id: P1, user_id: ME, role: 'lead' }, { project_id: P2, user_id: OTHER, role: 'lead' }],
  sites: [],
  cp_items: [
    it(I1, P1, 'Montage scène', ST1, -9, -3, { priority: 'high' }),          // EN RETARD, assignée à ME
    it(I2, P1, 'Réglage lumière', ST0, 2, 9),                                  // à venir
    it('22222222-0000-0000-0000-000000000003', P1, 'Livraison faite', ST2, -9, -5),   // passée mais terminée
    it('22222222-0000-0000-0000-000000000004', P2, 'Prototype boîtier', ST1, -7, -1, { priority: 'low' }),  // EN RETARD, assignée à OTHER
  ],
  cp_item_members: [{ item_id: I1, user_id: ME }, { item_id: '22222222-0000-0000-0000-000000000004', user_id: OTHER }],
  cp_item_links: [], cp_item_checks: [], cp_comments: [], cp_documents: [],
  platform_modules: [{ key: 'cp.projects', label: 'Projets', description: 'x', position: 1 }],
  users: [{ id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', active: true }, { id: OTHER, first_name: 'Autre', last_name: 'Personne', email: 'a@p.test', role: 'user', active: true }],
};
const RPC = { whoami: profile, my_notifications: [], unread_notification_count: 0, rbac_has_any_permission: true, cp_can_discuss: true, my_cp_notification_prefs: [] };
const filt = (rows, url) => { let out = rows; for (const [k, v] of url.searchParams) { if (['select', 'order', 'limit', 'offset'].includes(k)) continue; if (v === 'is.null') out = out.filter(r => r[k] == null); else if (v.startsWith('eq.')) out = out.filter(r => String(r[k]) === v.slice(3)); } return out; };
(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'fr-CH' });
  const sess = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 't@r.test', app_metadata: {}, user_metadata: {}, created_at: now } };
  await ctx.addInitScript(s => { try { if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(s)); } catch {} }, sess);
  await ctx.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));
  const rpcCalls = []; const writes = []; const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) { const fn = path.split('/').pop(); const args = req.postData() ? req.postDataJSON() : {}; rpcCalls.push({ fn, args }); if (fn === 'cp_history') return json([{ at: '2026-11-05T09:30:00Z', who: 'Ana Test', action: 'update', changes: { name: ['Montage', 'Montage scène'], status_id: ['33333333-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002'], ends_on: ['2026-11-05', '2026-11-06'] } }, { at: '2026-11-02T08:00:00Z', who: 'Ana Test', action: 'insert', changes: { name: 'Montage' } }]); return json(fn in RPC ? RPC[fn] : null); }
    if (path.startsWith('/rest/v1/')) { const table = path.split('/').pop(); if (req.method() !== 'GET') { if (req.method() === 'DELETE') { const raw = url.searchParams.get('id') || ''; const ids = raw.startsWith('in.(') ? raw.slice(4, -1).split(',') : [raw.slice(3)]; writes.push({ table, method: 'DELETE', ids }); TABLES[table] = (TABLES[table] || []).filter(r => !ids.includes(r.id)); return json(ids.map(id => ({ id }))); } if (table === 'cp_item_members' && req.method() === 'POST') { writes.push({ table, method: 'POST', body: req.postDataJSON(), query: url.search, prefer: req.headers()['prefer'] }); return route.fulfill({ status: 204, body: '' }); } if (req.method() === 'PATCH' && (url.searchParams.get('id') || '').startsWith('in.(')) { const ids = url.searchParams.get('id').slice(4, -1).split(','); const body = req.postDataJSON(); writes.push({ table, method: 'PATCH', ids, body }); for (const id of ids) { const row = (TABLES[table] || []).find(r => r.id === id); if (row) Object.assign(row, body); } return json(ids.map(id => ({ id }))); } if (req.method() === 'PATCH') { const id = (url.searchParams.get('id') || '').slice(3); const body = req.postDataJSON(); writes.push({ table, id, body }); const row = (TABLES[table] || []).find(r => r.id === id); if (row) { Object.assign(row, body, { updated_at: new Date().toISOString() }); return json([{ id }]); } return json([]); } return route.fulfill({ status: 204, body: '' }); } const rows = filt(TABLES[table] || [], url); return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows); }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };


  const viewButton = () => page.getByRole('button', { name: /^Vue : / });
  const goView = async (name) => { const b = viewButton(); await b.waitFor({ timeout: 25000 }); await b.click(); await page.getByRole('menuitemradio', { name }).click(); };
  const viewItems = async () => { await viewButton().click(); const t = await page.getByRole('menuitemradio').allInnerTexts(); await page.keyboard.press('Escape'); return t.map(s => s.replace(/\s+/g, ' ').trim()); };
  const viewLabel = async () => { const b = viewButton(); await b.waitFor({ timeout: 25000 }); return ((await b.getAttribute('aria-label')) || '').replace(/^Vue : /, '').replace(/\. Changer de vue$/, ''); };
  const goBoard = async () => { await page.goto(BASE + '/pilote/projets'); await goView('Tableau'); await page.waitForSelector('[data-card]', { timeout: 15000 }); await page.waitForTimeout(400); };
  const colOf = (name) => page.getByRole('listitem', { name: new RegExp('^' + name) });
  const cardNames = async (col) => (await col.locator('article button[title]').allInnerTexts()).map(s => s.trim());
  const A = '22222222-0000-0000-0000-000000000001', B = '22222222-0000-0000-0000-000000000004', R = '22222222-0000-0000-0000-000000000002';
  const ST1 = '33333333-0000-0000-0000-000000000002', ST2 = '33333333-0000-0000-0000-000000000003';

  await goBoard();
  // sélection
  check('1 pas de barre groupée sans sélection', (await page.locator('[data-bulk-bar]').count()) === 0);
  await page.getByLabel('Sélectionner « Montage scène »').check(); await page.getByLabel('Sélectionner « Prototype boîtier »').check();
  check('2 la barre annonce « 2 sélectionnées »', /2 sélectionnées/.test(await page.locator('[data-bulk-bar]').innerText()));
  // état groupé
  await page.getByRole('button', { name: "Changer l'état" }).click(); await page.getByRole('menuitemradio', { name: 'Terminé' }).click(); await page.waitForTimeout(900);
  const w1 = writes.find(w => w.method === 'PATCH' && w.ids);
  check('3 une seule requête pour les 2 cartes, avec le nouvel état', w1 && w1.table === 'cp_items' && w1.ids.length === 2 && w1.ids.includes(A) && w1.ids.includes(B) && w1.body.status_id === ST2, JSON.stringify(w1));
  check('4 les cartes sont dans « Terminé » et la sélection est vidée', (await cardNames(colOf('Terminé'))).length === 3 && (await page.locator('[data-bulk-bar]').count()) === 0);
  // annuler par le bouton de la notification
  await page.getByRole('button', { name: 'Annuler', exact: true }).first().click(); await page.waitForTimeout(900);
  const w2 = writes.filter(w => w.method === 'PATCH' && w.ids)[1];
  check('5 « Annuler » remet l\'état d\'origine (En cours) sur les 2 cartes, en une requête', w2 && w2.ids.length === 2 && w2.body.status_id === ST1, JSON.stringify(w2));
  check('6 les cartes sont revenues dans « En cours »', (await cardNames(colOf('En cours'))).length === 2);
  // priorité groupée
  await page.getByLabel('Sélectionner « Montage scène »').check(); await page.getByLabel('Sélectionner « Réglage lumière »').check();
  await page.getByRole('button', { name: 'Changer la priorité' }).click(); await page.getByRole('menuitem', { name: 'Basse' }).or(page.getByRole('menuitemradio', { name: 'Basse' })).click(); await page.waitForTimeout(900);
  const w3 = writes.filter(w => w.method === 'PATCH' && w.ids).pop();
  check('7 priorité « Basse » envoyée pour les 2 cartes', w3 && w3.body.priority === 'low' && w3.ids.length === 2, JSON.stringify(w3));
  // Ctrl+Z annule
  await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
  const undone = writes.filter(w => w.method === 'PATCH' && w.ids).length;
  check('8 Ctrl+Z annule la dernière action (plusieurs valeurs d\'origine = plusieurs requêtes)', undone >= 5, String(undone));
  // assigner
  await page.getByLabel('Sélectionner « Réglage lumière »').check();
  await page.getByRole('button', { name: 'Assigner à' }).click(); await page.getByRole('menuitemradio', { name: 'Autre Personne' }).or(page.getByRole('menuitem', { name: 'Autre Personne' })).click(); await page.waitForTimeout(900);
  const wa = writes.find(w => w.table === 'cp_item_members' && w.method === 'POST');
  check('9 l\'assignation envoie (élément, personne) avec « on_conflict » et « ignore-duplicates »', wa && wa.body.length === 1 && wa.body[0].item_id === R && wa.body[0].user_id === 'aaaaaaaa-0000-0000-0000-000000000002' && /on_conflict=item_id(%2C|,)user_id/.test(wa.query) && /ignore-duplicates/.test(wa.prefer || ''), JSON.stringify(wa));
  // décaler
  await page.getByLabel('Sélectionner « Montage scène »').check();
  await page.getByRole('button', { name: 'Décaler…' }).click(); await page.getByRole('dialog').getByRole('textbox').fill('2'); await page.getByRole('button', { name: 'Valider' }).click(); await page.waitForTimeout(900);
  const sh = rpcCalls.filter(c => c.fn === 'cp_shift_item');
  check('10 décaler de 2 jours appelle la base pour la carte choisie', sh.length === 1 && sh[0].args.p_days === 2 && sh[0].args.p_item_id === A, JSON.stringify(sh));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
  const sh2 = rpcCalls.filter(c => c.fn === 'cp_shift_item');
  check('11 Ctrl+Z décale dans l\'autre sens (−2)', sh2.length === 2 && sh2[1].args.p_days === -2, JSON.stringify(sh2));
  // supprimer
  await page.getByLabel('Sélectionner « Livraison faite »').check();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click(); await page.getByRole('button', { name: 'Confirmer' }).click(); await page.waitForTimeout(900);
  const del = writes.find(w => w.method === 'DELETE');
  check('12 suppression groupée après confirmation (une requête sur la liste)', del && del.table === 'cp_items' && del.ids.length === 1 && del.ids[0] === '22222222-0000-0000-0000-000000000003', JSON.stringify(del));

  // raccourcis
  await page.mouse.click(5, 5); await page.keyboard.press('/'); await page.waitForTimeout(200);
  check('13 « / » met le curseur dans la recherche', await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('type') === 'search'));
  await page.keyboard.type('nnn'); await page.waitForTimeout(300);
  check('14 taper « n » dans un champ n\'ouvre pas de fiche', (await page.locator('#itm-name').count()) === 0 && (await page.getByPlaceholder('Rechercher').inputValue()) === 'nnn');
  await page.getByPlaceholder('Rechercher').fill(''); await page.mouse.click(5, 5);
  await page.keyboard.press('n'); await page.waitForSelector('#itm-name', { timeout: 5000 });
  check('15 « n » ouvre la fiche d\'une nouvelle tâche', true);
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  check('16 les raccourcis sont inactifs quand une fiche est ouverte (« ? » n\'ouvre pas l\'aide)', (await page.getByRole('dialog', { name: 'Raccourcis clavier' }).count()) === 0);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.mouse.click(5, 5); await page.keyboard.press('?'); await page.waitForTimeout(300);
  const help = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ');
  check('17 « ? » ouvre l\'aide des raccourcis (Chercher, Nouvelle tâche, Annuler, Afficher cette aide)', /Chercher/.test(help) && /Nouvelle tâche/.test(help) && /Ctrl\+Z/.test(help) && /Afficher cette aide/.test(help), help);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.mouse.click(5, 5); await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
  check('18 Ctrl+Z sans action à défaire : « Rien à annuler »', (await page.getByText('Rien à annuler').count()) >= 1);

  // historique d'une fiche
  await page.getByRole('button', { name: 'Montage scène', exact: true }).first().click(); await page.waitForSelector('#itm-name', { timeout: 10000 });
  const hdr = page.getByRole('button', { name: 'Historique', exact: true });
  check('19 la section « Historique » est repliée : aucune requête avant l\'ouverture', (await hdr.getAttribute('aria-expanded')) === 'false' && rpcCalls.filter(c => c.fn === 'cp_history').length === 0);
  await hdr.click(); await page.waitForSelector('[data-history]', { timeout: 5000 });
  const hist = (await page.locator('[data-history]').innerText()).replace(/\s+/g, ' ');
  check('20 l\'historique est lu pour l\'élément (type « item » + son identifiant)', rpcCalls.some(c => c.fn === 'cp_history' && c.args.p_kind === 'item' && c.args.p_id === A));
  check('21 l\'historique donne qui, quand, et les changements en clair', /Ana Test/.test(hist) && /05\.11\.2026/.test(hist) && /Nom : Montage → Montage scène/.test(hist) && /État : Pas commencé → En cours/.test(hist) && /Fin : 05\.11\.2026 → 06\.11\.2026/.test(hist) && /Création/.test(hist), hist);
  await page.screenshot({ path: process.argv[2] + '/p12-historique.png' });

  check('22 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
