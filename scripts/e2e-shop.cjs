#!/usr/bin/env node
// Parcours de bout en bout du Shop et des pages en cartes, pilotés par Playwright (pas de clic « à la souris »).
// Chaque point est tenté seul : un échec n'arrête pas les suivants. Résultat : un rapport Markdown + des captures.
//
// Lancer l'application (base GO-MAT réelle) :   npm run dev            (note le port affiché)
// Puis :
//   BASE=http://localhost:5173 E2E_PASSWORD='...' node scripts/e2e-shop.cjs
// Comptes (adresses de test) : E2E_COLLAB, E2E_STAFF (par défaut test.collaborateur@example.com et test.magasinier@example.com).
// Le mot de passe se passe UNIQUEMENT par la variable E2E_PASSWORD : il n'est jamais écrit dans le rapport ni dans les captures.
//
// Données créées : une commande « TEST-SHOP e2e » (consommable, livraison sur chantier), annulée à la fin.
// Essai à blanc sans base réelle :  E2E_MOCK=1 BASE=http://localhost:5181 node scripts/e2e-shop.cjs
//   (serveur lancé avec VITE_SUPABASE_URL=http://mock.supabase.test VITE_SUPABASE_ANON_KEY=x npx vite --port 5181)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const MOCK = process.env.E2E_MOCK === '1';
const PASSWORD = process.env.E2E_PASSWORD || '';
const COLLAB = process.env.E2E_COLLAB || 'test.collaborateur@example.com';
const STAFF = process.env.E2E_STAFF || 'test.magasinier@example.com';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'tests');
const SHOTS = path.join(OUT_DIR, 'captures-shop-e2e');
const REPORT = path.join(OUT_DIR, 'rapport-shop-e2e.md');
fs.mkdirSync(SHOTS, { recursive: true });

if (!MOCK && !PASSWORD) { console.error('E2E_PASSWORD manquant (variable d\'environnement).'); process.exit(2); }

const results = [];
const consoleErrors = [];
let order = null; // numéro de la commande créée
let cancelled = false; // vrai seulement si l'annulation a été constatée

