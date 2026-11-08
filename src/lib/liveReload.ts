// Temps réel de PILOTE (sans affichage) : quand quelqu'un d'autre modifie un projet, une tâche, une équipe ou une discussion, l'écran se recharge.
// Ce contrôleur regroupe les rafales d'événements en UN rechargement (délai après le dernier événement) et se met en pause pendant qu'une fiche ou un
// formulaire est ouvert (on ne remplace pas ce que la personne est en train de saisir) : un seul rechargement de rattrapage à la fermeture.
export interface LiveController {
  notify(): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}
export interface Timers { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void }
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: h => clearTimeout(h as ReturnType<typeof setTimeout>) };

export function createLiveController(reload: () => void, delay = 400, timers: Timers = realTimers): LiveController {
  let handle: unknown = null;
  let paused = false;
  let pending = false;
  let disposed = false;
  const schedule = () => {
    if (handle !== null) timers.clear(handle);
    handle = timers.set(() => { handle = null; pending = false; if (!disposed) reload(); }, delay);
  };
  return {
    notify() {
      if (disposed) return;
      if (paused) { pending = true; return; }
      schedule();
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) { if (handle !== null) { timers.clear(handle); handle = null; pending = true; } return; }
      if (pending && !disposed) schedule();
    },
    dispose() {
      disposed = true;
      if (handle !== null) { timers.clear(handle); handle = null; }
    },
  };
}

export interface LiveHandle { setPaused(paused: boolean): void; stop(): void }

// Démarre le suivi d'un écran : un contrôleur NEUF à chaque démarrage. React, en développement, monte puis démonte puis remonte chaque effet : un contrôleur déjà arrêté
// (dispose) ne se réveille pas, il ne doit donc jamais être réutilisé par le remontage (sinon plus aucun rechargement n'a lieu après ce cycle).
export function startLive(reload: () => void, subscribe: (notify: () => void) => () => void, paused = false, delay = 400, timers: Timers = realTimers): LiveHandle {
  const controller = createLiveController(reload, delay, timers);
  controller.setPaused(paused);
  const unsubscribe = subscribe(() => controller.notify());
  return { setPaused: p => controller.setPaused(p), stop() { controller.dispose(); unsubscribe(); } };
}

// Tables PILOTE dont les changements rechargent les écrans (les mêmes que celles ajoutées à la publication par la migration 73)
export const LIVE_TABLES = ['cp_projects', 'cp_items', 'cp_item_members', 'cp_project_members', 'cp_comments', 'cp_item_resources'] as const;
