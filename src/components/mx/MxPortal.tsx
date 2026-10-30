import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useScopePortalTarget } from '../../lib/scopePortal';

/**
 * MxPortal — sortie de flux pour les couches flottantes du tronc.
 *
 * POURQUOI un portail. Une couche en `position: fixed` n'est PAS toujours
 * positionnee par rapport a la fenetre : un ancetre portant `transform`,
 * `filter`, `perspective`, `contain` ou `backdrop-filter` cree un bloc
 * conteneur, et la couche s'y retrouve enfermee — decalee, rognee par
 * `overflow`, et incapable de depasser le z-index de cet ancetre quelle que
 * soit sa propre valeur. L'echelle --mx-z-* ne tient donc que si les couches
 * sortent du flux. C'est vrai pour le drawer comme, plus tard, pour MxModal,
 * MxPopover, MxTooltip et MxToast.
 *
 * OU l'on sort. Pas systematiquement dans `document.body` : on delegue a
 * `useScopePortalTarget()` (lib/scopePortal), deja en place pour les pickers et
 * les drawers. Par defaut il vaut `null` et l'on rend dans `document.body` ;
 * quand un `*ConsoleScope` fournit une cible, on rend DEDANS, et la couche
 * herite des tokens scopes au lieu de fuir vers le theme global. Un drawer mx
 * ouvert depuis une console Ground reste donc dans la colorimetrie de la
 * console.
 *
 * Note : lib/scopePortal vit hors de components/mx/, donc hors du champ de la
 * garde ESLint du tronc. Il n'importe aucun token et ne porte aucun style, il
 * n'y a rien a garder.
 *
 * MONTAGE DIFFERE. Le premier rendu ne portalise pas ; on rend `null`, puis
 * l'effet declenche le vrai rendu. PAS une contrainte d'hydratation : ce
 * tronc n'en a aucune (SPA `createRoot`, ni SSR ni pre-rendu, voir main.tsx).
 *
 * La vraie raison : laisser `useScopePortalTarget()` se resoudre avant le
 * premier portage reel. Un `*ConsoleScope` fournit sa cible par un noeud DOM
 * connu seulement apres l'attachement de son propre ref (meme motif que
 * `mounted` ici) ; sur le rendu initial d'un consommateur co-monte dans le
 * meme arbre, ce ref n'a pas encore attache et la cible vaut encore `null`.
 * Sans ce differe, le premier portage irait dans `document.body`, suivi d'un
 * changement de conteneur qui remonterait le contenu (perte d'etat DOM,
 * flash visuel) une fois la cible resolue.
 *
 * Cette garantie tient a l'ordonnancement de React, pas a un mecanisme
 * dedie : l'attachement du ref du scope a lieu pendant le commit, avant la
 * peinture ; l'effet ci-dessous (passif) ne se declenche qu'apres la
 * peinture, donc strictement apres que la cible du scope s'est deja
 * resolue. Le decalage d'une frame est sans effet visible : les couches du
 * tronc sont montees fermees et s'ouvrent par transition.
 */
export function MxPortal({ children }: { children: ReactNode }) {
  const scopeTarget = useScopePortalTarget();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, scopeTarget ?? document.body);
}

export default MxPortal;
