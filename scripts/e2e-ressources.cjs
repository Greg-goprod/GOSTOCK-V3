// Matériel et véhicules rattachés aux tâches PILOTE (section de la fiche, avertissements de disponibilité, repère dans le Gantt) — test dans un vrai navigateur,
// base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026. La disponibilité est CALCULÉE PAR LA BASE (testée en SQL) : ici la base simulée
// applique une règle simple (stock libre fixe, véhicule en maintenance) pour vérifier ce que l'écran en fait.
// Lancer : node scripts/run-pilote-e2e.cjs   (ou, à la main : serveur sur le port 5197 avec VITE_SUPABASE_URL=http://mock.supabase.test, puis node scripts/e2e-ressources.cjs <dossier>)
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:5197';
const ME = 'aaaaaaaa-0000-0000-0000-000000000001', OTHER = 'aaaaaaaa-0000-0000-0000-000000000002';
const P1 = '11111111-0000-0000-0000-000000000001';
const ORG = '44444444-0000-0000-0000-000000000001';
const profile = { id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', permissions: ['view_all', 'scan', 'approve', 'manage_stock', 'settings', 'manage_users'], depot_ids: [], organization: { id: ORG, name: 'Org' }, organizations: [], modules: ['cp.projects', 'cp.planning', 'logistics'], platform_admin: true };
const now = new Date().toISOString();
const day = (n) => { const d = new Date(new Date('2026-11-07T10:00:00+01:00').getTime() + n * 86400000); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(d); };
const ST0 = '33333333-0000-0000-0000-000000000001', ST1 = '33333333-0000-0000-0000-000000000002', ST2 = '33333333-0000-0000-0000-000000000003';
const base = { organization_id: ORG, priority: null, color: '#6366f1', description: null, site_id: null, link_mode: 'overlap', link_skip_weekends: true, created_at: now, updated_at: now };
const it = (id, project_id, name, status_id, extra = {}) => ({ ...base, id, project_id, parent_id: null, kind: 'task', name, position: 1, starts_on: day(0), ends_on: day(3), status_id, version: 1, estimate_hours: null, ...extra });
const IA = '22222222-0000-0000-0000-00000000000a', IB = '22222222-0000-0000-0000-00000000000b', IC = '22222222-0000-0000-0000-00000000000c';
const E1 = 'e1e1e1e1-0000-0000-0000-000000000001', E2 = 'e1e1e1e1-0000-0000-0000-000000000002', V1 = 'f1f1f1f1-0000-0000-0000-000000000001', V2 = 'f1f1f1f1-0000-0000-0000-000000000002';
const EQUIP = [{ id: E1, name: 'Perceuse P8', total_quantity: 5, status: 'available' }, { id: E2, name: 'Projecteur P8', total_quantity: 2, status: 'available' }];
const VEHS = [{ id: V1, name: 'Camion P8', plate: 'ZZ 8001', status: 'available' }, { id: V2, name: 'Fourgon P8', plate: 'ZZ 8002', status: 'maintenance' }];
const FREE = { [E1]: 2, [E2]: 2 };                     // stock libre sur la période (règle simple de la base simulée)
const TABLES = {
  cp_statuses: [{ id: ST0, name: 'Pas commencé', family: 'not_started', color: '#999999', position: 0, is_system: true }, { id: ST1, name: 'En cours', family: 'in_progress', color: '#3b82f6', position: 1, is_system: true }, { id: ST2, name: 'Terminé', family: 'done', color: '#10b981', position: 2, is_system: true }],
  cp_projects: [{ ...base, id: P1, type: 'site', name: 'Projet Alpha', status_id: ST1, starts_on: day(-10), ends_on: day(20) }],
  cp_project_members: [{ project_id: P1, user_id: ME, role: 'lead' }],
  sites: [],
  cp_items: [it(IA, P1, 'Montage scène', ST1), it(IB, P1, 'Réglage lumière', ST1), it(IC, P1, 'Rangement final', ST0, { starts_on: null, ends_on: null })],
  cp_item_members: [], cp_calendar_days: [], cp_user_capacity: [], cp_item_links: [], cp_item_checks: [], cp_comments: [], cp_documents: [], cp_budget_lines: [], cp_user_rates: [],
  cp_item_resources: [
    { id: 'r1', item_id: IA, kind: 'equipment', equipment_id: E1, vehicle_id: null, quantity: 3, note: null, created_at: '2026-11-01T10:00:00Z' },
    { id: 'r2', item_id: IB, kind: 'equipment', equipment_id: E2, vehicle_id: null, quantity: 1, note: null, created_at: '2026-11-01T10:00:00Z' },
  ],
  platform_modules: [{ key: 'cp.projects', label: 'Projets', description: 'x', position: 1 }],
  users: [{ id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', active: true }, { id: OTHER, first_name: 'Autre', last_name: 'Personne', email: 'a@p.test', role: 'user', active: true }],
};
let canUpdate = true;
let seq = 100;
// Ce que calculerait cp_resource_issues avec la règle simple de cette base simulée
const searched = [];   // textes cherchés dans les articles (une recherche trop courte ne doit rien envoyer)
const issues = (only) => TABLES.cp_item_resources.filter(r => (!only || r.item_id === only)).map(r => {
  const item = TABLES.cp_items.find(i => i.id === r.item_id); if (!item || (!item.starts_on && !item.ends_on)) return null;
  if (r.kind === 'equipment') { const free = FREE[r.equipment_id] ?? 0; const e = EQUIP.find(x => x.id === r.equipment_id); if (!e) return null; return r.quantity > free ? { resource_id: r.id, item_id: r.item_id, kind: 'equipment', ref_id: r.equipment_id, name: e.name, needed: r.quantity, available: free, reason: null } : null; }
  const v = VEHS.find(x => x.id === r.vehicle_id); if (!v) return null; return v.status === 'maintenance' ? { resource_id: r.id, item_id: r.item_id, kind: 'vehicle', ref_id: v.id, name: v.name, needed: 1, available: 0, reason: `${v.name} est en maintenance` } : null;
}).filter(Boolean);
const RPC = { whoami: profile, my_notifications: [], unread_notification_count: 0, cp_can_discuss: true, my_cp_notification_prefs: [] };
const filt = (rows, url) => { let out = rows; for (const [k, v] of url.searchParams) { if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue; if (v === 'is.null') out = out.filter(r => r[k] == null); else if (v.startsWith('eq.')) out = out.filter(r => String(r[k]) === v.slice(3)); } return out; };
(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 1100 }, locale: 'fr-CH' });
  const sess = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 't@r.test', app_metadata: {}, user_metadata: {}, created_at: now } };
  await ctx.addInitScript(s => { try { if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(s)); } catch {} }, sess);
  await ctx.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));
  const writes = []; const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  await page.route('http://mock.supabase.test/**', route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.startsWith('/auth/v1')) return json(sess.user);
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop();
      if (fn === 'rbac_has_any_permission') { const keys = (req.postDataJSON() || {}).p_keys || []; return json(keys.every(k => canUpdate || !/:(create|update|delete)$/.test(k))); }
      if (fn === 'cp_resource_issues') return json(issues((req.postDataJSON() || {}).p_item));
      return json(fn in RPC ? RPC[fn] : null);
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').pop();
      if (req.method() !== 'GET') {
        if (table === 'cp_item_resources') {
          const body = req.method() === 'DELETE' ? null : req.postDataJSON();
          writes.push({ method: req.method(), query: url.search, body });
          if (req.method() === 'POST') (Array.isArray(body) ? body : [body]).forEach(r => TABLES.cp_item_resources.push({ id: 'rn' + (++seq), note: null, created_at: now, ...r }));
          if (req.method() === 'PATCH') { const id = url.searchParams.get('id').slice(3); TABLES.cp_item_resources = TABLES.cp_item_resources.map(r => (r.id === id ? { ...r, ...body } : r)); }
          if (req.method() === 'DELETE') { const id = url.searchParams.get('id').slice(3); TABLES.cp_item_resources = TABLES.cp_item_resources.filter(r => r.id !== id); }
        }
        return route.fulfill({ status: 204, body: '' });
      }
      if (table === 'cp_item_resources') {
        const rows = filt(TABLES.cp_item_resources, url).map(r => ({ ...r,
          equipment: r.equipment_id ? { name: EQUIP.find(e => e.id === r.equipment_id)?.name ?? '?', total_quantity: EQUIP.find(e => e.id === r.equipment_id)?.total_quantity ?? null } : null,
          vehicle: r.vehicle_id ? { name: VEHS.find(v => v.id === r.vehicle_id)?.name ?? '?', plate: VEHS.find(v => v.id === r.vehicle_id)?.plate ?? '' } : null }));
        return json(rows);
      }
      // Recherche dans Logistique (limite 8) : articles par nom, véhicules par nom ou plaque
      if (table === 'equipment' && url.searchParams.get('limit') === '8') { const q = (url.searchParams.get('name') || '').replace(/^ilike\./, '').replace(/%/g, '').toLowerCase(); searched.push(q); return json(EQUIP.filter(e => e.name.toLowerCase().includes(q))); }
      if (table === 'vehicles' && url.searchParams.get('limit') === '8') { const m = /ilike\.%([^%]*)%/.exec(url.searchParams.get('or') || ''); const q = (m ? m[1] : '').toLowerCase(); return json(VEHS.filter(v => !q || v.name.toLowerCase().includes(q) || v.plate.toLowerCase().includes(q))); }
      if (table === 'equipment' || table === 'vehicles') return json([]);
      const rows = filt(TABLES[table] || [], url);
      return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows);
    }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };
  const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
  const last = (method) => [...writes].reverse().find(w => w.method === method);
  const openItem = async (name) => { await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Plus d\'options d\'affichage' }).click().catch(() => {}); await page.getByRole('menuitem', { name: 'Tout déplier' }).click().catch(() => {}); await page.waitForTimeout(400);
    await page.locator('button[title*=" · "]').filter({ hasText: new RegExp('^' + name + '$') }).first().click(); await page.getByRole('dialog').waitFor({ timeout: 10000 }); await page.waitForTimeout(400); };
  const section = () => page.locator('[data-resources]');

  // 1. Le Gantt signale la tâche dont le matériel manque
  await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Plus d\'options d\'affichage' }).click(); await page.getByRole('menuitem', { name: 'Tout déplier' }).click(); await page.waitForTimeout(500);
  const marker = page.locator(`[data-resource-issue="${IA}"]`);
  check('1 Gantt : repère « Matériel ou véhicule à vérifier » sur « Montage scène » (3 perceuses demandées, 2 libres)', (await marker.count()) === 1);
  check('2 pas de repère sur les tâches sans problème', (await page.locator('[data-resource-issue]').count()) === 1);
  check('3 l\'infobulle du repère donne la raison', /Manque de « Perceuse P8 » sur la période : 3 demandé\(s\), 2 disponible\(s\)/.test(await marker.evaluate(el => el.textContent || '')), await marker.evaluate(el => el.textContent || ''));
  await page.screenshot({ path: process.argv[2] + '/p8-gantt.png' });

  // 2. La fiche : section repliée avec le nombre à vérifier, puis ouverte
  await openItem('Montage scène');
  const header = page.getByRole('button', { name: /Matériel et véhicules/ });
  check('4 section repliée par défaut, l\'en-tête annonce « 1 à vérifier »', (await header.getAttribute('aria-expanded')) === 'false' && /1 à vérifier/.test(await txt(header)), await txt(header));
  await header.click(); await page.waitForSelector('[data-resource-list]', { timeout: 10000 });
  const li = page.locator('[data-resource="r1"]');
  check('5 la ligne affiche l\'article, son stock et la quantité 3', /Perceuse P8/.test(await txt(li)) && /5 en stock/.test(await txt(li)) && (await li.getByLabel('Quantité de Perceuse P8').inputValue()) === '3');
  check('6 avertissement ambre avec la raison, sur la bonne ligne', (await li.getAttribute('data-issue')) === 'true' && /Manque de « Perceuse P8 » sur la période : 3 demandé\(s\), 2 disponible\(s\)/.test(await txt(li)), await txt(li));
  check('7 l\'autre rattachement (réglage lumière) n\'est pas dans cette fiche', (await page.locator('[data-resource]').count()) === 1);
  check('8 rappel : avertissement seulement, rien n\'est réservé', /rien n'est réservé/.test(await txt(section())));
  await page.screenshot({ path: process.argv[2] + '/p8-fiche.png' });

  // 3. Changer la quantité
  const qty = li.getByLabel('Quantité de Perceuse P8');
  await qty.fill('abc'); await qty.press('Enter'); await page.waitForTimeout(500);
  check('9 quantité illisible refusée avec un message, rien d\'envoyé', (await page.getByText('Quantité : un nombre entier de 1 à 9 999').count()) >= 1 && !last('PATCH'));
  await qty.fill('0'); await qty.press('Enter'); await page.waitForTimeout(500);
  check('10 quantité 0 refusée', !last('PATCH'));
  await qty.fill('2'); await qty.press('Enter'); await page.waitForTimeout(1000);
  const patch = last('PATCH');
  check('11 quantité 2 : envoyée en nombre sur le bon rattachement', !!patch && patch.body.quantity === 2 && /id=eq\.r1/.test(patch.query), JSON.stringify(patch));
  check('12 plus d\'avertissement (2 demandées, 2 libres) et l\'en-tête n\'annonce plus rien', (await page.locator('[data-resource="r1"]').getAttribute('data-issue')) === null && !/à vérifier/.test(await txt(page.getByRole('button', { name: /Matériel et véhicules/ }))), await txt(section()));

  // 4. Ajouter un article
  const search = page.getByRole('searchbox', { name: 'Rechercher un article' });
  await search.fill('p'); await page.waitForTimeout(600);
  check('13 une seule lettre : aucune requête envoyée à Logistique, aucun résultat', (await page.locator('[data-resource-results]').count()) === 0 && !searched.includes('p'), JSON.stringify(searched));
  await search.fill('proj'); await page.waitForSelector('[data-resource-results]', { timeout: 10000 });
  check('14 « proj » trouve le projecteur avec son stock', /Projecteur P8/.test(await txt(page.locator('[data-resource-results]'))) && /2 en stock/.test(await txt(page.locator('[data-resource-results]'))));
  await page.getByRole('button', { name: 'Ajouter Projecteur P8' }).click(); await page.waitForTimeout(1000);
  const post = last('POST');
  check('15 ajout : envoyé avec la tâche, le genre, l\'article et la quantité 1 (pas d\'identifiant de véhicule)', !!post && post.body.item_id === IA && post.body.kind === 'equipment' && post.body.equipment_id === E2 && post.body.vehicle_id === null && post.body.quantity === 1, JSON.stringify(post));
  check('16 le projecteur apparaît dans la liste, sans avertissement (1 demandé, 2 libres)', (await page.locator('[data-resource-list] li').count()) === 2 && /Projecteur P8/.test(await txt(section())) && (await page.locator('[data-issue="true"]').count()) === 0);
  check('17 la recherche est vidée après l\'ajout', (await search.inputValue()) === '');
  await search.fill('proj'); await page.waitForSelector('[data-resource-results]');
  check('18 un article déjà ajouté est grisé (« Déjà ajouté »)', await page.getByRole('button', { name: 'Projecteur P8 déjà ajouté' }).isDisabled());
  await search.fill('');

  // 5. Véhicules
  await page.getByRole('radio', { name: 'Véhicule', exact: true }).click(); await page.waitForSelector('[data-resource-results]', { timeout: 10000 });
  const results1 = await txt(page.locator('[data-resource-results]'));
  check('19 onglet Véhicule : la liste se charge sans rien taper, avec la plaque et la maintenance', /Camion P8/.test(results1) && /ZZ 8001/.test(results1) && /Fourgon P8/.test(results1) && /en maintenance/.test(results1), results1);
  await page.getByRole('button', { name: 'Ajouter Fourgon P8' }).click(); await page.waitForTimeout(1000);
  const post2 = last('POST');
  check('20 véhicule ajouté : quantité 1, identifiant de véhicule, pas d\'article', !!post2 && post2.body.kind === 'vehicle' && post2.body.vehicle_id === V2 && post2.body.equipment_id === null && post2.body.quantity === 1, JSON.stringify(post2));
  const vli = page.locator('[data-resource-list] li').filter({ hasText: 'Fourgon P8' });
  check('21 le fourgon en maintenance est signalé avec la raison de la base ; pas de champ quantité pour un véhicule', (await vli.getAttribute('data-issue')) === 'true' && /Fourgon P8 est en maintenance/.test(await txt(vli)) && (await vli.getByLabel('Quantité de Fourgon P8').count()) === 0, await txt(vli));
  check('22 l\'en-tête annonce de nouveau « 1 à vérifier »', /1 à vérifier/.test(await txt(page.getByRole('button', { name: /Matériel et véhicules/ }))));
  await page.getByRole('searchbox', { name: 'Rechercher un véhicule' }).fill('8002'); await page.waitForTimeout(700);
  check('23 recherche d\'un véhicule par plaque', /Fourgon P8/.test(await txt(page.locator('[data-resource-results]'))) && !/Camion P8/.test(await txt(page.locator('[data-resource-results]'))));

  // 6. Retirer
  await page.getByRole('button', { name: 'Retirer Fourgon P8' }).click(); await page.waitForTimeout(1000);
  const del = last('DELETE');
  check('24 retrait : DELETE sur le bon rattachement, plus d\'avertissement', !!del && /id=eq\.rn/.test(del.query) && (await page.locator('[data-issue="true"]').count()) === 0 && (await page.locator('[data-resource-list] li').count()) === 2, JSON.stringify(del));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // 7. Tâche sans date
  await openItem('Rangement final');
  // L'état ouvert / fermé de la section est mémorisé d'une fiche à l'autre : on ne clique que si elle est repliée
  { const h = page.getByRole('button', { name: /Matériel et véhicules/ }); if ((await h.getAttribute('aria-expanded')) !== 'true') await h.click(); await page.waitForTimeout(800); }
  check('25 tâche sans date : message « la disponibilité n\'est pas vérifiée »', /n'a pas de date : la disponibilité n'est pas vérifiée/.test(await txt(section())));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // 8. Lecture seule
  canUpdate = false;
  await openItem('Montage scène');
  const hdr = page.getByRole('button', { name: /Matériel et véhicules/ });
  if ((await hdr.getAttribute('aria-expanded')) !== 'true') await hdr.click();
  await page.waitForSelector('[data-resource-list]', { timeout: 10000 });
  const ro = { rows: await page.locator('[data-resource-list] li').count(), search: await section().getByRole('searchbox').count(), remove: await page.getByRole('button', { name: /^Retirer/ }).count(), disabled: await page.getByLabel('Quantité de Perceuse P8').isDisabled() };
  check('26 lecture seule : la liste est visible mais ni ajout, ni retrait, quantité grisée', ro.rows === 2 && ro.search === 0 && ro.remove === 0 && ro.disabled, JSON.stringify(ro));

  check('27 aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} OK`);
  await b.close(); process.exit(ok === results.length ? 0 : 1);
})();
