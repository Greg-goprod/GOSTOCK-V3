import { supabase } from './supabase';

// Notifications sur le téléphone (Web Push). La clé publique VAPID vient de .env (VITE_VAPID_PUBLIC_KEY) ;
// la clé privée reste dans les secrets de la fonction Supabase.
const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushConfigured = () => Boolean(PUBLIC_KEY);
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

const registration = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('Application non installée : ouvre la version en ligne de GO-Mat (le mode développement ne reçoit pas les notifications)');
  return reg;
};

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush() {
  if (!PUBLIC_KEY) throw new Error('Notifications non configurées (clé VAPID manquante)');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications refusées dans les réglages du téléphone');
  const reg = await registration();
  const subscription = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    device: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' });
  if (error) throw error;
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}

export async function testPush() {
  const reg = await registration();
  await reg.showNotification('GO-Mat', { body: 'Les avis arriveront ainsi sur ce téléphone.', icon: '/icon-192.png' });
}
