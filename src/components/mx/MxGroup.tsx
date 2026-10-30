import type { CSSProperties, ReactNode } from 'react';

import { MX_TEXT, mxToneDot, type MxTone } from './tokens';
import { MxBadge } from './MxBadge';

interface MxGroupProps {
  /** Intitulé de l'étape -- texte PRINCIPAL (`--mx-text`), jamais le gris
   * secondaire/tertiaire utilisé par `MxSectionLabel`/`segmentedLabel`. */
  title: ReactNode;
  /** Nombre d'éléments de l'étape. Absent : pas de badge. */
  count?: number;
  /**
   * Ton de l'étape -- LA MÊME couleur que le liseré des cartes qu'elle
   * contient (voir `MX_TONE_LINE`/`mxToneDot`, source commune). Absent (ex.
   * groupement « Par jour », qui n'a pas de notion d'étape) : pas de
   * pastille ; le badge de compte, s'il est fourni, retombe sur `neutral`.
   */
  tone?: MxTone;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxGroup — LOT VUES-CARTES-LISTE, C2.2 (Greg, 2026-10-17). RÉGRESSION
 * constatée en recette sur données réelles : les intitulés d'ÉTAPE
 * (« Offres à établir », « Prêtes à envoyer », « Expirées » côté Offres ;
 * « Des agences · À recevoir » côté Contrats) étaient à peine visibles --
 * rendus via `MxSectionLabel`/`MX_TEXT.segmentedLabel`, un gris tertiaire
 * (`--mx-text3`) à 11-12px, SOUS la taille du corps de texte
 * (`--mx-fs-body`, 13.5px) -- alors qu'ils portent la compréhension du
 * parcours (« où en est cette offre/ce contrat ? »).
 *
 * Hiérarchie à deux niveaux (niveau 1, la SECTION -- « À traiter par
 * vous », « En attente de l'agent »... -- INCHANGÉE, voir le `GroupHeader`
 * propre à chaque page, non touché par ce lot) :
 *   - niveau 2, l'ÉTAPE : ce composant. Un bloc LÉGER (fond à peine
 *     différencié -- `--mx-surface2`, la même nuance déjà utilisée par les
 *     en-têtes de groupe repliables -- et bord fin `--mx-border`) qui
 *     enveloppe la grille/le tableau de l'étape, sans l'alourdir : pas de
 *     fond saturé, pas d'ombre, un rayon de coin discret
 *     (`--mx-radius-8`, déjà le rayon des en-têtes repliables du module).
 *     En tête : le titre en `MX_TEXT.blockTitle` (16px/700, le palier
 *     ACTIF de l'échelle juste au-dessus du corps de texte -- aucun palier
 *     intermédiaire n'existe entre les deux, voir tokens-mx.css), couleur
 *     `--mx-text` (texte principal, PAS `--mx-text3`) ; CASSE PHRASE
 *     (pas de majuscules/tracking) -- seule différence volontaire avec le
 *     titre de SECTION (niveau 1), qui lui reste en majuscules : à taille
 *     égale, l'absence de capitales suffit à lire "un cran en dessous"
 *     sans dupliquer un token de taille qui n'existe pas dans l'échelle.
 *     Une pastille de ton (`mxToneDot`, optionnelle) précède le titre et
 *     reprend la MÊME couleur que le liseré des cartes de l'étape ; un
 *     badge de compte (optionnel) le suit.
 *
 * CORRECTIF C3.3 (Greg, 2026-10-17), RÉGRESSION -- « Expirées 4 » sans
 * pastille visible : `MX_TONE_FILL.neutral.bg` vaut `--mx-surface2`
 * (« pas d'aplat sature », tokens-mx.css) -- EXACTEMENT le fond du bloc
 * `MxGroup` lui-même. Un badge de compte `neutral` (étape « fermée », ex.
 * Expirées/Clôturées) devient donc un fond sur fond IDENTIQUE : le nombre
 * reste lisible (texte `--mx-text2`) mais la forme de pastille disparaît.
 * Fixe par un bord fin (`--mx-border-w-thin solid --mx-border`) sur le
 * badge de compte, pour TOUS les tons -- pas une exception pour `neutral`
 * seul : « même pastille pour toutes les étapes » (consigne de Greg), un
 * contour discret qui ne gêne pas les tons satures (fond deja visible) et
 * qui rend le ton neutre tout aussi delimite que les autres.
 *
 * Un seul composant, consommé par Offres (« Qui doit agir » -- 4
 * sous-sections à établir/brouillons/prêtes/expirées -- et « Par jour »,
 * où chaque jour n'a pas de ton d'étape, `tone` omis) et par Contrats (les
 * 6 étapes de `STEP_ORDER`), en cartes ET en liste -- le gap ENTRE
 * instances de `MxGroup` reste porté par le conteneur parent de chaque
 * page (déjà `var(--mx-space-24)` sur les 3 vues avant ce lot, inchangé
 * ici : ce lot ne touche que l'intérieur de chaque étape, pas l'espacement
 * qui les sépare).
 *
 * CORRECTIF LOT OFFRES-VUES, V1 (Greg, 2026-10-18) -- REGRESSION « les
 * cartes se noient dans le bloc » en DARK : ce bloc et `MxEntityCard`
 * partageaient le MEME token (`--mx-surface2`), fond de bloc et fond de
 * carte strictement identiques (mesure : rgb(27,30,39) des deux cotes,
 * contraste 1.00:1). Fond remplace par `--mx-group-bg` (tokens-mx.css, voir
 * son commentaire complet pour le detail de la mesure et le rejet d'une
 * piste "transparence" qui s'est averee inefficace) : un token DERIVE, dark
 * uniquement (assombri vers #000, meme formule que --mx-accent-deep),
 * retombant sur --mx-surface2 nu en light -- AUCUN changement en clair.
 * `--mx-tone-fill-neutral` (badge de compte neutre, ex. "Expirées 4", cf.
 * CORRECTIF C3.3 plus haut) reste sur `--mx-surface2`, INCHANGE : lui aussi
 * se distingue desormais du fond du bloc (qui n'est plus --mx-surface2 en
 * dark), le filet de bordure du badge (deja pose par C3.3) suffit a le
 * distinguer de la carte le cas echeant.
 */
export function MxGroup({ title, count, tone, children, className, style }: MxGroupProps) {
  return (
    <section
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--mx-space-12)',
        background: 'var(--mx-group-bg)',
        border: 'var(--mx-border-w) solid var(--mx-border)',
        borderRadius: 'var(--mx-radius-8)',
        padding: 'var(--mx-space-12)',
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-8)', minWidth: 0 }}>
        {tone ? <span aria-hidden="true" style={mxToneDot(tone)} /> : null}
        <span style={{ ...MX_TEXT.blockTitle, color: 'var(--mx-text)', minWidth: 0 }}>{title}</span>
        {count != null ? (
          <MxBadge
            tone={tone ?? 'neutral'}
            style={{ border: 'var(--mx-border-w-thin) solid var(--mx-border)' }}
          >
            {count}
          </MxBadge>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default MxGroup;
