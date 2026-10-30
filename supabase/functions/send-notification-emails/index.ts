// Envoi des alertes GO-Mat : e-mail (relais SMTP de Mannyx, Fly.io) et notifications sur le téléphone (Web Push)
//
// Appelée toutes les 5 minutes par pg_cron (corps vide) : crée les échéances et relances,
// envoie les e-mails en attente, puis les notifications aux téléphones abonnés.
// Chaque canal ne fonctionne que si ses secrets sont saisis ; l'autre continue sans lui.
// Corps { "test": "adresse@exemple.ch" } : e-mail de test vers un destinataire enregistré.
//
// Secrets e-mail : SMTP_RELAY_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
// SMTP_FROM_EMAIL ; facultatifs : SMTP_RELAY_URL, SMTP_FROM_NAME, APP_URL.
// Secrets téléphone : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. mailto:magasin@exemple.ch).
// Secrets SMS (Twilio) : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (numéro ou nom d'expéditeur) ;
// les SMS ne partent que si le réglage « SMS » est aussi activé dans Paramètres.
// Sauvegarde automatique : chaque mois, fichier complet dans le stockage privé « backups » (12 gardés).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

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
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY'),
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY'),
  subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@go-mat.ch',
};
const TWILIO = {
  sid: Deno.env.get('TWILIO_ACCOUNT_SID'),
  token: Deno.env.get('TWILIO_AUTH_TOKEN'),
  from: Deno.env.get('TWILIO_FROM'),
};
const pushReady = Boolean(VAPID.publicKey && VAPID.privateKey);
if (pushReady) webpush.setVapidDetails(VAPID.subject, VAPID.publicKey!, VAPID.privateKey!);

// Client sans schéma typé (la base n'est pas décrite côté fonction)
// deno-lint-ignore no-explicit-any
type Client = ReturnType<typeof createClient<any>>;

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
  rental_due: { label: 'Location', path: '/locations', action: 'Voir les locations' },
  training_expiry: { label: 'Formation', path: '/formations', action: 'Voir les formations' },
  transfer: { label: 'Transfert', path: '/transferts', action: 'Voir les transferts' },
  drop_box: { label: 'Boîte de retour', path: '/comptoir', action: 'Ouvrir le comptoir' },
  tool_found: { label: 'Outil trouvé', path: '/notifications', action: 'Voir les notifications' },
  backup_due: { label: 'Sauvegarde', path: '/settings', action: 'Ouvrir les paramètres' },
  ppe_renewal: { label: 'EPI', path: '/epi', action: 'Voir les EPI' },
  mission_end: { label: 'Fin de mission', path: '/users', action: 'Voir les personnes' },
  warranty_end: { label: 'Garantie', path: '/atelier', action: "Ouvrir l'atelier" },
  repair_late: { label: 'Réparation', path: '/atelier', action: "Ouvrir l'atelier" },
  battery_end: { label: 'Batterie', path: '/atelier', action: "Ouvrir l'atelier" },
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
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => ({}));

  // E-mail de test : uniquement vers une adresse déjà enregistrée comme destinataire
  if (typeof body?.test === 'string') {
    if (missing.length) return json({ error: `Envoi d'e-mails non configuré : secrets manquants (${missing.join(', ')})` }, 500);
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
    supabase.rpc('check_training_rental_deadlines'),
    supabase.rpc('check_people_deadlines'),
    supabase.rpc('check_equipment_deadlines'),
    supabase.rpc('check_backup_reminder'),
  ]);

  const pushed = await sendPush(supabase);
  const sms = await sendSms(supabase);
  const backup = await autoBackup(supabase).catch((e) => `erreur : ${(e as Error).message}`);

  // Sans secrets SMTP, les e-mails restent en attente (visibles dans l'app) ; le reste a tourné
  if (missing.length) return json({ emails: 'non configuré', missing, push: pushed, sms, backup });

  const { data: pending, error } = await supabase.rpc('claim_notification_emails', { p_limit: 50 });
  if (error) return json({ error: error.message, push: pushed, sms, backup }, 500);

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

  return json({ notifications: pending?.length ?? 0, sent, failed, push: pushed, sms, backup });
});

interface PendingPush {
  id: string;
  kind: string;
  title: string;
  message: string;
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
}

