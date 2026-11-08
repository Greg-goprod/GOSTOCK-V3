import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { LIVE_TABLES, startLive, type LiveHandle } from '../../lib/liveReload';

let counter = 0;

// Abonnement Realtime aux tables PILOTE : chaque événement appelle `notify`. Retourne la fonction qui retire l'abonnement.
function subscribeToTables(notify: () => void): () => void {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  try {
    channel = supabase.channel(`pilote-live-${++counter}`);
    for (const table of LIVE_TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => notify());
    channel.subscribe();
  } catch { channel = null; }
  return () => { if (channel) { try { void supabase.removeChannel(channel); } catch { /* rien à faire */ } } };
}

// Recharge un écran PILOTE quand les données changent chez quelqu'un d'autre (Supabase Realtime, soumis aux mêmes règles d'accès que la lecture).
// `paused` : une fiche ou un formulaire est ouvert, on attend sa fermeture. Sans la publication « supabase_realtime » (migration 73 pas appliquée),
// aucun événement n'arrive et l'écran garde son comportement habituel (rechargement à la main ou après ses propres modifications).
export function usePiloteLive(reload: () => void | Promise<void>, paused = false): void {
  const latest = useRef(reload);
  latest.current = reload;
  const pausedNow = useRef(paused);
  pausedNow.current = paused;
  const handle = useRef<LiveHandle | null>(null);
  useEffect(() => { handle.current?.setPaused(paused); }, [paused]);
  // Le suivi (contrôleur + abonnement) naît et meurt avec l'effet : le remontage de React en développement en recrée un neuf
  useEffect(() => {
    const live = startLive(() => { void latest.current(); }, subscribeToTables, pausedNow.current);
    handle.current = live;
    return () => { live.stop(); handle.current = null; };
  }, []);
}
