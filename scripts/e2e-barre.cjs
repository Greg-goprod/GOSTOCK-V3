// Barre d'outils UNIQUE de PILOTE › Projets : une seule ligne (menu des vues, recherche, filtres, affichage, actions) pour le Gantt, le Tableau et le Calendrier,
// menu des vues complet, panneau de filtres — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Lancer : node scripts/run-pilote-e2e.cjs   (ou, à la main : serveur sur le port 5197 avec VITE_SUPABASE_URL=http://mock.supabase.test, puis node scripts/e2e-barre.cjs <dossier>)
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:5197';
const ME = 'aaaaaaaa-0000-0000-0000-000000000001', ANNE = 'aaaaaaaa-0000-0000-0000-000000000002';
const P1 = '11111111-0000-0000-0000-000000000001';
const ORG = '44444444-0000-0000-0000-000000000001';
const profile = { id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', permissions: ['view_all', 'scan', 'approve', 'manage_stock', 'settings', 'manage_users'], depot_ids: [], organization: { id: ORG, name: 'Org' }, organizations: [], modules: ['cp.projects', 'cp.planning', 'logistics'], platform_admin: true };
const now = new Date().toISOString();
const day = (n) => { const d = new Date(new Date('2026-11-07T10:00:00+01:00').getTime() + n * 86400000); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(d); };
const ST0 = '33333333-0000-0000-0000-000000000001', ST1 = '33333333-0000-0000-0000-000000000002', ST2 = '33333333-0000-0000-0000-000000000003';
const base = { organization_id: ORG, priority: null, color: '#6366f1', description: null, site_id: null, link_mode: 'overlap', link_skip_weekends: true, created_at: now, updated_at: now, estimate_hours: null, series_id: null, series_index: null };
const it = (id, name, extra = {}) => ({ ...base, id, project_id: P1, parent_id: null, kind: 'task', name, position: 1, starts_on: '2026-11-09', ends_on: '2026-11-10', status_id: ST1, version: 1, ...extra });
const IA = '22222222-0000-0000-0000-00000000000a', IP = '22222222-0000-0000-0000-00000000000b', IS = '22222222-0000-0000-0000-00000000000c', IB = '22222222-0000-0000-0000-00000000000d';
const IC = '22222222-0000-0000-0000-00000000000e', ICC = '22222222-0000-0000-0000-00000000000f';
const X1 = 'e1e1e1e1-0000-0000-0000-000000000001', X2 = 'e1e1e1e1-0000-0000-0000-000000000002', X3 = 'e1e1e1e1-0000-0000-0000-000000000003';
const TABLES = {
  cp_statuses: [{ id: ST0, name: 'Pas commencé', family: 'not_started', color: '#999999', position: 0, is_system: true }, { id: ST1, name: 'En cours', family: 'in_progress', color: '#3b82f6', position: 1, is_system: true }, { id: ST2, name: 'Terminé', family: 'done', color: '#10b981', position: 2, is_system: true }],
  cp_projects: [{ ...base, id: P1, type: 'site', name: 'Projet Alpha', status_id: ST1, starts_on: day(-10), ends_on: day(60) }],
  cp_project_members: [{ project_id: P1, user_id: ME, role: 'lead' }],
  sites: [],
  cp_items: [it(IA, 'Montage scène', { estimate_hours: 2 }), it(IP, 'Phase Alpha', { kind: 'phase', starts_on: '2026-11-02', ends_on: '2026-12-18' }), it(IS, 'Sans date', { starts_on: null, ends_on: null }), it(IB, 'Tâche B'), it(IC, 'Parent S', { starts_on: '2026-11-16', ends_on: '2026-11-17' }), it(ICC, 'Enfant S', { kind: 'subtask', parent_id: IC, starts_on: '2026-11-16', ends_on: '2026-11-16' })],
  cp_item_members: [], cp_calendar_days: [], cp_user_capacity: [], cp_item_links: [], cp_item_checks: [], cp_comments: [], cp_documents: [], cp_budget_lines: [], cp_user_rates: [], cp_item_resources: [],
  cp_externals: [
    { id: X1, name: 'Jean Prestataire', company: 'Sono SA', note: null, active: true },
    { id: X2, name: 'Marie Électricienne', company: null, note: 'Disponible le matin', active: true },
    { id: X3, name: 'Pierre Ancien', company: null, note: null, active: false },
  ],
  cp_item_externals: [{ item_id: IA, external_id: X1 }],
  cp_time_entries: [
    { id: 't1', item_id: IA, user_id: ME, work_date: '2026-11-05', minutes: 60, started_at: null, note: 'Préparation', created_at: now },
    { id: 't2', item_id: IA, user_id: ANNE, work_date: '2026-11-06', minutes: 45, started_at: null, note: null, created_at: now },
  ],
  platform_modules: [{ key: 'cp.projects', label: 'Projets', description: 'x', position: 1 }],
  users: [{ id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', active: true }, { id: ANNE, first_name: 'Anne', last_name: 'Dupont', email: 'anne@p.test', role: 'user', active: true }],
};
let canUpdate = true, canLog = true, seq = 100;
const calls = [];
const shift = (iso, freq, k) => { const d = new Date(iso + 'T12:00:00Z'); if (freq === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * k); else d.setUTCMonth(d.getUTCMonth() + (freq === 'monthly' ? k : 12 * k)); return d.toISOString().slice(0, 10); };
const RPC = {
  whoami: profile, my_notifications: [], unread_notification_count: 0, cp_can_discuss: true, my_cp_notification_prefs: [], cp_resource_issues: [],
};
const filt = (rows, url) => { let out = rows; for (const [k, v] of url.searchParams) { if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue; if (v === 'is.null') out = out.filter(r => r[k] == null); else if (v.startsWith('eq.')) out = out.filter(r => String(r[k]) === v.slice(3)); } return out; };
(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 1200 }, locale: 'fr-CH' });
  const sess = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 't@r.test', app_metadata: {}, user_metadata: {}, created_at: now } };
  await ctx.addInitScript(s => { try { if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(s)); } catch {} }, sess);
  await ctx.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));
  const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  const running = () => TABLES.cp_time_entries.find(t => t.user_id === ME && t.minutes == null);
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop(); const args = (() => { try { return req.postDataJSON() || {}; } catch { return {}; } })();
      calls.push({ fn, args });
      if (fn === 'rbac_has_any_permission') return json(canUpdate || !(args.p_keys || []).some(k => /:(create|update|delete)$/.test(k)));
      if (fn === 'cp_can_log_time') return json(canLog);
      if (fn === 'cp_repeat_item') {
        const src = TABLES.cp_items.find(i => i.id === args.p_item); const sid = src.series_id || 'serie-' + (++seq); const first = src.series_id ? Math.max(...TABLES.cp_items.filter(i => i.series_id === sid).map(i => i.series_index)) : 1;
        if (!src.series_id) { src.series_id = sid; src.series_index = 1; }
        for (let k = 1; k <= args.p_count; k++) TABLES.cp_items.push({ ...src, id: 'rep' + (++seq), starts_on: src.starts_on && shift(src.starts_on, args.p_freq, k), ends_on: src.ends_on && shift(src.ends_on, args.p_freq, k), series_id: sid, series_index: first + k, status_id: ST0 });
        return json(args.p_count);
      }
      if (fn === 'cp_delete_series_after') {
        const src = TABLES.cp_items.find(i => i.id === args.p_item); const later = TABLES.cp_items.filter(i => i.series_id === src.series_id && i.series_index > src.series_index);
        // la règle de la base est testée en SQL : ici une occurrence sur deux est « touchée » et gardée
        const gone = later.filter((_, i) => i % 2 === 0); TABLES.cp_items = TABLES.cp_items.filter(i => !gone.includes(i));
        return json([{ deleted: gone.length, kept: later.length - gone.length }]);
      }
      if (fn === 'cp_timer_stop') { const r = running(); if (!r) return json(null); r.minutes = 60; return json(60); }
      if (fn === 'cp_timer_start') {
        const r = running(); if (r && r.item_id === args.p_item) return json(r.id); if (r) r.minutes = 60;
        const e = { id: 'tm' + (++seq), item_id: args.p_item, user_id: ME, work_date: '2026-11-07', minutes: null, started_at: '2026-11-07T09:00:00+01:00', note: null, created_at: now }; TABLES.cp_time_entries.push(e); return json(e.id);
      }
      return json(fn in RPC ? RPC[fn] : null);
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').pop();
      if (req.method() !== 'GET') {
        const body = req.method() === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
        calls.push({ table, method: req.method(), query: url.search, body });
        const rows = Array.isArray(body) ? body : body ? [body] : [];
        let created = null;
        if (req.method() === 'POST') {
          if (table === 'cp_time_entries') rows.forEach(r => TABLES.cp_time_entries.push({ id: 'tn' + (++seq), user_id: ME, started_at: null, created_at: now, ...r }));
          if (table === 'cp_externals') { created = { id: 'xn' + (++seq), note: null, active: true, ...rows[0] }; TABLES.cp_externals.push(created); }
          if (table === 'cp_item_externals') rows.forEach(r => TABLES.cp_item_externals.push(r));
        }
        if (req.method() === 'PATCH') { const id = (url.searchParams.get('id') || '').slice(3); const arr = TABLES[table]; if (arr) TABLES[table] = arr.map(r => (r.id === id ? { ...r, ...body } : r)); }
        if (req.method() === 'DELETE') {
          if (table === 'cp_item_externals') TABLES.cp_item_externals = TABLES.cp_item_externals.filter(r => !(r.item_id === url.searchParams.get('item_id').slice(3) && r.external_id === url.searchParams.get('external_id').slice(3)));
          else if (TABLES[table] && url.searchParams.get('id')) { const id = url.searchParams.get('id').slice(3); TABLES[table] = TABLES[table].filter(r => r.id !== id); }
        }
        if (created) return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? created : [created]) });
        return route.fulfill({ status: 204, body: '' });
      }
      if (table === 'cp_time_entries') {
        const rows = filt(TABLES.cp_time_entries, url).map(r => ({ ...r, item: { name: (TABLES.cp_items.find(i => i.id === r.item_id) || {}).name } }));
        return json(rows);
      }
      const rows = filt(TABLES[table] || [], url);
      return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows);
    }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };
  const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
  const last = (key, v) => [...calls].reverse().find(c => (key === 'fn' ? c.fn === v : c.table === v));
  const lastW = (table, method) => [...calls].reverse().find(c => c.table === table && c.method === method);
  const openItem = async (name) => { await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Plus d\'options d\'affichage' }).click().catch(() => {}); await page.getByRole('menuitem', { name: 'Tout déplier' }).click().catch(() => {}); await page.waitForTimeout(400);
    await page.locator('button[title*=" · "]').filter({ hasText: new RegExp('^' + name + '$') }).first().click(); await page.getByRole('dialog').waitFor({ timeout: 10000 }); await page.waitForTimeout(500); };
  const ensureOpen = async (sel, label) => { const h = page.locator(sel).getByRole('button', { name: label }).first(); if ((await h.getAttribute('aria-expanded')) !== 'true') await h.click(); await page.waitForTimeout(500); };
  const closeDrawer = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(400); };
  const oneLine = async () => page.evaluate(() => {
    const bar = document.querySelector('[data-pilote-toolbar]');
    if (!bar) return null;
    const kids = [...bar.querySelectorAll('button, input, h2')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const tops = kids.map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2));
    const r = bar.getBoundingClientRect();
    return { n: kids.length, spread: Math.max(...tops) - Math.min(...tops), height: Math.round(r.height), overflow: bar.scrollWidth - bar.clientWidth };
  });
  const viewButton = () => page.getByRole('button', { name: /^Vue : / });
  const viewLabel = async () => ((await viewButton().getAttribute('aria-label')) || '').replace(/^Vue : /, '').replace(/\. Changer de vue$/, '');
  await page.setViewportSize({ width: 1366, height: 800 });

  for (const [view, label] of [['gantt', 'Gantt'], ['board', 'Tableau'], ['agenda', 'Calendrier']]) {
    await page.goto(BASE + '/pilote/projets?view=' + view); await viewButton().waitFor({ timeout: 25000 }); await page.waitForTimeout(1200);
    const m = await oneLine();
    check(`1 ${label} : tous les outils tiennent sur UNE ligne à 1366 px (écart vertical ${m && m.spread} px, hauteur ${m && m.height} px, ${m && m.n} contrôles)`, !!m && m.n >= 6 && m.spread <= 6 && m.height <= 44 && m.overflow <= 0, JSON.stringify(m));
    check(`2 ${label} : le menu des vues affiche « ${label} »`, (await viewLabel()) === label);
  }

  // Menu des vues : 9 destinations en trois groupes ; choisir une autre vue la change
  await page.goto(BASE + '/pilote/projets?view=gantt'); await viewButton().waitFor({ timeout: 25000 });
  await viewButton().click(); await page.waitForTimeout(300);
  const menuText = (await page.getByRole('menu').innerText()).replace(/\s+/g, ' ');
  check('3 le menu range 9 vues en 3 groupes : Pilotage, Planification, Listes', /PILOTAGE Synthèse Budget Charge PLANIFICATION Gantt Tableau Calendrier LISTES Projets \(\d+\) Mes tâches Modèles \(\d+\)/i.test(menuText), menuText);
  check('4 la vue courante est cochée dans le menu', (await page.getByRole('menuitemradio', { name: 'Gantt' }).getAttribute('aria-checked')) === 'true');
  await page.getByRole('menuitemradio', { name: 'Tableau' }).click(); await page.waitForTimeout(800);
  check('5 choisir « Tableau » affiche le tableau et le bouton annonce « Tableau »', (await viewLabel()) === 'Tableau' && (await page.locator('[data-card]').count()) > 0);
  await viewButton().click(); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check('6 Échap referme le menu sans changer de vue', (await page.getByRole('menu').count()) === 0 && (await viewLabel()) === 'Tableau');

  // Panneau « Filtres »
  await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(900);
  const filtres = () => page.getByRole('button', { name: /^Filtres/ });
  check('7 « Filtres » est un seul bouton replié (aucune liste de filtres visible au départ)', (await filtres().getAttribute('aria-expanded')) === 'false' && (await page.locator('[data-filter-panel]').count()) === 0);
  await filtres().click(); await page.waitForTimeout(300);
  check('8 le panneau montre personne, état, priorité, type, « en retard seulement » et les vues enregistrées', (await page.locator('[data-filter-panel] select').count()) === 4 && (await page.getByLabel(/En retard seulement/).count()) === 1 && (await page.getByText('Vues enregistrées').count()) === 1);
  await page.getByLabel(/^Priorité/).selectOption({ label: 'Haute' }).catch(() => {}); await page.waitForTimeout(400);
  const active = (await filtres().innerText()).replace(/\s+/g, ' ').trim();
  check('9 le bouton annonce le nombre de filtres actifs et « Tout afficher » apparaît', /^Filtres \(1\)$/.test(active) && (await page.getByRole('button', { name: 'Tout afficher' }).count()) === 1, active);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check('10 Échap referme le panneau, le filtre reste actif', (await page.locator('[data-filter-panel]').count()) === 0 && /^Filtres \(1\)$/.test((await filtres().innerText()).replace(/\s+/g, ' ').trim()));
  await filtres().click(); await page.waitForTimeout(200); await page.mouse.click(700, 600); await page.waitForTimeout(250);
  check('11 un clic à côté referme le panneau', (await page.locator('[data-filter-panel]').count()) === 0);
  await page.getByRole('button', { name: 'Tout afficher' }).click(); await page.waitForTimeout(300);
  check('12 « Tout afficher » remet le bouton à « Filtres »', (await filtres().innerText()).replace(/\s+/g, ' ').trim() === 'Filtres');
  await filtres().click(); await page.waitForTimeout(250);
  await page.screenshot({ path: process.argv[2] + '/barre-filtres.png' });
  await page.keyboard.press('Escape');

  // 1280 px (portable courant) : toujours une seule ligne
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(500);
  const m1280 = await oneLine();
  check(`13b à 1280 px, tout tient encore sur UNE ligne (écart ${m1280 && m1280.spread} px, hauteur ${m1280 && m1280.height} px)`, !!m1280 && m1280.spread <= 6 && m1280.height <= 44, JSON.stringify(m1280));

  // Écran plus étroit : les outils passent à la ligne sans rien couper
  await page.setViewportSize({ width: 1100, height: 800 }); await page.waitForTimeout(500);
  const narrow = await oneLine();
  check('13 à 1100 px, rien n\'est coupé (pas de défilement horizontal de la barre, page entière comprise)', !!narrow && narrow.overflow <= 0 && (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, JSON.stringify(narrow));
  await page.screenshot({ path: process.argv[2] + '/barre-1100.png' });

  check('14 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
