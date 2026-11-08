// Charge par personne PILOTE (heures estimées, capacité, surcharge) — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Lancer (deux terminaux) :
//   1) VITE_SUPABASE_URL=http://mock.supabase.test VITE_SUPABASE_ANON_KEY=k npx vite --port 5197 --host 127.0.0.1
//   2) node scripts/e2e-charge.cjs <dossier des captures>
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
    { ...it('22222222-0000-0000-0000-00000000000a', P1, 'Montage scène', ST1, 0, 0), starts_on: '2026-11-02', ends_on: '2026-11-06', estimate_hours: 50 },
    { ...it('22222222-0000-0000-0000-00000000000b', P1, 'Réglage lumière', ST1, 0, 0), starts_on: '2026-11-09', ends_on: '2026-11-13', estimate_hours: 20 },
    { ...it('22222222-0000-0000-0000-00000000000c', P2, 'Prototype boîtier', ST1, 0, 0), starts_on: '2026-11-16', ends_on: '2026-11-20', estimate_hours: null },
    { ...it('22222222-0000-0000-0000-00000000000d', P2, 'Essais mesures', ST1, 0, 0), starts_on: '2026-11-16', ends_on: '2026-11-20', estimate_hours: 30 },
  ],
  cp_item_members: [{ item_id: '22222222-0000-0000-0000-00000000000a', user_id: ME }, { item_id: '22222222-0000-0000-0000-00000000000b', user_id: ME }, { item_id: '22222222-0000-0000-0000-00000000000b', user_id: OTHER },
    { item_id: '22222222-0000-0000-0000-00000000000c', user_id: OTHER }, { item_id: '22222222-0000-0000-0000-00000000000d', user_id: OTHER }],
  cp_calendar_days: [{ id: 'cd1', day: '2026-11-18', label: 'Fermeture test', kind: 'closure' }],
  cp_user_capacity: [],
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
    if (path.startsWith('/rest/v1/')) { const table = path.split('/').pop(); if (req.method() !== 'GET') { if (table === 'cp_user_capacity' && req.method() === 'POST') { const b = req.postDataJSON(); writes.push({ table, upsert: b, query: url.search }); const rows = Array.isArray(b) ? b : [b]; for (const r of rows) { const ex = TABLES.cp_user_capacity.find(c => c.user_id === r.user_id); if (ex) Object.assign(ex, r); else TABLES.cp_user_capacity.push({ ...r }); } return route.fulfill({ status: 204, body: '' }); } if (req.method() === 'PATCH') { const id = (url.searchParams.get('id') || '').slice(3); const body = req.postDataJSON(); writes.push({ table, id, body }); const row = (TABLES[table] || []).find(r => r.id === id); if (row) { Object.assign(row, body, { updated_at: new Date().toISOString() }); return json([{ id }]); } return json([]); } return route.fulfill({ status: 204, body: '' }); } const rows = filt(TABLES[table] || [], url); return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows); }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };


  const goWorkload = async () => { await page.goto(BASE + '/pilote/projets'); const top = page.getByRole('radio', { name: 'Pilotage', exact: true }); await top.waitFor({ timeout: 25000 }); await top.click(); const tab = page.getByRole('radio', { name: 'Charge', exact: true }); await tab.waitFor({ timeout: 25000 }); await tab.click(); await page.waitForSelector('table[aria-label="Charge par personne et par semaine"]', { timeout: 15000 }); await page.waitForTimeout(500); };
  const cell = (user, weekStart) => page.locator(`tr[data-user="${user}"] button[data-week-start="${weekStart}"]`);
  const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();

  await goWorkload();
  check('1 en-têtes : « Sem. 45 » pour la semaine du 02.11 (2026)', /Sem\. 45\s*02\.11/i.test((await page.locator('thead').innerText()).replace(/\s+/g, ' ')), (await page.locator('thead').innerText()).replace(/\s+/g, ' '));
  check('2 Test Responsable, semaine du 2.11 : 50 h sur 40 = surcharge', (await txt(cell(ME, '2026-11-02'))) === '50 / 40' && (await cell(ME, '2026-11-02').getAttribute('data-level')) === 'over');
  check('3 compteur « 1 semaine en surcharge »', (await page.locator('[data-overload-count]').getAttribute('data-overload-count')) === '1' && /1 semaine en surcharge/.test(await page.locator('[data-overload-count]').innerText()));
  check('4 semaine du 9.11 : 20 h partagées entre 2 assignés = 10 h chacun, confortable', (await txt(cell(ME, '2026-11-09'))) === '10 / 40' && (await txt(cell(OTHER, '2026-11-09'))) === '10 / 40' && (await cell(OTHER, '2026-11-09').getAttribute('data-level')) === 'ok');
  check('5 semaine du 16.11 (jour de fermeture le 18) : capacité 32 h, 30 h = presque plein', (await txt(cell(OTHER, '2026-11-16'))) === '30 / 32' && (await cell(OTHER, '2026-11-16').getAttribute('data-level')) === 'warn', await txt(cell(OTHER, '2026-11-16')));
  check('6 les semaines sans charge sont vides (—)', (await txt(cell(ME, '2026-11-23'))) === '—');
  check('7 « À estimer (1) » : Prototype boîtier', (await page.getByRole('heading', { name: 'À estimer (1)' }).count()) === 1 && (await page.getByRole('region', { name: 'Tâches à estimer' }).innerText()).includes('Prototype boîtier'));
  await page.screenshot({ path: process.argv[2] + '/p6-charge.png' });

  // détail d'une case
  await cell(ME, '2026-11-02').click(); await page.waitForTimeout(400);
  const dlg = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ');
  check('8 le détail liste l\'élément et ses heures', /Montage scène/.test(dlg) && /50 h/.test(dlg) && /50 h sur 40 h de capacité \(surcharge\)/.test(dlg), dlg);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // capacité modifiable
  const capInput = page.getByLabel('Capacité de Test Responsable (heures par semaine)');
  check('9 capacité par défaut : 40', (await capInput.inputValue()) === '40');
  await capInput.fill('60'); await capInput.blur(); await page.waitForTimeout(900);
  const up = writes.find(w => w.table === 'cp_user_capacity');
  check('10 la capacité est enregistrée (upsert sur entreprise + personne)', up && up.upsert.user_id === ME && up.upsert.hours_per_week === 60 && /on_conflict=organization_id(%2C|,)user_id/.test(up.query), JSON.stringify(up));
  check('11 la charge se recalcule : 50 / 60 = presque plein, plus de surcharge', (await txt(cell(ME, '2026-11-02'))) === '50 / 60' && (await cell(ME, '2026-11-02').getAttribute('data-level')) === 'warn' && (await page.locator('[data-overload-count]').getAttribute('data-overload-count')) === '0');
  await capInput.fill('99'); await capInput.blur(); await page.waitForTimeout(500);
  check('12 une capacité de 99 h est refusée à l\'écran (rien envoyé de plus)', writes.filter(w => w.table === 'cp_user_capacity').length === 1);

  // fiche : estimation
  await page.getByRole('button', { name: 'Prototype boîtier' }).click(); await page.waitForSelector('#itm-estimate', { timeout: 10000 });
  check('13 la fiche montre « Estimation (heures) », vide pour un élément non estimé', (await page.locator('#itm-estimate').inputValue()) === '');
  await page.locator('#itm-estimate').fill('12.5');   // un champ numérique n'accepte pas la virgule sous Playwright (un vrai navigateur suisse, si) ; le code gère les deux
  await page.getByRole('button', { name: /^Enregistrer/ }).last().click(); await page.waitForTimeout(1200);
  const p1 = writes.find(w => w.table === 'cp_items' && w.id === '22222222-0000-0000-0000-00000000000c');
  check('14 l\'estimation « 12,5 » est envoyée en nombre (12.5)', p1 && p1.body.estimate_hours === 12.5, JSON.stringify(p1));
  // une fiche modifiée SANS toucher à l'estimation ne l'envoie pas (la base peut ne pas avoir la colonne)
  await goWorkload();
  await cell(ME, '2026-11-09').click(); await page.getByRole('dialog').getByRole('button', { name: 'Réglage lumière' }).click(); await page.waitForSelector('#itm-name', { timeout: 10000 });
  check('15 la fiche d\'un élément estimé montre 20', (await page.locator('#itm-estimate').inputValue()) === '20');
  await page.locator('#itm-name').fill('Réglage lumière 2'); await page.getByRole('button', { name: /^Enregistrer/ }).last().click(); await page.waitForTimeout(1200);
  const p2 = writes.filter(w => w.table === 'cp_items' && w.id === '22222222-0000-0000-0000-00000000000b').pop();
  check('16 sans changement d\'estimation, la requête ne contient pas « estimate_hours »', p2 && p2.body.name === 'Réglage lumière 2' && !('estimate_hours' in p2.body), JSON.stringify(p2));

  check('17 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