async function contextFor(browser, who, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-CH' });
  const page = await ctx.newPage();
  page.on('pageerror', e => consoleErrors.push(`${who}: ${e.message}`));
  if (MOCK) {
    const { data, PERMS } = require('./help-demo-data.cjs');
    const role = who === 'collab' ? 'user' : 'technician';
    const tables = { ...data, whoami: { id: 'u1', first_name: 'Marc', last_name: 'Dubois', email: 'm@d.ch', role, permissions: PERMS[role], depot_ids: [] } };
    await page.route('http://mock.supabase.test/**', route => {
      const u = new URL(route.request().url());
      const t = u.pathname.split('/').pop();
      if (u.pathname.startsWith('/auth/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      if (u.pathname.includes('/rpc/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(t === 'tool_availability' ? 2 : tables[t] ?? null) });
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables[t] ?? []) });
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem('gomat-language')) localStorage.setItem('gomat-language', 'fr');
      localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { id: 'a1', email: 'm@d.ch', aud: 'authenticated', role: 'authenticated' } }));
    });
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    return { ctx, page };
  }
  await page.goto(BASE);
  await page.getByRole('button', { name: /J'ai un mot de passe/ }).click();
  await page.locator('#login-email-pw').fill(who === 'collab' ? COLLAB : STAFF);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

// Un point : exécute, capture, enregistre le verdict (OK / KO / NON TESTÉ) et le détail relevé
async function step(page, id, title, fn) {
  const entry = { id, title, status: 'KO', detail: '', shot: '' };
  try {
    const detail = await fn();
    entry.status = detail && detail.status ? detail.status : 'OK';
    entry.detail = (detail && detail.detail) || '';
  } catch (error) {
    entry.status = 'KO';
    entry.detail = `Erreur : ${String(error.message).split('\n')[0]}`;
  }
  const file = `${id}.png`;
  try { await page.screenshot({ path: path.join(SHOTS, file) }); entry.shot = `captures-shop-e2e/${file}`; } catch { /* page fermée */ }
  console.log(`${entry.status.padEnd(11)} ${id}  ${title}${entry.detail ? ' — ' + entry.detail : ''}`);
  results.push(entry);
}
const expect = (cond, message) => { if (!cond) throw new Error(message); };
const text = async (loc) => ((await loc.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const goShop = async (page) => { await page.goto(`${BASE}/shop`); await page.waitForSelector('text=articles', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1200); };

(async () => {
  const browser = await chromium.launch();

  /* ---------------- Collaborateur ---------------- */
  const c = await contextFor(browser, 'collab');
  const p = c.page;
  await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gomat-cart')).forEach(k => localStorage.removeItem(k)));

  await step(p, 'A1-demandes-interdit', 'Collaborateur : /demandes est inaccessible', async () => {
    await p.goto(`${BASE}/demandes`); await p.waitForTimeout(1500);
    expect(!p.url().includes('/demandes'), `reste sur ${p.url()}`);
    expect(await p.getByRole('link', { name: /Demandes/i }).count() === 0, 'onglet Demandes visible');
  });

  await step(p, 'A2-rail', 'Rail : icône + nom, un lien par chapitre', async () => {
    await goShop(p);
    const links = p.locator('nav[aria-label="Navigation principale"] a');
    const n = await links.count();
    expect(n >= 5, `seulement ${n} chapitres`);
    const names = (await links.allInnerTexts()).map(t => t.trim()).filter(Boolean);
    return { detail: names.join(', ') };
  });

  await step(p, 'B1-dispo-dates', 'Disponibilité par dates : les cartes d\'outils changent', async () => {
    await goShop(p);
    await p.getByRole('button', { name: 'Outils', exact: true }).click(); await p.waitForTimeout(600);
    const card = p.locator('main li.mx-card').first();
    const before = await text(card);
    await p.getByLabel('Voir la disponibilité pour mes dates').check(); await p.waitForTimeout(2500);
    const after = await text(p.locator('main li.mx-card').first());
    expect(/sur ces dates/i.test(after) || /Indisponible sur ces dates/i.test(after), `texte sans « sur ces dates » : ${after}`);
    return { detail: `avant : « ${before.slice(0, 80)} » → après : « ${after.slice(0, 80)} »` };
  });

  await step(p, 'B2-lot', 'Lot : « Lot » ajoute les articles du kit au panier', async () => {
    await goShop(p);
    const btn = p.getByRole('button', { name: /^Ajouter le lot au panier/ });
    if (await btn.count() === 0) return { status: 'NON TESTÉ', detail: 'aucun kit actif' };
    await btn.first().click(); await p.waitForTimeout(600);
    await p.getByRole('button', { name: /^Panier/ }).first().click(); await p.waitForTimeout(1000);
    const lines = await p.locator('ul[aria-label="Articles du panier"] > li').count();
    expect(lines > 0, 'panier vide après « Lot »');
    return { detail: `${lines} ligne(s) dans le panier` };
  });
  await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gomat-cart')).forEach(k => localStorage.removeItem(k)));

  await step(p, 'B3-vehicule', 'Véhicules : un seul par commande', async () => {
    await goShop(p);
    await p.getByRole('button', { name: 'Véhicules', exact: true }).click(); await p.waitForTimeout(600);
    const adds = p.getByRole('button', { name: /^Ajouter au panier :/ });
    const n = await adds.count();
    if (n < 2) return { status: 'NON TESTÉ', detail: `${n} véhicule(s) seulement` };
    await adds.first().click(); await p.waitForTimeout(500);
    // Le premier véhicule est au panier (son bouton devient « Retirer ») : le suivant est maintenant le premier « Ajouter »
    await adds.first().click(); await p.waitForTimeout(700);
    const refused = await p.locator('[role="status"]').filter({ hasText: /Un seul v/i }).count();
    expect(refused > 0, 'pas de message « Un seul véhicule par commande » au 2e ajout');
  });
  await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gomat-cart')).forEach(k => localStorage.removeItem(k)));

  await step(p, 'B4-commande-livraison', 'Commande d\'un consommable en livraison sur chantier', async () => {
    if (MOCK) return { status: 'NON TESTÉ', detail: 'création réelle impossible avec la base simulée' };
    await goShop(p);
    await p.getByRole('button', { name: 'Consommables', exact: true }).click(); await p.waitForTimeout(600);
    await p.getByRole('button', { name: /^Ajouter au panier :/ }).first().click(); await p.waitForTimeout(500);
    await p.getByRole('button', { name: /^Panier/ }).first().click(); await p.waitForTimeout(1200);
    await p.getByLabel('Chantier ou service').fill('TEST-SHOP e2e');
    await p.getByRole('radio', { name: /Livraison sur chantier/ }).check();
    await p.getByLabel(/Adresse de livraison/).fill('TEST-SHOP e2e, rue de l\'essai 1');
    await p.getByLabel('Remarque (facultatif)').fill('TEST-SHOP e2e');
    await p.getByRole('button', { name: 'Commander', exact: true }).click();
    const toast = p.locator('[role="status"]').filter({ hasText: /Commande DEM/ });
    await toast.first().waitFor({ timeout: 20000 });
    const t = await text(toast);
    order = (t.match(/DEM\d{4}-\d{4}/) || [])[0];
    expect(order, `numéro de commande introuvable dans « ${t} »`);
    return { detail: `commande ${order}` };
  });

  await step(p, 'B5-mes-commandes', 'Mes commandes : la commande apparaît avec son suivi', async () => {
    if (!order) return { status: 'NON TESTÉ', detail: 'pas de commande créée' };
    await p.goto(`${BASE}/shop?vue=commandes`); await p.waitForTimeout(2000);
    await p.getByText(order).first().waitFor({ timeout: 15000 });
    expect(await p.getByRole('button', { name: 'Annuler la commande' }).count() > 0, 'bouton Annuler absent');
  });

  /* ---------------- Magasin ---------------- */
  const s = await contextFor(browser, 'staff');
  const sp = s.page;

  await step(sp, 'C1-a-livrer', 'Magasin : la commande en livraison est dans « À livrer »', async () => {
    if (!order) return { status: 'NON TESTÉ', detail: 'pas de commande créée' };
    await sp.goto(`${BASE}/demandes`); await sp.waitForTimeout(2000);
    await sp.getByRole('radio', { name: /^À livrer/ }).click(); await sp.waitForTimeout(800);
    const found = await sp.getByText(order).count();
    if (found === 0) {
      // Commande « À valider » (article soumis à validation, ou quantité au-delà du seuil) : pas encore dans « À livrer »
      await sp.getByRole('radio', { name: /^Toutes/ }).click(); await sp.waitForTimeout(800);
      expect(await sp.getByText(order).count() > 0, `${order} absente de « Toutes »`);
      return { status: 'PARTIEL', detail: `${order} existe mais n'est pas dans « À livrer » (probablement « À valider » : valide-la puis revérifie)` };
    }
  });

  await step(sp, 'C2-cartes-demandes', 'Demandes : groupes par étape et cartes', async () => {
    await sp.goto(`${BASE}/demandes`); await sp.waitForTimeout(1500);
    await sp.getByRole('radio', { name: /^Toutes/ }).click(); await sp.waitForTimeout(800);
    const groups = await sp.locator('main h2.mx-section-label').allInnerTexts();
    expect(groups.length > 0, 'aucun groupe par étape');
    return { detail: groups.join(' | ') };
  });

  /* ---------------- Retour collaborateur : recommander puis annuler ---------------- */
  await step(p, 'D1-recommander', '« Commander à nouveau » remet les articles dans le panier', async () => {
    if (!order) return { status: 'NON TESTÉ', detail: 'pas de commande créée' };
    await p.goto(`${BASE}/shop?vue=commandes`); await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Commander à nouveau' }).first().click(); await p.waitForTimeout(1200);
    const lines = await p.locator('ul[aria-label="Articles du panier"] > li').count();
    expect(lines > 0, 'panier vide après « Commander à nouveau »');
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gomat-cart')).forEach(k => localStorage.removeItem(k)));
  });

  await step(p, 'D2-annuler', 'Annuler la commande (Envoyée / Validée)', async () => {
    if (!order) return { status: 'NON TESTÉ', detail: 'pas de commande créée' };
    await p.goto(`${BASE}/shop?vue=commandes`); await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Annuler la commande' }).first().click(); await p.waitForTimeout(500);
    // Le bouton se cherche dans la fenêtre de confirmation (un bouton « OK » d'avis existe aussi sur la page)
    await p.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
    await p.locator('[role="status"]').filter({ hasText: /annulée/ }).first().waitFor({ timeout: 15000 });
    cancelled = true;
  });

  /* ---------------- Pages en cartes (magasin) : bureau + téléphone ---------------- */
  const pages = ['demandes', 'chantiers', 'kits', 'locations', 'entretien', 'atelier', 'formations', 'epi', 'consommables', 'incidents', 'vehicules', 'transferts'];
  for (const name of pages) {
    await step(sp, `E-${name}`, `Page ${name} : s'affiche, une carte s'ouvre, pas de débordement`, async () => {
      await sp.setViewportSize({ width: 1440, height: 900 });
      await sp.goto(`${BASE}/${name}`); await sp.waitForTimeout(1800);
      const cards = await sp.locator('main button[aria-haspopup="menu"]').count();
      const errorBanner = await sp.getByText(/Impossible de charger|Erreur/).count();
      expect(errorBanner === 0, 'message d\'erreur affiché');
      let detail = `${cards} carte(s)`;
      const menu = sp.locator('main button[aria-haspopup="menu"]').first();
      if (await menu.count()) {
        await menu.click(); await sp.waitForTimeout(400);
        const items = await sp.locator('[role="menu"]').last().innerText().catch(() => '');
        detail += ` ; menu ⋮ : ${items.replace(/\s+/g, ' ').slice(0, 80)}`;
        await sp.keyboard.press('Escape');
      }
      await sp.setViewportSize({ width: 390, height: 844 }); await sp.waitForTimeout(700);
      const overflow = await sp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(!overflow, 'défilement horizontal sur téléphone');
      return { detail };
    });
  }

  /* ---------------- Langues ---------------- */
  for (const lang of ['de', 'it', 'en']) {
    await step(p, `F-${lang}`, `Shop en ${lang.toUpperCase()} : s'affiche (relecture à faire sur la capture)`, async () => {
      await p.setViewportSize({ width: 1440, height: 900 });
      await p.evaluate(l => localStorage.setItem('gomat-language', l), lang);
      await p.goto(`${BASE}/shop`); await p.waitForTimeout(2000);
      const body = await p.locator('main').innerText();
      const french = ['Ajouter', 'Disponible maintenant', 'Mes commandes', 'Panier', 'Lots prêts'].filter(w => body.includes(w));
      return { status: french.length ? 'PARTIEL' : 'OK', detail: french.length ? `reste en français : ${french.join(', ')}` : '' };
    });
  }
  await p.evaluate(() => localStorage.setItem('gomat-language', 'fr'));

  await browser.close();

  /* ---------------- Rapport ---------------- */
  const count = k => results.filter(r => r.status === k).length;
  const lines = [
    '# Rapport des parcours Shop (Playwright)',
    '',
    `Commit testé : à renseigner avec \`git log --oneline -1\`. Base : ${MOCK ? 'SIMULÉE (essai à blanc)' : 'GO-MAT'}. Comptes : ${COLLAB} et ${STAFF}.`,
    '',
    `Synthèse : ${count('OK')} OK · ${count('PARTIEL')} PARTIEL · ${count('KO')} KO · ${count('NON TESTÉ')} NON TESTÉ`,
    order ? (cancelled ? `Commande de test créée puis annulée : ${order}` : `ATTENTION : la commande de test ${order} n'a PAS été annulée par le script : annule-la à la main (Shop › Mes commandes › Annuler la commande).`) : 'Aucune commande créée.',
    '',
    '| Point | Verdict | Détail | Capture |', '|---|---|---|---|',
    ...results.map(r => `| ${r.id} — ${r.title} | ${r.status} | ${r.detail.replace(/\|/g, '/')} | ${r.shot ? `[${path.basename(r.shot)}](${r.shot})` : ''} |`),
    '',
    consoleErrors.length ? `Erreurs JavaScript de la page (${consoleErrors.length}) :\n${[...new Set(consoleErrors)].slice(0, 15).map(e => `- ${e}`).join('\n')}` : 'Aucune erreur JavaScript.',
    '',
  ];
  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`\nRapport : ${path.relative(process.cwd(), REPORT)}`);
  console.log(`Synthèse : ${count('OK')} OK · ${count('PARTIEL')} PARTIEL · ${count('KO')} KO · ${count('NON TESTÉ')} NON TESTÉ`);
  process.exit(count('KO') ? 1 : 0);
})();
