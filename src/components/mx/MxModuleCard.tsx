import { useState, type CSSProperties, type ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

import { MX_TABULAR, MX_TEXT } from './tokens';
import { mxIconBox } from './internal/mxIcon';
import { useMxReducedMotion } from './internal/useMxReducedMotion';

/**
 * MxModuleCard — carte module cliquable (tableau de bord), LOT PAGE-DASHBOARD
 * B1 (2026-10-02).
 *
 * Source qui fait foi : reference/Mannyx Components V2.html, section
 * `#s-cards` (L.549-591), sous-titre « Carte module (Dashboard) » — VARIANTE
 * STANDARD seulement (pastille icone + titre + lignes metrique). Les 2 autres
 * variantes du catalogue (bordure superieure coloree, carte "stat focale" a
 * barre de progression) ne sont pas implementees ici : aucun consommateur ne
 * les demande (`/app` n'utilise que la variante standard) — meme regle de
 * bornage que MxButton/MxTextField.
 *
 * INDEPENDANT DU ROUTEUR, meme patron que `renderLink` de MxTabs : la
 * primitive calcule l'etat (survol, focus, `data-mx-focus`) et delegue le
 * rendu de l'element cliquable a l'appelant, qui y enveloppe son propre
 * `<Link>` (react-router). Une SEULE carte par appel (pas une liste
 * d'`item`/`renderLink(item, linkProps)` comme MxTabs) : `renderLink` ne
 * prend que `linkProps`.
 *
 * ACCENT UNIQUE — decision de Greg, LOT PAGE-DASHBOARD B (2026-10-02) : les 8
 * teintes Tailwind par module de l'ancienne page (violet/bleu/ambre/
 * emeraude/rose/cyan/orange/ardoise) ne correspondent a aucun des 6 MxTone du
 * tronc, et le tronc n'a pas de notion de « couleur de module ». La pastille
 * d'icone est donc TOUJOURS en --mx-accent — meme couple de tokens que la
 * variante `accentSoft` de MxButton (fond --mx-accent-lt, icone --mx-accent) :
 * un « voile transparent », pas un fond delave (cf. le commentaire de
 * MxButton sur --mx-accent-lt, qui survit a l'abandon de cette famille).
 *
 * PAS DE PIED « Ouvrir → » — present sur UNE SEULE des 3 variantes du
 * catalogue (celle-ci), absent du site d'appel actuel (toute la carte est
 * deja le lien, le pied serait une redite) et non demande par Greg au B1.
 *
 * LIGNES METRIQUE : PAS MxKV tel quel — equivalent construit ici avec les
 * MEMES presets (`MX_TEXT.fieldLabel`/`kvValue` + `MX_TABULAR`), parce que
 * MxKV n'a pas de notion de ligne EN COURS DE CHARGEMENT (`aria-busy` +
 * `Loader2` a la place de la valeur) : ajouter cet etat a MxKV changerait une
 * primitive deja consommee ailleurs (SettlementDrawerMx) pour un besoin d'un
 * seul appelant. Greg l'autorise explicitement (« MxKV OU equivalent du
 * catalogue »).
 *
 * SPIN NON SUSPENDU SOUS MOUVEMENT REDUIT — meme precedent que
 * `MxLoadingLine` : un rouet de chargement communique un etat FONCTIONNEL
 * (une donnee arrive), pas une animation decorative ; seul le survol/focus de
 * la carte (deplacement, purement decoratif) est suspendu.
 */

export interface MxModuleCardMetric {
  /** Cle React. Fournie par l'appelant (identifiant metier). */
  id: string;
  label: string;
  value: ReactNode;
  /** Ligne EN COURS DE CHARGEMENT : `Loader2` a la place de `value`, `aria-busy`. */
  loading?: boolean;
}

export interface MxModuleCardLinkProps {
  style: CSSProperties;
  /** Nom accessible du lien = le TITRE de la carte, jamais le contenu des
   *  lignes metrique (sans quoi un lecteur d'ecran annoncerait toute la carte
   *  comme texte de lien). */
  'aria-label': string;
  'data-mx-focus': string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  children: ReactNode;
}

export interface MxModuleCardProps {
  /** Icone Lucide — le COMPOSANT, jamais un element deja instancie : la carte
   *  le rend elle-meme via `mxIconBox`, toujours en 'sm' (15px) — taille EXACTE
   *  du catalogue (svg 15x15 L.556). */
  icon: LucideIcon;
  title: string;
  metrics: MxModuleCardMetric[];
  /** Rend l'element cliquable final (typiquement un `<Link to=...>`), avec
   *  `linkProps` etale dessus — meme patron que `renderLink` de MxTabs. */
  renderLink: (linkProps: MxModuleCardLinkProps) => ReactNode;
  style?: CSSProperties;
}

export function MxModuleCard({
  icon: Icon,
  title,
  metrics,
  renderLink,
  style,
}: MxModuleCardProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useMxReducedMotion();

  return renderLink({
    style: {
      display: 'flex',
      flexDirection: 'column',
      // 18px : padding de la carte module du catalogue (L.554), distinct des
      // 20px generiques de `.card` — la valeur du site specifique prime sur le
      // generique, meme precedent que --mx-space-14 de MxSection/MxTabs.
      padding: 'calc(18px * var(--mx-scale, 1))',
      background: 'var(--mx-surface)',
      border: 'var(--mx-border-w) solid ' + (hovered ? 'var(--mx-accent)' : 'var(--mx-border)'),
      borderRadius: 'var(--mx-radius-10)',
      boxShadow: focused ? 'var(--mx-shadow), var(--mx-focus-ring)' : 'var(--mx-shadow)',
      textDecoration: 'none',
      cursor: 'pointer',
      // Soulevement au survol : meme micro-interaction que MxButton (seule
      // reference tronc pour une surface cliquable). Supprime en mouvement
      // reduit, position finale conservee (meme garde que MxButton).
      transform: reduced ? 'none' : hovered ? 'translateY(-2px)' : 'none',
      transition: reduced
        ? 'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)'
        : 'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear), transform var(--mx-dur-fast) var(--mx-ease-spring)',
      ...style,
    },
    'aria-label': title,
    'data-mx-focus': '',
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    children: (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mx-space-8)',
            // 14px : ecart pastille+titre -> premiere ligne metrique, `.card`
            // du catalogue (L.556 `margin-bottom:14px`).
            marginBottom: 'calc(14px * var(--mx-scale, 1))',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              // 30px : pastille icone du catalogue (L.556), absente de
              // l'echelle --mx-space-*.
              width: 'calc(30px * var(--mx-scale, 1))',
              height: 'calc(30px * var(--mx-scale, 1))',
              borderRadius: 'var(--mx-radius-4)',
              background: 'var(--mx-accent-lt)',
              color: 'var(--mx-accent)',
            }}
          >
            <Icon style={mxIconBox('sm')} />
          </span>
          <span style={{ ...MX_TEXT.itemTitle, color: 'var(--mx-text)' }}>{title}</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            // 7px : ecart entre lignes metrique, `.card` du catalogue (L.561-563).
            gap: 'calc(7px * var(--mx-scale, 1))',
          }}
        >
          {metrics.map((metric) => (
            <div
              key={metric.id}
              aria-busy={metric.loading || undefined}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 'var(--mx-space-12)',
              }}
            >
              <span style={{ ...MX_TEXT.fieldLabel, color: 'var(--mx-text3)' }}>{metric.label}</span>
              {metric.loading ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  style={{ ...mxIconBox('xs'), color: 'var(--mx-text3)' }}
                />
              ) : (
                <span style={{ ...MX_TEXT.kvValue, color: 'var(--mx-text)', ...MX_TABULAR }}>
                  {metric.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </>
    ),
  });
}

export default MxModuleCard;
