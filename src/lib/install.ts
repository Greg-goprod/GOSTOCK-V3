import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// Chrome / Edge / Android : l'invite d'installation est proposée par le navigateur, on la garde
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    listeners.forEach(l => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach(l => l());
  });
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

// canInstall : bouton d'installation possible ; iosHint : sur iPhone, l'ajout se fait par « Partager »
export function useInstallPrompt() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick(t => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    canInstall: !!deferred && !isStandalone(),
    iosHint: isIos() && !isStandalone(),
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      listeners.forEach(l => l());
    },
  };
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Service worker non enregistré :', error));
  });
}
