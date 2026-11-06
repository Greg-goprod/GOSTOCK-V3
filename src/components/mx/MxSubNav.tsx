import type { CSSProperties, ReactNode } from 'react';

import { MxNavItem, type MxNavItemData, type MxNavLinkProps } from './MxNavItem';
import { GROUP_LABEL_STYLE } from './internal/mxGroupLabel';

/**
 * MxSubNav — navigation de SECOND niveau, en flux (jamais `position:fixed`,
 * a la difference de MxSidebar qui est la barre PRINCIPALE). LOT
 * NAV-SECONDAIRE, B1 (2026-09-30).
 *
 * AUCUN PRECEDENT CATALOGUE (LOT NAV-SECONDAIRE, Phase A, recherche exhaustive
 * de « sidebar »/« sub-nav »/« nav-group »/« nav-title » dans reference/Mannyx
 * Components V2.html — zero occurrence) : cette primitive reprend deux
 * precedents DEJA EN PRODUCTION plutot que d'inventer un dessin —
 *   - la FAMILLE D'ITEM de MxSidebar (meme MxNavItem, meme geometrie, meme
 *     filet droit, meme rythme d'espacement `--mx-space-8`) ;
 *   - le TITRE DE GROUPE de MxMenu (`GROUP_LABEL_STYLE`, extrait dans
 *     `internal/mxGroupLabel.ts` par ce lot pour etre partage sans dupliquer
 *     une valeur).
 *
 * COMPOSE MxNavItem, JAMAIS `collapsed` : contrairement a MxSidebar, cette
 * navigation secondaire n'a pas de mode replie — SettingsSidebar (l'unique
 * appelant a ce jour) n'en a jamais eu non plus.
 *
 * LARGEUR — `--mx-subnav-w` (182px * --mx-scale, tokens-mx.css), CORRIGE C1
 * (2026-09-30, Greg) : EXACTEMENT 13rem, la largeur REELLEMENT rendue par la
 * sidebar legacy (SettingsSidebar.tsx, branche ancienne, `w-52` Tailwind =
 * 13rem), le `rem` de ce projet valant 14px (src/index.css), PAS les 16px
 * que suppose la documentation Tailwind pour `w-52` — meme raisonnement que
 * `--mx-topbar-h`, voir son commentaire dans tokens-mx.css : l'egalite tient
 * par CALCUL (13rem suit --mx-scale via `html { font-size }`), pas par une
 * valeur mesuree une fois puis figee. (La version B1 de ce token posait
 * 208px, la valeur NOMINALE de 13rem a l'hypothese Tailwind de 16px, pas la
 * largeur reellement rendue ici — corrige par Greg.)
 *
 * HAUTEUR HERITEE (aucune valeur posee ici) : `<nav>` est un enfant flex
 * ordinaire, dimensionne par le CONTENEUR de l'appelant (les 12 sites
 * d'appel de SettingsSidebar posent tous une hauteur explicite sur leur
 * conteneur — `calc(100vh - 4rem - 110px)` ou equivalent). Defilement
 * VERTICAL PROPRE : `overflow-y:auto`, jamais `overflow:hidden` ni de
 * defilement horizontal.
 *
 * FILET DROIT FIXE (`--mx-border-w-thin`, PAS mis a l'echelle) : meme
 * convention que tous les filets 1px du tronc (MxMenu, MxDrawer, MxSidebar)
 * — `--mx-scale` s'applique a tout SAUF les traits.
 *
 * GROUPES — `role="group"` + `aria-label` PAR GROUPE (un seul wrapper autour
 * de TOUS les items d'un meme groupe contigu, pas un wrapper par item — meme
 * structure que `MxMenu`, groupes de `role="menuitemradio"`). Le titre visible
 * (`GROUP_LABEL_STYLE`) n'apparait qu'UNE FOIS par groupe, au-dessus de ses
 * items — `clusterByGroup` ci-dessous fait cette agregation a partir du
 * tableau PLAT `items` (meme forme que `SidebarTab[]` cote appelant, aucune
 * restructuration en arbre cote SettingsSidebar).
 *
 * ITEM SANS GROUPE PARMI DES ITEMS GROUPES — CAS SIGNALE, TRAITE AINSI : un
 * item dont `group` est absent forme son propre cluster D'UN SEUL ITEM, rendu
 * SANS wrapper `role="group"` ni titre (aucun libelle disponible pour
 * `aria-label` — poser un `role="group"` sans `aria-label` degraderait
 * l'accessibilite plutot que de la preserver). Il reste a SA PLACE dans
 * l'ordre du tableau, entre les groupes voisins, exactement comme le
 * separateur de la sidebar legacy ne s'affiche que si `tab.group` est
 * truthy.
 *
 * `renderLink` : MEME CONTRAT que `MxNavItem` (l'appelant enveloppe son
 * propre element cliquable, `linkProps` etale dessus) — MxSubNav ne fait que
 * le transmettre tel quel a chaque `MxNavItem`, sans intermediaire.
 *
 * `aria-label` du `<nav>` : FOURNI PAR L'APPELANT (`navLabel`), jamais
 * calcule ici — SettingsSidebar sert des contextes tres varies (Parametres,
 * workflow Production, Ground, Hospitality...), aucun libelle unique ne
 * conviendrait a tous sans etre lui-meme une prop.
 */

