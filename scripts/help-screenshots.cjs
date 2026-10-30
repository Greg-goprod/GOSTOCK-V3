#!/usr/bin/env node
// Captures de la rubrique Aide et mode d'emploi PDF, avec des données fictives.
//
// 1. Lancer l'application avec une base simulée :
//      VITE_SUPABASE_URL=http://mock.supabase.test VITE_SUPABASE_ANON_KEY=x npx vite --port 5181
// 2. Dans un autre terminal :  node scripts/help-screenshots.cjs
//    (BASE=http://localhost:5181 par défaut ; ONLY=comptoir-1,badge-1 pour quelques captures ;
//     PDF=1 avec ONLY pour refaire aussi le PDF)
//
// Résultat : public/aide/<nom>.jpg et public/aide/GO-Mat-mode-emploi.pdf
const path = require('path');
const { chromium } = require('playwright');
const { data, PERMS } = require('./help-demo-data.cjs');

const BASE = process.env.BASE || 'http://localhost:5181';
const OUT = path.join(__dirname, '..', 'public', 'aide');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 780 };

// Repère numéroté posé sur un élément (cercle + cadre), retiré après la capture
async function mark(page, locator, n) {
  const box = await locator.first().boundingBox().catch(() => null);
  if (!box) return;
  await page.evaluate(([b, num]) => {
    const layer = document.getElementById('help-marks') || Object.assign(document.createElement('div'), { id: 'help-marks' });
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    document.body.appendChild(layer);
    const frame = document.createElement('div');
    frame.style.cssText = `position:fixed;left:${b.x - 4}px;top:${b.y - 4}px;width:${b.width + 8}px;height:${b.height + 8}px;border:3px solid #e8590c;border-radius:8px`;
    const dot = document.createElement('div');
    dot.textContent = String(num);
    dot.style.cssText = `position:fixed;left:${Math.max(2, b.x - 16)}px;top:${Math.max(2, b.y - 16)}px;width:26px;height:26px;border-radius:50%;background:#e8590c;color:#fff;font:700 14px/26px system-ui;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
    layer.append(frame, dot);
  }, [box, n]);
}

const byRole = (page, role, name) => page.getByRole(role, { name });

// Chaque capture : page, rôle, format, actions avant la photo, repères
const SHOTS = [
  { name: 'connexion-1', path: '/', role: 'none', marks: p => [byRole(p, 'button', 'Recevoir un code')] },
  { name: 'connexion-2', path: '/', role: 'none', act: async p => {
      await p.getByLabel(/Adresse e-mail/i).fill('marc.dubois@exemple.ch');
      await byRole(p, 'button', 'Recevoir un code').click();
      await p.waitForTimeout(800);
    }, marks: p => [p.getByLabel(/Code reçu/i)] },
  { name: 'accueil-magasinier', path: '/', role: 'technician' },
  { name: 'accueil-collaborateur', path: '/', role: 'user', viewport: MOBILE },
  { name: 'badge-1', path: '/badge', role: 'user', viewport: MOBILE },
  { name: 'pilotage-1', path: '/pilotage' },
  { name: 'demarrage-1', path: '/demarrage' },
  { name: 'comptoir-1', path: '/comptoir', marks: p => [p.getByPlaceholder(/Scannez ou saisissez un code/i), byRole(p, 'button', 'choisissez la personne')] },
  { name: 'comptoir-2', path: '/comptoir', act: async p => {
      await byRole(p, 'button', 'choisissez la personne').click();
      await p.locator('li > button', { hasText: 'Marc Dubois' }).first().click();
      await p.waitForTimeout(600);
      const input = p.getByPlaceholder(/Scannez ou saisissez un code/i);
      for (const code of ['HT30-01', 'GOMAT-0042']) { await input.fill(code); await input.press('Enter'); await p.waitForTimeout(900); }
    }, marks: p => [p.getByRole('group', { name: 'Mode de scan' }), byRole(p, 'button', /^Valider$/)] },
  { name: 'demandes-1', path: '/demandes', marks: p => [byRole(p, 'button', /Nouvelle demande/)] },
  { name: 'demandes-2', path: '/demandes', act: async p => { await byRole(p, 'button', /Nouvelle demande/).first().click(); await p.waitForTimeout(900); } },
  { name: 'sorties-1', path: '/checkouts' },
  { name: 'scanner-1', path: '/scan', viewport: MOBILE },
  { name: 'libre-service-1', path: '/libre-service', role: 'user', viewport: MOBILE },
  { name: 'transferts-1', path: '/transferts', marks: p => [byRole(p, 'button', /Nouveau transfert/)] },
  { name: 'inventaire-1', path: '/inventaire' },
  { name: 'emplacements-1', path: '/emplacements' },
  { name: 'ecran-tv-1', path: '/ecran', marks: p => [p.getByLabel('Dépôt'), byRole(p, 'button', 'Plein écran')] },
  { name: 'outils-1', path: '/equipment', marks: p => [byRole(p, 'button', /Ajouter un équipement/)] },
  { name: 'outils-2', path: '/equipment', act: async p => { await byRole(p, 'button', /Ajouter un équipement/).first().click(); await p.waitForTimeout(900); } },
  { name: 'kits-1', path: '/kits' },
  { name: 'etiquettes-1', path: '/etiquettes' },
  { name: 'entretien-1', path: '/entretien' },
  { name: 'atelier-1', path: '/atelier' },
  { name: 'pertes-1', path: '/incidents' },
  { name: 'consommables-1', path: '/consommables' },
  { name: 'commande-1', path: '/commande' },
  { name: 'vehicules-1', path: '/vehicules' },
  { name: 'locations-1', path: '/locations', marks: p => [byRole(p, 'button', /Nouvelle location/), byRole(p, 'button', /^Réception$/)] },
  { name: 'locations-2', path: '/locations', act: async p => { await byRole(p, 'button', /^Réception$/).first().click(); await p.waitForTimeout(1200); } },
  { name: 'chantiers-1', path: '/chantiers', marks: p => [byRole(p, 'button', /Rapport PDF/)] },
  { name: 'carte-1', path: '/carte' },
  { name: 'planning-1', path: '/planning' },
  { name: 'personnes-1', path: '/users' },
  { name: 'personnes-2', path: '/users', act: async p => { await byRole(p, 'button', /Ajouter/).first().click(); await p.waitForTimeout(900); } },
  { name: 'permis-1', path: '/formations' },
  { name: 'epi-1', path: '/epi' },
  { name: 'couts-1', path: '/couts' },
  { name: 'comptabilite-1', path: '/comptabilite' },
  { name: 'journal-1', path: '/journal' },
  { name: 'parametres-1', path: '/settings', act: async p => {
      await p.getByRole('button', { name: /PARAMÈTRES SYSTÈME/i }).first().click();
      await p.getByRole('button', { name: /NOTIFICATIONS PAR E-MAIL ET SMS/i }).first().click();
      await p.waitForTimeout(700);
    } },
  { name: 'donnees-1', path: '/donnees' },
];

async function newPage(browser, role, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport === MOBILE ? 2 : 1, colorScheme: 'light', locale: 'fr-CH' });
  const page = await ctx.newPage();
  const tables = { ...data, whoami: role === 'none' ? null : { id: 'u1', first_name: 'Marc', last_name: 'Dubois', email: 'm@d.ch', role, permissions: PERMS[role] ?? PERMS.admin, depot_ids: [] } };
  await page.route('http://mock.supabase.test/**', route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop();
    if (url.pathname.startsWith('/auth/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (url.pathname.includes('/storage/')) return route.fulfill({ status: 404, body: '' });
    if (url.pathname.includes('/rpc/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables[table] ?? null) });
    let rows = tables[table] ?? [];
    if (Array.isArray(rows)) {
      for (const [k, v] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset', 'columns'].includes(k)) continue;
        const m = /^(eq|ilike)\.(.*)$/.exec(v);
        if (m) rows = rows.filter(r => String(r[k] ?? '').toLowerCase() === m[2].replace(/\\/g, '').toLowerCase());
      }
    }
    const single = (route.request().headers().accept || '').includes('vnd.pgrst.object');
    if (single) return route.fulfill({ status: rows.length === 1 ? 200 : 406, contentType: 'application/json', body: JSON.stringify(rows.length === 1 ? rows[0] : { code: 'PGRST116', message: 'no rows' }) });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await page.addInitScript(signedIn => {
    window.print = () => {};
    localStorage.setItem('theme', 'light');
    localStorage.setItem('gomat-language', 'fr');
    if (signedIn) {
      localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { id: 'a1', email: 'm@d.ch', aud: 'authenticated', role: 'authenticated' } }));
    }
  }, role !== 'none');
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const failed = [];
  for (const shot of SHOTS) {
    if (ONLY && !ONLY.includes(shot.name)) continue;
    const { ctx, page } = await newPage(browser, shot.role || 'admin', shot.viewport || DESKTOP);
    try {
      await page.goto(BASE + shot.path);
      await page.waitForTimeout(2200);
      if (shot.act) await shot.act(page);
      // Les messages passagers (toasts) gêneraient la capture
      await page.addStyleTag({ content: '[role="status"][aria-live], div[style*="z-index: 9999"] { display: none !important; }' });
      for (const [i, loc] of (shot.marks ? shot.marks(page) : []).entries()) await mark(page, loc, i + 1);
      await page.screenshot({ path: path.join(OUT, `${shot.name}.jpg`), type: 'jpeg', quality: 80 });
      console.log('✓', shot.name);
    } catch (error) {
      failed.push(shot.name);
      console.log('✗', shot.name, error.message.split('\n')[0]);
    }
    await ctx.close();
  }

  // Mode d'emploi PDF, depuis la version imprimable (avec les captures qui viennent d'être faites)
  if (!ONLY || process.env.PDF) {
    const { ctx, page } = await newPage(browser, 'admin', DESKTOP);
    await page.goto(BASE + '/aide/imprimer');
    await page.waitForTimeout(2500);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(OUT, 'GO-Mat-mode-emploi.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
    console.log('✓ GO-Mat-mode-emploi.pdf');
    await ctx.close();
  }
  await browser.close();
  if (failed.length) console.log('Captures en échec :', failed.join(', '));
})();
