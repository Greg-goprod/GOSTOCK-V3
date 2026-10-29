// Envoi des alertes GO-Mat par e-mail, via le relais SMTP de Mannyx (Fly.io)
//
// Appelée toutes les 5 minutes par pg_cron (corps vide) : génère les échéances véhicules,
// réserve les alertes en attente, envoie un e-mail par destinataire, note le résultat.
// Corps { "test": "adresse@exemple.ch" } : e-mail de test vers un destinataire enregistré.
//
// Secrets : SMTP_RELAY_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
// SMTP_FROM_EMAIL ; facultatifs : SMTP_RELAY_URL, SMTP_FROM_NAME, APP_URL.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const RELAY_URL = Deno.env.get('SMTP_RELAY_URL') ?? 'https://go-prod-smtp-relay.fly.dev';
const RELAY_KEY = Deno.env.get('SMTP_RELAY_API_KEY');
const SMTP = {
  host: Deno.env.get('SMTP_HOST'),
  port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
  username: Deno.env.get('SMTP_USERNAME'),
  password: Deno.env.get('SMTP_PASSWORD'),
};
const FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL');
const FROM_NAME = Deno.env.get('SMTP_FROM_NAME') ?? 'GO-Mat';
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KIND_LABEL: Record<string, { label: string; path: string; action: string }> = {
  low_stock: { label: 'Stock bas', path: '/commande', action: 'Voir la feuille de commande' },
  request_to_approve: { label: 'Demande à valider', path: '/demandes', action: 'Ouvrir les demandes' },
  vehicle_deadline: { label: 'Échéance véhicule', path: '/vehicules', action: 'Voir la flotte' },
  maintenance_due: { label: 'Entretien', path: '/entretien', action: "Voir l'entretien" },
  tool_damaged: { label: 'Outil abîmé', path: '/entretien', action: "Voir l'entretien" },
  incident: { label: 'Perte / casse', path: '/incidents', action: 'Voir les incidents' },
  inventory_gap: { label: 'Inventaire', path: '/inventaire', action: "Voir l'inventaire" },
  return_escalation: { label: 'Retard', path: '/checkouts', action: 'Voir les sorties' },
  monthly_report: { label: 'Rapport mensuel', path: '/pilotage', action: 'Ouvrir le pilotage' },
  request_ready: { label: 'Votre demande', path: '/demandes', action: 'Voir mes demandes' },
  request_approved: { label: 'Votre demande', path: '/demandes', action: 'Voir mes demandes' },
  request_rejected: { label: 'Votre demande', path: '/demandes', action: 'Voir mes demandes' },
  return_reminder: { label: 'Retour de matériel', path: '/demandes', action: 'Voir mon matériel' },
  return_overdue: { label: 'Retour de matériel', path: '/demandes', action: 'Voir mon matériel' },
};

