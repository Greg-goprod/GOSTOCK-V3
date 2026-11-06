import type { CSSProperties, ReactNode } from 'react';

import { MX_TABULAR, MX_TEXT, MX_TONE_TEXT, type MxTone } from './tokens';
import { useMxReducedMotion } from './internal/useMxReducedMotion';

/**
 * MxBarList — LOT BOOKING-DASHBOARD, B1 (2026-10-03).
 *
 * Source qui fait foi : reference/Mannyx Components V2.html, section
 * `#s-charts` (L.822-838), sous-titre « Répartition offres » — barres de
 * PROGRESSION empilées (une `<div>` pleine largeur par ligne, largeur en %),
 * PAS un graphique Recharts. Decision issue de la Phase A de ce lot : le
 * catalogue ne maquette aucun bar chart generique pour ce besoin, seulement
 * cette forme simplifiee — c'est elle qui est portee ici, pas un wrapper
 * Recharts.
 *
 * Piste de fond en `var(--mx-border)` — EXACTEMENT le token du catalogue
 * (`background:var(--border)`, L.828), pas une invention.
 *
 * RAYON EN PILL, PAS 3px LITTERAL : le catalogue pose un `border-radius:3px`
 * litteral (moitie de la hauteur de 6px), mais `--mx-radius-pill` (999px)
 * produit un rendu IDENTIQUE sur une piste de 6px de haut avec
 * `overflow:hidden` — un rayon superieur au demi-hauteur ne change rien au
 * tracé. Reutiliser le token existant plutot qu'ajouter une valeur litterale
 * qui ferait doublon.
 *
 * TON PAR LIGNE, ACCENT PAR DEFAUT : chaque ligne peut porter son propre
 * MxTone (statut semantique) ; en son absence, la ligne tombe sur `accent` —
 * jamais une couleur grise par defaut, qui lirait comme une ligne desactivee.
 *
 * VALEUR AFFICHEE FOURNIE PAR L'APPELANT (`displayValue`), JAMAIS FORMATEE
 * ICI : la primitive ne connait ni devise ni unite (meme regle que MxKV/
 * MxList, qui ne formatent jamais un montant). `value` (numerique) ne sert
 * QU'AU CALCUL (largeur proportionnelle, libelle accessible par defaut).
 *
 * LISTE ACCESSIBLE : chaque ligne est un `role="listitem"` portant un
 * `aria-label` COMPLET ("Acceptées : 12 sur 40" par defaut, ou `ariaLabel`
 * fourni par l'appelant pour un phrase different) ; le contenu visuel
 * (libelle + valeur + piste) est marque `aria-hidden`, pour qu'un lecteur
 * d'ecran annonce UNE SEULE fois la ligne, jamais le texte visuel ET le
 * libelle accessible a la suite.
 *
 * ETAT VIDE : `empty` est un ReactNode fourni par l'appelant (typiquement un
 * <MxEmpty>), jamais rendu par la primitive elle-meme — meme convention que
 * MxList.
 */
export interface MxBarListItem {
  /** Cle React. Fournie par l'appelant (identifiant metier). */
  id: string;
  label: ReactNode;
  /** Valeur numerique brute : largeur proportionnelle + libelle accessible par defaut. */
  value: number;
  /** Valeur AFFICHEE a droite de la ligne (formatee par l'appelant : devise, %, unite...). */
  displayValue: ReactNode;
  /** Ton de la barre. Defaut : accent. */
  tone?: MxTone;
  /**
   * Nom accessible complet de la ligne. Par defaut, calcule depuis `label`
   * (si chaine) / `value` / le total effectif : "<label> : <value> sur
   * <total>". A fournir explicitement si `label` n'est pas une chaine, ou si
   * la phrase par defaut ne convient pas (ex. une valeur en devise).
   */
  ariaLabel?: string;
}

export interface MxBarListProps {
  items: MxBarListItem[];
  /**
   * Denominateur de la largeur proportionnelle ET du libelle accessible par
   * defaut. Absent : somme des `value` de `items` (repartition qui couvre
   * 100% d'elle-meme, cas le plus courant — repartition de statuts).
   */
  total?: number;
  /** Rendu quand `items` est vide. Typiquement un <MxEmpty>. */
  empty?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Hauteur de piste : 6px, catalogue (L.828). Absente de l'echelle d'espacement (4/8/12...), litterale comme le 72px de MxTextArea. */
const TRACK_HEIGHT = 'calc(6px * var(--mx-scale, 1))';

export function MxBarList({ items, total, empty, className, style }: MxBarListProps) {
  const reduced = useMxReducedMotion();

  if (items.length === 0) {
    return empty != null ? <>{empty}</> : null;
  }

  const effectiveTotal = total ?? items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className={className}
      role="list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--mx-space-12)',
        ...style,
      }}
    >
      {items.map((item) => {
        const tone = item.tone ?? 'accent';
        const percent =
          effectiveTotal > 0 ? Math.min(100, Math.max(0, (item.value / effectiveTotal) * 100)) : 0;
        const defaultAriaLabel = `${typeof item.label === 'string' ? item.label : ''} : ${item.value} sur ${effectiveTotal}`;

        return (
          <div key={item.id} role="listitem" aria-label={item.ariaLabel ?? defaultAriaLabel}>
            <div
              aria-hidden="true"
              style={{ display: 'flex', flexDirection: 'column', gap: 'calc(5px * var(--mx-scale, 1))' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 'var(--mx-space-8)',
                }}
              >
                <span style={{ ...MX_TEXT.fieldLabel, color: 'var(--mx-text2)' }}>{item.label}</span>
                <span style={{ ...MX_TEXT.kvValue, color: 'var(--mx-text)', ...MX_TABULAR }}>
                  {item.displayValue}
                </span>
              </div>
              <div
                style={{
                  height: TRACK_HEIGHT,
                  background: 'var(--mx-border)',
                  borderRadius: 'var(--mx-radius-pill)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: MX_TONE_TEXT[tone],
                    borderRadius: 'var(--mx-radius-pill)',
                    transition: reduced ? 'none' : 'width var(--mx-dur-fast) var(--mx-ease-appear)',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MxBarList;
