import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { mxIconBox } from './internal/mxIcon';

/**
 * MxPageHeader — en-tete de page, calque sur « Titre de section » et
 * « Sous-titre de section » du catalogue
 * (reference/Mannyx Components V2.html, `.section-title` L.1885,
 * `.subsection-title` L.1886 ; docs/design/handoff-mannyx-ds/README.md,
 * tableau de la typographie, L.199/205).
 *
 * Remplace `aura/PageHeader` pour le tronc — decision de Greg (lot
 * "nav-primitives-3a", 2026-09-29), a la suite de l'audit A3 : sur les 9
 * layouts qui consomment `aura/PageHeader` aujourd'hui, SEULS 4 props sont
 * jamais utilises (`icon`, `title`, `subtitle`, `className="!mb-0"`) ;
 * `actions` n'est cable NULLE PART (GroundLayout le contourne par un `<div>`
 * externe pour poser ses boutons a cote du header) et `showEventBadge` est un
 * prop MORT dans `aura/PageHeader` lui-meme (jamais lu dans son JSX). Ni l'un
 * ni l'autre ne sont repris ici : `actions` est REELLEMENT cable, et
 * `showEventBadge` disparait.
 *
 * AUCUNE MARGE EXTERIEURE : contrairement a `aura/PageHeader` (`mb-6` par
 * defaut, que les 9 layouts annulent tous via `className="!mb-0"`), la
 * marge est la responsabilite du LAYOUT appelant, jamais du composant — ce qui
 * evite au 10e appelant de devoir, lui aussi, l'annuler.
 *
 * SOUS-TITRE AU-DESSUS DU TITRE (et non a cote, comme `aura/PageHeader`) :
 * decision de Greg, conforme a la hierarchie du catalogue (`.subsection-title`
 * PRECEDE `.section-title` dans la charte typographique).
 *
 * TRAIT FIXE (ne suit pas --mx-scale), meme famille que --mx-border-w/-thin,
 * le contour de focus et le soulignement de MxTabs (cf. C5, tokens-mx.css) :
 * le filet 3px sous le titre. `.section-title` est `display:inline-block` —
 * le filet ne souligne QUE le texte du titre, jamais l'icone ni les actions :
 * c'est pourquoi il est porte par le `<h1>` lui-meme, pas par la ligne
 * icone+titre qui l'enveloppe.
 */

export interface MxPageHeaderProps {
  title: string;
  /**
   * Icone Lucide — le COMPOSANT, jamais un element deja instancie : MxPageHeader
   * le rend lui-meme via `mxIconBox`. Absente du catalogue (qui ne specifie
   * que le texte du titre) : taille 'lg' choisie par coherence avec un titre
   * de 26px, sans mesure catalogue a l'appui — a confirmer en recette.
   */
  icon?: LucideIcon;
  /** Rendu AU-DESSUS du titre, style "sous-titre" du catalogue. */
  subtitle?: ReactNode;
  /** Aligne a droite. REELLEMENT cable (contrairement a aura/PageHeader). */
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function MxPageHeader({
  title,
  icon: Icon,
  subtitle,
  actions,
  className,
  style,
}: MxPageHeaderProps) {
  return (
    <header
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--mx-space-16)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--mx-space-4)',
        }}
      >
        {subtitle != null ? (
          <span
            style={{
              fontFamily: 'var(--mx-font-ui)',
              // 11px/800/0.14em/majuscules : --mx-fs-subtitle, DEJA PREPARE dans
              // tokens-mx.css pour cet usage exact (commentaire du token),
              // jusqu'ici sans consommateur.
              fontSize: 'var(--mx-fs-subtitle)',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--mx-text3)',
            }}
          >
            {subtitle}
          </span>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-8)' }}>
          {Icon ? (
            <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>
              <Icon style={mxIconBox('lg')} />
            </span>
          ) : null}
          <h1
            style={{
              margin: 0,
              display: 'inline-block',
              fontFamily: 'var(--mx-font-ui)',
              // 26px/700/-0.04em/majuscules : --mx-fs-section, DEJA PREPARE dans
              // tokens-mx.css pour cet usage exact (commentaire du token :
              // "drawer-title 26px/-0.02em" y est le second usage, distinct).
              fontSize: 'var(--mx-fs-section)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              textTransform: 'uppercase',
              color: 'var(--mx-text)',
              lineHeight: 1.1,
              // 10px : `.section-title{padding-bottom:10px}` du catalogue.
              // Absent de l'echelle --mx-space-* (qui passe de 8 a 12) ; la
              // valeur du catalogue prime sur l'arrondi, meme precedent que le
              // padding de MxTabs et le padding-left de MxSection.
              paddingBottom: 'calc(10px * var(--mx-scale, 1))',
              // 3px FIXE (trait) : voir le commentaire de tete de fichier.
              borderBottom: '3px solid var(--mx-accent)',
            }}
          >
            {title}
          </h1>
        </div>
      </div>
      {actions != null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-8)', flexShrink: 0 }}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export default MxPageHeader;
