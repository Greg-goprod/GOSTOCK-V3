import { useEffect, useState } from 'react';

const storageKey = (key: string) => `gomat.pilote.section.${key}`;
const readOpen = (key: string): boolean => { try { return localStorage.getItem(storageKey(key)) !== '0'; } catch { return true; } };
const writeOpen = (key: string, open: boolean) => { try { localStorage.setItem(storageKey(key), open ? '1' : '0'); } catch { /* navigation privée : le choix n'est simplement pas retenu */ } };

// Ouvert / replié d'une section de fiche (Documents, Discussion…). Le choix est retenu par personne dans ce navigateur, une fois pour toute
// la section (pas fiche par fiche). `forceOpen` (arrivée par un avis de message) l'ouvre sans changer le choix retenu.
export function useSectionOpen(key: string, forceOpen = false) {
  const [stored, setStored] = useState(() => readOpen(key));
  const [forced, setForced] = useState(forceOpen);
  useEffect(() => { if (forceOpen) setForced(true); }, [forceOpen]);
  const open = stored || forced;
  const toggle = () => {
    const next = !open;
    setStored(next);
    setForced(false);
    writeOpen(key, next);
  };
  return { open, toggle };
}
