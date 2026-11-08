// Tableau par état et Calendrier PILOTE — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Lancer (deux terminaux) :
//   1) VITE_SUPABASE_URL=http://mock.supabase.test VITE_SUPABASE_ANON_KEY=k npx vite --port 5197 --host 127.0.0.1
//   2) node scripts/e2e-tableau-calendrier.cjs <dossier des captures>
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
  const writes = []; const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) { const fn = path.split('/').pop(); return json(fn in RPC ? RPC[fn] : null); }
    if (path.startsWith('/rest/v1/')) { const table = path.split('/').pop(); if (req.method() !== 'GET') { if (req.method() === 'PATCH') { const id = (url.searchParams.get('id') || '').slice(3); const body = req.postDataJSON(); writes.push({ table, id, body }); const row = (TABLES[table] || []).find(r => r.id === id); if (row) { Object.assign(row, body, { updated_at: new Date().toISOString() }); return json([{ id }]); } return json([]); } return route.fulfill({ status: 204, body: '' }); } const rows = filt(TABLES[table] || [], url); return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows); }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };

  const viewButton = () => page.getByRole('button', { name: /^Vue : / });
  const selectView = async (name) => { const b = viewButton(); await b.waitFor({ timeout: 25000 }); await b.click(); await page.getByRole('menuitemradio', { name }).click(); await page.waitForTimeout(600); };
  const goView = async (name) => { await page.goto(BASE + '/pilote/projets'); await selectView(name); };
  const colOf = (name) => page.getByRole('listitem', { name: new RegExp('^' + name) });
  const cardNames = async (col) => (await col.locator('article button[title]').allInnerTexts()).map(s => s.trim());

  // ---------- Tableau
  await goView('Tableau');
  check('1 colonnes dans l\'ordre des familles : Pas commencé, En cours, Terminé', JSON.stringify((await page.getByRole('list', { name: 'Colonnes par état' }).locator('header h3').allInnerTexts()).map(s => s.trim())) === JSON.stringify(['Pas commencé', 'En cours', 'Terminé']));
  check('2 « Pas commencé » : Réglage lumière', JSON.stringify(await cardNames(colOf('Pas commencé'))) === JSON.stringify(['Réglage lumière']), JSON.stringify(await cardNames(colOf('Pas commencé'))));
  const en = await cardNames(colOf('En cours'));
  check('3 « En cours » : Montage scène et Prototype boîtier (triés par fin : Montage d\'abord)', JSON.stringify(en) === JSON.stringify(['Montage scène', 'Prototype boîtier']), JSON.stringify(en));
  check('4 les 2 cartes en retard portent l\'icône « En retard »', (await colOf('En cours').locator('svg[aria-label="En retard"]').count()) === 2);
  check('5 la carte montre projet, type et priorité', /Tâche · Projet Alpha/.test(await colOf('En cours').locator('article').first().innerText()) && /Priorité : Haute/.test(await colOf('En cours').locator('article').first().innerText()));
  await page.screenshot({ path: process.argv[2] + '/p4-tableau.png' });

  // glisser une carte dans une autre colonne
  await page.locator('[data-card="i:22222222-0000-0000-0000-000000000002"]').dragTo(colOf('En cours')); await page.waitForTimeout(900);
  const w1 = writes.find(w => w.table === 'cp_items' && w.id === '22222222-0000-0000-0000-000000000002');
  check('6 glisser « Réglage lumière » vers « En cours » envoie le nouvel état', w1 && w1.body.status_id === '33333333-0000-0000-0000-000000000002', JSON.stringify(w1));
  check('7 après rechargement, la carte est dans « En cours » (3 cartes)', (await cardNames(colOf('En cours'))).length === 3 && (await cardNames(colOf('Pas commencé'))).length === 0);
  // menu « Déplacer vers » (clavier / toucher)
  await page.getByRole('button', { name: 'Déplacer « Réglage lumière » vers un autre état' }).click();
  await page.getByRole('menuitemradio', { name: 'Terminé' }).click(); await page.waitForTimeout(900);
  const w2 = writes.filter(w => w.id === '22222222-0000-0000-0000-000000000002')[1];
  check('8 le menu « Déplacer vers » fait la même chose (Terminé)', w2 && w2.body.status_id === '33333333-0000-0000-0000-000000000003', JSON.stringify(w2));
  // filtres : en retard seulement
  await page.getByRole('button', { name: /^En retard/ }).click(); await page.waitForTimeout(500);
  const late = [...await cardNames(colOf('En cours')), ...await cardNames(colOf('Terminé'))];
  check('9 filtre « En retard » : seulement les 2 cartes en retard', JSON.stringify(late) === JSON.stringify(['Montage scène', 'Prototype boîtier']), JSON.stringify(late));
  await page.getByRole('button', { name: 'Tout afficher' }).click();
  // mode projets
  await page.getByRole('radio', { name: 'Projets', exact: true }).click();
  await page.waitForTimeout(500);
  const proj = await cardNames(colOf('En cours'));
  check('10 mode « Projets » : les 2 projets en cours', proj.includes('Projet Alpha') && proj.includes('Projet Beta'), JSON.stringify(proj));
  // ouverture d'une carte
  await page.getByRole('button', { name: 'Projet Alpha', exact: true }).first().click(); await page.waitForSelector('#prj-name', { timeout: 10000 });
  check('11 un clic sur la carte ouvre la fiche du projet', (await page.locator('#prj-name').inputValue()) === 'Projet Alpha');

  // ---------- Calendrier
  await goView('Calendrier');
  const title = (await page.locator('[data-calendar-title]').innerText()).trim().toLowerCase();
  check('12 le calendrier s\'ouvre sur novembre 2026', /novembre 2026/.test(title), title);
  const weeks = await page.locator('[data-week]').count();
  check('13 novembre 2026 : 6 semaines (le 1er est un dimanche : de la semaine du 26 octobre à celle du 30 novembre)', weeks === 6 && (await page.locator('[data-week]').first().getAttribute('data-week')) === '2026-10-26' && (await page.locator('[data-week]').last().getAttribute('data-week')) === '2026-11-30', String(weeks));
  const ev = await page.locator('[data-event]').count();
  check('14 les éléments datés de novembre sont des barres (au moins Montage scène)', ev >= 1 && (await page.locator('[data-event="22222222-0000-0000-0000-000000000001"]').count()) >= 1, String(ev));
  const late2 = await page.locator('[data-event][title$="En retard"]').count();
  check('15 les éléments en retard sont signalés (titre « En retard »)', late2 >= 2, String(late2));
  check('16 le jour d\'aujourd\'hui (7 novembre) est repéré', (await page.locator('[data-day="2026-11-07"] span.bg-danger-500').count()) === 1);
  check('17 week-ends teintés : une colonne samedi', (await page.locator('[data-day="2026-11-07"]').getAttribute('class')).includes('bg-gray-500/5'));
  await page.screenshot({ path: process.argv[2] + '/p4-calendrier.png' });
  await page.getByRole('button', { name: 'Mois suivant' }).click(); await page.waitForTimeout(300);
  check('18 « Mois suivant » : décembre 2026', /décembre 2026/.test((await page.locator('[data-calendar-title]').innerText()).toLowerCase()));
  await page.getByRole('button', { name: "Aujourd'hui" }).click(); await page.waitForTimeout(300);
  check('19 « Aujourd\'hui » revient à novembre 2026', /novembre 2026/.test((await page.locator('[data-calendar-title]').innerText()).toLowerCase()));
  await page.getByRole('radio', { name: 'Semaine' }).or(page.getByRole('button', { name: 'Semaine', exact: true })).first().click(); await page.waitForTimeout(400);
  check('20 vue semaine : une seule ligne de 7 jours, celle du 2 au 8 novembre', (await page.locator('[data-week]').count()) === 1 && (await page.locator('[data-week="2026-11-02"]').count()) === 1);
  await page.locator('[data-event="22222222-0000-0000-0000-000000000001"]').first().click(); await page.waitForSelector('#itm-name', { timeout: 10000 });
  check('21 un clic sur une barre ouvre la fiche de l\'élément', (await page.locator('#itm-name').inputValue()) === 'Montage scène');

  check('22 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
