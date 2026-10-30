import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { MX_TEXT, MX_TONE_TEXT, type MxTone } from './tokens';
import { mxIconBox } from './internal/mxIcon';

interface MxEmptyProps {
  icon?: LucideIcon;
  iconTone?: MxTone;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /**
   * `comfortable` (defaut) = variante PAR DEFAUT : centree, pastille ronde,
   * pleine surface. `compact` = variante COMPACTE : une ligne, entre deux
   * filets fins (voir doctrine ci-dessous).
   */
  density?: 'compact' | 'comfortable';
  className?: string;
  style?: CSSProperties;
}

/**
 * MxEmpty — etat vide du tronc. Decision de Greg, LOT TRONC-ETATS-VIDES
 * (2026-10-05) : voir docs/design/handoff-mannyx-ds/DOCTRINE-ETATS-VIDES.md
 * pour les TROIS roles d'etat vide et la regle des pointilles.
 *
 * ECART AU HANDOFF, DEFINITIF — la carte en pointilles (`.mx-dr-empty` du
 * prototype, filet --mx-dashed 1.5px, rayon 10px) est ABANDONNEE pour
 * `MxEmpty`. Les pointilles sont desormais RESERVES a `MxDropzone` (depot de
 * fichiers) — c'est la SEULE primitive du tronc qui les porte encore. Ne pas
 * les reintroduire ici au pretexte d'un retour au handoff.
 *
 * Deux variantes, choisies par `density` :
 *
 *   comfortable (DEFAUT) — centree, SANS cadre : une pastille ronde (fond
 *   --mx-surface, filet 1px --mx-border, PAS --mx-border-w : la pastille est
 *   un repere discret, pas une bordure de carte) porte l'icone, suivie du
 *   titre, de la description et d'une action facultative. Pour un grand
 *   espace vide (onglet de drawer entier, page de liste).
 *
 *   compact — une seule LIGNE (icone discrete + texte secondaire + action
 *   facultative en fin de ligne), encadree par deux filets fins
 *   (--mx-border-w --mx-border, comme `MxDivider`). Pour un etat vide
 *   insere entre d'autres blocs (widget de tableau de bord, sous-section de
 *   drawer).
 *
 * Un MANQUE IMPORTANT a signaler (ex. aucun agent de booking) n'est PAS un
 * etat vide : voir `MxNote` (tone `info`/`warning`), pas `MxEmpty`.
 */
export function MxEmpty({
  icon: Icon,
  iconTone,
  title,
  description,
  actions,
  density = 'comfortable',
  className,
  style,
}: MxEmptyProps) {
  const iconColor = iconTone ? MX_TONE_TEXT[iconTone] : 'var(--mx-text3)';

  if (density === 'compact') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mx-space-8)',
          padding: 'var(--mx-space-8) 0',
          borderTop: 'var(--mx-border-w) solid var(--mx-border)',
          borderBottom: 'var(--mx-border-w) solid var(--mx-border)',
          ...style,
        }}
      >
        {Icon ? (
          <span style={{ display: 'flex', flexShrink: 0, color: iconColor }} aria-hidden="true">
            <Icon style={mxIconBox('sm')} />
          </span>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-4)', minWidth: 0, flex: 1 }}>
          <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{title}</span>
          {description ? (
            <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{description}</span>
          ) : null}
        </div>
        {actions ? <div style={{ display: 'flex', flexShrink: 0, gap: 'var(--mx-space-8)' }}>{actions}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'calc(10px * var(--mx-scale, 1))',
        padding: 'calc(20px * var(--mx-scale, 1)) calc(18px * var(--mx-scale, 1))',
        ...style,
      }}
    >
      {Icon ? (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'calc(40px * var(--mx-scale, 1))',
            height: 'calc(40px * var(--mx-scale, 1))',
            borderRadius: 'var(--mx-radius-pill)',
            background: 'var(--mx-surface)',
            border: '1px solid var(--mx-border)',
            color: iconColor,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Icon style={mxIconBox('xl')} />
        </span>
      ) : null}
      <div style={{ ...MX_TEXT.body, fontWeight: 700, color: 'var(--mx-text2)' }}>{title}</div>
      {description ? (
        <div style={{ ...MX_TEXT.help, lineHeight: 1.5, color: 'var(--mx-text3)', maxWidth: '46ch' }}>{description}</div>
      ) : null}
      {actions ? <div style={{ display: 'flex', gap: 'var(--mx-space-8)' }}>{actions}</div> : null}
    </div>
  );
}

export default MxEmpty;
