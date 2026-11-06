// Envoi des écritures comptables de GO-Mat dans bexio (écritures manuelles simples)
//
// Appelée depuis la page Comptabilité par une personne qui a le droit « settings ».
// Corps : { entries: [{ date: 'AAAA-MM-JJ', reference, debit: '6800', credit: '1500', amount, description }] }
// Les numéros de compte sont traduits en identifiants bexio d'après le plan comptable du compte bexio.
//
// Secrets : BEXIO_API_TOKEN (jeton personnel bexio avec le droit « accounting ») et BEXIO_ORGANIZATION_ID (l'entreprise de GO-Mat à qui appartient ce
// compte bexio : un seul jeton existe pour toute la plateforme, une autre entreprise ne doit pas pouvoir y écrire).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TOKEN = Deno.env.get('BEXIO_API_TOKEN');
const BEXIO_ORG = Deno.env.get('BEXIO_ORGANIZATION_ID');
const API = 'https://api.bexio.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Entry {
  date: string;
  reference: string;
  debit: string;
  credit: string;
  amount: number;
  description: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const bexio = (path: string, init: RequestInit = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...init.headers },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  if (!TOKEN) return json({ error: 'bexio non configuré : secret BEXIO_API_TOKEN manquant dans Supabase' }, 500);

  // Seule une personne avec le droit « settings » peut écrire dans la comptabilité
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: me } = await caller.rpc('whoami');
  if (!me || !(me.permissions ?? []).includes('settings')) return json({ error: 'Accès refusé' }, 403);
  // Un seul compte bexio pour toute la plateforme : seule l'entreprise désignée peut y écrire (sans désignation, personne)
  if (!BEXIO_ORG) return json({ error: 'bexio non lié à une entreprise : secret BEXIO_ORGANIZATION_ID manquant dans Supabase' }, 500);
  if (me.organization?.id !== BEXIO_ORG) return json({ error: 'Ce compte bexio n\'est pas celui de ton entreprise' }, 403);

  const body = await req.json().catch(() => ({}));
  const entries = (Array.isArray(body?.entries) ? body.entries : []) as Entry[];
  if (!entries.length) return json({ error: 'Aucune écriture à envoyer' }, 400);

  // Plan comptable bexio : numéro de compte → identifiant
  const accountsResponse = await bexio('/2.0/accounts?limit=2000');
  if (!accountsResponse.ok) return json({ error: `bexio refuse l'accès au plan comptable (HTTP ${accountsResponse.status}). Vérifie le jeton.` }, 502);
  const accounts = new Map<string, number>(
    ((await accountsResponse.json()) as { id: number; account_no: string }[]).map((a) => [String(a.account_no), a.id]),
  );
  const unknown = [...new Set(entries.flatMap((e) => [e.debit, e.credit]).filter((no) => !accounts.has(String(no))))];
  if (unknown.length) return json({ error: `Comptes absents du plan comptable bexio : ${unknown.join(', ')}` }, 400);

  let sent = 0;
  const errors: string[] = [];
  for (const e of entries) {
    const response = await bexio('/3.0/accounting/manual_entries', {
      method: 'POST',
      body: JSON.stringify({
        type: 'manual_single_entry',
        date: e.date,
        reference_nr: e.reference,
        entries: [{
          debit_account_id: accounts.get(String(e.debit)),
          credit_account_id: accounts.get(String(e.credit)),
          amount: Math.round(Number(e.amount) * 100) / 100,
          description: e.description.slice(0, 255),
        }],
      }),
    });
    if (response.ok) sent++;
    else errors.push(`${e.reference} : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return json({ sent, failed: errors.length, errors });
});
