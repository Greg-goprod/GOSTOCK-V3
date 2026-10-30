import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * useContainerWidth — LOT CARTE-AUDIENCE, C1 (2026-10-06, Greg). Hook PARTAGE
 * du tronc : mesure la largeur REELLE du conteneur
 * (`getBoundingClientRect().width`), pour decider d'une mise en page (ex.
 * carte + liste cote a cote VS liste sous la carte) a partir de l'espace
 * disponible, PAS du viewport — un media query/`sm:` Tailwind se base sur la
 * fenetre, inadapte ici car le conteneur mesure (bloc "Audience par pays" du
 * tiroir fiche artiste) peut etre bien plus etroit que la fenetre (ex.
 * colonne de grille, tiroir partage avec d'autres panneaux). Reutilise par
 * `MxCardGrid` (LOT CONTRATS-GRILLE ET ANNULATION, correctif de recette,
 * 2026-10-10) pour mesurer le conteneur de la grille de cartes.
 *
 * REF EN CALLBACK, pas un `RefObject` recu en argument : fonctionne meme si
 * l'element est conditionnel ou remonte.
 *
 * `ResizeObserver` ABSENT (jsdom) : mesure initiale quand meme effectuee via
 * `getBoundingClientRect` (jsdom retourne 0 sans configuration -- les tests
 * controlent `getBoundingClientRect` directement).
 *
 * VALEUR STABLE, SANS BOUCLE DE RENDU : `setWidth` jamais appele avec une
 * valeur identique (comparaison via ref, pas de re-render).
 */
export function useContainerWidth(): [number, (node: HTMLElement | null) => void] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const lastWidth = useRef(0);

  const ref = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  useLayoutEffect(() => {
    if (!node) return;

    function measure() {
      const next = (node as HTMLElement).getBoundingClientRect().width;
      if (next !== lastWidth.current) {
        lastWidth.current = next;
        setWidth(next);
      }
    }

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  return [width, ref];
}

export default useContainerWidth;
