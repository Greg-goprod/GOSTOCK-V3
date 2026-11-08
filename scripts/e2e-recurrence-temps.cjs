// Répétition d'une tâche, intervenants externes, temps passé (chronomètre et saisie) — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée),
// date figée au 7 novembre 2026 à 10 h 00. Les calculs de dates et les droits sont ceux de la base (testés en SQL) ; ici on vérifie ce que l'écran en fait.
// Lancer : node scripts/run-pilote-e2e.cjs   (ou, à la main : serveur sur le port 5197 avec VITE_SUPABASE_URL=http://mock.supabase.test, puis node scripts/e2e-recurrence-temps.cjs <dossier>)
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

  /* ------------------------------------------------------------ répétition */
  await openItem('Montage scène');
  check('1 la fiche a les trois nouvelles sections', (await page.locator('[data-repeat]').count()) === 1 && (await page.locator('[data-externals]').count()) === 1 && (await page.locator('[data-time]').count()) === 1);
  await ensureOpen('[data-repeat]', /Répétition/);
  check('2 tâche qui ne se répète pas encore : texte d\'explication et bouton « Répéter… »', /ne se répète pas/.test(await txt(page.locator('[data-repeat]'))) && (await page.getByRole('button', { name: 'Répéter…' }).count()) === 1);
  await page.getByRole('button', { name: 'Répéter…' }).click(); await page.getByRole('radiogroup', { name: 'Fréquence' }).waitFor();
  check('3 la fenêtre propose les 3 fréquences, 4 répétitions par défaut et un aperçu des dates', (await page.getByRole('radio').filter({ hasText: /Chaque/ }).count()) === 3 && (await page.locator('#rep-count').inputValue()) === '4' && /4 nouvelles occurrences/.test(await txt(page.locator('[data-repeat-preview]'))));
  const preview = await txt(page.locator('[data-repeat-preview]'));
  check('4 aperçu hebdomadaire de la tâche du 9 au 10 novembre : 16.11 → 17.11, 23.11 → 24.11, 30.11 → 01.12, puis la 4e (07.12 → 08.12)', /16\.11\.2026 → 17\.11\.2026/.test(preview) && /23\.11\.2026 → 24\.11\.2026/.test(preview) && /30\.11\.2026 → 01\.12\.2026/.test(preview) && /07\.12\.2026 → 08\.12\.2026/.test(preview), preview);
  await page.getByRole('radio', { name: 'Chaque mois' }).click(); await page.locator('#rep-count').fill('3'); await page.waitForTimeout(200);
  const previewM = await txt(page.locator('[data-repeat-preview]'));
  check('5 aperçu mensuel ×3 : 09.12 → 10.12, 09.01 → 10.01, 09.02 → 10.02', /09\.12\.2026 → 10\.12\.2026/.test(previewM) && /09\.01\.2027 → 10\.01\.2027/.test(previewM) && /09\.02\.2027 → 10\.02\.2027/.test(previewM), previewM);
  await page.locator('#rep-count').fill('0');
  check('6 0 répétition : message d\'erreur et bouton désactivé', (await page.getByText('Entre un nombre entier de 1 à 52.').count()) === 1 && (await page.getByRole('button', { name: 'Créer', exact: true }).isDisabled()));
  await page.locator('#rep-count').fill('53');
  check('7 53 répétitions : refusé', (await page.getByText('Entre un nombre entier de 1 à 52.').count()) === 1 && (await page.getByRole('button', { name: 'Créer', exact: true }).isDisabled()));
  await page.locator('#rep-count').fill('abc');
  check('8 texte : refusé', (await page.getByRole('button', { name: 'Créer', exact: true }).isDisabled()));
  await page.locator('#rep-count').fill('3'); await page.waitForTimeout(200);
  await page.locator('#rep-skip').check(); await page.waitForTimeout(200);
  const previewSkip = await txt(page.locator('[data-repeat-preview]'));
  check('8b option « éviter les week-ends » : samedi 09.01.2027 → lundi 11.01, durée conservée (11.01 → 12.01)', /11\.01\.2027 → 12\.01\.2027/.test(previewSkip) && !/09\.01\.2027/.test(previewSkip), previewSkip);
  await page.locator('#rep-skip').uncheck(); await page.waitForTimeout(200);
  check('8c l\'option décochée rend les dates brutes (09.01.2027 de nouveau)', /09\.01\.2027 → 10\.01\.2027/.test(await txt(page.locator('[data-repeat-preview]'))));
  await page.getByRole('button', { name: 'Créer 3 occurrences' }).click(); await page.waitForTimeout(1200);
  const rep = last('fn', 'cp_repeat_item');
  check('9 la demande envoyée à la base : la tâche, « monthly », 3', !!rep && rep.args.p_item === IA && rep.args.p_freq === 'monthly' && rep.args.p_count === 3 && rep.args.p_skip_nonworking === false, JSON.stringify(rep));
  check('10 la fenêtre se ferme et l\'en-tête de la section annonce « 1 sur 4 »', (await page.getByRole('radiogroup', { name: 'Fréquence' }).count()) === 0 && /Répétition \(1 sur 4\)/.test(await txt(page.locator('[data-repeat]'))), await txt(page.locator('[data-repeat]')));
  check('11 la série a bien 4 éléments dans les données', TABLES.cp_items.filter(i => i.series_id).length === 4);
  await page.screenshot({ path: process.argv[2] + '/p13-repetition.png' });
  await ensureOpen('[data-repeat]', /Répétition/);
  check('12 occurrence 1 sur 4 : « Supprimer les 3 suivantes » proposé, « Prolonger » absent (ce n\'est pas la dernière)', (await page.getByRole('button', { name: 'Supprimer les 3 suivantes' }).count()) === 1 && (await page.getByRole('button', { name: 'Prolonger la série…' }).count()) === 0 && /Pour prolonger la série, ouvre sa dernière occurrence/.test(await txt(page.locator('[data-series-info]'))));
  await page.getByRole('button', { name: 'Supprimer les 3 suivantes' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click(); await page.waitForTimeout(1000);
  const del = last('fn', 'cp_delete_series_after');
  check('13 suppression des suivantes : demandée pour cette tâche, résultat annoncé (2 supprimées, 1 gardée car déjà travaillée)', !!del && del.args.p_item === IA && (await page.getByText(/2 supprimée\(s\), 1 gardée\(s\) car déjà travaillée\(s\)/).count()) >= 1);
  check('14 il reste 2 éléments dans la série (celui-ci et la gardée)', TABLES.cp_items.filter(i => i.series_id).length === 2);
  await closeDrawer();

  // Dernière occurrence : on peut prolonger
  const lastOcc = TABLES.cp_items.filter(i => i.series_id).sort((a, b) => b.series_index - a.series_index)[0];
  await page.goto(BASE + '/pilote/projets?item=' + lastOcc.id); await page.getByRole('dialog').waitFor({ timeout: 15000 }); await page.waitForTimeout(600);
  await ensureOpen('[data-repeat]', /Répétition/);
  check('15 dernière occurrence : « Prolonger la série… » proposé', (await page.getByRole('button', { name: 'Prolonger la série…' }).count()) === 1 && (await page.getByRole('button', { name: /^Supprimer les/ }).count()) === 0);
  await page.getByRole('button', { name: 'Prolonger la série…' }).click(); await page.getByRole('radiogroup', { name: 'Fréquence' }).waitFor();
  check('16 prolonger : fenêtre titrée « Prolonger la série », de 1 à 52 répétitions possibles', (await page.getByRole('dialog').filter({ hasText: 'Prolonger la série' }).count()) >= 1 && /1 à 52/.test(await txt(page.locator('label[for="rep-count"]'))));
  await page.locator('#rep-count').fill('1'); await page.locator('#rep-skip').check();
  await page.getByRole('button', { name: 'Créer 1 occurrence' }).click(); await page.waitForTimeout(1200);
  const repSkip = last('fn', 'cp_repeat_item');
  check('16b prolonger avec l\'option cochée : la demande envoie « éviter les jours non ouvrés » (p_skip_nonworking = true) et p_count = 1', !!repSkip && repSkip.args.p_skip_nonworking === true && repSkip.args.p_count === 1, JSON.stringify(repSkip && repSkip.args));
  await closeDrawer();

  // Éléments qu'on ne répète pas
  await openItem('Phase Alpha'); await ensureOpen('[data-repeat]', /Répétition/);
  check('17 une phase : message d\'explication, pas de bouton « Répéter… »', /Une phase ne se répète pas/.test(await txt(page.locator('[data-repeat-blocked]'))) && (await page.getByRole('button', { name: 'Répéter…' }).count()) === 0);
  await closeDrawer();
  await openItem('Sans date'); await ensureOpen('[data-repeat]', /Répétition/);
  check('18 sans date : « Donne d\'abord une date », pas de bouton', /Donne d'abord une date/.test(await txt(page.locator('[data-repeat-blocked]'))) && (await page.getByRole('button', { name: 'Répéter…' }).count()) === 0);
  await closeDrawer();
  await openItem('Parent S'); await ensureOpen('[data-repeat]', /Répétition/);
  check('18b une tâche qui a des sous-tâches se répète (plus de blocage) : bouton « Répéter… », aucun message de refus', (await page.getByRole('button', { name: 'Répéter…' }).count()) === 1 && (await page.locator('[data-repeat-blocked]').count()) === 0);
  await page.getByRole('button', { name: 'Répéter…' }).click(); await page.getByRole('radiogroup', { name: 'Fréquence' }).waitFor();
  check('18c la fenêtre annonce que la sous-tâche est copiée avec chaque occurrence', /1 sous-tâche copiée avec chaque occurrence, au même écart que dans l'original\./.test(await txt(page.locator('[data-repeat-children]'))), await txt(page.locator('[data-repeat-preview]')));
  await page.getByRole('button', { name: 'Annuler' }).last().click(); await closeDrawer();

  /* ------------------------------------------------------ intervenants externes */
  await openItem('Montage scène'); await ensureOpen('[data-externals]', /Intervenants externes/);
  check('19 intervenant déjà assigné affiché avec sa société', /Jean Prestataire \(Sono SA\)/.test(await txt(page.locator('[data-external-list]'))));
  const opts = (await page.locator('#ext-pick option').allInnerTexts()).map(s => s.trim());
  check('20 la liste des choix exclut l\'assigné et l\'inactif', opts.join('|') === 'Choisir un intervenant…|Marie Électricienne', opts.join('|'));
  await page.locator('#ext-pick').selectOption(X2); await page.getByRole('button', { name: 'Ajouter', exact: true }).last().click(); await page.waitForTimeout(900);
  const ai = lastW('cp_item_externals', 'POST');
  check('21 ajout d\'un intervenant existant : affectation envoyée (tâche, intervenant)', !!ai && ai.body.item_id === IA && ai.body.external_id === X2, JSON.stringify(ai && ai.body));
  check('22 il apparaît dans la liste', /Marie Électricienne/.test(await txt(page.locator('[data-external-list]'))) && (await page.locator('[data-external]').count()) === 2);
  await page.locator('#ext-name').fill('Paul Nouveau'); await page.locator('#ext-company').fill('Lumières SA');
  await page.getByRole('button', { name: 'Créer et ajouter' }).click(); await page.waitForTimeout(1000);
  const ce = lastW('cp_externals', 'POST'); const ai2 = lastW('cp_item_externals', 'POST');
  check('23 création + affectation : l\'intervenant est créé (nom, société) PUIS affecté avec son nouvel identifiant', !!ce && ce.body.name === 'Paul Nouveau' && ce.body.company === 'Lumières SA' && !!ai2 && /^xn/.test(ai2.body.external_id) && ai2.body.item_id === IA, JSON.stringify([ce && ce.body, ai2 && ai2.body]));
  check('24 les champs sont vidés et le nouvel intervenant est dans la liste', (await page.locator('#ext-name').inputValue()) === '' && /Paul Nouveau \(Lumières SA\)/.test(await txt(page.locator('[data-external-list]'))));
  await page.getByRole('button', { name: 'Retirer Jean Prestataire (Sono SA)' }).click(); await page.waitForTimeout(900);
  const rm = lastW('cp_item_externals', 'DELETE');
  check('25 retrait : DELETE de cette affectation seulement (tâche et intervenant)', !!rm && rm.query.includes(IA) && rm.query.includes(X1) && (await page.locator('[data-external]').count()) === 2, JSON.stringify(rm));
  await page.getByRole('button', { name: /Intervenants externes/ }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: process.argv[2] + '/p13-externes.png' });
  await closeDrawer();

  /* ------------------------------------------------------------- temps passé */
  TABLES.cp_time_entries.push({ id: 'trun', item_id: IB, user_id: ME, work_date: '2026-11-07', minutes: null, started_at: '2026-11-07T09:00:00+01:00', note: null, created_at: now });
  await openItem('Montage scène');
  const bar = page.locator('[data-timer-bar]');
  check('26 barre du chronomètre en cours : tâche et temps écoulé (1 h 00 min 00 s depuis 9 h 00)', (await bar.count()) === 1 && /« Tâche B »/.test(await txt(bar)) && (await txt(bar.locator('[data-timer-bar-elapsed]'))) === '01:00:00', await txt(bar));
  await ensureOpen('[data-time]', /Temps passé/);
  const summary = await txt(page.locator('[data-time-summary]'));
  check('27 responsable : total de toute l\'équipe (1 h 45), dont 1 h à lui, comparé à l\'estimation de 2 h', /1 h 45 au total/.test(summary) && /dont 1 h à toi/.test(summary) && /estimé 2 h/.test(summary), summary);
  const list = await txt(page.locator('[data-time-list]'));
  check('28 la liste montre le temps des autres avec leur nom, et celui à soi sans nom', /Anne Dupont/.test(list) && /Préparation/.test(list) && !/Test Responsable/.test(list));
  check('29 chronomètre sur une AUTRE tâche : message et bouton « Démarrer ici (arrête l\'autre) »', /Chronomètre en cours sur « Tâche B »/.test(await txt(page.locator('[data-time]'))) && (await page.getByRole('button', { name: 'Démarrer ici (arrête l\'autre)' }).count()) === 1);
  await page.getByRole('button', { name: 'Démarrer ici (arrête l\'autre)' }).click(); await page.waitForTimeout(1200);
  const st = last('fn', 'cp_timer_start');
  check('30 démarrer ici : la base reçoit cette tâche ; le chronomètre de Tâche B est arrêté, celui-ci tourne', !!st && st.args.p_item === IA && TABLES.cp_time_entries.find(t => t.id === 'trun').minutes === 60 && !!running() && running().item_id === IA);
  check('31 la fiche affiche le chronomètre (role timer) et « Arrêter » ; la barre du haut suit la nouvelle tâche', (await page.getByRole('timer', { name: 'Chronomètre en cours' }).count()) === 1 && (await page.getByRole('button', { name: 'Arrêter' }).count()) >= 1 && /« Montage scène »/.test(await txt(page.locator('[data-timer-bar]'))), await txt(page.locator('[data-timer-bar]')));
  await page.locator('[data-time]').getByRole('button', { name: 'Arrêter' }).click(); await page.waitForTimeout(1000);
  check('32 arrêter : appel à la base, plus de barre, la saisie apparaît dans la liste (« 1 h »)', !!last('fn', 'cp_timer_stop') && (await page.locator('[data-timer-bar]').count()) === 0 && (await page.locator('[data-time-entry]').count()) === 3);
  // Saisie à la main
  await page.locator('#tm-dur').fill('beaucoup'); await page.getByRole('button', { name: 'Ajouter', exact: true }).last().click(); await page.waitForTimeout(500);
  check('33 durée illisible : message et rien d\'envoyé', (await page.getByText(/Durée : par exemple 1 h 30/).count()) >= 1 && !lastW('cp_time_entries', 'POST'));
  check('34 le champ « Jour » ne permet pas de choisir un jour futur (max = aujourd\'hui)', (await page.locator('#tm-date').getAttribute('max')) === '2026-11-07' && (await page.locator('#tm-date').inputValue()) === '2026-11-07');
  await page.locator('#tm-dur').fill('1 h 30'); await page.locator('#tm-note').fill('Montage'); await page.getByRole('button', { name: 'Ajouter', exact: true }).last().click(); await page.waitForTimeout(1000);
  const add = lastW('cp_time_entries', 'POST');
  check('35 saisie « 1 h 30 » : tâche, jour d\'aujourd\'hui, 90 minutes (nombre), note', !!add && add.body.item_id === IA && add.body.work_date === '2026-11-07' && add.body.minutes === 90 && add.body.note === 'Montage', JSON.stringify(add && add.body));
  check('36 aucune personne dans la requête (la base pose la sienne) et les champs sont vidés', !('user_id' in add.body) && (await page.locator('#tm-dur').inputValue()) === '');
  await page.locator('#tm-dur').fill('2:15'); await page.locator('#tm-dur').press('Enter'); await page.waitForTimeout(900);
  check('37 Entrée valide la saisie « 2:15 » = 135 minutes', lastW('cp_time_entries', 'POST').body.minutes === 135);
  // Modifier / supprimer
  const mine = page.locator('[data-time-entry="t1"]');
  await mine.getByRole('button', { name: /Modifier la saisie/ }).click();
  await mine.getByLabel('Durée').fill('3 h'); await mine.getByLabel('Note').fill('Corrigé'); await mine.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(900);
  const pa = lastW('cp_time_entries', 'PATCH');
  check('38 modifier sa saisie : PATCH sur la bonne ligne (180 min, note, jour)', !!pa && /id=eq\.t1/.test(pa.query) && pa.body.minutes === 180 && pa.body.note === 'Corrigé' && pa.body.work_date === '2026-11-05', JSON.stringify(pa));
  check('39 le temps des AUTRES n\'a ni crayon ni corbeille', (await page.locator('[data-time-entry="t2"]').getByRole('button').count()) === 0);
  await page.locator('[data-time-entry="t1"]').getByRole('button', { name: /Supprimer la saisie/ }).click(); await page.getByRole('button', { name: 'Confirmer' }).click(); await page.waitForTimeout(900);
  const dt = lastW('cp_time_entries', 'DELETE');
  check('40 supprimer sa saisie (avec confirmation) : DELETE sur la bonne ligne', !!dt && /id=eq\.t1/.test(dt.query) && (await page.locator('[data-time-entry="t1"]').count()) === 0, JSON.stringify(dt));
  await page.screenshot({ path: process.argv[2] + '/p13-temps.png' });
  await closeDrawer();

  // Quelqu'un qui n'est pas de l'équipe : lecture seulement, pas de chronomètre ni de saisie
  canLog = false;
  await openItem('Montage scène'); await ensureOpen('[data-time]', /Temps passé/);
  check('41 sans droit de saisie : ni chronomètre ni formulaire, mais une explication', (await page.locator('[data-time-form]').count()) === 0 && (await page.getByRole('button', { name: 'Démarrer le chronomètre' }).count()) === 0 && /Tu saisis ton temps sur les tâches des projets dont tu fais partie/.test(await txt(page.locator('[data-time]'))));
  await closeDrawer(); canLog = true;

  /* ---------------------------------------------------- réglages › intervenants */
  await page.goto(BASE + '/pilote/projets'); await page.getByRole('button', { name: 'Réglages des projets' }).waitFor({ timeout: 25000 });
  await page.getByRole('button', { name: 'Réglages des projets' }).click(); await page.getByRole('menuitem', { name: 'Intervenants externes' }).click(); await page.waitForTimeout(700);
  const admin = await txt(page.locator('main, body').first());
  check('42 réglages › intervenants externes : la liste avec société, note et état', /Jean Prestataire/.test(admin) && /Sono SA/.test(admin) && /Disponible le matin/.test(admin) && /Inactif/.test(admin) && /Actif/.test(admin));
  await page.getByRole('button', { name: 'Nouvel intervenant' }).click(); await page.locator('#crud-name').fill('Zoé Nouvelle'); await page.locator('#crud-company').fill('Scène SA'); await page.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(900);
  const nx = lastW('cp_externals', 'POST');
  check('43 création depuis les réglages : nom, société, actif par défaut', !!nx && nx.body.name === 'Zoé Nouvelle' && nx.body.company === 'Scène SA' && nx.body.active === true, JSON.stringify(nx && nx.body));
  await page.getByRole('button', { name: /Supprimer/ }).first().click(); await page.getByRole('button', { name: 'Confirmer' }).click(); await page.waitForTimeout(900);
  check('44 supprimer un intervenant demande confirmation et envoie un DELETE', !!lastW('cp_externals', 'DELETE'));

  // Lecture seule : sections visibles, aucun contrôle de modification
  canUpdate = false;
  await openItem('Montage scène'); await ensureOpen('[data-externals]', /Intervenants externes/); await ensureOpen('[data-repeat]', /Répétition/);
  check('45 lecture seule : intervenants listés sans ajout ni retrait, pas de bouton « Répéter… »', (await page.locator('[data-external]').count()) >= 1 && (await page.locator('#ext-pick').count()) === 0 && (await page.getByRole('button', { name: /^Retirer/ }).count()) === 0 && (await page.getByRole('button', { name: /Répéter…|Prolonger la série…/ }).count()) === 0);

  check('46 aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} OK`);
  await b.close(); process.exit(ok === results.length ? 0 : 1);
})();
