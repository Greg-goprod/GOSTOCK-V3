import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { MX_TEXT, MX_TONE_FILL, MX_TONE_TEXT, type MxTone } from './tokens';
import { mxIconBox, type MxIconSize } from './internal/mxIcon';

/**
 * ============================================================================
 * REGLE — la forme d'un message d'etat suit son ROLE, pas son ton, et elle est
 * IDENTIQUE dans les deux themes.
 *
 *   message BLOQUANT  (warning, danger) -> density="fill"
 *     Il empeche l'utilisateur d'avancer, il doit s'imposer. Aplat du ton.
 *     Dans le pilote : no_config, no_canton, no_scale, no_fee (warning) et
 *     error (danger).
 *
 *   message INFORMATIF (neutral) -> density="plain"
 *     Il renseigne sans bloquer. Texte nu.
 *     Dans le pilote : resolving_scale, no_fx.
 *
 * Deux raisons de trancher par le role. D'abord un seul etat de calc.kind
 * s'affiche a la fois, ils sont mutuellement exclusifs : il n'y a donc jamais
 * deux messages a hierarchiser cote a cote. Ensuite le danger doit etre au
 * moins aussi visible que le warning, sinon la hierarchie s'inverse — ce qui
 * arrive fatalement si le warning est un aplat et le danger du texte nu.
 *
 * ECART AU HANDOFF — VALIDE PAR GREG LE 2026-09-23. L'aplat plein est conserve,
 * la question est close.
 * Le handoff prevoit du TEXTE NU pour tous les messages tones (`note` : « message
 * tone avec icone »). L'ecart est impose par la colorimetrie, pas par le gout :
 * l'ambre du handoff est illisible en texte nu sur fond clair (1.51 sur
 * --mx-surface2) et le gamut sRGB interdit toute variante ambre qui tienne AA —
 * l'assombrir la fait virer au kaki, la saturer la fait virer a l'orange, donc au
 * danger. L'aplat resout les deux : la couleur passe en fond, ou elle reste vive,
 * et le contraste du texte ne depend plus de la surface de la page (ambre 11.56,
 * danger 4.98 en light).
 * ============================================================================
 */

/**
 * Forme du message.
 *   plain — DEFAUT. Texte en couleur pure du ton, sans fond ni boite. Forme des
 *           messages INFORMATIFS.
 *   fill  — APLAT du ton : fond en couleur pleine, texte en --mx-tone-on-<ton>.
 *           Forme des messages BLOQUANTS.
 *
 * `boxed` A ETE RETIRE — arbitrage de Greg du 2026-09-23. Ne pas le remettre.
 * C'etait une EXTENSION du projet : un encart neutre (fond --mx-muted-box,
 * filet --mx-border) que le handoff ne prevoit nulle part pour un message
 * tone. Il faisait doublon avec MxKVGroup, qui EST l'encart neutre du handoff
 * (`.mx-dr-muted`), et il brouillait la regle de forme ci-dessus en offrant
 * une troisieme voie entre « bloquant » et « informatif ». Seuls deux sites de
 * demonstration l'employaient, aucun site de production.
 */
export type MxNoteDensity = 'plain' | 'fill';

/**
 * Couple ton/forme, en UNION DISCRIMINEE : le type interdit a la compilation les
 * combinaisons que la colorimetrie rend inacceptables.
 *
 * Le warning n'admet que l'APLAT. Sa couleur de texte en light
 * (--mx-tone-text-warning) est un ambre assombri jusqu'a AA, qui vire au kaki, et
 * le gamut sRGB n'offre aucune alternative : ni plus clair, il tombe sous AA, ni
 * plus sature, il se confond avec le danger. La forme est donc contrainte, et la
 * densite est REQUISE pour ce ton afin qu'aucun defaut implicite ne la
 * contourne.
 *
 * Les cinq autres tons gardent les deux formes. Le danger en texte nu est
 * lisible dans les deux themes (6.00 en dark, 4.61 en light sur --mx-surface2) et
 * a des usages legitimes, une erreur sous un champ par exemple.
 */
export type MxNoteToneForm =
  | { tone: 'warning'; density: 'fill' }
  | { tone: Exclude<MxTone, 'warning'>; density?: MxNoteDensity };