// Notifications sur les téléphones abonnés ; un abonnement expiré (404/410) est supprimé
async function sendPush(supabase: Client) {
  if (!pushReady) return 'non configuré';
  const { data, error } = await supabase.rpc('claim_push_notifications', { p_limit: 100 });
  if (error) return `erreur : ${error.message}`;
  let delivered = 0;
  const expired: string[] = [];
  for (const n of (data ?? []) as PendingPush[]) {
    const meta = KIND_LABEL[n.kind];
    const payload = JSON.stringify({ title: n.title, body: n.message, url: meta?.path ?? '/notifications', tag: n.id });
    for (const s of n.subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600 });
        delivered++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(s.id);
      }
    }
  }
  if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired);
  return { notifications: data?.length ?? 0, delivered, expired: expired.length };
}

// Numéro suisse saisi librement (« 079 123 45 67 », « 0041… ») → format international (+41…)
const internationalPhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+41${digits.slice(1)}`;
  return `+${digits}`;
};

// Rappels personnels par SMS (retour demain, retard, demande prête), via Twilio
async function sendSms(supabase: Client) {
  if (!TWILIO.sid || !TWILIO.token || !TWILIO.from) return 'non configuré';
  const { data, error } = await supabase.rpc('claim_sms_notifications', { p_limit: 50 });
  if (error) return `erreur : ${error.message}`;
  let delivered = 0;
  const errors: string[] = [];
  for (const n of (data ?? []) as { id: string; phone: string; title: string; message: string }[]) {
    const body = new URLSearchParams({ To: internationalPhone(n.phone), From: TWILIO.from, Body: `GO-Mat · ${n.title}\n${n.message}`.slice(0, 600) });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO.sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${TWILIO.sid}:${TWILIO.token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (response.ok) delivered++;
    else errors.push(`${n.id} : HTTP ${response.status}`);
  }
  return { notifications: data?.length ?? 0, delivered, errors };
}

// Mêmes tables que la sauvegarde téléchargée (Paramètres), sans codes de badge ni abonnements
const BACKUP_TABLES = [
  'organizations', 'system_settings', 'depots', 'storage_bins', 'departments', 'role_configs', 'status_configs',
  'users', 'user_depots', 'trainings', 'user_trainings', 'ppe_types', 'ppe_issues', 'user_ppe_sizes',
  'categories', 'equipment_groups', 'equipment_subgroups', 'suppliers', 'catalog_products', 'sites', 'rentals',
  'equipment', 'equipment_instances', 'equipment_accessories', 'consumable_stock', 'stock_movements',
  'kits', 'kit_items', 'requests', 'request_items', 'request_templates', 'delivery_notes', 'checkouts', 'return_checks',
  'vehicles', 'vehicle_trips', 'fuel_entries', 'maintenance_types', 'equipment_maintenance', 'maintenance_plans', 'maintenance_plan_runs',
  'repair_orders', 'incidents', 'inventory_counts', 'inventory_count_lines', 'purchase_orders', 'purchase_order_lines',
  'transfers', 'transfer_lines', 'rental_inspections', 'notification_recipients', 'notifications', 'audit_log',
];
const KEEP_BACKUPS = 12;

// Une sauvegarde complète tous les 30 jours dans le stockage privé ; les plus anciennes sont effacées
async function autoBackup(supabase: Client) {
  const { data: settings } = await supabase.from('system_settings').select('id, value').in('id', ['auto_backup', 'last_auto_backup_at']);
  const value = (id: string) => settings?.find((s) => s.id === id)?.value ?? '';
  if (value('auto_backup') !== 'true') return 'désactivée';
  const last = value('last_auto_backup_at');
  if (last && Date.now() - new Date(last).getTime() < 30 * 24 * 3600 * 1000) return 'à jour';

  const tables: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
      if (error) {
        tables[`_erreur_${table}`] = [error.message];
        break;
      }
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    tables[table] = rows;
  }
  const stamp = new Date().toISOString();
  const name = `GO-Mat_sauvegarde_${stamp.slice(0, 10)}.json`;
  const file = new Blob([JSON.stringify({ application: 'GO-Mat', exported_at: stamp, automatic: true, tables })], { type: 'application/json' });
  const { error } = await supabase.storage.from('backups').upload(name, file, { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(error.message);
  await supabase.from('system_settings').update({ value: stamp }).eq('id', 'last_auto_backup_at');

  const { data: files } = await supabase.storage.from('backups').list('', { sortBy: { column: 'name', order: 'desc' } });
  const old = (files ?? []).filter((f) => f.name.endsWith('.json')).slice(KEEP_BACKUPS).map((f) => f.name);
  if (old.length) await supabase.storage.from('backups').remove(old);
  return { file: name, removed: old.length };
}
