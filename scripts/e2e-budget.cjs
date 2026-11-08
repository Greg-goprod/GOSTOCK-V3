// Budget par projet PILOTE (lignes prévu / engagé / réel, taux horaires, main-d'œuvre estimée, droit séparé) — test dans un vrai navigateur,
// base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Lancer : node scripts/run-pilote-e2e.cjs   (ou, à la main : serveur sur le port 5197 avec VITE_SUPABASE_URL=http://mock.supabase.test, puis node scripts/e2e-budget.cjs <dossier>)
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:5197';
const ME = 'aaaaaaaa-0000-0000-0000-000000000001', OTHER = 'aaaaaaaa-0000-0000-0000-000000000002';
const P1 = '11111111-0000-0000-0000-000000000001', P2 = '11111111-0000-0000-0000-000000000002';
const ORG = '44444444-0000-0000-0000-000000000001';
const profile = { id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', permissions: ['view_all', 'scan', 'approve', 'manage_stock', 'settings', 'manage_users'], depot_ids: [], organization: { id: ORG, name: 'Org' }, organizations: [], modules: ['cp.projects', 'cp.planning', 'logistics'], platform_admin: true };
const now = new Date().toISOString();
const day = (n) => { const d = new Date(new Date('2026-11-07T10:00:00+01:00').getTime() + n * 86400000); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(d); };
const ST0 = '33333333-0000-0000-0000-000000000001', ST1 = '33333333-0000-0000-0000-000000000002', ST2 = '33333333-0000-0000-0000-000000000003';
const base = { organization_id: ORG, priority: null, color: '#6366f1', description: null, site_id: null, link_mode: 'overlap', link_skip_weekends: true, created_at: now, updated_at: now };
const it = (id, project_id, name, status_id, s, e, extra = {}) => ({ ...base, id, project_id, parent_id: null, kind: 'task', name, position: 1, starts_on: day(s), ends_on: day(e), status_id, version: 1, ...extra });
const IA = '22222222-0000-0000-0000-00000000000a', IB = '22222222-0000-0000-0000-00000000000b', IC = '22222222-0000-0000-0000-00000000000c', ID = '22222222-0000-0000-0000-00000000000d';
const line = (id, project_id, category, planned, committed, actual, note = null, position = 0) => ({ id, organization_id: ORG, project_id, category, planned, committed, actual, note, position, created_at: now, updated_at: now });
const TABLES = {
  cp_statuses: [{ id: ST0, name: 'Pas commencé', family: 'not_started', color: '#999999', position: 0, is_system: true }, { id: ST1, name: 'En cours', family: 'in_progress', color: '#3b82f6', position: 1, is_system: true }, { id: ST2, name: 'Terminé', family: 'done', color: '#10b981', position: 2, is_system: true }],
  cp_projects: [{ ...base, id: P1, type: 'site', name: 'Projet Alpha', status_id: ST1, starts_on: day(-10), ends_on: day(20) }, { ...base, id: P2, type: 'rd', name: 'Projet Beta', status_id: ST1, starts_on: day(-8), ends_on: day(15) }],
  cp_project_members: [{ project_id: P1, user_id: ME, role: 'lead' }, { project_id: P2, user_id: OTHER, role: 'lead' }],
  sites: [],
  cp_items: [
    { ...it(IA, P1, 'Montage scène', ST1, 0, 0), starts_on: '2026-11-02', ends_on: '2026-11-06', estimate_hours: 50 },
    { ...it(IB, P1, 'Réglage lumière', ST1, 0, 0), starts_on: '2026-11-09', ends_on: '2026-11-13', estimate_hours: 20 },
    { ...it(IC, P2, 'Prototype boîtier', ST1, 0, 0), starts_on: '2026-11-16', ends_on: '2026-11-20', estimate_hours: null },
    { ...it(ID, P2, 'Essais mesures', ST1, 0, 0), starts_on: '2026-11-16', ends_on: '2026-11-20', estimate_hours: 30 },
  ],
  cp_item_members: [{ item_id: IA, user_id: ME }, { item_id: IB, user_id: ME }, { item_id: IB, user_id: OTHER }, { item_id: IC, user_id: OTHER }, { item_id: ID, user_id: OTHER }],
  cp_calendar_days: [], cp_user_capacity: [], cp_item_links: [], cp_item_checks: [], cp_comments: [], cp_documents: [],
  cp_budget_lines: [
    line('b1', P1, 'Matériel', 12000, 8000, 3500.25, 'Location scène', 1),
    line('b2', P1, 'Prestataires', 5000, 0, 0, null, 2),
    line('b3', P2, 'Divers', 1000, 1200, 0, null, 1),
  ],
  cp_user_rates: [{ user_id: ME, hourly_rate: 100 }],   // Autre personne : pas de taux
  platform_modules: [{ key: 'cp.projects', label: 'Projets', description: 'x', position: 1 }],
  users: [{ id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', active: true }, { id: OTHER, first_name: 'Autre', last_name: 'Personne', email: 'a@p.test', role: 'user', active: true }],
};
// Droits de la personne connectée : tout, sauf si le scénario retire « cp.budget »
let budgetRights = new Set(['read', 'create', 'update', 'delete']);
const RPC = { whoami: profile, my_notifications: [], unread_notification_count: 0, cp_can_discuss: true, my_cp_notification_prefs: [] };
const filt = (rows, url) => { let out = rows; for (const [k, v] of url.searchParams) { if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue; if (v === 'is.null') out = out.filter(r => r[k] == null); else if (v.startsWith('eq.')) out = out.filter(r => String(r[k]) === v.slice(3)); } return out; };
(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 1000 }, locale: 'fr-CH' });
  const sess = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 't@r.test', app_metadata: {}, user_metadata: {}, created_at: now } };
  await ctx.addInitScript(s => { try { if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(s)); } catch {} }, sess);
  await ctx.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));
  const writes = []; const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop();
      if (fn === 'rbac_has_any_permission') { const keys = (req.postDataJSON() || {}).p_keys || []; return json(keys.every(k => !k.startsWith('cp.budget:') || budgetRights.has(k.split(':')[1]))); }
      // Temps réellement saisi (migration 75) : sur Alpha, 2 h 30 pour ME (taux 100) et 45 min pour une personne sans taux ; rien ailleurs
      if (fn === 'cp_project_time_by_user') return json((req.postDataJSON() || {}).p_project === P1 ? [{ user_id: ME, minutes: 150 }, { user_id: OTHER, minutes: '45' }] : []);
      return json(fn in RPC ? RPC[fn] : null);
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').pop();
      if (req.method() !== 'GET') {
        if (table === 'cp_budget_lines' || table === 'cp_user_rates') {
          const body = req.method() === 'DELETE' ? null : req.postDataJSON();
          writes.push({ table, method: req.method(), query: url.search, body });
          if (table === 'cp_budget_lines' && req.method() === 'POST') (Array.isArray(body) ? body : [body]).forEach((r, i) => TABLES.cp_budget_lines.push({ id: 'bn' + Math.random().toString(36).slice(2), organization_id: ORG, note: null, created_at: now, updated_at: now, ...r }));
          if (table === 'cp_budget_lines' && req.method() === 'PATCH') { const id = url.searchParams.get('id').slice(3); TABLES.cp_budget_lines = TABLES.cp_budget_lines.map(r => (r.id === id ? { ...r, ...body } : r)); }
          if (table === 'cp_budget_lines' && req.method() === 'DELETE') { const id = url.searchParams.get('id').slice(3); TABLES.cp_budget_lines = TABLES.cp_budget_lines.filter(r => r.id !== id); }
          if (table === 'cp_user_rates' && req.method() === 'POST') (Array.isArray(body) ? body : [body]).forEach(r => { const ex = TABLES.cp_user_rates.find(x => x.user_id === r.user_id); if (ex) ex.hourly_rate = r.hourly_rate; else TABLES.cp_user_rates.push({ ...r }); });
          if (table === 'cp_user_rates' && req.method() === 'DELETE') { const uid = url.searchParams.get('user_id').slice(3); TABLES.cp_user_rates = TABLES.cp_user_rates.filter(r => r.user_id !== uid); }
        }
        return route.fulfill({ status: 204, body: '' });
      }
      // Sans le droit de lecture, la base ne renvoie aucune ligne de budget (RLS)
      if ((table === 'cp_budget_lines' || table === 'cp_user_rates') && !budgetRights.has('read')) return json([]);
      const rows = filt(TABLES[table] || [], url);
      return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows);
    }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };
  const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
  const lastWrite = (table, method) => [...writes].reverse().find(w => w.table === table && w.method === method);

  const goBudget = async () => { await page.goto(BASE + '/pilote/projets'); const top = page.getByRole('radio', { name: 'Pilotage', exact: true }); await top.waitFor({ timeout: 25000 }); await top.click(); const tab = page.getByRole('radio', { name: 'Budget', exact: true }); await tab.waitFor({ timeout: 15000 }); await tab.click(); await page.waitForSelector('[data-budget-summary]', { timeout: 15000 }); await page.waitForTimeout(500); };
  const kpi = async (id) => (await txt(page.locator(`[data-kpi="${id}"] dd`))).replace(/\s*CHF$/, '');

  // 1. Navigation : un onglet « Pilotage » regroupe Synthèse, Budget et Charge
  await page.goto(BASE + '/pilote/projets'); await page.getByRole('radio', { name: 'Pilotage', exact: true }).waitFor({ timeout: 25000 });
  const topNames = await page.getByRole('radiogroup', { name: 'Vues des projets' }).getByRole('radio').allInnerTexts();
  check('1 onglets principaux : Pilotage remplace Synthèse et Charge', topNames.map(s => s.replace(/\s*\(\d+\)/, '').trim()).join('|') === 'Pilotage|Gantt|Tableau|Calendrier|Projets|Mes tâches|Modèles', topNames.join('|'));
  await page.getByRole('radio', { name: 'Pilotage', exact: true }).click(); await page.waitForTimeout(400);
  const subNames = await page.getByRole('radiogroup', { name: 'Pilotage', exact: true }).getByRole('radio').allInnerTexts();
  check('2 sous-vues de Pilotage : Synthèse, Budget, Charge', subNames.join('|') === 'Synthèse|Budget|Charge', subNames.join('|'));

  await goBudget();
  // 2. Totaux : prévu 12000+5000+1000, engagé 8000+0+1200, réel 3500,25
  check('3 total prévu 18\'000', (await kpi('planned')) === "18'000", await kpi('planned'));
  check('4 total engagé 9\'200', (await kpi('committed')) === "9'200");
  check('5 total réel 3\'500.25', (await kpi('actual')) === "3'500.25");
  check('6 écart prévu − réel = 14\'499.75', (await kpi('variance')) === "14'499.75");
  const rowOf = (name) => page.locator('tbody tr').filter({ has: page.getByRole('button', { name, exact: true }) });
  const rowA = await txt(rowOf('Projet Alpha')), rowB = await txt(rowOf('Projet Beta'));
  check('7 Alpha : prévu 17\'000, engagé 8\'000, réel 3\'500.25, écart 13\'499.75, Dans le budget (47 %)', /17'000 8'000 3'500\.25 13'499\.75 Dans le budget 47 %/.test(rowA), rowA);
  check('8 Beta : engagé 1\'200 > prévu 1\'000 → Dépassé (120 %), écart 1\'000', /1'000 1'200 0 1'000 Dépassé 120 %/.test(rowB), rowB);
  check('9 main-d\'œuvre estimée dans le tableau : Alpha 6\'000 (une moitié sans taux), Beta 0 (30 h sans taux)', /47 % 6'000$/.test(rowA) && /120 % 0$/.test(rowB), `${rowA} || ${rowB}`);
  await page.screenshot({ path: process.argv[2] + '/p7-budget.png' });

  // 3. Détail d'un projet : lignes, reste à engager, main-d'œuvre
  const detail = page.locator('[data-budget-project]');
  check('10 détail du premier projet avec budget (Alpha) : 2 lignes', (await detail.getByRole('heading', { name: 'Projet Alpha' }).count()) === 1 && /Matériel/.test(await txt(detail)) && /Prestataires/.test(await txt(detail)));
  check('11 reste à engager 9\'000 et marge sur le réel 13\'499.75', /Reste à engager : 9'000 CHF/.test(await txt(page.locator('[data-budget-remaining]'))) && /Marge sur le réel : 13'499\.75 CHF/.test(await txt(page.locator('[data-budget-remaining]'))), await txt(page.locator('[data-budget-remaining]')));
  check('12 main-d\'œuvre Alpha : 50 h × 100 + 10 h × 100 + 10 h sans taux = 6\'000 valorisés', (await txt(page.locator('[data-labor-cost]'))).startsWith("6'000"), await txt(page.locator('[data-labor]')));
  const actual = page.locator('[data-labor-actual]');
  check('12b temps réellement passé (Alpha) : 2 h 30 × 100 = 250 CHF valorisées sur 3,3 h saisies ; 0,8 h sans taux non valorisées', (await actual.count()) === 1 && (await txt(page.locator('[data-labor-actual-cost]'))).startsWith('250') && /2,5 h valorisées sur 3,3 h saisies\./.test(await txt(actual)) && /0,8 h de personnes sans taux horaire ne sont pas valorisées\./.test(await txt(actual)), await txt(actual));
  check('13 les 10 h de l\'assigné sans taux sont signalées, pas devinées', /10 h d'assignés sans taux horaire ne sont pas valorisées/.test(await txt(page.locator('[data-labor]'))), await txt(page.locator('[data-labor]')));
  await page.getByRole('button', { name: 'Projet Beta', exact: true }).click(); await page.waitForTimeout(400);
  check('14 on passe au projet Beta : sa ligne « Divers »', /Divers/.test(await txt(detail)) && !/Matériel/.test(await txt(detail)));
  check('15 Beta : 30 h sans taux, rien de valorisé (0)', (await txt(page.locator('[data-labor-cost]'))).startsWith('0 ') && /30 h d'assignés sans taux horaire/.test(await txt(page.locator('[data-labor]'))), await txt(page.locator('[data-labor]')));
  await page.waitForTimeout(500);
  check('15b Beta : aucun temps saisi, annoncé comme tel (pas de montant inventé)', /Aucun temps saisi dans ce projet\./.test(await txt(page.locator('[data-labor-actual]'))), await txt(page.locator('[data-labor]')));
  await page.getByRole('button', { name: 'Projet Alpha', exact: true }).click(); await page.waitForTimeout(300);

  // 4. Ajouter une ligne
  await page.getByRole('button', { name: 'Nouvelle ligne' }).click();
  await page.locator('#crud-category').fill('Déplacements');
  check('16 les montants proposés à la création sont 0', (await page.locator('#crud-planned').inputValue()) === '0' && (await page.locator('#crud-committed').inputValue()) === '0');
  await page.locator('#crud-planned').fill("1 500,50"); await page.locator('#crud-actual').fill('abc');
  await page.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(500);
  check('17 un montant illisible est refusé avec un message et rien n\'est envoyé', (await page.getByText(/Réel \(CHF\) : entre un montant positif ou nul/).count()) >= 1 && !lastWrite('cp_budget_lines', 'POST'));
  await page.locator('#crud-actual').fill('0,5'); await page.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(900);
  const post = lastWrite('cp_budget_lines', 'POST');
  check('18 la ligne est envoyée avec les bons types (nombres, pas du texte) et le bon projet', !!post && post.body.project_id === P1 && post.body.category === 'Déplacements' && post.body.planned === 1500.5 && post.body.committed === 0 && post.body.actual === 0.5, JSON.stringify(post && post.body));
  check('19 le total prévu passe à 18\'000 + 1\'500.50 = 19\'500.50', (await kpi('planned')) === "19'500.50", await kpi('planned'));

  // 5. Modifier, supprimer
  await page.locator('tr').filter({ hasText: 'Déplacements' }).getByRole('button', { name: /Modifier/ }).click();
  await page.locator('#crud-category').waitFor({ timeout: 10000 });
  check('20a le formulaire de modification est prérempli (montants avec virgule : 1500,5 et 0,5)', (await page.locator('#crud-planned').inputValue()) === '1500,5' && (await page.locator('#crud-actual').inputValue()) === '0,5');
  await page.locator('#crud-category').fill('Déplacements et repas'); await page.locator('#crud-committed').fill('700'); await page.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(900);
  const patch = lastWrite('cp_budget_lines', 'PATCH');
  check('20 modification : catégorie et engagé envoyés en PATCH sur la bonne ligne', !!patch && patch.body.category === 'Déplacements et repas' && patch.body.committed === 700 && /id=eq\./.test(patch.query), JSON.stringify(patch));
  check('21 le total engagé passe à 9\'200 + 700 = 9\'900', (await kpi('committed')) === "9'900", await kpi('committed'));
  await page.locator('tr').filter({ hasText: 'Déplacements et repas' }).getByRole('button', { name: /Supprimer/ }).click(); await page.getByRole('button', { name: 'Confirmer' }).click(); await page.waitForTimeout(800);
  check('22 suppression confirmée : DELETE envoyé et total prévu revenu à 18\'000', !!lastWrite('cp_budget_lines', 'DELETE') && (await kpi('planned')) === "18'000", await kpi('planned'));

  // 6. Taux horaires
  const rate = page.locator(`[data-rate-user="${OTHER}"] input`);
  check('23 taux : Test Responsable 100, Autre vide', (await page.locator(`[data-rate-user="${ME}"] input`).inputValue()) === '100' && (await rate.inputValue()) === '');
  await rate.fill('9 999,99'); await rate.press('Enter'); await page.waitForTimeout(800);
  const up = lastWrite('cp_user_rates', 'POST');
  check('24 taux saisi avec Entrée : envoyé en upsert (user_id, 9999.99, clé organisation+personne)', !!up && up.body.user_id === OTHER && up.body.hourly_rate === 9999.99 && /on_conflict=organization_id%2Cuser_id|on_conflict=organization_id,user_id/.test(up.query), JSON.stringify(up));
  await rate.fill('10 000'); await rate.press('Enter'); await page.waitForTimeout(500);
  check('25 taux au-dessus de 9 999,99 refusé, rien d\'envoyé de plus', (await page.getByText('Taux horaire : un montant entre 0 et 9 999,99 CHF').count()) >= 1 && writes.filter(w => w.table === 'cp_user_rates' && w.method === 'POST').length === 1);
  await rate.fill('80'); await rate.press('Enter'); await page.waitForTimeout(800);
  check('26 la main-d\'œuvre d\'Alpha est maintenant entièrement valorisée : 6\'000 + 10 h × 80 = 6\'800', (await txt(page.locator('[data-labor-cost]'))).startsWith("6'800") && !/sans taux horaire/.test(await txt(page.locator('[data-labor]'))), await txt(page.locator('[data-labor]')));
  await rate.fill(''); await rate.press('Enter'); await page.waitForTimeout(800);
  const del = lastWrite('cp_user_rates', 'DELETE');
  check('27 taux vidé : le taux est retiré (DELETE sur la personne)', !!del && del.query.includes(OTHER), JSON.stringify(del));

  // 7. Export CSV
  // Écouteur direct plutôt que waitForEvent : pour un clic immédiat sur ce bouton, waitForEvent ne voyait pas l'événement alors que page.on le reçoit (constaté avec Playwright 1.63)
  let dl = null; page.once('download', d => { dl = d; });
  await page.getByRole('button', { name: 'Exporter (CSV)' }).click();
  for (let i = 0; i < 60 && !dl; i++) await page.waitForTimeout(250);
  if (!dl) throw new Error('aucun téléchargement après le clic sur « Exporter (CSV) »');
  const file = process.argv[2] + '/' + dl.suggestedFilename(); await dl.saveAs(file);
  const csv = fs.readFileSync(file, 'utf8');
  check('28 export CSV : nom daté, BOM, en-têtes, ligne, total par projet', /^pilote-budget-2026-11-07\.csv$/.test(dl.suggestedFilename()) && csv.startsWith('﻿') && csv.includes('Projet;Catégorie;Prévu (CHF);Engagé (CHF);Réel (CHF);Écart (CHF);Note') && csv.includes('Projet Alpha;Matériel;12000;8000;3500.25;8499.75;Location scène') && csv.includes('Projet Beta;TOTAL;1000;1200;0;1000;'), csv.slice(0, 500));

  // 8. Liens directs
  await page.goto(BASE + '/pilote/projets?view=budget'); await page.waitForSelector('[data-budget-summary]', { timeout: 20000 });
  check('29 ?view=budget ouvre directement le budget, Pilotage sélectionné', (await page.getByRole('radio', { name: 'Pilotage', exact: true }).getAttribute('aria-checked')) === 'true' && (await page.getByRole('radio', { name: 'Budget', exact: true }).getAttribute('aria-checked')) === 'true');
  await page.goto(BASE + '/pilote/projets?view=dashboard'); await page.waitForSelector('[data-kpi]', { timeout: 20000 });
  check('30 ?view=dashboard (ancien lien) ouvre la Synthèse', (await page.getByRole('radio', { name: 'Synthèse', exact: true }).getAttribute('aria-checked')) === 'true');
  await page.goto(BASE + '/pilote/projets?view=workload'); await page.waitForSelector('table[aria-label="Charge par personne et par semaine"]', { timeout: 20000 });
  check('31 ?view=workload (ancien lien) ouvre la Charge', (await page.getByRole('radio', { name: 'Charge', exact: true }).getAttribute('aria-checked')) === 'true');

  // 9. Sans le droit « budget »
  budgetRights = new Set();
  await page.goto(BASE + '/pilote/projets'); await page.getByRole('radio', { name: 'Pilotage', exact: true }).waitFor({ timeout: 25000 }); await page.getByRole('radio', { name: 'Pilotage', exact: true }).click(); await page.waitForTimeout(600);
  const subNo = await page.getByRole('radiogroup', { name: 'Pilotage', exact: true }).getByRole('radio').allInnerTexts();
  check('32 sans droit : pas d\'onglet Budget (Synthèse et Charge restent)', subNo.join('|') === 'Synthèse|Charge', subNo.join('|'));
  await page.goto(BASE + '/pilote/projets?view=budget'); const reserved = await page.getByText('Budget réservé').waitFor({ timeout: 10000 }).then(() => true, () => false); await page.waitForTimeout(500);
  check('33 sans droit, lien direct : message « Budget réservé », aucun montant affiché', reserved && (await page.locator('[data-budget-summary]').count()) === 0 && !/18'000|12'000/.test(await page.locator('body').innerText()));
  // Lecture seule : voit, ne modifie pas
  budgetRights = new Set(['read']);
  await page.goto(BASE + '/pilote/projets?view=budget'); await page.waitForSelector('[data-budget-summary]', { timeout: 20000 }); await page.waitForTimeout(500);
  check('34 lecture seule : montants visibles, ni « Nouvelle ligne », ni Modifier/Supprimer, taux grisés', (await kpi('planned')) === "18'000" && (await page.getByRole('button', { name: 'Nouvelle ligne' }).count()) === 0 && (await page.getByRole('button', { name: /^Modifier/ }).count()) === 0 && (await page.getByRole('button', { name: /^Supprimer/ }).count()) === 0 && (await page.locator(`[data-rate-user="${ME}"] input`).isDisabled()));

  check('35 aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} OK`);
  await b.close(); process.exit(ok === results.length ? 0 : 1);
})();
