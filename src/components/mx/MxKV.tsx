import type { CSSProperties, ReactNode } from 'react';

import { MX_TABULAR, MX_TEXT } from './tokens';

interface MxKVProps {
  label: ReactNode;
  value: ReactNode;
  /**
   * @deprecated Sans effet : les chiffres tabulaires sont desormais TOUJOURS
   * appliques, comme `.mx-dr-kv-row dd` du handoff. La prop reste acceptee pour
   * ne pas casser les sites d'appel existants ; ne plus la poser sur du neuf.
   */
  tabular?: boolean;
  /** Met la valeur en avant (total, ligne de synthese). */
  strong?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxKV — ligne cle/valeur alignee sur la ligne de base.
 * Remplace le helper local `Field` du drawer pilote.
 *
 * Aligne sur `.mx-dr-kv-row` : cle en --mx-text3, valeur en --mx-text, chiffres
 * tabulaires systematiques.
 *
 * Les tailles et graisses restent celles du tronc (decision du 2026-09-23) : le
 * handoff demande 12/600 pour la cle et 13/700 pour la valeur, on garde
 * 12.5/500 et 12.5/600. L'ecart de graisse entre cle et valeur est conserve,
 * c'est lui qui porte la hierarchie.
 *
 * FILET DE SEPARATION — pose en CSS, pas ici. `.mx-dr-kv-row` porte un filet
 * de 1.5px sous chaque ligne sauf la derniere : une position relative entre
 * freres, qu'un style en ligne ne sait pas exprimer. C'est la 2e des deux
 * exceptions a la regle « zero CSS dans le tronc », accordee par Greg le
 * 2026-09-23 ; la regle vit dans src/styles/tokens-mx.css, section
 * « EXCEPTIONS A LA REGLE ZERO CSS », et s'appuie sur les classes ci-dessous.
 *
 * LA CLASSE `mx-kv` EST UN POINT D'ANCRAGE, PAS UNE DECORATION : la supprimer
 * ou la renommer fait disparaitre le filet sans aucune erreur. Elle est
 * fusionnee avec le `className` de l'appelant, jamais remplacee par lui.
 */
export function MxKV({ label, value, strong, className, style }: MxKVProps) {
  return (
    <div
      className={className ? `mx-kv ${className}` : 'mx-kv'}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--mx-space-12)',
        ...style,
      }}
    >
      {/* --mx-text3 et non --mx-text2 : couleur de `.mx-dr-kv-row dt`. La cle
          d'une ligne cle/valeur est plus effacee qu'un label de champ. */}
      <span style={{ ...MX_TEXT.fieldLabel, color: 'var(--mx-text3)' }}>{label}</span>
      <span
        style={{
          ...(strong ? MX_TEXT.blockTitle : MX_TEXT.kvValue),
          color: 'var(--mx-text)',
          textAlign: 'right',
          // Systematique, comme au handoff. Sans alignement des chiffres, une
          // colonne de montants ne se lit pas verticalement. Sans effet sur du
          // texte : tabular-nums ne touche que les chiffres.
          ...MX_TABULAR,
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface MxKVGroupProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxKVGroup — encart NEUTRE regroupant des lignes cle/valeur.
 * Fond --mx-muted-box (et non --mx-surface2) : c'est le fond des encarts neutres
 * du handoff, `.mx-dr-muted`.
 *
 * A SAVOIR : ce composant fusionne DEUX blocs du handoff — `.mx-dr-muted`
 * (l'encart neutre) et `.mx-dr-kv` (la pile de lignes cle/valeur). Le pilote
 * s'en sert comme d'un encart generique : ses trois groupes contiennent aussi
 * des MxDivider, des MxBadge et des MxNote. C'est cette fusion qui interdit de
 * poser le filet par cloneElement — la position injectee atterrirait dans un
 * MxDivider — et qui a impose de passer par le selecteur de frere adjacent.
 *
 * LA CLASSE `mx-kv-group` EST UN POINT D'ANCRAGE, PAS UNE DECORATION : elle
 * borne le filet a l'interieur du groupe. La supprimer fait disparaitre le
 * filet sans aucune erreur.
 */
export function MxKVGroup({ children, className, style }: MxKVGroupProps) {
  return (
    <div
      className={className ? `mx-kv-group ${className}` : 'mx-kv-group'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--mx-space-8)',
        // 14px : padding de `.mx-dr-muted`. Pas un token, l'echelle passant de
        // 12 a 16 ; la valeur du handoff prime sur l'arrondi.
        padding: 'calc(14px * var(--mx-scale, 1))',
        borderRadius: 'var(--mx-radius-8)',
        border: 'var(--mx-border-w) solid var(--mx-border)',
        background: 'var(--mx-muted-box)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default MxKV;
