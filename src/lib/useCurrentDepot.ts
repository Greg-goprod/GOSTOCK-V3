import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

// Dépôt courant, choisi dans la barre du haut (équivalent du sélecteur d'événement de Mannyx).
// '' = tous les dépôts. Mémorisé sur l'appareil ; toutes les pages ouvertes suivent le changement.
const KEY = 'gomat-depot';
const EVENT = 'gomat:depot';

const read = () => {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
};

export function useCurrentDepot() {
  const { depots } = useApp();
  const { profile } = useAuth();
  const [depotId, setState] = useState(read);

  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setDepotId = useCallback((id: string) => {
    try { localStorage.setItem(KEY, id); } catch { /* stockage indisponible */ }
    setState(id);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  // Dépôts accessibles (une personne limitée à certains dépôts ne voit que les siens)
  const myDepots = profile?.depot_ids?.length ? depots.filter(d => profile.depot_ids.includes(d.id)) : depots;
  const valid = depotId && myDepots.some(d => d.id === depotId) ? depotId : '';
  return { depotId: valid, setDepotId, myDepots };
}