interface MxNoteBaseProps {
  /**
   * Icone Lucide — le COMPOSANT, jamais un element deja instancie : la
   * primitive le rend elle-meme via `mxIconBox`, dans la couleur pure du ton
   * (correction C1/C2 du lot "echelle et densite d'affichage", 2026-09-29).
   */
  icon?: LucideIcon;
  /**
   * Taille de l'icone. Defaut 'sm' (15px) : arrondi des 14px que porte la
   * quasi-totalite des sites d'appel de production (SettlementDrawerMx).
   * 'xs' (13px) pour les rares sites deja a cette taille (ex. recouvrement de
   * tranche, meme fichier ; MxPreview, demo).
   */
  size?: MxIconSize;
  /** Titre appuye, au-dessus du corps. */
  title?: ReactNode;
  children?: ReactNode;
  /** Slot d'actions en pied de note. */
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

type MxNoteProps = MxNoteBaseProps & MxNoteToneForm;

/**
 * MxNote — message tone. Voir la REGLE en tete de fichier pour le choix de la
 * forme.
 * Aucun fond DELAVE, quelle que soit la forme : un ton se pose en aplat plein ou
 * en texte nu. La piste des fonds teintes lavés en color-mix a ete construite
 * puis abandonnee, le handoff ne la demande nulle part.
 */
export function MxNote({
  tone,
  density = 'plain',
  icon: Icon,
  size = 'sm',
  title,
  children,
  actions,
  className,
  style,
}: MxNoteProps) {
  // En aplat, la couleur du ton passe en FOND : le texte et l'icone prennent le
  // contraste du ton, pas sa teinte.
  //
  // AUDIT C2.2 (LOT BOOKING-DRAWERS-FIN, LOT 2, 2026-10-23), PAS DE CHANGEMENT
  // ICI -- `.mx-dr-note` du handoff (reference/mannyx-drawer.js L.70-72) colore
  // son texte/icone avec `var(--_line)` (`MX_TONE_LINE`, tokens.ts), pas
  // `MX_TONE_TEXT`. Les deux coincident pour 5 tons sur 6 (warning, danger,
  // success, info, accent) ; seul `neutral` differe :
  // `--mx-tone-line-neutral` = `--mx-border` (#E2E3E9 clair), calcule a ~1.1:1
  // de contraste sur `--mx-surface` -- tres en dessous du plancher AA (4.5:1),
  // illisible en texte de paragraphe. Suivre le handoff a la lettre ici
  // degraderait la lisibilite de tous les `MxNote tone="neutral"` deja en
  // production (SettlementDrawerMx, ExtendOfferDrawerMx, OffersPageViewMx).
  // NON applique -- `MX_TONE_TEXT` conserve pour les 6 tons. Signale a Greg
  // (rapport du lot), pas un choix autonome : le handoff ne prevoit
  // probablement jamais de note `neutral` en texte nu dans son propre
  // prototype (seul `--_line` sert de filet de section 3px ailleurs), ce que
  // cette primitive expose en le branchant sur un VRAI texte.
  const color = density === 'fill' ? MX_TONE_FILL[tone].fg : MX_TONE_TEXT[tone];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--mx-space-8)',
        color,
        ...(density === 'fill'
          ? {
              // Rayon 8px : le README range les encarts avec les boutons de
              // drawer. Pas de bordure, l'aplat se detache par sa couleur.
              padding: 'var(--mx-space-8) var(--mx-space-12)',
              borderRadius: 'var(--mx-radius-8)',
              background: MX_TONE_FILL[tone].bg,
            }
          : null),
        ...style,
      }}
    >
      {Icon ? (
        // marginTop : cale l'icone sur la ligne de base du premier texte plutot
        // que sur le haut du bloc.
        <span
          style={{ display: 'flex', flexShrink: 0, marginTop: 'calc(3px * var(--mx-scale, 1))' }}
          aria-hidden="true"
        >
          <Icon style={{ ...mxIconBox(size), color }} />
        </span>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--mx-space-4)',
          minWidth: 0,
          flex: 1,
        }}
      >
        {title ? <span style={{ ...MX_TEXT.noteTitle, color }}>{title}</span> : null}
        {children ? (
          <div style={{ ...MX_TEXT.meta, lineHeight: 1.5, fontWeight: 600, color }}>{children}</div>
        ) : null}
        {actions ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--mx-space-8)',
              marginTop: 'var(--mx-space-4)',
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default MxNote;
