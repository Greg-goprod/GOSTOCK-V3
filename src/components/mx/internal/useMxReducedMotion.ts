import { useEffect, useState } from 'react';

/**
 * useMxReducedMotion — interne au tronc, HORS BARREL (voir index.ts).
 *
 * Lit la preference systeme `prefers-reduced-motion: reduce` et se tient a
 * jour si l'utilisateur la change en cours de session (bascule OS sans
 * recharger la page).
 *
 * PROTEGE SI `window.matchMedia` EST ABSENT (jsdom en test, environnement
 * degrade) : renvoie `false` sans lever d'exception, aussi bien a la valeur
 * initiale qu'a l'effet.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function readPreference(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

export function useMxReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export default useMxReducedMotion;