export interface MxSubNavProps {
  items: MxNavItemData[];
  renderLink: (item: MxNavItemData, linkProps: MxNavLinkProps) => ReactNode;
  /** `aria-label` du `<nav>` — fourni par l'appelant, voir le commentaire de tete de fichier. */
  navLabel: string;
  className?: string;
  style?: CSSProperties;
}

interface Cluster {
  /** Cle React du cluster — id du premier item qu'il contient. */
  key: string;
  /** Absent : cluster d'UN SEUL item sans groupe, voir le commentaire de tete de fichier. */
  group?: string;
  items: MxNavItemData[];
}

/**
 * Regroupe un tableau PLAT en clusters CONTIGUS de meme `group`. Un item sans
 * `group`, ou dont le `group` differe du precedent, ouvre un NOUVEAU cluster
 * — deux groupes de meme nom mais NON contigus (separes par un item d'un
 * autre groupe) resteraient donc deux clusters distincts, chacun avec son
 * propre titre : meme comportement que la sidebar legacy (`lastGroup`), qui
 * ne fusionne que des occurrences ADJACENTES.
 */
function clusterByGroup(items: MxNavItemData[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const item of items) {
    const last = clusters[clusters.length - 1];
    if (item.group && last?.group === item.group) {
      last.items.push(item);
    } else {
      clusters.push({ key: item.id, group: item.group, items: [item] });
    }
  }
  return clusters;
}

export function MxSubNav({ items, renderLink, navLabel, className, style }: MxSubNavProps) {
  const clusters = clusterByGroup(items);

  return (
    <nav
      aria-label={navLabel}
      className={className}
      style={{
        width: 'var(--mx-subnav-w)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'calc(2px * var(--mx-scale, 1))', // meme rythme que MxSidebar.
        overflowY: 'auto',
        borderRight: 'var(--mx-border-w-thin) solid var(--mx-border)',
        padding: 'var(--mx-space-8)',
        ...style,
      }}
    >
      {clusters.map((cluster) =>
        cluster.group ? (
          <div key={cluster.key} role="group" aria-label={cluster.group}>
            <div style={GROUP_LABEL_STYLE}>{cluster.group}</div>
            {cluster.items.map((item) => (
              <MxNavItem key={item.id} item={item} renderLink={renderLink} />
            ))}
          </div>
        ) : (
          // Item(s) sans groupe : aucun wrapper, aucun titre — voir le
          // commentaire de tete de fichier.
          cluster.items.map((item) => (
            <MxNavItem key={item.id} item={item} renderLink={renderLink} />
          ))
        ),
      )}
    </nav>
  );
}

export default MxSubNav;
