import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { MX_TABULAR, MX_TEXT, MX_TONE_TEXT, type MxTone } from './tokens';
import { mxIconBox } from './internal/mxIcon';

export interface MxListItem {
  /** Cle React. Fournie par l'appelant (identifiant metier). */
  id: string;
  /**
   * Icone Lucide — le COMPOSANT, jamais un element deja instancie : la ligne
   * le rend elle-meme via `mxIconBox`, toujours en 'sm' (15px) — seule taille
   * demandee a ce jour (correction C1/C2 du lot "echelle et densite
   * d'affichage", 2026-09-29), en tete de ligne.
   */
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * Valeur alignee a droite (montant, quantite). Indispensable au grand livre
   * du pilote, qui affiche un montant par ligne.
   */
  value?: ReactNode;
  /** Chiffres alignes en colonne sur `value`. */
  tabular?: boolean;
  /** Badge en fin de ligne. */
  badge?: ReactNode;
  /** Colore l'ICONE dans la couleur pure du ton. Le fond de la ligne reste neutre. */
  tone?: MxTone;
}

interface MxListProps {
  items: MxListItem[];
  /** Rendu quand `items` est vide. Typiquement un <MxEmpty> ou un message. */
  empty?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxList — items NEUTRES detaches, separes par un vide de 8px.
 * Chaque ligne est sa propre carte (fond --mx-surface2, filet 1.5px, rayon 6px),
 * conformement a `.mx-dr-list` / `.mx-dr-list-item` du prototype de handoff, et
 * non une pile de lignes dans un conteneur unique.
 */
export function MxList({ items, empty, className, style }: MxListProps) {
  if (items.length === 0) {
    return empty != null ? <>{empty}</> : null;
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--mx-space-8)',
        ...style,
      }}
    >
      {items.map((item) => {
        const toneColor = item.tone ? MX_TONE_TEXT[item.tone] : undefined;
        const Icon = item.icon;

        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--mx-space-12)',
              padding: 'calc(10px * var(--mx-scale, 1)) var(--mx-space-12)',
              background: 'var(--mx-surface2)',
              border: 'var(--mx-border-w) solid var(--mx-border)',
              borderRadius: 'var(--mx-radius-6)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--mx-space-8)',
                minWidth: 0,
              }}
            >
              {Icon ? (
                <span
                  aria-hidden="true"
                  style={{ display: 'flex', flexShrink: 0, color: toneColor ?? 'var(--mx-text3)' }}
                >
                  <Icon style={mxIconBox('sm')} />
                </span>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    // 12.5/700 : taille du tronc, graisse du handoff. Sans le 700,
                    // le titre ne se distinguait plus de son sous-titre.
                    ...MX_TEXT.itemTitle,
                    color: 'var(--mx-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </span>
                {item.subtitle ? (
                  <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{item.subtitle}</span>
                ) : null}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--mx-space-8)',
                flexShrink: 0,
              }}
            >
              {item.badge}
              {item.value != null ? (
                <span
                  style={{
                    ...MX_TEXT.kvValue,
                    color: 'var(--mx-text)',
                    ...(item.tabular ? MX_TABULAR : null),
                  }}
                >
                  {item.value}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MxList;