interface PendingEmail {
  id: string;
  kind: string;
  title: string;
  message: string;
  created_at: string;
  depot_name: string | null;
  recipients: string[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const missingConfig = () =>
  [
    ['SMTP_RELAY_API_KEY', RELAY_KEY],
    ['SMTP_HOST', SMTP.host],
    ['SMTP_USERNAME', SMTP.username],
    ['SMTP_PASSWORD', SMTP.password],
    ['SMTP_FROM_EMAIL', FROM_EMAIL],
  ].filter(([, value]) => !value).map(([name]) => name);

function renderEmail(n: Pick<PendingEmail, 'kind' | 'title' | 'message' | 'created_at' | 'depot_name'>) {
  const meta = KIND_LABEL[n.kind] ?? { label: 'Alerte', path: '/notifications', action: 'Ouvrir GO-Mat' };
  const when = new Date(n.created_at).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' });
  const link = APP_URL
    ? `<p style="margin:24px 0 0"><a href="${APP_URL}${meta.path}" style="background:#6d3ee0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block">${meta.action}</a></p>`
    : '';
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f7fa;font-family:Arial,Helvetica,sans-serif;color:#101018">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0e0ea">
      <tr><td style="background:#1a1a24;padding:16px 24px;color:#fff;font-weight:700;font-size:18px">GO-Mat <span style="color:#a78bfa;font-weight:400;font-size:13px">· ${escapeHtml(meta.label)}</span></td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 12px;font-size:18px">${escapeHtml(n.title)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.5">${escapeHtml(n.message)}</p>
        <p style="margin:16px 0 0;font-size:13px;color:#55556b">${escapeHtml(when)}${n.depot_name ? ` · ${escapeHtml(n.depot_name)}` : ''}</p>
        ${link}
      </td></tr>
    </table>
    <p style="font-size:12px;color:#6b6b82;margin:12px 0 0">Message automatique de GO-Mat · gestion du matériel.</p>
  </td></tr></table></body></html>`;
  const text = `${n.title}\n\n${n.message}\n\n${when}${n.depot_name ? ` · ${n.depot_name}` : ''}${APP_URL ? `\n\n${APP_URL}${meta.path}` : ''}`;
  return { subject: `[GO-Mat] ${n.title}`, html, text };
}

async function sendMail(to: string, mail: { subject: string; html: string; text: string }) {
  const response = await fetch(`${RELAY_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': RELAY_KEY! },
    body: JSON.stringify({
      smtp: SMTP,
      email: { from: FROM_EMAIL, fromName: FROM_NAME, to, ...mail },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error ? `${data.error}${data.details ? ` (${[].concat(data.details).join(', ')})` : ''}` : `Relais SMTP : HTTP ${response.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const missing = missingConfig();
  if (missing.length) return json({ error: `Envoi d'e-mails non configuré : secrets manquants (${missing.join(', ')})` }, 500);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => ({}));

  // E-mail de test : uniquement vers une adresse déjà enregistrée comme destinataire
  if (typeof body?.test === 'string') {
    const address = body.test.trim().toLowerCase();
    const { data: recipient } = await supabase
      .from('notification_recipients')
      .select('email')
      .ilike('email', address)
      .maybeSingle();
    if (!recipient) return json({ error: "Cette adresse n'est pas dans la liste des destinataires" }, 400);
    try {
      await sendMail(recipient.email, renderEmail({
        kind: 'test',
        title: 'E-mail de test',
        message: 'Les alertes GO-Mat arriveront à cette adresse.',
        created_at: new Date().toISOString(),
        depot_name: null,
      }));
      return json({ sent: 1 });
    } catch (error) {
      return json({ error: (error as Error).message }, 502);
    }
  }

  // Les échéances et relances sont créées ici aussi, même si personne n'ouvre l'application
  await Promise.all([
    supabase.rpc('check_vehicle_deadlines'),
    supabase.rpc('check_maintenance_due'),
    supabase.rpc('check_due_reminders'),
    supabase.rpc('check_monthly_report'),
  ]);

  const { data: pending, error } = await supabase.rpc('claim_notification_emails', { p_limit: 50 });
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let failed = 0;
  for (const n of (pending ?? []) as PendingEmail[]) {
    const mail = renderEmail(n);
    const errors: string[] = [];
    let delivered = 0;
    for (const to of n.recipients) {
      try {
        await sendMail(to, mail);
        delivered++;
        sent++;
      } catch (e) {
        failed++;
        errors.push(`${to} : ${(e as Error).message}`);
      }
    }
    // Sans destinataire, l'alerte est considérée comme traitée (elle reste visible dans l'app)
    // Si au moins un destinataire l'a reçue, pas de nouvel essai (il la recevrait en double)
    const failure = errors.length ? errors.join(' ; ').slice(0, 1000) : null;
    const marked = await supabase.rpc('mark_notification_email', { p_id: n.id, p_error: failure, p_done: errors.length === 0 || delivered > 0 });
    // Base sans la version à trois paramètres (correction du backlog non appliquée) : ancienne signature
    if (marked.error?.code === 'PGRST202') {
      await supabase.rpc('mark_notification_email', { p_id: n.id, p_error: delivered > 0 ? null : failure });
    }
  }

  return json({ notifications: pending?.length ?? 0, sent, failed });
});
