// Chemin critique et ligne de base PILOTE — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
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
    { ...it('22222222-0000-0000-0000-00000000000a', P1, 'Étude', ST1, 0, 0), starts_on: '2026-11-09', ends_on: '2026-11-11' },
    { ...it('22222222-0000-0000-0000-00000000000b', P1, 'Fabrication', ST0, 0, 0), starts_on: '2026-11-12', ends_on: '2026-11-13' },
    { ...it('22222222-0000-0000-0000-00000000000c', P1, 'Livraison', ST0, 0, 0), starts_on: '2026-11-16', ends_on: '2026-11-18' },
    { ...it('22222222-0000-0000-0000-00000000000d', P1, 'Documentation', ST0, 0, 0), starts_on: '2026-11-09', ends_on: '2026-11-12' },
  ],
  cp_item_members: [],
  cp_baseline_dates: [
    { project_id: P1, item_id: null, starts_on: '2026-11-09', ends_on: '2026-11-13', taken_at: '2026-10-30T10:00:00Z' },
    { project_id: P1, item_id: '22222222-0000-0000-0000-00000000000a', starts_on: '2026-11-09', ends_on: '2026-11-11', taken_at: '2026-10-30T10:00:00Z' },
    { project_id: P1, item_id: '22222222-0000-0000-0000-00000000000b', starts_on: '2026-11-12', ends_on: '2026-11-13', taken_at: '2026-10-30T10:00:00Z' },
    { project_id: P1, item_id: '22222222-0000-0000-0000-00000000000c', starts_on: '2026-11-12', ends_on: '2026-11-13', taken_at: '2026-10-30T10:00:00Z' },
  ],
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
  const rpcCalls = []; const writes = []; const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) { const fn = path.split('/').pop(); const args = req.postData() ? req.postDataJSON() : {}; rpcCalls.push({ fn, args }); if (fn === 'cp_set_baseline') return json(4); if (fn === 'cp_clear_baseline') return json(4); return json(fn in RPC ? RPC[fn] : null); }
    if (path.startsWith('/rest/v1/')) { const table = path.split('/').pop(); if (req.method() !== 'GET') { if (req.method() === 'PATCH') { const id = (url.searchParams.get('id') || '').slice(3); const body = req.postDataJSON(); writes.push({ table, id, body }); const row = (TABLES[table] || []).find(r => r.id === id); if (row) { Object.assign(row, body, { updated_at: new Date().toISOString() }); return json([{ id }]); } return json([]); } return route.fulfill({ status: 204, body: '' }); } const rows = filt(TABLES[table] || [], url); return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows); }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };


  const goGantt = async () => { await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(700); await page.getByRole('button', { name: "Plus d'options d'affichage" }).click(); await page.getByRole('menuitem', { name: 'Tout déplier' }).click(); await page.waitForTimeout(300); };
  const toggle = async (label) => { await page.getByRole('button', { name: "Plus d'options d'affichage" }).click(); await page.getByRole('menuitemradio', { name: label }).click(); await page.keyboard.press('Escape'); await page.waitForTimeout(400); };

  await goGantt();
  check('1 par défaut : ni chemin critique ni ligne de base affichés', (await page.locator('svg[aria-label="Chemin critique"]').count()) === 0 && (await page.locator('[data-baseline]').count()) === 0);
  await toggle('Chemin critique');
  check('2 chemin critique : Étude, Fabrication, Livraison (3 icônes), pas Documentation', (await page.locator('svg[aria-label="Chemin critique"]').count()) === 3, String(await page.locator('svg[aria-label="Chemin critique"]').count()));
  check('3 les 2 dépendances serrées sont tracées en orange', (await page.locator('path[data-critical="true"]').count()) === 2, String(await page.locator('path[data-critical="true"]').count()));
  const docCrit = await page.locator('[data-variance], button[title^="Tâche · Documentation"]').first().getAttribute('title').catch(() => '');
  check('4 l\'infobulle d\'une barre critique le dit', (await page.locator('[title*="Chemin critique"]').count()) >= 3);
  await page.screenshot({ path: process.argv[2] + '/p9-critique.png' });
  await toggle('Ligne de base');
  const bases = await page.locator('[data-baseline]').evaluateAll(els => els.map(e => e.getAttribute('data-baseline')).sort());
  check('5 ligne de base : 4 barres grises (projet + Étude, Fabrication, Livraison ; Documentation n\'en a pas)', bases.length === 4 && bases.includes('p:11111111-0000-0000-0000-000000000001') && bases.includes('i:22222222-0000-0000-0000-00000000000c'), JSON.stringify(bases));
  const variances = await page.locator('[data-variance]').evaluateAll(els => els.map(e => e.textContent));
  check('6 écart de fin : « +14 j » sur le projet (sa propre fin est le 27.11, prévue le 13.11) et « +5 j » sur Livraison (18.11 au lieu du 13.11), rien ailleurs', JSON.stringify(variances) === JSON.stringify(['+14 j', '+5 j']), JSON.stringify(variances));
  check('7 l\'infobulle donne la fin de la ligne de base', (await page.locator('[title*="Ligne de base : fin 13.11.2026 (+5 j)"]').count()) >= 1);
  await page.screenshot({ path: process.argv[2] + '/p9-base.png' });
  // préférences mémorisées
  await page.reload(); await page.waitForSelector('[role="search"]'); await page.waitForTimeout(700);
  await page.getByRole('button', { name: "Plus d'options d'affichage" }).click(); await page.getByRole('menuitem', { name: 'Tout déplier' }).click(); await page.waitForTimeout(400);
  check('8 les deux repères restent activés après rechargement', (await page.locator('svg[aria-label="Chemin critique"]').count()) === 3 && (await page.locator('[data-baseline]').count()) === 4);

  // un filtre ne casse pas le chemin critique
  await page.getByPlaceholder('Rechercher').fill('Livraison'); await page.waitForTimeout(500);
  check('9 avec un filtre, la ligne affichée reste marquée critique (calcul sur toutes les données)', (await page.locator('svg[aria-label="Chemin critique"]').count()) === 1);
  await page.getByRole('button', { name: 'Tout afficher' }).click(); await page.waitForTimeout(300);

  // figer / effacer
  await page.getByRole('button', { name: 'Projet Alpha', exact: true }).first().click(); await page.waitForSelector('#prj-name', { timeout: 10000 });
  check('10 la fiche du projet propose « Figer… » et « Effacer la ligne de base… » (il en a une)', (await page.getByRole('button', { name: 'Figer la ligne de base…' }).count()) === 1 && (await page.getByRole('button', { name: 'Effacer la ligne de base…' }).count()) === 1);
  await page.getByRole('button', { name: 'Figer la ligne de base…' }).click(); await page.waitForTimeout(300);
  check('11 une confirmation annonce que la précédente est remplacée', /remplacent la ligne de base précédente/.test(await page.getByRole('dialog').innerText()));
  await page.getByRole('button', { name: 'Confirmer' }).click(); await page.waitForTimeout(900);
  const fr = rpcCalls.find(c => c.fn === 'cp_set_baseline');
  check('12 la fonction reçoit le projet', fr && fr.args.p_project === '11111111-0000-0000-0000-000000000001', JSON.stringify(fr));
  await page.getByRole('button', { name: 'Projet Beta', exact: true }).first().click(); await page.waitForSelector('#prj-name', { timeout: 10000 });
  check('13 Projet Beta (sans ligne de base) : « Figer » oui, « Effacer » non', (await page.getByRole('button', { name: 'Figer la ligne de base…' }).count()) === 1 && (await page.getByRole('button', { name: 'Effacer la ligne de base…' }).count()) === 0);

  check('14 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
