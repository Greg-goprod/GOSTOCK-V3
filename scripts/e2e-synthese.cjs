// Synthèse des projets PILOTE (santé, échéances, surcharges) — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
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
  cp_projects: [
    { ...base, id: P1, type: 'site', name: 'Projet Alpha', status_id: ST1, starts_on: '2026-11-02', ends_on: '2026-11-20' },
    { ...base, id: P2, type: 'rd', name: 'Projet Beta', status_id: ST1, starts_on: '2026-10-01', ends_on: '2026-11-04' },
    { ...base, id: '11111111-0000-0000-0000-000000000003', type: 'admin', name: 'Projet Gamma', status_id: ST1, starts_on: '2026-11-01', ends_on: '2026-12-15' },
    { ...base, id: '11111111-0000-0000-0000-000000000004', type: 'admin', name: 'Projet Delta', status_id: ST1, starts_on: '2026-11-09', ends_on: '2026-12-15' },
    { ...base, id: '11111111-0000-0000-0000-000000000005', type: 'admin', name: 'Projet Fini', status_id: ST2, starts_on: '2026-09-01', ends_on: '2026-09-30' },
  ],
  cp_project_members: [{ project_id: P1, user_id: ME, role: 'lead' }, { project_id: P2, user_id: OTHER, role: 'lead' }],
  sites: [],
  cp_items: [
    { ...it('22222222-0000-0000-0000-00000000000a', P1, 'Étude', ST1, 0, 0), starts_on: '2026-11-02', ends_on: '2026-11-06' },
    { ...it('22222222-0000-0000-0000-00000000000b', P1, 'Fabrication', ST0, 0, 0), starts_on: '2026-11-09', ends_on: '2026-11-13' },
    { ...it('22222222-0000-0000-0000-00000000000c', P1, 'Livraison', ST0, 0, 0), starts_on: '2026-11-16', ends_on: '2026-11-20' },
    { ...it('22222222-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-000000000003', 'Retard Gamma', ST1, 0, 0), starts_on: '2026-11-02', ends_on: '2026-11-05' },
    { ...it('22222222-0000-0000-0000-00000000000f', '11111111-0000-0000-0000-000000000004', 'Tâche Delta', ST0, 0, 0), starts_on: '2026-11-25', ends_on: '2026-11-30' },
    { ...it('22222222-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000004', 'Gros lot', ST1, 0, 0), starts_on: '2026-11-09', ends_on: '2026-11-13', estimate_hours: 60 },
  ],
  cp_item_members: [{ item_id: '22222222-0000-0000-0000-000000000010', user_id: ME }, { item_id: '22222222-0000-0000-0000-00000000000b', user_id: OTHER }],
  cp_item_links: [{ id: 'k1', project_id: P1, predecessor_id: '22222222-0000-0000-0000-00000000000a', successor_id: '22222222-0000-0000-0000-00000000000b' }, { id: 'k2', project_id: P1, predecessor_id: '22222222-0000-0000-0000-00000000000b', successor_id: '22222222-0000-0000-0000-00000000000c' }],
  cp_item_checks: [], cp_comments: [], cp_documents: [],
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


  await page.goto(BASE + '/pilote/projets'); const tab = page.getByRole('radio', { name: 'Synthèse' }); await tab.waitFor({ timeout: 25000 }); await tab.click(); await page.waitForSelector('[data-kpi]', { timeout: 15000 }); await page.waitForTimeout(500);
  const kpi = async (k) => Number(await page.locator(`[data-kpi="${k}"]`).getAttribute('data-value'));
  check('1 projets en cours : 4 (le projet terminé n\'est pas compté)', (await kpi('running')) === 4, String(await kpi('running')));
  check('2 projets en retard : 1 (Beta)', (await kpi('late')) === 1);
  check('3 éléments en retard : 2 (Étude, Retard Gamma)', (await kpi('overdue')) === 2);
  check('4 échéances sous 14 jours : 3 (Fabrication, Livraison, Gros lot)', (await kpi('due')) === 3);
  check('5 personnes en surcharge : 1 ; tâches à estimer : 1 (Fabrication, assignée sans estimation)', (await kpi('over')) === 1 && (await kpi('est')) === 1);
  const order = await page.locator('tr[data-project]').evaluateAll(rs => rs.map(r => [r.querySelector('th').innerText.trim(), r.getAttribute('data-health')]));
  check('6 projets triés par risque : Beta, Alpha (rouges), Gamma (orange), Delta (vert), Fini (clos)', JSON.stringify(order) === JSON.stringify([['Projet Beta', 'red'], ['Projet Alpha', 'red'], ['Projet Gamma', 'orange'], ['Projet Delta', 'green'], ['Projet Fini', 'closed']]), JSON.stringify(order));
  const txt = (await page.locator('table[aria-label="Projets par niveau de risque"]').innerText()).replace(/\s+/g, ' ');
  check('7 raisons lisibles : « Projet en retard », « 1 élément en retard sur le chemin critique », « 1 autre élément en retard »', /Projet en retard/.test(txt) && /1 élément en retard sur le chemin critique/.test(txt) && /1 autre élément en retard/.test(txt), txt.slice(0, 400));
  const up = (await page.getByRole('region', { name: 'Échéances proches' }).innerText()).replace(/\s+/g, ' ');
  check('8 échéances : Fabrication 13.11, Gros lot 13.11, Livraison 20.11 (pas Tâche Delta)', /Fabrication/.test(up) && /Gros lot/.test(up) && /Livraison/.test(up) && !/Tâche Delta/.test(up) && up.indexOf('Fabrication') < up.indexOf('Livraison'), up);
  const ov = (await page.getByRole('region', { name: 'Surcharges' }).innerText()).replace(/\s+/g, ' ');
  check('9 surcharge : Test Responsable, semaine du 09.11, 60 / 40 h', /Test Responsable/.test(ov) && /09\.11/.test(ov) && /60 \/ 40 h/.test(ov), ov);
  await page.screenshot({ path: process.argv[2] + '/p10-synthese.png' });
  await page.getByRole('button', { name: 'Projet Beta', exact: true }).click(); await page.waitForSelector('#prj-name', { timeout: 10000 });
  check('10 un clic sur un projet ouvre sa fiche', (await page.locator('#prj-name').inputValue()) === 'Projet Beta');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Livraison', exact: true }).click(); await page.waitForSelector('#itm-name', { timeout: 10000 });
  check('11 un clic sur une échéance ouvre la fiche de l\'élément', (await page.locator('#itm-name').inputValue()) === 'Livraison');
  check('12 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
