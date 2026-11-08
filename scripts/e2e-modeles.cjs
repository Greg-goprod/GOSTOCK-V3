// Modèles de projet PILOTE (modèles de départ, création depuis un modèle, enregistrer comme modèle) — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Lancer (deux terminaux) :
//   1) VITE_SUPABASE_URL=http://mock.supabase.test VITE_SUPABASE_ANON_KEY=k npx vite --port 5197 --host 127.0.0.1
//   2) node scripts/e2e-modeles.cjs <dossier des captures>
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
    { ...it('22222222-0000-0000-0000-0000000000f1', P1, 'Tâche semaine', ST0, 0, 0), starts_on: '2027-03-01', ends_on: '2027-03-07' },
    it('22222222-0000-0000-0000-000000000004', P2, 'Prototype boîtier', ST1, -7, -1, { priority: 'low' }),  // EN RETARD, assignée à OTHER
  ],
  cp_item_members: [{ item_id: I1, user_id: ME }, { item_id: '22222222-0000-0000-0000-000000000004', user_id: OTHER }],
  cp_item_links: [], cp_item_checks: [], cp_comments: [], cp_documents: [], cp_calendar_days: [{ id: 'cd0', day: '2027-03-05', label: 'Férié de test 2027', kind: 'holiday' }],
  platform_modules: [{ key: 'cp.projects', label: 'Projets', description: 'x', position: 1 }],
  users: [{ id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', active: true }, { id: OTHER, first_name: 'Autre', last_name: 'Personne', email: 'a@p.test', role: 'user', active: true }],
};
const RPC = { whoami: profile, my_notifications: [], unread_notification_count: 0, rbac_has_any_permission: true, cp_can_discuss: true, my_cp_notification_prefs: [] };
const filt = (rows, url) => { let out = rows; for (const [k, v] of url.searchParams) { if (['select', 'order', 'limit', 'offset'].includes(k)) continue; if (v === 'is.null') out = out.filter(r => r[k] == null); else if (v.startsWith('eq.')) out = out.filter(r => String(r[k]) === v.slice(3)); else if (v.startsWith('in.(')) { const set = new Set(v.slice(4, -1).split(',')); out = out.filter(r => set.has(String(r[k]))); } } return out; };
(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'fr-CH' });
  const sess = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 't@r.test', app_metadata: {}, user_metadata: {}, created_at: now } };
  await ctx.addInitScript(s => { try { if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(s)); } catch {} }, sess);
  await ctx.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));   // date figée : le test ne dépend pas du jour où on le lance
  const rpcCalls = []; const writes = []; const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) { const fn = path.split('/').pop(); const args = req.postData() ? req.postDataJSON() : {}; rpcCalls.push({ fn, args });
      if (fn === 'cp_seed_starter_templates') { const mk = (id, name, type, color, items) => { TABLES.cp_projects.push({ ...base, id, type, name, status_id: ST1, color, starts_on: '2027-01-04', ends_on: '2027-03-01', is_template: true, description: 'Modèle de départ' }); for (let i = 0; i < items; i++) TABLES.cp_items.push({ ...base, id: id + '-i' + i, project_id: id, parent_id: null, kind: 'task', name: 'Élément ' + i, position: i, starts_on: '2026-10-01', ends_on: '2026-10-05', status_id: ST0, version: 1 }); };
        mk('aaaaaaaa-1111-0000-0000-000000000001', "Montage d'un événement", 'event', '#8b5cf6', 18); mk('aaaaaaaa-1111-0000-0000-000000000002', 'Recrutement', 'recruitment', '#10b981', 18); mk('aaaaaaaa-1111-0000-0000-000000000003', 'Conception / R&D', 'rd', '#3b82f6', 14); return json(3); }
      if (fn === 'cp_create_from_template') { const src = TABLES.cp_projects.find(p => p.id === args.p_template); const id = 'bbbbbbbb-2222-0000-0000-000000000001'; TABLES.cp_projects.push({ ...base, id, type: src.type, name: args.p_name, status_id: ST0, color: src.color, starts_on: args.p_start, ends_on: args.p_start, is_template: false }); return json(id); }
      if (fn === 'cp_save_as_template') return json('cccccccc-3333-0000-0000-000000000001');
      return json(fn in RPC ? RPC[fn] : null); }
    if (path.startsWith('/rest/v1/')) { const table = path.split('/').pop(); if (req.method() !== 'GET') { if (table === 'cp_calendar_days') { writes.push({ method: req.method(), url: url.search, body: req.method() === 'DELETE' ? null : req.postDataJSON() }); if (req.method() === 'POST') { const b = req.postDataJSON(); (Array.isArray(b) ? b : [b]).forEach((r, i) => TABLES.cp_calendar_days.push({ id: 'cd' + Math.random().toString(36).slice(2), kind: 'holiday', ...r })); } else if (req.method() === 'DELETE') { const id = url.searchParams.get('id').slice(3); TABLES.cp_calendar_days = TABLES.cp_calendar_days.filter(r => r.id !== id); } } return route.fulfill({ status: 204, body: '' }); } const rows = filt(TABLES[table] || [], url); return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows); }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };


  const goTemplates = async () => { await page.goto(BASE + '/pilote/projets'); const b = page.getByRole('button', { name: /^Vue : / }); await b.waitFor({ timeout: 25000 }); await b.click(); await page.getByRole('menuitemradio', { name: /^Modèles/ }).click(); await page.waitForTimeout(500); };

  await goTemplates();
  check('1 onglet « Modèles (0) » et état vide', (await page.getByText('Aucun modèle', { exact: true }).count()) === 1 && (await page.getByText('Modèles (0)').count()) >= 1);
  await page.getByRole('button', { name: 'Ajouter les modèles de départ' }).click(); await page.waitForTimeout(900);
  check('2 la fonction des modèles de départ est appelée une fois', rpcCalls.filter(c => c.fn === 'cp_seed_starter_templates').length === 1);
  const cards = await page.getByRole('list', { name: 'Modèles de projet' }).getByRole('listitem').count();
  check('3 trois modèles affichés', cards === 3, String(cards));
  const txt = (await page.getByRole('list', { name: 'Modèles de projet' }).innerText()).replace(/\s+/g, ' ');
  check('4 chaque carte annonce son nombre d\'éléments et sa durée', /18 éléments/.test(txt) && /14 éléments/.test(txt) && /57 jours/.test(txt), txt.slice(0, 300));
  await page.screenshot({ path: process.argv[2] + '/p3-modeles.png' });

  // Les modèles n'apparaissent nulle part ailleurs
  await page.getByRole('button', { name: /^Vue : / }).click(); await page.getByRole('menuitemradio', { name: /^Projets/ }).click(); await page.waitForTimeout(500);
  const body = (await page.locator('body').innerText());
  check('5 la liste des projets ne montre aucun modèle (3 projets, pas 6)', /Projets \(2\)/.test(body) && (await page.getByRole('listitem').filter({ hasText: 'Recrutement' }).count()) === 0 && !/Montage d'un événement/.test(body), body.slice(0, 200).replace(/\s+/g, ' '));
  await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(600);
  await page.getByRole('button', { name: "Plus d'options d'affichage" }).click(); await page.getByRole('menuitem', { name: 'Tout déplier' }).click(); await page.waitForTimeout(400);
  const rowNames = (await page.locator('button[title*=" · "]').allInnerTexts()).map(s => s.trim());
  check('6 le Gantt ne montre que les 2 vrais projets et leurs éléments (aucun modèle, aucun « Élément n »)', rowNames.includes('Projet Alpha') && rowNames.includes('Projet Beta') && !rowNames.some(n => /^(Recrutement|Conception \/ R&D|Montage d'un événement)$/.test(n) || /^Élément \d+$/.test(n)), rowNames.join(' | '));

  check('6b les éléments en retard des modèles ne gonflent pas le compteur « En retard » (2, pas 52)', (await page.getByRole('button', { name: 'En retard (2)' }).count()) === 1, await page.locator('[role="search"]').innerText());

  // Utiliser un modèle
  await goTemplates();
  await page.getByRole('listitem').filter({ hasText: 'Recrutement' }).getByRole('button', { name: 'Utiliser ce modèle' }).click(); await page.waitForTimeout(400);
  check('7 la fenêtre propose le nom du modèle et le début d\'aujourd\'hui', (await page.locator('#tpl-name').inputValue()) === 'Recrutement');
  await page.locator('#tpl-name').fill('Recrutement technicien');
  await page.getByRole('button', { name: 'Créer le projet' }).click(); await page.waitForTimeout(1200);
  const use = rpcCalls.find(c => c.fn === 'cp_create_from_template');
  check('8 la création envoie le modèle, le nom et le début (7 novembre 2026, date figée)', use && use.args.p_template === 'aaaaaaaa-1111-0000-0000-000000000002' && use.args.p_name === 'Recrutement technicien' && use.args.p_start === '2026-11-07', JSON.stringify(use));
  check('9 le nouveau projet s\'ouvre (fiche « Recrutement technicien »)', (await page.locator('#prj-name').inputValue().catch(() => '')) === 'Recrutement technicien');
  await page.screenshot({ path: process.argv[2] + '/p3-projet-cree.png' });

  // Enregistrer un projet comme modèle
  check('10 « Enregistrer comme modèle… » est proposé dans la fiche', (await page.getByRole('button', { name: 'Enregistrer comme modèle…' }).count()) === 1);
  await page.getByRole('button', { name: 'Enregistrer comme modèle…' }).click(); await page.waitForTimeout(400);
  await page.getByRole('dialog').getByRole('textbox').fill('Mon modèle maison'); await page.getByRole('button', { name: 'Valider' }).click(); await page.waitForTimeout(900);
  const sv = rpcCalls.find(c => c.fn === 'cp_save_as_template');
  check('11 la fonction reçoit le projet et le nom saisi', sv && sv.args.p_name === 'Mon modèle maison' && sv.args.p_project === 'bbbbbbbb-2222-0000-0000-000000000001', JSON.stringify(sv));

  check('12 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
