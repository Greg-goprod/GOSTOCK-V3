// Exports PILOTE (Excel, CSV, .ics) et impression PDF — test dans un vrai navigateur, base SIMULÉE (aucune donnée réelle touchée), date figée au 7 novembre 2026.
// Les fichiers téléchargés et les PDF sont écrits dans le dossier donné en argument.
// Lancer (deux terminaux) :
//   1) VITE_SUPABASE_URL=http://mock.supabase.test VITE_SUPABASE_ANON_KEY=k npx vite --port 5197 --host 127.0.0.1
//   2) node scripts/e2e-exports.cjs <dossier>
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
    it('22222222-0000-0000-0000-000000000004', P2, 'Prototype boîtier', ST1, -7, -1, { priority: 'low' }),  // EN RETARD, assignée à OTHER
  ],
  cp_item_members: [{ item_id: I1, user_id: ME }, { item_id: '22222222-0000-0000-0000-000000000004', user_id: OTHER }],
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
    if (path.startsWith('/rest/v1/')) { const table = path.split('/').pop(); if (req.method() !== 'GET') { if (req.method() === 'PATCH') { const id = (url.searchParams.get('id') || '').slice(3); const body = req.postDataJSON(); writes.push({ table, id, body }); const row = (TABLES[table] || []).find(r => r.id === id); if (row) { Object.assign(row, body, { updated_at: new Date().toISOString() }); return json([{ id }]); } return json([]); } return route.fulfill({ status: 204, body: '' }); } const rows = filt(TABLES[table] || [], url); return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows); }
    return json([]);
  });
  const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `— ${detail}`); };


  const fs = require('fs'); const ExcelJS = require('exceljs');
  const openMenu = async () => { await page.getByRole('button', { name: /^Exporter/ }).click(); await page.waitForTimeout(250); };
  const download = async (item) => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('menuitem', { name: item }).click()]); const path = process.argv[2] + '/' + dl.suggestedFilename(); await dl.saveAs(path); return { name: dl.suggestedFilename(), path }; };

  await page.goto(BASE + '/pilote/projets?view=gantt'); await page.waitForSelector('[role="search"]', { timeout: 25000 }); await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Plus d'options d'affichage" }).click(); await page.getByRole('menuitem', { name: 'Tout déplier' }).click(); await page.waitForTimeout(300);

  // CSV
  await openMenu(); const csv = await download('CSV (tâches et jalons)');
  const csvText = fs.readFileSync(csv.path, 'utf8');
  check('1 CSV : nom de fichier daté, BOM UTF-8, en-têtes, une ligne par élément (4)', csv.name === 'pilote-taches-2026-11-07.csv' && csvText.startsWith('﻿Projet;Parent;Type;Nom;') && csvText.trim().split('\r\n').length === 5, csv.name + ' | ' + csvText.slice(0, 120).replace(/\r?\n/g, '⏎'));
  check('2 CSV : retard marqué « Oui » pour les 2 éléments en retard', (csvText.match(/;Oui;/g) || []).length === 2, String((csvText.match(/;Oui;/g) || []).length));
  // ICS
  await openMenu(); const ics = await download('Calendrier (.ics)');
  const icsText = fs.readFileSync(ics.path, 'utf8');
  check('3 .ics : 4 événements journée entière, fin exclusive, identifiants stables', ics.name === 'pilote-2026-11-07.ics' && (icsText.match(/BEGIN:VEVENT/g) || []).length === 4 && /UID:gomat-item-22222222-0000-0000-0000-000000000001@gomat/.test(icsText) && /DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}/.test(icsText), icsText.slice(0, 200));
  // XLSX
  await openMenu(); const xl = await download('Excel (projets et tâches)');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(xl.path);
  const names = wb.worksheets.map(w => w.name); const itemsSheet = wb.getWorksheet('Tâches et jalons');
  check('4 Excel : deux feuilles « Projets » et « Tâches et jalons », 2 projets et 4 tâches', JSON.stringify(names) === JSON.stringify(['Projets', 'Tâches et jalons']) && wb.getWorksheet('Projets').rowCount === 3 && itemsSheet.rowCount === 5, JSON.stringify(names) + ' ' + wb.getWorksheet('Projets').rowCount + ' ' + itemsSheet.rowCount);
  check('5 Excel : en-tête en gras, première cellule « Projet »', itemsSheet.getRow(1).getCell(1).value === 'Projet' && itemsSheet.getRow(1).font.bold === true);

  // Les exports reprennent les filtres : « En retard » seulement
  await page.getByRole('button', { name: /^En retard/ }).click(); await page.waitForTimeout(500);
  await openMenu(); const csv2 = await download('CSV (tâches et jalons)');
  const lines2 = fs.readFileSync(csv2.path, 'utf8').trim().split('\r\n');
  check('6 l\'export suit les filtres : 2 éléments en retard seulement', lines2.length === 3, String(lines2.length));
  await page.getByRole('button', { name: 'Tout afficher' }).click(); await page.waitForTimeout(300);

  // Impression / PDF du Gantt
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });   // le navigateur sans écran n'ouvre pas de fenêtre d'impression : on la remplace pour garder l'état « en impression »
  await openMenu(); await page.getByRole('menuitem', { name: 'Imprimer / PDF' }).click(); await page.waitForTimeout(500);
  const classes = await page.evaluate(() => document.body.className); 
  check('7 l\'impression appelle window.print, pose la classe et la feuille de style temporaires', (await page.evaluate(() => window.__printed)) === 1 && /pilote-printing/.test(classes) && (await page.locator('style[data-print-style]').count()) === 1, classes);
  await page.pdf({ path: process.argv[2] + '/p5-gantt.pdf', landscape: true, printBackground: true, preferCSSPageSize: true });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await page.waitForTimeout(200);
  check('8 après l\'impression, tout est retiré (classe et style)', !(await page.evaluate(() => document.body.className)).includes('pilote-printing') && (await page.locator('style[data-print-style]').count()) === 0);

  // Tableau : menu d'export présent
  const viewButton = () => page.getByRole('button', { name: /^Vue : / });
  const goView = async (name) => { const b = viewButton(); await b.waitFor({ timeout: 25000 }); await b.click(); await page.getByRole('menuitemradio', { name }).click(); };
  const viewItems = async () => { await viewButton().click(); const t = await page.getByRole('menuitemradio').allInnerTexts(); await page.keyboard.press('Escape'); return t.map(s => s.replace(/\s+/g, ' ').trim()); };
  const viewLabel = async () => { const b = viewButton(); await b.waitFor({ timeout: 25000 }); return ((await b.getAttribute('aria-label')) || '').replace(/^Vue : /, '').replace(/\. Changer de vue$/, ''); };
  await page.goto(BASE + '/pilote/projets'); await goView('Tableau'); await page.waitForTimeout(500);
  await openMenu();
  check('9 le Tableau propose l\'export (sans « Imprimer / PDF »)', (await page.getByRole('menuitem', { name: 'CSV (projets)' }).count()) === 1 && (await page.getByRole('menuitem', { name: 'Imprimer / PDF' }).count()) === 0);
  await page.keyboard.press('Escape');
  // Calendrier : export + impression
  await goView('Calendrier'); await page.waitForTimeout(500); await openMenu();
  check('10 le Calendrier propose l\'export et « Imprimer / PDF »', (await page.getByRole('menuitem', { name: 'Excel (projets et tâches)' }).count()) === 1 && (await page.getByRole('menuitem', { name: 'Imprimer / PDF' }).count()) === 1);
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('menuitem', { name: 'Imprimer / PDF' }).click(); await page.waitForTimeout(400);
  await page.pdf({ path: process.argv[2] + '/p5-calendrier.pdf', landscape: true, printBackground: true, preferCSSPageSize: true });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  check('11 aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
