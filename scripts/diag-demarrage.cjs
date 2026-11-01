#!/usr/bin/env node
// DIAGNOSTIC (lecture seule, ne crée rien) : où va le temps au démarrage, et quelles requêtes échouent ?
// Pour départager « vraie régression » et « test trop pressé ».
//   BASE=http://localhost:5173 E2E_PASSWORD='…' node scripts/diag-demarrage.cjs
// Mot de passe UNIQUEMENT par E2E_PASSWORD. Comptes : E2E_STAFF, E2E_COLLAB (défauts : test.magasinier@ / test.collaborateur@example.com).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:5173';
const PASSWORD = process.env.E2E_PASSWORD || '';
if (!PASSWORD) { console.error('E2E_PASSWORD manquant'); process.exit(2); }
const ACCOUNTS = { staff: process.env.E2E_STAFF || 'test.magasinier@example.com', collab: process.env.E2E_COLLAB || 'test.collaborateur@example.com' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
  const page = await ctx.newPage();
  const net = []; const errors = []; const consoleErrors = [];
  let t0 = Date.now();
  page.on('response', async r => {
    const u = r.url(); if (!/supabase\.co/.test(u)) return;
    const short = u.replace(/^https:\/\/[^/]+/, '').slice(0, 90);
    const entry = { at: Date.now() - t0, status: r.status(), url: short };
    if (r.status() >= 400) { try { entry.body = (await r.text()).slice(0, 160); } catch { /* corps illisible */ } errors.push(entry); }
    if (/rpc\/(whoami|unread_notification_count|my_notifications)/.test(u)) { try { entry.body = (await r.text()).slice(0, 80); } catch { /* corps illisible */ } net.push(entry); }
  });
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));

  await page.goto(BASE);
  await page.getByRole('button', { name: /J'ai un mot de passe/ }).click();
  await page.locator('#login-email-pw').fill(ACCOUNTS[who]);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30000 });
  console.log(`\n=== ${who} (${ACCOUNTS[who]}) ===`);
  const bell = async () => ((await page.locator('header a[aria-label^="Notifications"]').first().getAttribute('aria-label').catch(() => null)) || '(cloche absente)');
  for (const wait of [500, 1500, 3000, 6000]) { await sleep(wait === 500 ? 500 : wait - (wait === 1500 ? 500 : wait === 3000 ? 1500 : 3000)); console.log(`  cloche après connexion +${wait} ms : ${await bell()}`); }

  // Rechargement complet sur une page réservée au personnel, comme le fait la batterie
  for (const route of ['/comptoir', '/users', '/entreprises']) {
    t0 = Date.now();
    await page.goto(BASE + route);
    const seen = [];
    for (const ms of [300, 900, 2000, 4000, 7000]) {
      await sleep(ms - (seen.length ? seen[seen.length - 1].ms : 0));
      seen.push({ ms, path: new URL(page.url()).pathname });
    }
    console.log(`  ${route} : chemin visible à ${seen.map(s => `${s.ms} ms → ${s.path}`).join(' | ')}`);
  }
  console.log('  requêtes clés :', JSON.stringify(net.slice(0, 8)));
  console.log(`  requêtes en échec (HTTP ≥ 400) : ${errors.length}`, errors.length ? JSON.stringify(errors.slice(0, 8)) : '');
  console.log(`  erreurs console : ${consoleErrors.length}`, consoleErrors.length ? JSON.stringify([...new Set(consoleErrors)].slice(0, 6)) : '');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const who of ['staff', 'collab']) await run(browser, who);
  await browser.close();
})();
