// Calendrier de travail PILOTE (jours fériés, fermetures, jours ouvrés) — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Lancer (deux terminaux) :
//   1) VITE_SUPABASE_URL=http://mock.supabase.test VITE_SUPABASE_ANON_KEY=k npx vite --port 5197 --host 127.0.0.1
//   2) node scripts/e2e-calendrier.cjs <dossier des captures>
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

const day = (n) => { const d = new Date(Date.now() + n * 86400000); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(d); };
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
    { ...it('22222222-0000-0000-0000-0000000000f1', P1, 'Tâche semaine', ST0, 0, 0), starts_on: '2027-03-01', ends_on: '2027-03-07' },
    it('22222222-0000-0000-0000-000000000004', P2, 'Prototype boîtier', ST1, -7, -1, { priority: 'low' }),  // EN RETARD, assignée à OTHER
  ],
  cp_item_members: [{ item_id: I1, user_id: ME }, { item_id: '22222222-0000-0000-0000-000000000004', user_id: OTHER }],
  cp_item_links: [], cp_item_checks: [], cp_comments: [], cp_documents: [], cp_calendar_days: [{ id: 'cd0', day: '2027-03-05', label: 'Férié de test 2027', kind: 'holiday' }],
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
  await ctx.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));   // date figée : le test ne dépend pas du jour où on le lance
  const writes = []; const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) { const fn = path.split('/').pop(); return json(fn in RPC ? RPC[fn] : null); }
    if (path.startsWith('/rest/v1/')) { const table = path.split('/').pop(); if (req.method() !== 'GET') { if (table === 'cp_calendar_days') { writes.push({ method: req.method(), url: url.search, body: req.method() === 'DELETE' ? null : req.postDataJSON() }); if (req.method() === 'POST') { const b = req.postDataJSON(); (Array.isArray(b) ? b : [b]).forEach((r, i) => TABLES.cp_calendar_days.push({ id: 'cd' + Math.random().toString(36).slice(2), kind: 'holiday', ...r })); } else if (req.method() === 'DELETE') { const id = url.searchParams.get('id').slice(3); TABLES.cp_calendar_days = TABLES.cp_calendar_days.filter(r => r.id !== id); } } return route.fulfill({ status: 204, body: '' }); } const rows = filt(TABLES[table] || [], url); return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows); }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };

  const openCalendar = async () => { await page.goto(BASE + '/pilote/projets'); await page.getByRole('button', { name: 'Réglages des projets' }).waitFor({ timeout: 25000 }); await page.getByRole('button', { name: 'Réglages des projets' }).click(); await page.getByRole('menuitem', { name: 'Calendrier de travail' }).click(); await page.getByRole('heading', { name: 'Calendrier de travail' }).waitFor(); await page.waitForTimeout(400); };
  const Y = 2026;
  const pickDay = async (n) => { const fs = page.locator('fieldset', { hasText: 'Ajouter un jour' }); await fs.getByText('Sélectionner une date').click(); await page.waitForTimeout(300); await page.getByRole('gridcell', { name: String(n), exact: true }).click(); await page.getByRole('button', { name: 'OK', exact: true }).click(); await page.waitForTimeout(300); };
  

  await openCalendar();
  check('1 le calendrier de l\'année en cours est vide au départ', (await page.getByText('Aucun jour saisi').count()) === 1);
  const boxes = await page.locator('input[type=checkbox]:checked').count();
  check('2 les 7 jours fériés courants sont cochés par défaut', boxes === 7, String(boxes));
  check('3 le libellé du bouton annonce 7 jours', (await page.getByRole('button', { name: 'Ajouter 7 jours' }).count()) === 1);
  await page.getByRole('button', { name: 'Ajouter 7 jours' }).click(); await page.waitForTimeout(700);
  const post = writes.find(w => w.method === 'POST');
  const sent = post ? post.body.map(r => r.day).sort() : [];
  const want = ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-14', '2026-05-25', '2026-08-01', '2026-12-25'];
  check('4 les 7 dates envoyées sont les bonnes (Pâques 2026 = 5 avril)', JSON.stringify(sent) === JSON.stringify(want), JSON.stringify(sent));
  check('5 tous de type « férié » avec un libellé', post && post.body.every(r => r.kind === 'holiday' && r.label), JSON.stringify(post && post.body[0]));
  check('6 la liste affiche maintenant 7 jours', (await page.getByRole('heading', { name: new RegExp(`Jours non travaillés en ${Y} \\(7\\)`) }).count()) === 1);
  check('7 « Rien à ajouter » une fois tout ajouté, et « déjà ajouté » sur chaque ligne', (await page.getByRole('button', { name: 'Rien à ajouter' }).isDisabled()) && (await page.getByText('déjà ajouté').count()) >= 7);
  // jour personnalisé
  await page.locator('#cal-label').fill('Fermeture annuelle'); 
  check('8 « Ajouter ce jour » reste désactivé sans date', await page.getByRole('button', { name: 'Ajouter ce jour' }).isDisabled());
  await pickDay(9); await page.getByRole('button', { name: 'Ajouter ce jour' }).click(); await page.waitForTimeout(700);
  const post2 = writes.filter(w => w.method === 'POST')[1];
  check('9 jour personnalisé envoyé (date, nom, type « fermeture » par défaut)', post2 && post2.body.day === `${Y}-11-09` && post2.body.label === 'Fermeture annuelle' && post2.body.kind === 'closure', JSON.stringify(post2 && post2.body));
  check('10 il apparaît dans la liste (8 jours)', (await page.getByRole('heading', { name: new RegExp(`\\(8\\)`) }).count()) === 1);
  await page.screenshot({ path: process.argv[2] + '/p2-calendrier.png' });
  // suppression
  await page.getByRole('button', { name: 'Supprimer Fermeture annuelle' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click(); await page.waitForTimeout(700);
  check('11 suppression : requête DELETE sur ce jour, la liste revient à 7', writes.some(w => w.method === 'DELETE') && (await page.getByRole('heading', { name: /\(7\)/ }).count()) === 1);
  // re-ajouter une fermeture pour le Gantt
  await page.locator('#cal-label').fill('Fermeture annuelle'); await pickDay(9); await page.getByRole('button', { name: 'Ajouter ce jour' }).click(); await page.waitForTimeout(600);

  // Gantt : jours teintés (le 9 novembre et le 25 décembre sont dans la fenêtre de 3 mois)
  await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(700);
  const tinted = await page.locator('[data-non-working]').evaluateAll(els => els.map(e => e.getAttribute('data-non-working')));
  check('12 le Gantt teinte les jours du calendrier visibles (fermeture du 9.11 et Noël)', tinted.includes(`${Y}-11-09`) && tinted.includes(`${Y}-12-25`) && !tinted.some(d => ['0', '6'].includes(String(new Date(d + 'T12:00:00Z').getUTCDay()))), JSON.stringify(tinted));
  await page.screenshot({ path: process.argv[2] + '/p2-gantt.png' });

  // Fiche : jours ouvrés (2027-03-01 lundi → 03-07 dimanche = 5 jours ; férié le 5 mars → 4)
  await page.goto(BASE + '/pilote/projets?item=22222222-0000-0000-0000-0000000000f1'); await page.waitForSelector('#itm-name', { timeout: 25000 }); await page.waitForTimeout(800);
  const wd = (await page.locator('[data-working-days]').first().innerText().catch(() => '')).trim();
  check('13 la fiche indique « 4 jours ouvrés » (7 jours calendaires, 2 jours de week-end, 1 férié)', /^4 jours ouvrés/.test(wd), wd);

  check('14 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
