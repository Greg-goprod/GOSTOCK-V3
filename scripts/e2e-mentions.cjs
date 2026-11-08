// Mentions @ dans la discussion, choix d'avis (mention, récapitulatif), heure du récapitulatif — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée),
// date figée au 7 novembre 2026. Les avis eux-mêmes sont produits par la base (testée en SQL) ; ici on vérifie ce que l'écran en fait. Le TEMPS RÉEL (Realtime) n'est pas
// testable ici : la base simulée n'a pas de serveur Realtime ; on vérifie seulement que l'écran fonctionne sans erreur avec l'abonnement actif.
// Lancer : node scripts/run-pilote-e2e.cjs   (ou, à la main : serveur sur le port 5197 avec VITE_SUPABASE_URL=http://mock.supabase.test, puis node scripts/e2e-mentions.cjs <dossier>)
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:5197';
const ME = 'aaaaaaaa-0000-0000-0000-000000000001', ANNE = 'aaaaaaaa-0000-0000-0000-000000000002', MARTIN = 'aaaaaaaa-0000-0000-0000-000000000003', BRUNO = 'aaaaaaaa-0000-0000-0000-000000000004', DORA = 'aaaaaaaa-0000-0000-0000-000000000005';
const P1 = '11111111-0000-0000-0000-000000000001';
const ORG = '44444444-0000-0000-0000-000000000001';
const profile = { id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', permissions: ['view_all', 'scan', 'approve', 'manage_stock', 'settings', 'manage_users'], depot_ids: [], organization: { id: ORG, name: 'Org' }, organizations: [], modules: ['cp.projects', 'cp.planning', 'logistics'], platform_admin: true };
const now = new Date().toISOString();
const day = (n) => { const d = new Date(new Date('2026-11-07T10:00:00+01:00').getTime() + n * 86400000); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(d); };
const ST0 = '33333333-0000-0000-0000-000000000001', ST1 = '33333333-0000-0000-0000-000000000002', ST2 = '33333333-0000-0000-0000-000000000003';
const base = { organization_id: ORG, priority: null, color: '#6366f1', description: null, site_id: null, link_mode: 'overlap', link_skip_weekends: true, created_at: now, updated_at: now };
const IA = '22222222-0000-0000-0000-00000000000a';
const USERS = [
  { id: ME, first_name: 'Test', last_name: 'Responsable', email: 't@r.test', role: 'admin', active: true },
  { id: ANNE, first_name: 'Anne', last_name: 'Dupont', email: 'anne@p.test', role: 'user', active: true },
  { id: MARTIN, first_name: 'Anne', last_name: 'Dupont-Martin', email: 'martin@p.test', role: 'user', active: true },
  { id: BRUNO, first_name: 'Bruno', last_name: 'Meier', email: 'bruno@p.test', role: 'user', active: true },
  { id: DORA, first_name: 'Dora', last_name: 'Inactive', email: 'dora@p.test', role: 'user', active: false },
];
const TABLES = {
  cp_statuses: [{ id: ST0, name: 'Pas commencé', family: 'not_started', color: '#999999', position: 0, is_system: true }, { id: ST1, name: 'En cours', family: 'in_progress', color: '#3b82f6', position: 1, is_system: true }, { id: ST2, name: 'Terminé', family: 'done', color: '#10b981', position: 2, is_system: true }],
  cp_projects: [{ ...base, id: P1, type: 'site', name: 'Projet Alpha', status_id: ST1, starts_on: day(-10), ends_on: day(20) }],
  cp_project_members: [{ project_id: P1, user_id: ME, role: 'lead' }],
  sites: [], cp_items: [{ ...base, id: IA, project_id: P1, parent_id: null, kind: 'task', name: 'Montage scène', position: 1, starts_on: day(0), ends_on: day(3), status_id: ST1, version: 1, estimate_hours: null }],
  cp_item_members: [], cp_calendar_days: [], cp_user_capacity: [], cp_item_links: [], cp_item_checks: [], cp_documents: [], cp_budget_lines: [], cp_user_rates: [], cp_item_resources: [],
  cp_comments: [
    { id: 'c1', project_id: P1, item_id: IA, author_id: BRUNO, body: 'Salut @Anne Dupont, tu peux regarder ? Cc @Anne Dupont-Martin.', created_at: now, edited_at: null, mentions: [ANNE, MARTIN] },
    { id: 'c2', project_id: P1, item_id: IA, author_id: ANNE, body: 'Je regarde. Écris à contact@Anne Dupont si besoin (adresse, pas une mention).', created_at: now, edited_at: null, mentions: [] },
  ],
  platform_modules: [{ key: 'cp.projects', label: 'Projets', description: 'x', position: 1 }],
  users: USERS,
  system_settings: [],
};
const PREFS = [
  { kind: 'cp_assigned', in_app: true, email: true, push: true }, { kind: 'cp_team_added', in_app: true, email: true, push: true }, { kind: 'cp_dates_changed', in_app: true, email: false, push: true },
  { kind: 'cp_due_soon', in_app: true, email: true, push: true }, { kind: 'cp_overdue', in_app: true, email: true, push: true }, { kind: 'cp_comment', in_app: true, email: false, push: true },
  { kind: 'cp_mention', in_app: true, email: false, push: false }, { kind: 'cp_digest', in_app: true, email: false, push: false },
];
let noMentionsColumn = false;
const RPC = { whoami: profile, my_notifications: [], unread_notification_count: 0, cp_can_discuss: true, rbac_has_any_permission: true, my_cp_notification_prefs: PREFS };
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
    if (path.startsWith('/rest/v1/rpc/')) { const fn = path.split('/').pop(); return json(fn in RPC ? RPC[fn] : null); }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').pop();
      if (req.method() !== 'GET') {
        const body = req.method() === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
        writes.push({ table, method: req.method(), query: url.search, body });
        if (table === 'cp_comments' && req.method() === 'POST') {
          // La base déduit les mentions du texte (ici : règle simplifiée de la base simulée)
          const mentions = USERS.filter(u => u.active && u.id !== ME && new RegExp('(?<![A-Za-z])@' + `${u.first_name} ${u.last_name}`.replace(/[-]/g, '\\-') + '(?![A-Za-z0-9_-])', 'i').test(body.body)).map(u => u.id);
          TABLES.cp_comments.push({ id: 'cn' + Math.random().toString(36).slice(2), edited_at: null, created_at: now, author_id: ME, ...body, mentions });
        }
        if (table === 'system_settings' && req.method() === 'POST') { const r = Array.isArray(body) ? body[0] : body; TABLES.system_settings = TABLES.system_settings.filter(x => x.id !== r.id).concat([r]); }
        if (table === 'cp_notification_prefs' && req.method() === 'POST') { const r = Array.isArray(body) ? body[0] : body; const p = PREFS.find(x => x.kind === r.kind); if (p) Object.assign(p, { in_app: r.in_app, email: r.email, push: r.push }); }
        return route.fulfill({ status: 204, body: '' });
      }
      if (table === 'cp_comments' && noMentionsColumn && /mentions/.test(url.searchParams.get('select') || '')) return json({ code: '42703', message: 'column cp_comments.mentions does not exist' }, 400);
      let rows = filt(TABLES[table] || [], url);
      if (table === 'cp_comments' && noMentionsColumn) rows = rows.map(({ mentions, ...r }) => r);
      return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows);
    }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };
  const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
  const last = (table, method) => [...writes].reverse().find(w => w.table === table && w.method === method);
  const openItem = async () => { await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Plus d\'options d\'affichage' }).click().catch(() => {}); await page.getByRole('menuitem', { name: 'Tout déplier' }).click().catch(() => {}); await page.waitForTimeout(400);
    await page.locator('button[title*=" · "]').filter({ hasText: /^Montage scène$/ }).first().click(); await page.getByRole('dialog').waitFor({ timeout: 10000 }); await page.waitForSelector('#cmt-body', { timeout: 10000 }); };
  const options = async () => (await page.locator('[data-mention-option]').allInnerTexts()).map(s => s.trim());

  // 1. Messages existants : les mentions retenues par la base sont surlignées
  await openItem();
  const marks = (await page.locator('mark[data-mention]').allInnerTexts()).map(s => s.trim());
  check('1 les deux mentions du premier message sont surlignées', marks.join('|') === '@Anne Dupont|@Anne Dupont-Martin', marks.join('|'));
  check('2 une adresse e-mail « contact@Anne Dupont » n\'est pas surlignée (la base ne l\'a pas retenue)', marks.length === 2 && /contact@Anne Dupont si besoin/.test(await txt(page.locator('li').filter({ hasText: 'Je regarde.' }))));
  check('3 le texte du message reste intact (rien d\'ajouté ni de perdu)', /Salut @Anne Dupont, tu peux regarder \? Cc @Anne Dupont-Martin\./.test(await txt(page.locator('li').filter({ hasText: 'Salut' }).first())));

  // 2. Écrire : suggestions
  const area = page.locator('#cmt-body');
  await area.click(); await area.pressSequentially('Merci @An');
  await page.waitForSelector('[data-mention-option]', { timeout: 5000 });
  check('4 « @An » propose les deux Anne, pas moi-même, pas l\'inactive', (await options()).join('|') === 'Anne Dupont|Anne Dupont-Martin', (await options()).join('|'));
  check('5 la liste est annoncée comme une liste de choix accessible (combobox / listbox)', (await area.getAttribute('role')) === 'combobox' && (await area.getAttribute('aria-expanded')) === 'true' && (await page.getByRole('listbox', { name: 'Personnes à mentionner' }).count()) === 1);
  await page.screenshot({ path: process.argv[2] + '/p11-mentions.png' });
  await area.press('ArrowDown');
  check('6 flèche bas : le deuxième choix est actif', (await page.locator('[data-mention-option][aria-selected="true"]').innerText()).trim() === 'Anne Dupont-Martin');
  await area.press('ArrowUp'); await area.press('ArrowUp');
  check('7 flèche haut deux fois : on boucle sur le dernier', (await page.locator('[data-mention-option][aria-selected="true"]').innerText()).trim() === 'Anne Dupont-Martin');
  await area.press('Enter');
  check('8 Entrée choisit : « @Anne Dupont-Martin » inséré suivi d\'une espace, la liste se ferme, rien n\'est envoyé', (await area.inputValue()) === 'Merci @Anne Dupont-Martin ' && (await page.locator('[data-mention-option]').count()) === 0 && !last('cp_comments', 'POST'), await area.inputValue());
  await area.pressSequentially('et @Br');
  await page.waitForSelector('[data-mention-option]');
  await page.locator('[data-mention-option]').first().click();
  check('9 clic sur un choix : « @Bruno Meier » inséré', (await area.inputValue()) === 'Merci @Anne Dupont-Martin et @Bruno Meier ', await area.inputValue());
  await area.pressSequentially('@Zz');
  await page.waitForTimeout(300);
  check('10 personne inconnue : aucune suggestion', (await page.locator('[data-mention-option]').count()) === 0);
  await area.pressSequentially('\b\b\b'); await area.pressSequentially('@Te'); await page.waitForTimeout(300);
  check('10b « @Te » ne me propose pas moi-même (Test Responsable)', (await page.locator('[data-mention-option]').count()) === 0);
  await area.pressSequentially('\b\b\b'); await area.pressSequentially('@Do'); await page.waitForTimeout(300);
  check('11 « @Do » ne propose pas Dora (inactive)', (await page.locator('[data-mention-option]').count()) === 0);
  await area.pressSequentially('\b\b\b'); await area.pressSequentially('@An'); await page.waitForSelector('[data-mention-option]');
  await area.press('Escape'); await page.waitForTimeout(200);
  check('12 Échap ferme la liste sans fermer la fiche', (await page.locator('[data-mention-option]').count()) === 0 && (await page.getByRole('dialog').count()) >= 1);
  await area.pressSequentially('\b\b\b');
  await area.pressSequentially('contact@exemple'); await page.waitForTimeout(300);
  check('13 un « @ » collé à une lettre (adresse e-mail) ne déclenche pas de suggestions', (await page.locator('[data-mention-option]').count()) === 0);

  // 3. Envoi : le client n'envoie QUE le texte (c'est la base qui déduit les mentions)
  await area.fill('Merci @Anne Dupont-Martin et @Bruno Meier');
  await page.locator('[data-mention-option]').count();
  await page.getByRole('button', { name: 'Envoyer' }).click(); await page.waitForTimeout(1000);
  const post = last('cp_comments', 'POST');
  check('14 envoi : seulement le projet, la tâche et le texte (aucune liste de mentions envoyée par le navigateur)', !!post && post.body.project_id === P1 && post.body.item_id === IA && post.body.body === 'Merci @Anne Dupont-Martin et @Bruno Meier' && !('mentions' in post.body), JSON.stringify(post && post.body));
  const marks2 = (await page.locator('mark[data-mention]').allInnerTexts()).map(s => s.trim());
  check('15 le nouveau message affiche les mentions déduites par la base (surlignées après rechargement)', marks2.slice(-2).join('|') === '@Anne Dupont-Martin|@Bruno Meier', marks2.join('|'));

  // 4. Sans la migration (colonne absente) : la discussion continue de fonctionner
  noMentionsColumn = true;
  await openItem();
  check('16 colonne « mentions » absente : les messages s\'affichent quand même, sans surlignage', (await page.locator('li').filter({ hasText: 'Salut @Anne Dupont' }).count()) === 1 && (await page.locator('mark[data-mention]').count()) === 0);
  noMentionsColumn = false;

  // 5. Mes avis PILOTE : mention et récapitulatif
  await page.goto(BASE + '/notifications'); await page.getByRole('heading', { name: 'Mes avis PILOTE' }).waitFor({ timeout: 25000 });
  const cb = (title, channel) => page.getByRole('checkbox', { name: `${title} : ${channel}` });
  check('17 mention : dans l\'application coché, e-mail et push DÉCOCHÉS par défaut', await cb('On me mentionne dans une discussion', 'Dans l\'application').isChecked() && !(await cb('On me mentionne dans une discussion', 'E-mail').isChecked()) && !(await cb('On me mentionne dans une discussion', 'Push').isChecked()));
  check('18 récapitulatif : dans l\'application coché, e-mail et push décochés par défaut', await cb('Mon récapitulatif du jour', 'Dans l\'application').isChecked() && !(await cb('Mon récapitulatif du jour', 'E-mail').isChecked()) && !(await cb('Mon récapitulatif du jour', 'Push').isChecked()));
  await cb('On me mentionne dans une discussion', 'E-mail').check(); await page.waitForTimeout(700);
  const up = last('cp_notification_prefs', 'POST');
  check('19 activer l\'e-mail des mentions : choix enregistré pour ce type d\'avis seulement', !!up && up.body.kind === 'cp_mention' && up.body.email === true && up.body.in_app === true && up.body.push === false, JSON.stringify(up && up.body));
  await page.screenshot({ path: process.argv[2] + '/p11-avis.png' });

  // 6. Heure du récapitulatif (administrateur)
  const hour = page.locator('#digest-hour');
  check('20 administrateur : l\'heure du récapitulatif est proposée, 7 h 00 par défaut', (await hour.count()) === 1 && (await hour.inputValue()) === '7');
  check('21 24 choix de 0 h 00 à 23 h 00', (await hour.locator('option').count()) === 24 && (await hour.locator('option').first().innerText()).trim() === '0 h 00' && (await hour.locator('option').last().innerText()).trim() === '23 h 00');
  await hour.selectOption('9'); await page.waitForTimeout(800);
  const setting = last('system_settings', 'POST');
  check('22 choisir 9 h 00 : réglage « pilote_digest_hour » = "9" enregistré', !!setting && setting.body.id === 'pilote_digest_hour' && setting.body.value === '9', JSON.stringify(setting && setting.body));
  await page.reload(); await page.getByRole('heading', { name: 'Mes avis PILOTE' }).waitFor({ timeout: 25000 }); await page.waitForTimeout(600);
  check('23 rechargé : la valeur enregistrée est relue (9 h 00)', (await page.locator('#digest-hour').inputValue()) === '9');
  profile.permissions = profile.permissions.filter(p => p !== 'settings');
  await page.reload(); await page.getByRole('heading', { name: 'Mes avis PILOTE' }).waitFor({ timeout: 25000 }); await page.waitForTimeout(600);
  check('24 sans le droit « paramètres » : le réglage de l\'heure n\'est pas proposé, les choix personnels le sont', (await page.locator('#digest-hour').count()) === 0 && (await cb('Mon récapitulatif du jour', 'E-mail').count()) === 1);

  check('25 aucune erreur JavaScript (abonnement temps réel actif sans serveur Realtime)', errs.length === 0, errs.join(' | '));
  const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} OK`);
  await b.close(); process.exit(ok === results.length ? 0 : 1);
})();
