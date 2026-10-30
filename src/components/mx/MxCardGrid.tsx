import { cloneElement, useEffect, type Key, type ReactElement } from 'react';

import { useContainerWidth } from './internal/useContainerWidth';
import { columnsForWidth } from './internal/mxGridBreakpoints';

/**
 * MxCardGrid -- LOT CONTRATS-GRILLE ET ANNULATION, G1 (Greg, 2026-10-09),
 * correctif de recette (Greg, 2026-10-10). Grille de cartes COMMUNE du
 * tronc -- DOCTRINE : « Toute page en cartes utilise MxCardGrid »
 * (`DOCTRINE-BARRE-OUTILS.md`, §5bis).
 *
 * COLONNES -- PALIERS FIXES DE LARGEUR DE CONTENEUR, pas une largeur de
 * carte choisie par la page. Premiere version (G1) laissait chaque page
 * passer un `minCardWidth` et rendait `repeat(auto-fill, minmax(minCardWidth,
 * 1fr))` -- a la recette, cela donnait 7 colonnes sur Artistes (220px) et 9
 * sur Contrats (160px) SUR LE MEME ECRAN : deux largeurs de carte
 * differentes produisent forcement des comptes de colonnes differents a
 * largeur de conteneur egale, et l'arithmetique de `auto-fill` est en plus
 * sensible au pixel pres. Deuxieme version (ce correctif) : plus de
 * `minCardWidth` du tout -- le nombre de colonnes vient de
 * `columnsForWidth` (`internal/mxGridBreakpoints.ts`, SEULE source de
 * verite, calibrage et formule documentes la-bas), applique IDENTIQUEMENT
 * a toute grille du tronc. `gridTemplateColumns: repeat(N, 1fr)` : la
 * largeur de conteneur mesuree (`useContainerWidth`, meme famille que
 * `useMxGridColumns` qu'elle remplace ici -- mesure directe
 * `getBoundingClientRect`, pas une resolution `auto-fill` a relire apres
 * coup) determine N, PUIS `1fr` fait grandir/retrecir la largeur des
 * cartes pour remplir exactement ce nombre de colonnes -- « la largeur des
 * cartes s'adapte, et non plus le nombre de colonnes » (consigne de Greg).
 *
 * PAS DE `<div>` INTERMEDIAIRE PAR CARTE : `renderItem(item)` doit renvoyer
 * l'element RACINE de la carte (ex. `<ArtistCard />`) -- `MxCardGrid` lui
 * injecte sa `key` par `cloneElement` plutot que d'envelopper dans un
 * conteneur supplementaire, pour que cet element devienne un ENFANT DIRECT
 * de la grille CSS (`display:'grid'`).
 */
export interface MxCardGridProps<T> {
  items: T[];
  getItemKey: (item: T) => Key;
  renderItem: (item: T) => ReactElement;
  /** Nombre de colonnes effectivement affichees (voir columnsForWidth) -- a reporter au parent pour sa pagination (mxGridPagination.ts). */
  onColumnsChange?: (columns: number) => void;
}

export function MxCardGrid<T>({ items, getItemKey, renderItem, onColumnsChange }: MxCardGridProps<T>) {
  const [width, widthRef] = useContainerWidth();
  const columns = columnsForWidth(width);

  useEffect(() => {
    onColumnsChange?.(columns);
  }, [columns, onColumnsChange]);

  return (
    <div
      ref={widthRef}
      style={{
        display: 'grid',
        // LOT VUES-CARTES-LISTE, C1.1 (Greg, 2026-10-16) — RÉGRESSION :
        // `1fr` seul n'empêche PAS une piste de grille de s'élargir si le
        // contenu d'une carte a une largeur intrinsèque minimale supérieure
        // (texte non coupé, ligne de boutons qui ne se compresse pas) : la
        // piste grandit, la grille déborde, et un défilement horizontal
        // apparaît sur toute la page (INTERDIT, consigne de Greg). Le défaut
        // `min-width` d'un enfant de grille/flex est `auto` (la largeur de
        // son contenu), pas `0` — `minmax(0, 1fr)` impose explicitement
        // `min-width: 0` à la piste, qui redevient alors strictement bornée
        // par `1fr` ; toute carte trop large pour sa piste voit son CONTENU
        // coupé (ellipse, voir MxEntityCard) plutôt que la piste s'étendre.
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 'var(--mx-space-12)',
      }}
    >
      {items.map((item) => cloneElement(renderItem(item), { key: getItemKey(item) }))}
    </div>
  );
}

export default MxCardGrid;
