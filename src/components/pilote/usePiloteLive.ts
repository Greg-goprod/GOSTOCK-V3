import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { createLiveController, LIVE_TABLES } from '../../lib/liveReload';

let counter = 0;

// Recharge un écran PILOTE quand les données changent chez quelqu'un d'autre (Supabase Realtime, soumis aux mêmes règles d'accès que la lecture).
// `paused` : une fiche ou un formulaire est ouvert, on attend sa fermeture. Sans la publication « supabase_realtime » (migration 73 pas appliquée),
// aucun événement n'arrive et l'écran garde son comportement habituel (rechargement à la main ou après ses propres modifications).
export function usePiloteLive(reload: () => void | Promise<void>, paused = false): void {
  const latest = useRef(reload);
  latest.current = reload;
  const controller = useMemo(() => createLiveController(() => { void latest.current(); }), []);
  useEffect(() => { controller.setPaused(paused); }, [paused, controller]);
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`pilote-live-${++counter}`);
      for (const table of LIVE_TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => controller.notify());
      channel.subscribe();
    } catch { channel = null; }
    return () => {
      controller.dispose();
      if (channel) { try { void supabase.removeChannel(channel); } catch { /* rien à faire */ } }
    };
  }, [controller]);
}
